/**
 * ActivitySidebar.tsx
 * ─────────────────────────────────────────────────────────────────
 * A multi-functional right sidebar containing:
 *  - Collaboration Presence (detailed)
 *  - Workspace Chat
 *  - Real-time Activity Feed
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { RemoteUser } from '../../hooks/quotation/useCollaboration'
import { useCollaborationContext } from '../../context/CollaborationContext'
import './ActivitySidebar.css'

interface ChatMsg {
  sid: string
  name: string
  color: string
  message: string
  time: string
}

interface ActivityEntry {
  id: string
  uid: string
  name: string
  color: string
  action: string
  field?: string
  time: string
}

interface Props {
  remoteUsers: Record<string, RemoteUser>
  myColor: string
  userName: string
}

const MessageSquare = ({ size = 18, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const ActivityIcon = ({ size = 18, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
)

const SendIcon = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

export function ActivitySidebar({ remoteUsers, myColor, userName }: Props) {
  const { emitChat } = useCollaborationContext()
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'feed'>('chat')
  const [chatLog, setChatLog] = useState<ChatMsg[]>([])
  const [activityFeed, setActivityFeed] = useState<ActivityEntry[]>([])
  const [inputText, setInputText] = useState('')
  const [unreadChat, setUnreadChat] = useState(0)
  
  const chatScrollRef = useRef<HTMLDivElement>(null)

  // Listen for incoming collaborative signals
  useEffect(() => {
    const handleRemoteChat = (e: any) => {
      const msg = e.detail
      setChatLog(prev => [...prev, msg].slice(-100))
      if (!expanded || activeTab !== 'chat') {
        setUnreadChat(v => v + 1)
      }
    }

    const handleRemotePatch = (e: any) => {
      const { sid, patch } = e.detail
      const user = remoteUsers[sid] || { name: 'Unknown', color: '#ccc' }
      if (patch.path === '__full_restore__') return

      const newEntry: ActivityEntry = {
        id: Math.random().toString(36).substr(2, 9),
        uid: sid,
        name: user.name,
        color: user.color,
        action: 'updated',
        field: patch.path,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setActivityFeed(prev => [newEntry, ...prev].slice(-50))
    }

    window.addEventListener('kmti:remote-chat' as any, handleRemoteChat)
    window.addEventListener('kmti:remote-patch' as any, handleRemotePatch)
    
    return () => {
      window.removeEventListener('kmti:remote-chat' as any, handleRemoteChat)
      window.removeEventListener('kmti:remote-patch' as any, handleRemotePatch)
    }
  }, [expanded, activeTab, remoteUsers])

  // Scroll to bottom on new message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatLog])

  // Reset unread count when opening chat
  useEffect(() => {
    if (expanded && activeTab === 'chat') {
      setUnreadChat(0)
    }
  }, [expanded, activeTab])

  const handleSend = () => {
    if (!inputText.trim()) return
    emitChat(inputText.trim())
    setInputText('')
  }

  const formatFieldName = (path: string | undefined): string => {
    if (!path) return 'document'
    const parts = path.split('.')
    const last = parts[parts.length - 1]
    return last.replace(/([A-Z])/g, ' $1').toLowerCase()
  }

  const others = Object.values(remoteUsers)

  return (
    <aside className={`activity-sidebar ${expanded ? 'activity-sidebar--expanded' : ''}`}>
      <div className="activity-sidebar__toggle" onClick={() => setExpanded(!expanded)}>
        {activeTab === 'chat' ? <MessageSquare size={18} /> : <ActivityIcon size={18} />}
        {unreadChat > 0 && <div className="activity-sidebar__toggle-badge" />}
      </div>

      {expanded && (
        <>
          <div className="activity-sidebar__header">
            <span className="activity-sidebar__title">
              {activeTab === 'chat' ? 'Workspace Chat' : 'Activity Feed'}
            </span>
          </div>

          <div className="activity-sidebar__content">
            <div className="activity-tabs">
              <div 
                className={`activity-tab ${activeTab === 'chat' ? 'activity-tab--active' : ''}`}
                onClick={() => setActiveTab('chat')}
              >
                Chat {unreadChat > 0 && `(${unreadChat})`}
              </div>
              <div 
                className={`activity-tab ${activeTab === 'feed' ? 'activity-tab--active' : ''}`}
                onClick={() => setActiveTab('feed')}
              >
                Feed
              </div>
            </div>

            {/* Shared Presence (Always visible at top of expanded) */}
            <div className="activity-section">
              <div className="activity-section-title">Collaborators ({others.length + 1})</div>
              <div className="presence-list">
                <div className="presence-item">
                  <div className="presence-avatar" style={{ background: myColor }}>
                    {(userName || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="presence-info">
                    <span className="presence-name">{userName} (You)</span>
                    <span className="presence-status status-active">Viewing Workspace</span>
                  </div>
                </div>

                {others.map(u => (
                  <div key={u.sid} className="presence-item">
                    <div className="presence-avatar" style={{ background: u.color }}>
                      {(u.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="presence-info">
                      <span className="presence-name">{u.name}</span>
                      <span className="presence-status">
                        {u.focusedField ? `Editing ${formatFieldName(u.focusedField)}` : 'Idle'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tab Views */}
            {activeTab === 'chat' ? (
              <div className="chat-window">
                <div className="chat-messages" ref={chatScrollRef}>
                  {chatLog.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', marginTop: '20px' }}>
                      Start a collaborative discussion...
                    </div>
                  )}
                  {chatLog.map((msg, i) => {
                    const isMe = msg.name === userName || msg.sid === 'me'
                    return (
                      <div key={i} className={`chat-bubble ${isMe ? 'chat-bubble--me' : 'chat-bubble--other'}`}>
                        {!isMe && <span className="chat-bubble-sender" style={{ color: msg.color }}>{msg.name}</span>}
                        <div className="chat-bubble-content">{msg.message}</div>
                        <span className="chat-bubble-time">{msg.time}</span>
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
                    <SendIcon size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="activity-feed">
                {activityFeed.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', marginTop: '20px' }}>
                    Waiting for collaborator actions...
                  </div>
                )}
                {activityFeed.map(entry => (
                  <div key={entry.id} className="feed-item">
                    <div className="feed-indicator" style={{ background: entry.color }} />
                    <div className="feed-body">
                      <div className="feed-msg">
                        <strong>{entry.name}</strong> {entry.action} <strong>{formatFieldName(entry.field)}</strong>
                      </div>
                      <span className="feed-time">{entry.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  )
}
