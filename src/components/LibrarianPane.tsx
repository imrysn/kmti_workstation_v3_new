import React, { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { SERVER_BASE, librarianApi } from '../services/api'
import { useModal } from '../components/ModalContext'
import kmtiLogo from '../assets/kmti_logo.png'
import './LibrarianPane.css'

interface Message {
  id?: number
  role: 'user' | 'assistant'
  content: string
}

interface ChatSession {
  id: number
  title: string
  created_at: string
}

interface LibrarianPaneProps {
  compact?: boolean;
}

const LibrarianPane: React.FC<LibrarianPaneProps> = ({ compact = false }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false) // Toggle history dropdown in compact mode
  const [workstationName, setWorkstationName] = useState('Workstation')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)

  const { confirm, notify } = useModal()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Load Sessions on Mount
  useEffect(() => {
    const init = async () => {
      try {
        // Fetch Workstation Info (Computer Name)
        if ((window as any).electronAPI) {
          const ws = await (window as any).electronAPI.getWorkstationInfo()
          setWorkstationName(ws.computerName || 'System')
        }

        const res = await librarianApi.getSessions()
        const sessList = res.data
        setSessions(sessList)

        if (sessList.length > 0) {
          setActiveSessionId(sessList[0].id)
          loadHistory(sessList[0].id)
        } else {
          setIsLoading(false)
        }
      } catch (err) {
        console.error('Failed to init Librarian:', err)
        setIsLoading(false)
      }
    }
    init()
  }, [])

  // Auto-scroll on message update
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Auto-focus input on mount or session change
  useEffect(() => {
    if (!isLoading && !isTyping) {
      inputRef.current?.focus()
    }
  }, [activeSessionId, isLoading, isTyping])

  // Click outside history dropdown
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setIsHistoryOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const loadHistory = async (sid: number) => {
    setIsLoading(true)
    try {
      const res = await librarianApi.getHistory(sid)
      setMessages(res.data)
    } finally {
      setIsLoading(false)
      setTimeout(scrollToBottom, 50)
    }
  }

  const handleSessionChange = (sid: number) => {
    if (sid === activeSessionId) return
    setActiveSessionId(sid)
    loadHistory(sid)
    setIsHistoryOpen(false)
  }

  const createNewChat = async () => {
    try {
      setIsLoading(true)
      const res = await librarianApi.createSession("New Chat")
      const newSess = res.data
      setSessions(prev => [newSess, ...prev])
      setActiveSessionId(newSess.id)
      setMessages([])
      setInput('')
      setIsHistoryOpen(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteSession = (e: React.MouseEvent, sid: number) => {
    e.stopPropagation()
    confirm(
      "Delete this conversation thread?", 
      async () => {
        try {
          await librarianApi.deleteSession(sid)
          setSessions(prev => prev.filter(s => s.id !== sid))
          if (activeSessionId === sid) {
            setActiveSessionId(null)
            setMessages([])
          }
          notify("Conversation deleted", "success")
        } catch (err) {
          notify("Failed to delete session", "error")
        }
      },
      undefined,
      'danger',
      'Confirm Deletion',
      'Delete'
    )
  }

  const handleSend = async () => {
    if (!input.trim() || isTyping) return

    const userText = input.trim()
    const userMessage: Message = { role: 'user', content: userText }

    // If no active session, one will be created by backend or we can create here
    let sid = activeSessionId

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsTyping(true)

    try {
      const response = await fetch(`${SERVER_BASE}/api/librarian/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sid,
          messages: [{ role: 'user', content: userText }] // Pass current message
        })
      })

      if (!response.ok) throw new Error('Failed to connect')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader!.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        assistantContent += chunk
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: assistantContent }]
          }
          return prev
        })
      }

      // After streaming, refresh session list to pick up auto-title if it was "New Chat"
      const sessRes = await librarianApi.getSessions()
      setSessions(sessRes.data)
      if (!sid && sessRes.data.length > 0) {
        setActiveSessionId(sessRes.data[0].id)
      }

    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Error: Failed to reach the technical librarian records.' }])
    } finally {
      setIsTyping(false)
    }
  }

  const renderMessageContent = (content: string) => {
    // We transform [PATH:...] into a unique inline code block marker.
    // This bypasses Markdown link sanitization and URL-parsing issues with special characters.
    const processed = content
      .replace(/\[PATH:(.*?)\]/g, '`KMTI_PATH:$1`')
      .replace(/\[PROJECT:(.*?)\]/g, '`KMTI_PROJECT:$1`')

    return (
      <ReactMarkdown
        components={{
          code: ({ node, className, children, ...props }) => {
            const contentString = String(children).trim()

            // Handle KMTI Path Chip
            if (contentString.startsWith('KMTI_PATH:')) {
              const path = contentString.replace('KMTI_PATH:', '')
              return (
                <span
                  className="lib-pane-tag"
                  title={`Navigate to ${path}`}
                  onClick={() => window.dispatchEvent(new CustomEvent('librarian-navigate', { detail: { type: 'path', value: path } }))}
                >
                  {path.split('/').pop()}
                </span>
              )
            }

            // Handle KMTI Project Chip
            if (contentString.startsWith('KMTI_PROJECT:')) {
              const name = contentString.replace('KMTI_PROJECT:', '')
              return (
                <span
                  className="lib-pane-tag"
                  title={`Focus project: ${name}`}
                  onClick={() => window.dispatchEvent(new CustomEvent('librarian-navigate', { detail: { type: 'project', value: name } }))}
                >
                  {name}
                </span>
              )
            }

            // Default inline/block code
            return <code className={className} {...props}>{children}</code>
          },
          // Standard links still work for external resources
          a: ({ node, href, children, ...props }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
          )
        }}
      >
        {processed}
      </ReactMarkdown>
    )
  }


  return (
    <div className={`librarian-pane ${compact ? 'compact' : ''}`}>
      {/* Sidebar - Chat History Sessions (HIDDEN IN COMPACT) */}
      {!compact && (
        <div className="lib-sidebar">
          <div className="lib-sidebar-header">
            <button className="lib-new-chat-btn" onClick={createNewChat}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              New chat
            </button>
          </div>

          <div className="lib-history-label">Recent Conversations</div>
          <div className="lib-sidebar-sessions">
            {sessions.map(s => (
              <div
                key={s.id}
                className={`lib-session-item ${activeSessionId === s.id ? 'active' : ''}`}
                onClick={() => handleSessionChange(s.id)}
              >
                <div className="lib-session-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  {s.title}
                </div>
                <button className="lib-session-delete" onClick={(e) => handleDeleteSession(e, s.id)} title="Delete chat">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="lib-main">
        <div className="lib-top-nav">
          <div className="lib-branding">
            <div className="lib-ai-glow">
              <img src={kmtiLogo} alt="K" style={{ width: 22, height: 22, objectFit: 'contain' }} />
            </div>
            <div className="lib-header-text">KMTI Tech Assistant</div>
          </div>

          {compact && (
            <div className="lib-compact-actions" ref={historyRef}>
              <button className="lib-compact-btn" onClick={() => setIsHistoryOpen(!isHistoryOpen)} title="History">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button className="lib-compact-btn" onClick={createNewChat} title="New Chat">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>

              {isHistoryOpen && (
                <div className="lib-compact-history-dropdown">
                  <div className="lib-history-label">Recent Conversations</div>
                  {sessions.map(s => (
                    <div
                      key={s.id}
                      className={`lib-session-item ${activeSessionId === s.id ? 'active' : ''}`}
                      onClick={() => handleSessionChange(s.id)}
                    >
                      <div className="lib-session-title">{s.title}</div>
                      <button className="lib-session-delete" onClick={(e) => handleDeleteSession(e, s.id)} title="Delete chat">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  ))}
                  {sessions.length === 0 && <div className="lib-no-history">No recent chats</div>}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lib-content-wrapper">
          <div className="lib-chat-container">
            {messages.length === 0 && !isTyping ? (
              <div className="lib-welcome">
                <h1>Hi {workstationName},</h1>
                <p>I am your KMTI Tech Assistant. Where should we start searching?</p>
              </div>
            ) : (
              messages.map((m, idx) => (
                <div key={idx} className={`lib-msg ${m.role}`}>
                  {m.role === 'assistant' && (
                    <div className="lib-msg-avatar">
                      <img src={kmtiLogo} alt="AI" style={{ width: 14, height: 14, objectFit: 'contain' }} />
                    </div>
                  )}
                  <div className="lib-msg-body">
                    <div className="lib-msg-text">
                      {renderMessageContent(m.content)}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
            
            {isTyping && (
              <div className="lib-msg assistant">
                <div className="lib-msg-avatar">
                  <img src={kmtiLogo} alt="AI" style={{ width: 14, height: 14, objectFit: 'contain' }} />
                </div>
                <div className="lib-msg-body">
                  <div className="lib-msg-text">
                    <div className="lib-thinking">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input area */}
        <div className="lib-input-wrapper">
          <div className="lib-input-container">
            <textarea
              ref={inputRef}
              placeholder="How can I help you today?"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  e.stopPropagation()
                  handleSend()
                }
              }}
              rows={1}
            />
            <button
              className={`lib-send-btn ${input.trim() ? 'active' : ''}`}
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LibrarianPane
