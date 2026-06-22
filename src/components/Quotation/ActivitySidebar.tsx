import { useState, useEffect, useRef } from 'react'
import { ChatMsg } from '../../hooks/quotation/useCollaboration'
import { useCollaborationContext } from '../../context/CollaborationContext'
import { telemetryApi } from '../../services/api'
import { renderEquippedSkin } from '../Achievement'
import './ActivitySidebar.css'

interface Props {
  myColor: string
  userName: string
  chatLog: ChatMsg[]
  workspaceName?: string
  onDeleteChat?: (id: string) => void
  onEditChat?: (id: string, message: string) => void
  onReadChat?: (id: string) => void
}

const MessageSquare = ({ size = 20 }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const SendIcon = ({ size = 18 }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

const INTRO_GREETINGS = [
  "Hello! I'm your workspace chat. Let's collaborate!",
  "Need to align? Message your team here!",
  "Hello! I am your team chat. Let's work together!",
  "Hey there! Let's collaborate. Chat here!",
  "Got a question? Ask your teammates in real time!"
]

export function ActivitySidebar({ userName, chatLog, workspaceName, onDeleteChat, onEditChat, onReadChat }: Props) {
  const { emitChat } = useCollaborationContext()
  const [expanded, setExpanded] = useState(false)
  const [inputText, setInputText] = useState('')
  const [unreadChat, setUnreadChat] = useState(0)
  const [workstations, setWorkstations] = useState<any[]>([])

  // Fetch workstation statuses when expanded
  useEffect(() => {
    if (!expanded) return
    const fetchWS = () => {
      telemetryApi.getStatuses()
        .then(res => {
          if (res.data?.data) {
            setWorkstations(res.data.data)
          }
        })
        .catch(() => {})
    }
    fetchWS()
    const interval = setInterval(fetchWS, 15000)
    return () => clearInterval(interval)
  }, [expanded])

  const getCustomAvatar = (name: string) => {
    if (!name) return null
    const ws = workstations.find(w => {
      const pcName = (w.computer_name || '').toLowerCase()
      const curUser = (w.current_user || '').toLowerCase()
      const dispName = (w.display_name || '').toLowerCase()
      const lowerName = name.toLowerCase()
      return pcName === lowerName || curUser === lowerName || dispName === lowerName
    })
    if (ws) {
      return renderEquippedSkin(ws.computer_name || ws.ip_address, ws.achievements, ws.equipped_skin)
    }
    return null
  }
  const [toast, setToast] = useState<{ name: string; color?: string } | null>(null)
  const [showIntro, setShowIntro] = useState(true)
  const [selectedGreeting, setSelectedGreeting] = useState('')
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const [useCount, setUseCount] = useState(0)
  const [isDusty, setIsDusty] = useState(false)

  const getTierClass = () => {
    if (useCount >= 20) return 'chat-tier-3'
    if (useCount >= 10) return 'chat-tier-2'
    if (useCount >= 5) return 'chat-tier-1'
    return 'chat-tier-0'
  }

  // Pick a random greeting on mount and rotate every 30 seconds
  useEffect(() => {
    const pickGreeting = () => {
      setSelectedGreeting(prev => {
        const remaining = INTRO_GREETINGS.filter(g => g !== prev)
        if (remaining.length === 0) return prev
        const randomIdx = Math.floor(Math.random() * remaining.length)
        return remaining[randomIdx]
      })
    }
    
    // Set initial greeting
    const randomIdx = Math.floor(Math.random() * INTRO_GREETINGS.length)
    setSelectedGreeting(INTRO_GREETINGS[randomIdx])

    const interval = setInterval(pickGreeting, 30000)
    return () => clearInterval(interval)
  }, [])

  // Initialize Bored Developer easter egg states
  useEffect(() => {
    // Load use count
    const savedCount = localStorage.getItem('kmti_chat_use_count')
    if (savedCount) {
      setUseCount(parseInt(savedCount, 10) || 0)
    }

    // Load last opened timestamp
    const now = Date.now()
    const savedLastOpened = localStorage.getItem('kmti_chat_last_opened')
    if (!savedLastOpened) {
      // Default to 2 hours ago so the user sees the web immediately
      const twoHoursAgo = now - 2 * 3600 * 1000
      localStorage.setItem('kmti_chat_last_opened', twoHoursAgo.toString())
      setIsDusty(true)
    } else {
      const lastOpenedTime = parseInt(savedLastOpened, 10) || now
      if (now - lastOpenedTime > 3600000) {
        setIsDusty(true)
      }
    }

    // Check intro dismissal status (wait 30 mins if closed by user)
    const dismissedAt = localStorage.getItem('kmti_chat_intro_dismissed_at')
    if (dismissedAt) {
      const lastDismissedTime = parseInt(dismissedAt, 10) || 0
      if (now - lastDismissedTime < 30 * 60 * 1000) {
        setShowIntro(false)
      }
    }
  }, [])

  // Expose real-time developer debugging helper methods on window
  useEffect(() => {
    (window as any).__setChatUseCount = (val: number) => {
      setUseCount(val)
      localStorage.setItem('kmti_chat_use_count', val.toString())
      console.log(`[DevHelper] Set useCount to ${val} (Tier: ${val >= 20 ? 3 : val >= 10 ? 2 : val >= 5 ? 1 : 0})`)
    };
    (window as any).__setChatLastOpened = (hoursAgo: number) => {
      const time = Date.now() - hoursAgo * 3600 * 1000
      localStorage.setItem('kmti_chat_last_opened', time.toString())
      setIsDusty(hoursAgo > 1)
      console.log(`[DevHelper] Set last opened to ${hoursAgo} hours ago (isDusty: ${hoursAgo > 1})`)
    };
    return () => {
      delete (window as any).__setChatUseCount
      delete (window as any).__setChatLastOpened
    }
  }, [])

  // Context Menu State
  const [menuPos, setMenuPos] = useState<{ x: number, y: number, msgId: string, text: string, isMe: boolean } | null>(null)

  // Inline Edit State
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const chatScrollRef = useRef<HTMLDivElement>(null)
  const lastChatCountRef = useRef(chatLog.length)

  // Notification Sound
  const playNotificationSound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3')
      audio.volume = 0.4
      audio.play().catch(() => {})
    } catch (e) {}
  }

  // Tracking unread messages
  useEffect(() => {
    if (chatLog.length > lastChatCountRef.current) {
      const latest = chatLog[chatLog.length - 1]
      const isRemote = latest.name !== userName && latest.sid !== 'me'
      
      if (isRemote) {
        playNotificationSound()
        if (!expanded || document.hidden) {
          (window as any).electronAPI?.flashWindow(true)
        }
        if (!expanded) {
          setUnreadChat(v => v + 1)
          setToast({ name: latest.name, color: latest.color })
        }
      }
    }
    lastChatCountRef.current = chatLog.length
  }, [chatLog, expanded, userName])

  // Auto-dismiss toast notification after 4 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Scroll to bottom on new message or expand
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatLog, expanded])

  // Reset unread count when opening chat widget
  useEffect(() => {
    if (expanded) {
      setUnreadChat(0)
      setToast(null) // Close toast on expand
      setShowIntro(false) // Dismiss intro popup on expand
      ;(window as any).electronAPI?.flashWindow(false)
      
      // Easter egg: Reset dust & update last opened timestamp
      setIsDusty(false)
      localStorage.setItem('kmti_chat_last_opened', Date.now().toString())

      // Easter egg: Increment use count
      setUseCount(prev => {
        const next = prev + 1
        localStorage.setItem('kmti_chat_use_count', next.toString())
        return next
      })
    } else {
      setDragOffset({ x: 0, y: 0 })
    }
  }, [expanded])

  // Auto-mark messages as read when expanded
  useEffect(() => {
    if (expanded && onReadChat) {
      chatLog.forEach(msg => {
        const isRemote = msg.name !== userName && msg.sid !== 'me'
        const alreadyRead = msg.readBy?.includes(userName)
        if (isRemote && !alreadyRead && !msg.isDeleted && msg.id) {
          onReadChat(msg.id)
        }
      })
    }
  }, [expanded, chatLog, userName, onReadChat])

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button')) return

    setIsDragging(true)
    isDraggingRef.current = true
    const startX = e.clientX
    const startY = e.clientY
    const initialX = dragOffset.x
    const initialY = dragOffset.y

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return
      const dx = moveEvent.clientX - startX
      const dy = moveEvent.clientY - startY
      setDragOffset({
        x: initialX + dx,
        y: initialY + dy
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      isDraggingRef.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleSend = () => {
    if (!inputText.trim()) return
    emitChat(inputText.trim())
    setInputText('')

    // Easter egg: Increment use count on message send
    setUseCount(prev => {
      const next = prev + 1
      localStorage.setItem('kmti_chat_use_count', next.toString())
      return next
    })
  }

  const handleDismissIntro = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowIntro(false)
    localStorage.setItem('kmti_chat_intro_dismissed_at', Date.now().toString())
  }

  const handleContextMenu = (e: React.MouseEvent, msg: ChatMsg, isMe: boolean) => {
    e.preventDefault()
    let x = e.clientX
    let y = e.clientY
    const menuWidth = 180
    const menuHeight = isMe ? 90 : 40
    if (x + menuWidth > window.innerWidth) x -= menuWidth
    if (y + menuHeight > window.innerHeight) y -= menuHeight
    setMenuPos({ x, y, msgId: msg.id!, text: msg.message, isMe })
  }

  const handleUnsend = () => {
    if (menuPos && onDeleteChat) {
      onDeleteChat(menuPos.msgId)
      setMenuPos(null)
    }
  }

  const startEdit = () => {
    if (menuPos) {
      setEditingId(menuPos.msgId)
      setEditValue(menuPos.text)
      setMenuPos(null)
    }
  }

  const saveEdit = () => {
    if (editingId && onEditChat) {
      onEditChat(editingId, editValue.trim())
      setEditingId(null)
      setEditValue('')
    }
  }

  const getInitials = (name: string) => {
    if (!name) return 'U'
    const parts = name.trim().split(/\s+/)
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  useEffect(() => {
    const hide = () => setMenuPos(null)
    window.addEventListener('click', hide)
    return () => window.removeEventListener('click', hide)
  }, [])

  // Find the last read message index for each user (for Messenger-style seen indicators)
  const getLastReadIndices = () => {
    const lastRead: Record<string, number> = {}
    chatLog.forEach((msg, idx) => {
      if (msg.readBy) {
        msg.readBy.forEach(user => {
          if (user !== userName) {
            lastRead[user] = idx
          }
        })
      }
    })
    return lastRead
  }

  return (
    <div className={`activity-chat-container ${expanded ? 'expanded' : ''}`}>
      {/* Dynamic Intro Onboarding Popup */}
      {showIntro && !expanded && !toast && selectedGreeting && (
        <div 
          className="chat-intro-popup"
          onClick={() => { setExpanded(true); setShowIntro(false); }}
        >
          <div className="chat-intro-body">
            <span key={selectedGreeting} className="chat-intro-text-fade">{selectedGreeting}</span>
          </div>
          <button 
            className="chat-intro-close"
            onClick={handleDismissIntro}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Toast Hint Notification */}
      {toast && !expanded && (
        <div 
          className="chat-toast-notification"
          onClick={() => { setExpanded(true); setToast(null); }}
        >
          {(() => {
            const customAvatar = getCustomAvatar(toast.name)
            return (
              <div
                className={`chat-toast-avatar ${customAvatar ? 'chat-toast-avatar--custom' : ''}`}
                style={customAvatar ? undefined : { backgroundColor: toast.color || '#007aff' }}
              >
                {customAvatar || getInitials(toast.name)}
              </div>
            )
          })()}
          <div className="chat-toast-body">
            <span className="chat-toast-sender">{toast.name}</span>
            <span className="chat-toast-text">sent you a message</span>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      {!expanded && (
        <button
          className={`chat-floating-trigger ${getTierClass()}`}
          onClick={() => setExpanded(true)}
          title={`Workspace Chat (Interactions: ${useCount})`}
        >
          {isDusty && (
            <div className="chat-spider-web" title="Idle for > 1 hour! Covered in webs.">
              <svg viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="1">
                <line x1="0" y1="0" x2="56" y2="0" />
                <line x1="0" y1="0" x2="0" y2="56" />
                <line x1="0" y1="0" x2="56" y2="56" />
                <line x1="0" y1="0" x2="28" y2="56" />
                <line x1="0" y1="0" x2="56" y2="28" />
                
                <path d="M12 0 C12 6, 6 12, 0 12" />
                <path d="M24 0 C24 12, 12 24, 0 24" />
                <path d="M36 0 C36 18, 18 36, 0 36" />
                <path d="M48 0 C48 24, 24 48, 0 48" />
              </svg>
            </div>
          )}
          <div className="chat-trigger-icon-wrapper">
            <MessageSquare size={20} />
            {unreadChat > 0 && <span className="chat-unread-badge">{unreadChat}</span>}
          </div>
        </button>
      )}

      {/* Floating Chat Card */}
      {expanded && (
        <div 
          className={`chat-floating-card ${isDragging ? 'dragging' : ''}`}
          style={{ '--drag-x': `${dragOffset.x}px`, '--drag-y': `${dragOffset.y}px` } as React.CSSProperties}
          onClick={e => e.stopPropagation()}
        >
          <div className="chat-header" onMouseDown={handleHeaderMouseDown}>
            <div className="chat-header-info">
              <span className="chat-header-dot" />
              <h3>{workspaceName || 'Workspace Chat'}</h3>
            </div>
            <button className="chat-close-btn" onClick={() => setExpanded(false)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="chat-window">
            <div className="chat-messages" ref={chatScrollRef}>
              {chatLog.length === 0 && (
                <div className="chat-empty">Start a collaborative discussion...</div>
              )}
              {chatLog.map((msg, i) => {
                const isMe = msg.name === userName || msg.sid === 'me'
                const isEditing = editingId === msg.id

                return (
                  <div
                    key={msg.id || i}
                    className={`chat-row ${isMe ? 'chat-row--me' : 'chat-row--other'}`}
                  >
                    {!isMe && (
                      (() => {
                        const customAvatar = getCustomAvatar(msg.name)
                        return (
                          <div
                            className={`chat-avatar ${customAvatar ? 'chat-avatar--custom' : ''}`}
                            style={customAvatar ? undefined : { backgroundColor: msg.color || '#007aff' }}
                            title={msg.name}
                          >
                            {customAvatar || getInitials(msg.name)}
                          </div>
                        )
                      })()
                    )}

                    <div className="chat-message-wrapper">
                      {!isMe && <span className="chat-sender-name">{msg.name}</span>}
                      
                      <div
                        className={`chat-bubble ${isMe ? 'chat-bubble--me' : 'chat-bubble--other'} ${msg.isDeleted ? 'chat-bubble--deleted' : ''}`}
                        onContextMenu={(e) => !msg.isDeleted && handleContextMenu(e, msg, isMe)}
                      >
                        <div className="chat-bubble-content">
                          {msg.isDeleted ? (
                            <span className="chat-unsend-placeholder">
                              {isMe ? 'You unsent a message' : `${msg.name} unsent a message`}
                            </span>
                          ) : isEditing ? (
                            <div className="chat-inline-edit">
                              <textarea
                                autoFocus
                                className="chat-edit-input"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                              />
                              <div className="chat-edit-actions">
                                <button onClick={() => setEditingId(null)}>Cancel</button>
                                <button onClick={saveEdit}>Save</button>
                              </div>
                            </div>
                          ) : (
                            msg.message
                          )}
                        </div>
                        <span className="chat-bubble-time">
                          {msg.time}
                          {msg.isEdited && <span className="chat-edited-label"> • edited</span>}
                        </span>
                      </div>

                      {(() => {
                        const lastReadMap = getLastReadIndices()
                        const readersOfThisMsg = Object.entries(lastReadMap)
                          .filter(([_, msgIdx]) => msgIdx === i)
                          .map(([user]) => user)

                        if (readersOfThisMsg.length === 0) return null

                        return (
                          <div className="chat-seen-avatars-row">
                            {readersOfThisMsg.map(readerName => {
                              const readerMsg = chatLog.find(m => m.name === readerName)
                              const color = readerMsg?.color || '#a0aec0'
                              const customAvatar = getCustomAvatar(readerName)
                              return (
                                <div
                                  key={readerName}
                                  className={`chat-seen-avatar ${customAvatar ? 'chat-seen-avatar--custom' : ''}`}
                                  style={customAvatar ? undefined : { backgroundColor: color }}
                                  title={`Seen by ${readerName}`}
                                >
                                  {customAvatar || getInitials(readerName)}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )
              })}
            </div>
            
            <div className="chat-input-row">
              <input
                className="chat-input"
                placeholder="Type a message..."
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
              />
              <button className="activity-chat-send-btn" onClick={handleSend} disabled={!inputText.trim()}>
                <SendIcon size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {menuPos && (
        <div
          className="chat-context-menu"
          style={{ top: menuPos.y, left: menuPos.x }}
          onClick={e => e.stopPropagation()}
        >
          {menuPos.isMe && (
            <>
              <button className="chat-menu-item" onClick={startEdit}>Edit</button>
              <button className="chat-menu-item chat-menu-item--danger" onClick={handleUnsend}>Unsend</button>
            </>
          )}
          {!menuPos.isMe && (
            <div className="chat-menu-label">Only sender can manage this message</div>
          )}
        </div>
      )}
    </div>
  )
}
