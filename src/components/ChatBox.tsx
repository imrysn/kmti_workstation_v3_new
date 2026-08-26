import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { chatApi, SERVER_BASE } from '../services/api'
import { renderEquippedSkin } from './Achievement'
import { ThreadSettingsModal } from './OnlineDrawer/ThreadSettingsModal'
import { useModal } from './ModalContext'
import './ChatBox.css'

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

// 100% Offline-compatible glossy vector SVGs
const renderEmojiSVG = (emoji: string, size = 16) => {
  if (emoji === '❤️') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
        <defs>
          <radialGradient id="heartGrad" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ff85a7" />
            <stop offset="60%" stopColor="#ff1744" />
            <stop offset="100%" stopColor="#b70000" />
          </radialGradient>
        </defs>
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="url(#heartGrad)" />
      </svg>
    )
  }
  if (emoji === '👍') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
        <defs>
          <linearGradient id="thumbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="handGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffdd6b" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <path d="M2 10.5a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-2A1.5 1.5 0 0 1 2 19.5v-9z" fill="url(#thumbGrad)" />
        <path d="M20.5 10.02a2 2 0 0 0-2-2h-5.26l.8-2.61.02-.24a1 1 0 0 0-.29-.71l-.7-.69-4.88 4.88A2 2 0 0 0 7 10.02v8a2 2 0 0 0 2 2h7.32a2 2 0 0 0 1.77-1.12l2.77-6.47a2 2 0 0 0 .14-.77v-1.64z" fill="url(#handGrad)" />
      </svg>
    )
  }
  if (emoji === '😂') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
        <defs>
          <radialGradient id="faceGradJoy" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffe082" />
            <stop offset="70%" stopColor="#ffb300" />
            <stop offset="100%" stopColor="#ff8f00" />
          </radialGradient>
          <linearGradient id="tearGrad" x1="0" y1="0" x2="0" y2="100%">
            <stop offset="0%" stopColor="#80d8ff" />
            <stop offset="100%" stopColor="#00b0ff" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#faceGradJoy)" />
        <path d="M6.5 10c.5-.6 1.5-.6 2 0" stroke="#5d4037" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M15.5 10c.5-.6 1.5-.6 2 0" stroke="#5d4037" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M8 14c1 1.5 2.5 2 4 2s3-.5 4-2H8z" fill="#5d4037" />
        <path d="M4 11c-.5 0-.8.5-.8 1s.3.8.8.8.8-.3.8-.8-.3-.8-.8-.8z" fill="url(#tearGrad)" />
        <path d="M20 11c.5 0 .8.5 .8 1s-.3.8-.8.8-.8-.3-.8-.8.3-.8.8-.8z" fill="url(#tearGrad)" />
      </svg>
    )
  }
  if (emoji === '😮') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
        <defs>
          <radialGradient id="faceGradWow" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffe082" />
            <stop offset="70%" stopColor="#ffb300" />
            <stop offset="100%" stopColor="#ff8f00" />
          </radialGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#faceGradWow)" />
        <ellipse cx="8.5" cy="10" rx="1.2" ry="1.8" fill="#5d4037" />
        <ellipse cx="15.5" cy="10" rx="1.2" ry="1.8" fill="#5d4037" />
        <ellipse cx="8.5" cy="9.8" rx="0.5" ry="0.7" fill="#fff" />
        <ellipse cx="15.5" cy="9.8" rx="0.5" ry="0.7" fill="#fff" />
        <path d="M7 7.5c.5-.5 1.5-.5 2 0M15 7.5c.5-.5 1.5-.5 2 0" stroke="#5d4037" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        <ellipse cx="12" cy="15.5" rx="1.5" ry="2.2" fill="#5d4037" />
      </svg>
    )
  }
  if (emoji === '😢') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
        <defs>
          <radialGradient id="faceGradSad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffe082" />
            <stop offset="70%" stopColor="#ffb300" />
            <stop offset="100%" stopColor="#ff8f00" />
          </radialGradient>
          <linearGradient id="tearSingle" x1="0" y1="0" x2="0" y2="100%">
            <stop offset="0%" stopColor="#80d8ff" />
            <stop offset="100%" stopColor="#00b0ff" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#faceGradSad)" />
        <path d="M7 10.5c.6-.4 1.5-.4 2 0M15 10.5c.6-.4 1.5-.4 2 0" stroke="#5d4037" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M9.5 15.5c1.5-1 3.5-1 5 0" stroke="#5d4037" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M7.5 11.5c.4.4.4 1 0 1.4s-1 .4-1.4 0c-.4-.4.1-1.1.4-1.4.2-.2.6-.4 1 0z" fill="url(#tearSingle)" />
      </svg>
    )
  }
  if (emoji === '😡') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
        <defs>
          <radialGradient id="angryGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ff8a80" />
            <stop offset="70%" stopColor="#ff1744" />
            <stop offset="100%" stopColor="#b71c1c" />
          </radialGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#angryGrad)" />
        <path d="M6.5 8.5l2.5 1M17.5 8.5l-2.5 1" stroke="#3e2723" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8.5" cy="11.5" r="1.2" fill="#3e2723" />
        <circle cx="15.5" cy="11.5" r="1.2" fill="#3e2723" />
        <path d="M9.5 16c1.5-1 3.5-1 5 0" stroke="#3e2723" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
    )
  }
  return emoji
}

