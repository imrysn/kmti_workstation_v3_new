import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useModal } from './ModalContext'
import { broadcastApi, SERVER_BASE } from '../services/api'
import { io } from 'socket.io-client'
import megaphoneIcon from '../assets/megaphone-icon.png'
import './BroadcastFAB.css'

interface Position {
  x: number
  y: number
}

const BroadcastFAB: React.FC = () => {
  const { hasRole } = useAuth()
  const { notify } = useModal()

  // Default position: Bottom-Left. Resetting every refresh as requested.
  const [position, setPosition] = useState<Position>({ 
    x: 32, 
    y: window.innerHeight - 80 
  })

  const [isDragging, setIsDragging] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [activeView, setActiveView] = useState<'new' | 'history'>('new')
  const [history, setHistory] = useState<any[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [expansionQuadrant, setExpansionQuadrant] = useState({ x: 'left', y: 'top' })
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState<'info' | 'warning' | 'danger'>('info')
  const [isSending, setIsSending] = useState(false)
  const [ackingId, setAckingId] = useState<number | null>(null)
  const [acksMap, setAcksMap] = useState<Record<number, any[]>>({})

  const fabRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dragStartPos = useRef<{ x: number, y: number }>({ x: 0, y: 0 })
  const hasMovedRef = useRef(false)

  const playAckAlert = () => {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const now = ctx.currentTime
      
      const playChirp = (time: number, freq: number) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.setValueAtTime(freq, time)
        gain.gain.setValueAtTime(0.1, time)
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1)
        osc.start(time)
        osc.stop(time + 0.1)
      }

      playChirp(now, 880)
      playChirp(now + 0.15, 1100)
    } catch (e) {}
  }

  // Socket listener for real-time acknowledgment alerts
  useEffect(() => {
    console.log('[BROADCAST] Connecting to real-time alert engine...')
    const socket = io(SERVER_BASE, {
      path: '/socket.io',
      // polling-first: Initial HTTP handshake bypasses WebSocket CORS checks
      // then automatically upgrades to WebSocket after session is established
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 10,
    })

    socket.on('connect', () => {
      console.log('[BROADCAST] Alert engine linked.')
    })

    socket.on('broadcast_acknowledged', (data: any) => {
      playAckAlert()
      // Refresh history if open to show newest acks in real-time
      // Note: We use the *current* state by checking the condition inside the event handler
      // Or we can rely on the server broadcast to trigger a fetch
      window.dispatchEvent(new CustomEvent('kmti:broadcast-update', { detail: data }))
      notify(`${data.workstation} acknowledged the broadcast.`, 'success')
    })

    socket.on('connect_error', (err) => {
      console.error('[BROADCAST] Link Error:', err.message)
    })

    return () => {
      socket.disconnect()
    }
  }, []) // Empty dependency array = only connect once on mount

  // Secondary effect to refresh history when event fires
  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (isPanelOpen && activeView === 'history') {
        fetchHistory()
      }
      
      // If the admin is actively looking at the acks for the exact broadcast that was just acknowledged,
      // silently fetch the fresh data so it updates in real-time.
      if (e.detail && e.detail.id === ackingId) {
        broadcastApi.getAcks(e.detail.id).then(res => {
          setAcksMap(prev => ({ ...prev, [e.detail.id]: res.data.data }))
        }).catch(() => {})
      }
    }
    window.addEventListener('kmti:broadcast-update', handleUpdate)
    return () => window.removeEventListener('kmti:broadcast-update', handleUpdate)
  }, [isPanelOpen, activeView, ackingId])


  // Handle window resizing
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => ({
        x: Math.min(prev.x, window.innerWidth - 80),
        y: Math.min(prev.y, window.innerHeight - 80)
      }))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const fetchHistory = async () => {
    setIsLoadingHistory(true)
    try {
      const res = await broadcastApi.list()
      setHistory(res.data.data)
    } catch (err) {
      console.error('Failed to fetch history:', err)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await broadcastApi.delete(id)
      notify('Broadcast retired.', 'success')
      fetchHistory()
    } catch (err) {
      notify('Failed to delete.', 'error')
    }
  }

  useEffect(() => {
    if (isPanelOpen && activeView === 'history') {
      fetchHistory()
    }
    if (isPanelOpen && activeView === 'new') {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [isPanelOpen, activeView])

  const handleMouseDown = (e: React.MouseEvent) => {
    hasMovedRef.current = false
    dragStartPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    }
    e.preventDefault()
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragStartPos.current.x === 0 && dragStartPos.current.y === 0) return

      const deltaX = Math.abs(e.clientX - (dragStartPos.current.x + position.x))
      const deltaY = Math.abs(e.clientY - (dragStartPos.current.y + position.y))

      if (!hasMovedRef.current && (deltaX > 8 || deltaY > 8)) {
        hasMovedRef.current = true
        setIsDragging(true)
      }

      if (hasMovedRef.current) {
        const newX = Math.min(Math.max(20, e.clientX - dragStartPos.current.x), window.innerWidth - 60)
        const newY = Math.min(Math.max(40, e.clientY - dragStartPos.current.y), window.innerHeight - 60)
        setPosition({ x: newX, y: newY })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragStartPos.current = { x: 0, y: 0 }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [position])

  // Click outside to close handle
  useEffect(() => {
    if (!isPanelOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsPanelOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isPanelOpen])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    setIsSending(true)
    try {
      const formData = new FormData()
      formData.append('message', message)
      formData.append('severity', severity)
      formData.append('duration_minutes', '0') // 0 = No expiry, manual ack required

      await broadcastApi.create(formData)
      notify('Broadcast sent successfully!', 'success')
      setMessage('')
      setIsPanelOpen(false)
    } catch (err) {
      notify('Failed to send broadcast.', 'error')
    } finally {
      setIsSending(false)
    }
  }




  const fetchAcks = async (id: number) => {
    // If it's already open, simply toggle it closed
    if (ackingId === id) {
      setAckingId(null)
      return
    }

    setIsLoadingHistory(true)
    try {
      // Force fetching fresh data every time we open the dropdown
      const res = await broadcastApi.getAcks(id)
      setAcksMap(prev => ({ ...prev, [id]: res.data.data }))
      setAckingId(id)
    } catch (e) {
      notify("Failed to fetch acknowledgments", "error")
    } finally {
      setIsLoadingHistory(false)
    }
  }

  if (!hasRole('admin', 'it')) return null

  return (
    <>
      {!isPanelOpen && (
        <div
          ref={fabRef}
          className={`broadcast-fab ${isDragging ? 'dragging' : ''}`}
          style={{ left: position.x, top: position.y }}
          onMouseDown={handleMouseDown}
          onClick={() => {
            if (!hasMovedRef.current) {
              setExpansionQuadrant({
                x: position.x > window.innerWidth / 2 ? 'right' : 'left',
                y: position.y > window.innerHeight / 2 ? 'bottom' : 'top'
              })
              setIsPanelOpen(true)
            }
          }}
          title="Broadcast Message"
        >
          <div className="broadcast-fab-inner">
            <img src={megaphoneIcon} alt="Broadcast" className="broadcast-fab-img" />
          </div>
          {isDragging && <div className="broadcast-fab-drag-indicator">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>}
        </div>
      )}

      {isPanelOpen && (
        <div
          ref={panelRef}
          className={`broadcast-manager-panel ${isDragging ? 'dragging' : ''}`}
          style={{
            left: position.x,
            top: position.y,
            // Inline variables for the @keyframes animation
            '--tx-start': expansionQuadrant.x === 'right' ? '-100%' : '0%',
            '--ty-start': expansionQuadrant.y === 'bottom' ? '-90%' : '10%',
            '--tx-end': expansionQuadrant.x === 'right' ? '-100%' : '0%',
            '--ty-end': expansionQuadrant.y === 'bottom' ? '-100%' : '0%',
            transform: `translate(${expansionQuadrant.x === 'right' ? '-100%' : '0%'}, ${expansionQuadrant.y === 'bottom' ? '-100%' : '0%'})`,
            transformOrigin: `${expansionQuadrant.x} ${expansionQuadrant.y}`
          } as React.CSSProperties}
        >
          <div className="bm-header" onMouseDown={handleMouseDown}>
            <h3>BROADCAST CENTER</h3>
            <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={() => setIsPanelOpen(false)}>×</button>
          </div>

          <div className="bm-tabs">
            <button type="button" className={`bm-tab ${activeView === 'new' ? 'active' : ''}`} onClick={() => setActiveView('new')}>New Message</button>
            <button type="button" className={`bm-tab ${activeView === 'history' ? 'active' : ''}`} onClick={() => setActiveView('history')}>History</button>
          </div>

          {activeView === 'new' ? (
            <form className="bm-form" onSubmit={handleSend}>
              <div className="bm-grid">
                <div className="bm-field">
                  <label>Type</label>
                  <select value={severity} onChange={(e) => setSeverity(e.target.value as any)}>
                    <option value="info">Information</option>
                    <option value="warning">Warning</option>
                    <option value="danger">Danger</option>
                  </select>
                </div>
              </div>

              <div className="bm-field">
                <label>Message</label>
                <textarea
                  ref={textareaRef}
                  placeholder="Type urgent message here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={400}
                  required
                />
              </div>

              <div className="bm-actions">
                <button type="submit" className="bm-btn-send" disabled={isSending || !message.trim()}>
                  {isSending ? 'SENDING...' : 'BROADCAST'}
                </button>
              </div>
            </form>
          ) : (
            <div className="bm-history">
              {isLoadingHistory ? (
                <div className="bm-loading">Loading History...</div>
              ) : history.length === 0 ? (
                <div className="bm-empty">No previous broadcasts</div>
              ) : (
                <div className="bm-list">
                  {history.map(item => (
                    <div key={item.id} className={`bm-item sev-${item.severity}`}>
                      <div className="bm-item-header">
                        <span className="bm-item-author">{item.created_by}</span>
                        <span className="bm-item-date">{new Date(item.created_at).toLocaleDateString()}</span>
                        <div className="bm-item-actions">
                          <button type="button" className="bm-item-acks" onClick={() => fetchAcks(item.id)}>Acks</button>
                          <button type="button" className="bm-item-del" onClick={() => handleDelete(item.id)}>Delete</button>
                        </div>
                      </div>
                      <div className="bm-item-msg">{item.message}</div>

                      {ackingId === item.id && (
                        <div className="bm-acks-list">
                          {acksMap[item.id]?.length === 0 ? (
                            <div className="bm-ack-none">No acknowledgments yet</div>
                          ) : (
                            acksMap[item.id]?.map(ack => (
                              <div key={ack.id} className="bm-ack-item">
                                <strong>{ack.workstation}</strong>
                                <span>{ack.username} @ {new Date(ack.acknowledged_at).toLocaleTimeString()}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </>
  )
}

export default BroadcastFAB
