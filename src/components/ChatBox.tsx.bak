import { useState, useEffect, useRef } from 'react'
import { chatApi, SERVER_BASE } from '../services/api'
import { renderEquippedSkin } from './Achievement'

interface ChatBoxProps {
  peer: string | null
  groupId: number | null
  peerLabel: string
  onClose: () => void
  currentUsername?: string
  onMessageReceived?: (sender: string, recipient: string, groupId?: number) => void
  onEditGroup?: () => void
  peerStatus?: any
  drawerOpen?: boolean
  onMinimize?: () => void
}

export default function ChatBox({
  peer,
  groupId,
  peerLabel,
  onClose,
  currentUsername,
  onMessageReceived,
  onEditGroup,
  peerStatus,
  drawerOpen,
  onMinimize
}: ChatBoxProps) {
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatInputText, setChatInputText] = useState('')
  const [chatAttachments, setChatAttachments] = useState<{ path: string; name: string }[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatBoxBodyRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages update (instant, no animation)
  useEffect(() => {
    if (chatBoxBodyRef.current) {
      chatBoxBodyRef.current.scrollTop = chatBoxBodyRef.current.scrollHeight
    }
  }, [chatMessages])

  // Load chat history on mount/peer/group change
  useEffect(() => {
    let active = true
    const loadHistory = async () => {
      try {
        await chatApi.markRead(peer || undefined, groupId || undefined)
        const history = await chatApi.getHistory(peer || undefined, groupId || undefined)
        if (active) {
          setChatMessages(history || [])
        }
      } catch (err) {
        console.error('Failed to load chat history:', err)
      }
    }
    loadHistory()
    return () => {
      active = false
    }
  }, [peer, groupId])

  // Listen to incoming messages for the active peer/group
  useEffect(() => {
    const handleReceiveMessage = (e: any) => {
      const msg = e.detail
      if (!msg) return

      const isForThisGroup = groupId !== null && msg.group_id === groupId
      const isForThisP2P = groupId === null && peer !== null &&
        ((msg.sender === peer && msg.recipient === currentUsername) ||
          (msg.sender === currentUsername && msg.recipient === peer))

      if (isForThisGroup || isForThisP2P) {
        setChatMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        if (msg.sender !== currentUsername) {
          chatApi.markRead(peer || undefined, groupId || undefined).catch(err => console.error(err))
          if (onMessageReceived) {
            onMessageReceived(msg.sender, msg.recipient, msg.group_id)
          }
        }
      }
    }

    window.addEventListener('kmti:receive_chat_message', handleReceiveMessage)
    return () => {
      window.removeEventListener('kmti:receive_chat_message', handleReceiveMessage)
    }
  }, [peer, groupId, currentUsername, onMessageReceived])

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!chatInputText.trim() && chatAttachments.length === 0) return

    const socket = (window as any).kmtiSocket
    if (!socket) {
      console.error('Socket not connected')
      return
    }

    if (chatAttachments.length === 0) {
      socket.emit('send_chat_message', {
        recipient: peer,
        group_id: groupId,
        content: chatInputText,
        attachment_path: null,
        attachment_name: null
      })
    } else {
      chatAttachments.forEach((att, idx) => {
        const textContent = idx === 0 ? chatInputText : ''
        socket.emit('send_chat_message', {
          recipient: peer,
          group_id: groupId,
          content: textContent,
          attachment_path: att.path,
          attachment_name: att.name
        })
      })
    }

    setChatInputText('')
    setChatAttachments([])
  }

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return

    const imageFiles: File[] = []
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        if (file) imageFiles.push(file)
      }
    }

    if (imageFiles.length > 0) {
      // Allow up to 3 images max
      const availableSlots = 3 - chatAttachments.length
      const toUpload = imageFiles.slice(0, availableSlots)
      if (toUpload.length === 0) return

      setIsUploading(true)
      try {
        const newAttachments = []
        for (const file of toUpload) {
          const formData = new FormData()
          formData.append('file', file)
          const res = await chatApi.upload(formData)
          if (res.success) {
            newAttachments.push({ path: res.attachment_path, name: res.attachment_name })
          }
        }
        setChatAttachments(prev => [...prev, ...newAttachments])
      } catch (err) {
        console.error('Failed to upload pasted images:', err)
      } finally {
        setIsUploading(false)
      }
    }
  }

  return (
    <div className={`online-drawer-chat-box ${drawerOpen ? 'drawer-open' : 'drawer-closed'}`}>
      <div className="chat-box-header">
        <div className="chat-box-header-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', position: 'relative' }}>
          {groupId !== null ? (
            '👥'
          ) : peer === '__global__' ? (
            '🌐'
          ) : (
            <>
              <div
                className="user-avatar"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  filter: (!peerStatus || (peerStatus.last_ping && (Date.now() - new Date(peerStatus.last_ping).getTime() > 300000)) || peerStatus.active_module === 'offline') ? 'grayscale(1)' : 'none',
                  opacity: (!peerStatus || (peerStatus.last_ping && (Date.now() - new Date(peerStatus.last_ping).getTime() > 300000)) || peerStatus.active_module === 'offline') ? 0.6 : 1
                }}
              >
                {peerStatus ? (
                  renderEquippedSkin(peerStatus.computer_name || peerStatus.ip_address, peerStatus.achievements, peerStatus.equipped_skin)
                ) : (
                  renderEquippedSkin('', null, 'rookie')
                )}
              </div>
              <span
                className={`status-badge-dot ${(!peerStatus || (peerStatus.last_ping && (Date.now() - new Date(peerStatus.last_ping).getTime() > 300000)) || peerStatus.active_module === 'offline') ? 'status-offline' : 'status-active'}`}
                style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-2px',
                  width: '8px',
                  height: '8px',
                  border: '1.5px solid var(--bg-primary, #ffffff)',
                  borderRadius: '50%'
                }}
              ></span>
            </>
          )}
        </div>
        <div className="chat-box-header-title-sec">
          <span className="chat-box-header-name">{peerLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {groupId !== null && onEditGroup && (
            <button
              className="display-name-pencil-btn"
              onClick={onEditGroup}
              title="Edit group members/name"
              style={{ fontSize: '14px', border: 'none', background: 'transparent', cursor: 'pointer' }}
            >
              ⚙️
            </button>
          )}
          {onMinimize && (
            <button
              className="chat-box-header-minimize"
              onClick={onMinimize}
              title="Minimize chat"
              style={{ fontSize: '16px', border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 4px', color: 'var(--text-muted)' }}
            >
              &minus;
            </button>
          )}
          <button className="chat-box-header-close" onClick={onClose}>
            &times;
          </button>
        </div>
      </div>

      <div className="chat-box-body" ref={chatBoxBodyRef}>
        {chatMessages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>
            No messages yet. Send a message to start conversing!
          </div>
        ) : (
          chatMessages.map((msg, idx) => {
            const isOutgoing = msg.sender === currentUsername
            const attachmentUrl = msg.attachment_path
              ? (msg.attachment_path.startsWith('http') ? msg.attachment_path : `${SERVER_BASE}${msg.attachment_path}`)
              : null
            const isImage = msg.attachment_name && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(msg.attachment_name)

            return (
              <div key={msg.id || idx} className={`chat-msg-row ${isOutgoing ? 'outgoing' : 'incoming'}`}>
                {((peer === '__global__' || groupId !== null) && !isOutgoing) && (
                  <span className="chat-msg-sender">{msg.sender}</span>
                )}
                <div className={`chat-msg-bubble ${!msg.content?.trim() && isImage ? 'image-only' : ''}`}>
                  {msg.content}

                  {attachmentUrl && (
                    isImage ? (
                      <img
                        src={attachmentUrl}
                        alt={msg.attachment_name}
                        className="chat-msg-attachment-preview"
                        onClick={() => window.open(attachmentUrl, '_blank')}
                      />
                    ) : (
                      <div className="chat-msg-attachment">
                        📎 <a
                          href={attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="chat-msg-attachment-link"
                        >
                          {msg.attachment_name}
                        </a>
                      </div>
                    )
                  )}
                </div>
                {msg.created_at && (
                  <span className="chat-msg-time">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-box-footer" onSubmit={handleSendMessage}>
        {chatAttachments.length > 0 && (
          <div className="chat-footer-attachments-list" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {chatAttachments.map((att, idx) => (
              <div key={idx} className="chat-footer-attachment-preview">
                <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {att.name}</span>
                <button
                  type="button"
                  className="chat-attachment-clear-btn"
                  onClick={() => setChatAttachments(prev => prev.filter((_, i) => i !== idx))}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="chat-input-row">
          <textarea
            className="chat-input-field"
            placeholder={isUploading ? "Uploading..." : "Type a message..."}
            value={chatInputText}
            onChange={(e) => {
              setChatInputText(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${e.target.scrollHeight}px`
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
                e.currentTarget.style.height = 'auto'
              }
            }}
            onPaste={handlePaste}
            rows={1}
            disabled={isUploading}
          />
          <button type="submit" className="chat-send-btn" disabled={isUploading || (!chatInputText.trim() && chatAttachments.length === 0)}>
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