import { playTypingSound } from '../utils/sound'

const SUPPORTED_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡']

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
  const { confirm: showConfirmModal } = useModal()
  const [isUploading, setIsUploading] = useState(false)
  const [replyToMsg, setReplyToMsg] = useState<any>(null)
  const [editingMsgId, setEditingMsgId] = useState<number | null>(null)
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [activeMenuMsgId, setActiveMenuMsgId] = useState<number | null>(null)
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<number | null>(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null)
  const [showPinnedList, setShowPinnedList] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatBoxBodyRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<any>(null)
  const isInitialLoadRef = useRef(true)

  const handlePin = async (msgId: number) => {
    try {
      const res = await chatApi.pinMessage(msgId)
      const pinData = res?.data || res
      if (pinData && pinData.success !== false) {
        setChatMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_pinned: pinData.is_pinned, pinned_by: currentUsername } : m))
      }
    } catch (err) {
      console.error('Failed to pin message:', err)
    }
  }

  // Scroll to bottom when messages update (auto-scroll only on initial load or if user is near bottom)
  useEffect(() => {
    if (!chatBoxBodyRef.current) return
    const el = chatBoxBodyRef.current
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120

    if (isInitialLoadRef.current || isNearBottom) {
      el.scrollTop = el.scrollHeight
      if (chatMessages.length > 0) {
        isInitialLoadRef.current = false
      }
    }
  }, [chatMessages])


  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (activeMenuMsgId !== null || activeReactionMsgId !== null) {
        if (!target.closest('.chat-msg-actions-dropdown-wrapper')) {
          setActiveMenuMsgId(null)
          setActiveReactionMsgId(null)
        }
      }
      if (showPinnedList) {
        if (!target.closest('.chat-pinned-banner-multi-container')) {
          setShowPinnedList(false)
        }
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxImage) setLightboxImage(null)
        if (showSettingsModal) setShowSettingsModal(false)
        if (showPinnedList) setShowPinnedList(false)
        setActiveMenuMsgId(null)
        setActiveReactionMsgId(null)
      }
    }

    document.addEventListener('click', handleOutsideClick)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('click', handleOutsideClick)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeMenuMsgId, activeReactionMsgId, lightboxImage, showSettingsModal, showPinnedList])

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

  // Listen to socket events
  useEffect(() => {
    const matchUser = (a?: string | null, b?: string | null) => {
      if (!a || !b) return false
      return a.toLowerCase().trim() === b.toLowerCase().trim()
    }


    const isForThisGroup = (msg: any) => groupId !== null && msg.group_id === groupId
    const isForThisP2P = (msg: any) => groupId === null && peer !== null &&
      ((matchUser(msg.sender, peer) && matchUser(msg.recipient, currentUsername)) ||
        (matchUser(msg.sender, currentUsername) && matchUser(msg.recipient, peer)))

    const handleReceiveMessage = (e: any) => {
      const msg = e.detail
      if (!msg) return

      if (isForThisGroup(msg) || isForThisP2P(msg)) {
        setChatMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        if (!matchUser(msg.sender, currentUsername)) {
          chatApi.markRead(peer || undefined, groupId || undefined).catch(err => console.error(err))
          if (onMessageReceived) {
            onMessageReceived(msg.sender, msg.recipient, msg.group_id)
          }
        }
      }
    }

    const handleMutation = (e: any) => {
      const payload = e.detail
      if (payload.target === 'chat_message') {
        if (payload.action === 'edit') {
          setChatMessages(prev => prev.map(m => m.id === payload.data.id ? { ...m, content: payload.data.content, is_edited: true } : m))
        } else if (payload.action === 'delete') {
          setChatMessages(prev => prev.map(m => m.id === payload.data.id ? { ...m, is_deleted: true, content: 'This message was deleted.', attachment_path: null, attachment_name: null } : m))
        } else if (payload.action === 'react') {
          setChatMessages(prev => prev.map(m => m.id === payload.data.id ? { ...m, reactions: payload.data.reactions } : m))
        } else if (payload.action === 'pin') {
          setChatMessages(prev => prev.map(m => m.id === payload.data.id ? { ...m, is_pinned: payload.data.is_pinned, pinned_by: payload.data.pinned_by } : m))
        }
      }
    }

    const handleTyping = (e: any) => {
      const { sender, recipient, group_id } = e.detail
      if (matchUser(sender, currentUsername)) return
      if ((groupId !== null && group_id === groupId) || (groupId === null && matchUser(recipient, currentUsername) && matchUser(sender, peer))) {
        setTypingUsers(prev => new Set(prev).add(sender))
        playTypingSound()
      }
    }

    const handleStopTyping = (e: any) => {
      const { sender, recipient, group_id } = e.detail
      if ((groupId !== null && group_id === groupId) || (groupId === null && matchUser(recipient, currentUsername) && matchUser(sender, peer))) {
        setTypingUsers(prev => {
          const next = new Set(prev)
          next.delete(sender)
          return next
        })
      }
    }

    const handleMessagesRead = (e: any) => {
      const { reader, sender: msgSender } = e.detail
      // If we are the sender and the peer read them, update our local read state to double checks
      if (matchUser(msgSender, currentUsername) && matchUser(reader, peer) && groupId === null) {
        setChatMessages(prev => prev.map(m => matchUser(m.sender, currentUsername) ? { ...m, is_read: true } : m))
      }
    }


    window.addEventListener('kmti:receive_chat_message', handleReceiveMessage)
    window.addEventListener('kmti:db_mutation', handleMutation as EventListener)
    window.addEventListener('kmti:user_typing', handleTyping as EventListener)
    window.addEventListener('kmti:user_stop_typing', handleStopTyping as EventListener)
    window.addEventListener('kmti:chat_messages_read', handleMessagesRead as EventListener)

    return () => {
      window.removeEventListener('kmti:receive_chat_message', handleReceiveMessage)
      window.removeEventListener('kmti:db_mutation', handleMutation as EventListener)
      window.removeEventListener('kmti:user_typing', handleTyping as EventListener)
      window.removeEventListener('kmti:user_stop_typing', handleStopTyping as EventListener)
      window.removeEventListener('kmti:chat_messages_read', handleMessagesRead as EventListener)
    }
  }, [peer, groupId, currentUsername, onMessageReceived])

  const notifyTyping = () => {
    const socket = (window as any).kmtiSocket
    if (!socket) return

    socket.emit('user_typing', { recipient: peer, group_id: groupId })
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('user_stop_typing', { recipient: peer, group_id: groupId })
    }, 2000)
  }

  const handleSendMessage = async (e?: React.FormEvent, customContent?: string) => {
    if (e) e.preventDefault()

    const textToSend = customContent !== undefined ? customContent : chatInputText
    if (!textToSend.trim() && chatAttachments.length === 0) return

    const socket = (window as any).kmtiSocket
    if (!socket) {
      console.error('Socket not connected')
      return
    }

    if (editingMsgId) {
      try {
        await chatApi.editMessage(editingMsgId, textToSend)
        setEditingMsgId(null)
        setChatInputText('')
      } catch (err) {
        console.error('Failed to edit message', err)
      }
      return
    }

    if (chatAttachments.length === 0) {
      socket.emit('send_chat_message', {
        sender: currentUsername,
        recipient: peer,
        group_id: groupId,
        content: textToSend,
        attachment_path: null,
        attachment_name: null,
        reply_to_id: replyToMsg?.id
      })
    } else {
      chatAttachments.forEach((att, idx) => {
        const textContent = idx === 0 ? textToSend : ''
        socket.emit('send_chat_message', {
          sender: currentUsername,
          recipient: peer,
          group_id: groupId,
          content: textContent,
          attachment_path: att.path,
          attachment_name: att.name,
          reply_to_id: replyToMsg?.id
        })
      })
    }


    if (customContent === undefined) {
      setChatInputText('')
    }
    setChatAttachments([])
    setReplyToMsg(null)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    socket.emit('user_stop_typing', { recipient: peer, group_id: groupId })
  }

  const handleSendThumbsUp = () => {
    handleSendMessage(undefined, '👍')
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
      const availableSlots = 3 - chatAttachments.length
      const toUpload = imageFiles.slice(0, availableSlots)
      if (toUpload.length === 0) return

      setIsUploading(true)
      try {
        const newAttachments: { path: string; name: string }[] = []
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

  const handleDelete = (id: number) => {
    showConfirmModal(
      'Are you sure you want to delete this message?',
      async () => {
        try {
          await chatApi.deleteMessage(id)
        } catch (err) {
          console.error('Failed to delete message:', err)
        }
      },
      undefined,
      'danger',
      'Delete Message',
      'Delete'
    )
  }

  const handleReact = async (id: number, emoji: string) => {
    try {
      await chatApi.reactToMessage(id, emoji)
    } catch (err) {
      console.error("Failed to react", err)
    }
  }

  // Format date helper
  const formatDateHeader = (dateStr: string) => {
    const d = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString()
  }

  const formatMessageTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Find the last read outgoing message in the feed to show their avatar seen receipt
  const lastReadOutgoingMsg = [...chatMessages]
    .reverse()
    .find(m => m.sender === currentUsername && m.is_read && !m.is_deleted)
  const lastReadOutgoingId = lastReadOutgoingMsg?.id

  // Find the last outgoing message overall to show the unread single checkmark
  const lastOutgoingMsg = [...chatMessages]
    .reverse()
    .find(m => m.sender === currentUsername && !m.is_deleted)
  const lastOutgoingId = lastOutgoingMsg?.id

  const hasInputText = chatInputText.trim().length > 0 || chatAttachments.length > 0

  return (
    <div className={`online-drawer-chat-box ${drawerOpen ? 'drawer-open' : 'drawer-closed'}`}>
      <div className="chat-box-header">
        <div className="chat-box-header-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', position: 'relative' }}>
          {groupId !== null ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          ) : peer === '__global__' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
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
                  renderEquippedSkin(
                    peerStatus.computer_name || peerStatus.ip_address,
                    peerStatus.achievements,
                    peerStatus.equipped_skin,
                    peerStatus.current_user || undefined
                  )
                ) : (
                  renderEquippedSkin(peer || '', null, 'rookie', peer || undefined)
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
          <button
            className="display-name-pencil-btn"
            onClick={() => setShowSettingsModal(true)}
            title="Shared Media, Files & Links"
            style={{ fontSize: '13px', border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 4px', color: 'var(--text-muted)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </button>
          {groupId !== null && onEditGroup && (
            <button
              className="display-name-pencil-btn"
              onClick={onEditGroup}
              title="Edit group members/name"
              style={{ fontSize: '14px', border: 'none', background: 'transparent', cursor: 'pointer' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </button>
          )}
          {onMinimize && (
            <button
              className="chat-box-header-minimize"
              onClick={onMinimize}
              title="Minimize chat"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 4px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </button>
          )}
          <button className="chat-box-header-close" onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      </div>

      {/* Pinned Messages Sticky Banner & Multi-Pin Manager */}
      {(() => {
        const pinnedMessages = chatMessages.filter(m => m.is_pinned && !m.is_deleted).reverse()
        if (pinnedMessages.length === 0) return null

        if (pinnedMessages.length === 1) {
          const pinnedMsg = pinnedMessages[0]
          return (
            <div
              className="chat-pinned-banner"
              onClick={() => {
                const el = document.getElementById(`msg-${pinnedMsg.id}`)
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }}
              title="Click to jump to pinned message"
            >
              <div className="pinned-left">
                <span className="pinned-pin-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                </span>
                <div className="pinned-info">
                  <span className="pinned-author">{pinnedMsg.sender}</span>
                  <span className="pinned-text">
                    {pinnedMsg.content || (pinnedMsg.attachment_name ? 'Attachment' : '')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="pinned-unpin-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  handlePin(pinnedMsg.id)
                }}
                title="Unpin message"
                style={{ display: 'inline-flex', alignItems: 'center' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          )
        }

        const latestPinned = pinnedMessages[0]
        return (
          <div className="chat-pinned-banner-multi-container" style={{ position: 'relative' }}>
            <div
              className="chat-pinned-banner"
              onClick={() => setShowPinnedList(!showPinnedList)}
              title="Click to view all pinned messages"
            >
              <div className="pinned-left">
                <span className="pinned-pin-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                </span>
                <div className="pinned-info">
                  <span className="pinned-author">{pinnedMessages.length} Pinned Messages</span>
                  <span className="pinned-text">
                    {latestPinned.sender}: {latestPinned.content || (latestPinned.attachment_name ? 'Attachment' : '')}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--accent, #0084ff)', fontWeight: 600 }}>
                <span>View All</span>
                <span style={{ fontSize: '9px' }}>{showPinnedList ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Pinned Messages Popover List */}
            {showPinnedList && (
              <div className="chat-pinned-popover-list">
                <div className="pinned-popover-header">
                  <span>Pinned Messages ({pinnedMessages.length})</span>
                  <button
                    type="button"
                    onClick={() => setShowPinnedList(false)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <div className="pinned-popover-body">
                  {pinnedMessages.map(msg => (
                    <div
                      key={msg.id}
                      className="pinned-popover-item"
                      onClick={() => {
                        const el = document.getElementById(`msg-${msg.id}`)
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        setShowPinnedList(false)
                      }}
                    >
                      <div className="pinned-popover-item-content">
                        <span className="pinned-item-sender">{msg.sender}</span>
                        <span className="pinned-item-text">{msg.content || (msg.attachment_name ? 'Attachment' : '')}</span>
                      </div>
                      <button
                        type="button"
                        className="pinned-item-unpin"
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePin(msg.id)
                        }}
                        title="Unpin message"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      <div className="chat-box-body" ref={chatBoxBodyRef}>
        {chatMessages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>
            No messages yet. Send a message to start conversing!
          </div>
        ) : (
          chatMessages.map((msg, idx) => {
            const isOutgoing = matchUser(msg.sender, currentUsername)
            const attachmentUrl = msg.attachment_path
              ? (msg.attachment_path.startsWith('http') ? msg.attachment_path : `${SERVER_BASE}${msg.attachment_path}`)
              : null
            const isImage = msg.attachment_name && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(msg.attachment_name)

            // Check Date Grouping
            let showDateHeader = false
            if (idx === 0) showDateHeader = true
            else {
              const prevDate = new Date(chatMessages[idx - 1].created_at).toDateString()
              const currDate = new Date(msg.created_at).toDateString()
              if (prevDate !== currDate) showDateHeader = true
            }

            // Check Message Grouping (cluster consecutive messages from same user within 2 mins)
            let isFirstInGroup = false
            let isLastInGroup = false
            const twoMins = 2 * 60 * 1000

            if (idx === 0) isFirstInGroup = true
            else {
              const prevMsg = chatMessages[idx - 1]
              if (!matchUser(prevMsg.sender, msg.sender) || showDateHeader) {
                isFirstInGroup = true
              } else {
                const diff = new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()
                if (diff > twoMins) isFirstInGroup = true
              }
            }

            if (idx === chatMessages.length - 1) isLastInGroup = true
            else {
              const nextMsg = chatMessages[idx + 1]
              const nextDate = new Date(nextMsg.created_at).toDateString()
              const currDate = new Date(msg.created_at).toDateString()
              if (!matchUser(nextMsg.sender, msg.sender) || nextDate !== currDate) {
                isLastInGroup = true
              } else {
                const diff = new Date(nextMsg.created_at).getTime() - new Date(msg.created_at).getTime()
                if (diff > twoMins) isLastInGroup = true
              }
            }


            const isSingleEmoji = msg.content && SUPPORTED_EMOJIS.includes(msg.content.trim()) && !msg.attachment_path

            const rowClasses = [
              'chat-msg-row',
              isOutgoing ? 'outgoing' : 'incoming',
              isFirstInGroup ? 'first-in-group' : '',
              isLastInGroup ? 'last-in-group' : '',
              (!isFirstInGroup && !isLastInGroup) ? 'middle-in-group' : '',
              (isFirstInGroup && isLastInGroup) ? 'single-msg' : ''
            ].filter(Boolean).join(' ')

            const bubbleClasses = [
              'chat-msg-bubble',
              !msg.content?.trim() && isImage ? 'image-only' : '',
              msg.is_deleted ? 'deleted-msg' : '',
              isSingleEmoji ? 'single-emoji-msg' : '',
              msg.is_pinned ? 'is-pinned-msg' : ''
            ].filter(Boolean).join(' ')

            // Parse reactions JSON string
            let parsedReactions: Record<string, string[]> = {}
            try {
              if (msg.reactions) parsedReactions = JSON.parse(msg.reactions)
            } catch (e) { }

            const replyParent = msg.reply_to_id ? chatMessages.find(m => m.id === msg.reply_to_id) : null

            const tripleDotActions = !msg.is_deleted ? (
              <div className="chat-msg-actions-dropdown-wrapper" style={{ display: 'flex', gap: '4px' }}>
                <button
                  className="three-dots-action-trigger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveReactionMsgId(prev => prev === msg.id ? null : msg.id);
                    setActiveMenuMsgId(null);
                  }}
                  title="Add reaction"
                  style={{ fontSize: '15px', color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                    <line x1="9" y1="9" x2="9.01" y2="9"></line>
                    <line x1="15" y1="9" x2="15.01" y2="9"></line>
                  </svg>
                </button>
                <button
                  className="three-dots-action-trigger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuMsgId(prev => prev === msg.id ? null : msg.id);
                    setActiveReactionMsgId(null);
                  }}
                  title="More actions"
                >
                  ⋮
                </button>

                {activeReactionMsgId === msg.id && (
                  <div className="chat-msg-actions-dropdown-menu chat-reaction-popover" style={{ padding: '6px 8px' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      {SUPPORTED_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => { handleReact(msg.id, emoji); setActiveReactionMsgId(null); }}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', transition: 'transform 0.15s ease' }}
                          className="reaction-pill-btn-inline"
                          title={`React with ${emoji}`}
                        >
                          {renderEmojiSVG(emoji, 20)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeMenuMsgId === msg.id && (
                  <div className="chat-msg-actions-dropdown-menu">
                    <button onClick={() => { setReplyToMsg(msg); setActiveMenuMsgId(null); }} className="dropdown-item">
                      Reply
                    </button>
                    <button onClick={() => { handlePin(msg.id); setActiveMenuMsgId(null); }} className="dropdown-item">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg> {msg.is_pinned ? 'Unpin Message' : 'Pin Message'}
                    </button>
                    {isOutgoing && (
                      <>
                        <button onClick={() => { setEditingMsgId(msg.id); setChatInputText(msg.content); setActiveMenuMsgId(null); }} className="dropdown-item">
                          Edit
                        </button>
                        <button onClick={() => { handleDelete(msg.id); setActiveMenuMsgId(null); }} className="dropdown-item delete-option">
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : null;

            return (
              <div key={msg.id || idx} id={`msg-${msg.id}`} style={{ display: 'flex', flexDirection: 'column' }}>
                {showDateHeader && msg.created_at && (
                  <div className="chat-date-divider">
                    <span>{formatDateHeader(msg.created_at)}</span>
                  </div>
                )}

                <div className={rowClasses}>
                  {((peer === '__global__' || groupId !== null) && !isOutgoing && isFirstInGroup) && (
                    <span className="chat-msg-sender">{msg.sender}</span>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    {isOutgoing && tripleDotActions}
                    <div className="chat-msg-bubble-wrapper">
                      {/* curved connection layout for reply */}
                      {replyParent && (
                        <div className="chat-msg-reply-connector-wrapper">
                          <div className="reply-line-connector"></div>
                          <div className="chat-msg-reply-preview" onClick={() => { }}>
                            <div className="reply-author">{replyParent.sender}</div>
                            <div className="reply-content">{replyParent.is_deleted ? "Message deleted" : (replyParent.content || (replyParent.attachment_name ? "Attachment" : ""))}</div>
                          </div>
                        </div>
                      )}

                      <div className={bubbleClasses}>
                        {msg.is_pinned && (
                          <span className="pinned-bubble-corner-icon" title={`Pinned by ${msg.pinned_by || 'user'}`}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                          </span>
                        )}
                        <div className="bubble-content-text">
                          {isSingleEmoji ? (
                            <div className="single-emoji-display">
                              {renderEmojiSVG(msg.content.trim(), 44)}
                            </div>
                          ) : (
                            msg.content
                          )}
                          {msg.is_edited && !msg.is_deleted && <span className="edited-badge">(edited)</span>}

                          <div className="bubble-footer-meta">
                            {msg.created_at && (
                              <span className="inline-time">
                                {formatMessageTime(msg.created_at)}
                              </span>
                            )}
                          </div>
                        </div>

                        {attachmentUrl && !msg.is_deleted && (
                          isImage ? (
                            <img
                              src={attachmentUrl}
                              alt={msg.attachment_name}
                              className="chat-msg-attachment-preview"
                              onClick={() => setLightboxImage({ url: attachmentUrl, name: msg.attachment_name || 'Image' })}
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

                      {/* Reactions Display */}
                      {Object.keys(parsedReactions).length > 0 && (
                        <div className="chat-msg-reactions">
                          {Object.entries(parsedReactions).map(([emoji, users]) => (
                            <span
                              key={emoji}
                              className={`reaction-badge ${users.includes(currentUsername || '') ? 'reacted' : ''}`}
                              onClick={() => handleReact(msg.id, emoji)}
                              title={users.join(', ')}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px' }}
                            >
                              {renderEmojiSVG(emoji, 13)}
                              <span style={{ fontSize: '10px', lineHeight: 1 }}>{users.length}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Status Receipt (Checkmark/Seen Avatar) rendered OUTSIDE the bubble */}
                      {isOutgoing && !msg.is_deleted && (
                        <div className="chat-msg-status-receipt" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px', marginRight: '4px' }}>
                          {msg.is_read ? (
                            (lastReadOutgoingId !== undefined && msg.id === lastReadOutgoingId) ? (
                              <div
                                className="read-receipt-avatar"
                                style={{
                                  width: '13px',
                                  height: '13px',
                                  borderRadius: '50%',
                                  overflow: 'hidden',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  border: '1px solid rgba(0, 0, 0, 0.08)',
                                  backgroundColor: 'var(--bg-surface-subtle)'
                                }}
                                title={`Seen by ${peerLabel}`}
                              >
                                {peerStatus ? (
                                  renderEquippedSkin(
                                    peerStatus.computer_name || peerStatus.ip_address,
                                    peerStatus.achievements,
                                    peerStatus.equipped_skin,
                                    peerStatus.current_user || undefined
                                  )
                                ) : (
                                  renderEquippedSkin(peer || '', null, 'rookie', peer || undefined)
                                )}
                              </div>
                            ) : null
                          ) : (
                            (lastOutgoingId !== undefined && msg.id === lastOutgoingId) ? (
                              <span className="read-receipt-check sent" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                ✓
                              </span>
                            ) : null
                          )}
                        </div>
                      )}
                    </div>
                    {!isOutgoing && tripleDotActions}
                  </div>
                </div>
              </div>
            )
          })
        )}
        {/* Animated Typing dots bubble indicator */}
        {typingUsers.size > 0 && (
          Array.from(typingUsers).map(user => (
            <div key={user} className="chat-msg-row incoming typing-indicator-row">
              <div className="user-avatar" style={{ width: '24px', height: '24px', borderRadius: '50%', overflow: 'hidden', marginRight: '8px' }}>
                {renderEquippedSkin(user, null, 'rookie', user)}
              </div>
              <div className="chat-msg-bubble typing-bubble">
                <div className="bouncing-dots-container">
                  <div className="bouncing-dot"></div>
                  <div className="bouncing-dot"></div>
                  <div className="bouncing-dot"></div>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-box-footer" onSubmit={handleSendMessage}>
        {replyToMsg && (
          <div className="chat-reply-bar">
            <div className="reply-bar-content">
              <strong>Replying to {replyToMsg.sender}:</strong> {replyToMsg.content || 'Attachment'}
            </div>
            <button type="button" onClick={() => setReplyToMsg(null)} className="reply-bar-close">&times;</button>
          </div>
        )}
        {editingMsgId && (
          <div className="chat-reply-bar">
            <div className="reply-bar-content">
              <strong>Editing Message</strong>
            </div>
            <button type="button" onClick={() => { setEditingMsgId(null); setChatInputText('') }} className="reply-bar-close">&times;</button>
          </div>
        )}

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
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            multiple
            onChange={async (e) => {
              const files = e.target.files
              if (!files || files.length === 0) return
              const availableSlots = 3 - chatAttachments.length
              const toUpload = Array.from(files).slice(0, availableSlots)
              if (toUpload.length === 0) return
              setIsUploading(true)
              try {
                const newAttachments: { path: string; name: string }[] = []
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
                console.error('Failed to upload selected file:', err)
              } finally {
                setIsUploading(false)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }
            }}
          />
          <button
            type="button"
            className="chat-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file or image"
            disabled={isUploading || chatAttachments.length >= 3}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <textarea
            className="chat-input-field"
            placeholder={isUploading ? "Uploading..." : "Type a message..."}
            value={chatInputText}
            onChange={(e) => {
              setChatInputText(e.target.value)
              notifyTyping()
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
          {!hasInputText && !editingMsgId ? (
            <button
              type="button"
              className="chat-thumbs-up-btn"
              onClick={handleSendThumbsUp}
              title="Send thumbs up"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}
            >
              {renderEmojiSVG('👍', 22)}
            </button>
          ) : (
            <button
              type="submit"
              className="chat-send-btn animate-send-btn"
              disabled={isUploading || !hasInputText}
            >
              {editingMsgId ? 'Save' : 'Send'}
            </button>
          )}
        </div>
      </form>


      {showSettingsModal && (
        <ThreadSettingsModal
          peer={peer}
          groupId={groupId}
          peerLabel={peerLabel}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Custom In-App Lightbox Portal */}
      {lightboxImage && createPortal(
        <div className="chat-lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <div className="chat-lightbox-header" onClick={e => e.stopPropagation()}>
            <span className="chat-lightbox-title">{lightboxImage.name}</span>
            <div className="chat-lightbox-actions">
              <a
                href={lightboxImage.url}
                download={lightboxImage.name}
                target="_blank"
                rel="noopener noreferrer"
                className="chat-lightbox-download-btn"
                title="Download Image"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
              </a>
              <button
                type="button"
                className="chat-lightbox-close-btn"
                onClick={() => setLightboxImage(null)}
                title="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          <img
            src={lightboxImage.url}
            alt={lightboxImage.name}
            className="chat-lightbox-img"
            onClick={e => e.stopPropagation()}
          />
        </div>,
        document.body
      )}
    </div>
  )
}
