import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useModal } from './ModalContext'
import { broadcastApi } from '../services/api'
import megaphoneIcon from '../assets/megaphone-icon.png'
import './BroadcastFAB.css'

interface Position {
  x: number
  y: number
}

const BroadcastFAB: React.FC = () => {
  const { hasRole } = useAuth()
  const { notify } = useModal()
  const [position, setPosition] = useState<Position>({ x: 32, y: window.innerHeight - 80 })
  const [isDragging, setIsDragging] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [expansionQuadrant, setExpansionQuadrant] = useState({ x: 'left', y: 'top' })
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState<'info' | 'warning' | 'danger'>('info')
  const [isSending, setIsSending] = useState(false)

  const fabRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const dragStartPos = useRef<{ x: number, y: number }>({ x: 0, y: 0 })
  const hasMovedRef = useRef(false)


  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    hasMovedRef.current = false
    dragStartPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    }
    e.preventDefault()
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return

      const newX = Math.min(Math.max(20, e.clientX - dragStartPos.current.x), window.innerWidth - 60)
      const newY = Math.min(Math.max(40, e.clientY - dragStartPos.current.y), window.innerHeight - 60)

      if (Math.abs(e.clientX - (dragStartPos.current.x + position.x)) > 5 ||
        Math.abs(e.clientY - (dragStartPos.current.y + position.y)) > 5) {
        hasMovedRef.current = true
      }

      const newPos = { x: newX, y: newY }
      setPosition(newPos)
    }

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false)
      }
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, position])

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
      formData.append('duration_minutes', '60') // Hardcoded availability window

      await broadcastApi.create(formData)
      notify('Broadcast sent successfully!', 'success')
      setMessage('')
      setIsPanelOpen(false)
      // Broadcast will appear on next poll (60s) or we can trigger a refresh via context if needed
      // Currently, it will appear on next poll.
    } catch (err) {
      notify('Failed to send broadcast.', 'error')
    } finally {
      setIsSending(false)
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
            if (!isDragging && !hasMovedRef.current) {
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
            // Locked Quadrant Logic (Prevents jumping during drag)
            transform: `${expansionQuadrant.x === 'right' ? 'translateX(-100%)' : 'translateX(0)'} ${expansionQuadrant.y === 'bottom' ? 'translateY(-100%)' : 'translateY(0)'}`,
            transformOrigin: `${expansionQuadrant.y} ${expansionQuadrant.x}`
          }}
        >
          <div className="bm-header" onMouseDown={handleMouseDown}>
            <h3>BROADCAST CENTER</h3>
            <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setIsPanelOpen(false)}>×</button>
          </div>

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
                placeholder="Type urgent message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={400}
                required
              />
            </div>

            <div className="bm-actions">
              <button type="submit" className="bm-btn-send" disabled={isSending || !message.trim()}>
                {isSending ? 'SENDING...' : 'BROADCAST NOW'}
              </button>
            </div>
          </form>

          <div className="bm-footer">Messages will show to all users</div>
        </div>
      )}
    </>
  )
}

export default BroadcastFAB
