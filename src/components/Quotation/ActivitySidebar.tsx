import { useState, useEffect, useRef } from 'react'
import { ChatMsg } from '../../hooks/quotation/useCollaboration'
import { useCollaborationContext } from '../../context/CollaborationContext'
import './ActivitySidebar.css'

interface Props {
  myColor: string
  userName: string
  chatLog: ChatMsg[]
  onDeleteChat?: (id: string) => void
  onEditChat?: (id: string, message: string) => void
  onReadChat?: (id: string) => void
}

const MessageSquare = ({ size = 18 }: any) => (
  <span style={{ 
    fontSize: `${size}px`, 
    color: 'inherit', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    lineHeight: 1
  }}>
    💬
  </span>
)

const SendIcon = ({ size = 18 }: any) => (
  <span style={{ 
    fontSize: `${size}px`, 
    color: '#fff', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    lineHeight: 1,
    fontWeight: 'bold',
    transform: 'translateX(1px)' // Optical alignment for arrow
  }}>
    ➤
  </span>
)

export function ActivitySidebar({ userName, chatLog, onDeleteChat, onEditChat, onReadChat }: Props) {
  const { emitChat } = useCollaborationContext()
  const [expanded, setExpanded] = useState(false)
  const [inputText, setInputText] = useState('')
  const [unreadChat, setUnreadChat] = useState(0)

  // Context Menu State
  const [menuPos, setMenuPos] = useState<{ x: number, y: number, msgId: string, text: string, isMe: boolean } | null>(null)

  // Inline Edit State
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const chatScrollRef = useRef<HTMLDivElement>(null)
  const lastChatCountRef = useRef(chatLog.length)

  // Tracking unread messages
  useEffect(() => {
    if (!expanded && chatLog.length > lastChatCountRef.current) {
      setUnreadChat(v => v + (chatLog.length - lastChatCountRef.current))
    }
    lastChatCountRef.current = chatLog.length
  }, [chatLog, expanded])

  // Scroll to bottom on new message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatLog, expanded])

  // Reset unread count when opening sidebar
  useEffect(() => {
    if (expanded) {
      setUnreadChat(0)
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

  const handleSend = () => {
    if (!inputText.trim()) return
    emitChat(inputText.trim())
    setInputText('')
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

  useEffect(() => {
    const hide = () => setMenuPos(null)
    window.addEventListener('click', hide)
    return () => window.removeEventListener('click', hide)
  }, [])

  return (
    <aside className={`activity-sidebar ${expanded ? 'activity-sidebar--expanded' : ''}`}>
      <div
        className="activity-sidebar__toggle"
        onClick={() => setExpanded(!expanded)}
        title={expanded ? 'Collapse chat' : 'Workspace Chat'}
      >
        <MessageSquare size={18} />
        {unreadChat > 0 && <div className="activity-sidebar__toggle-badge" />}
        {expanded && <span className="activity-sidebar__title">Workspace Chat</span>}
      </div>

      {expanded && (
        <div className="activity-sidebar__content">
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
                    className={`chat-bubble ${isMe ? 'chat-bubble--me' : 'chat-bubble--other'} ${msg.isDeleted ? 'chat-bubble--deleted' : ''}`}
                    onContextMenu={(e) => !msg.isDeleted && handleContextMenu(e, msg, isMe)}
                  >
                    <div className="chat-bubble-header">
                      {!isMe && <span className="chat-bubble-sender" style={{ color: msg.color }}>{msg.name}</span>}
                    </div>

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

                    {isMe && msg.readBy && msg.readBy.length > 0 && (
                      (() => {
                        const isLatestFromMe = !chatLog.slice(i + 1).some(m => m.name === userName || m.sid === 'me')
                        if (!isLatestFromMe) return null
                        return (
                          <div className="chat-read-receipt">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /><polyline points="22 10 13 19 9 15" /></svg>
                            <span>Read by {msg.readBy.join(', ')}</span>
                          </div>
                        )
                      })()
                    )}
                  </div>
                )
              })}
            </div>
            <div className="chat-input-row" onClick={(e) => e.stopPropagation()}>
              <input
                className="chat-input"
                placeholder="Type a message..."
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
              />
                <button className="chat-send-btn" onClick={handleSend} disabled={!inputText.trim()}>
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
    </aside>
  )
}
