import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { telemetryApi, chatApi, SERVER_BASE, scheduleApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { getDisplayName } from '../utils/nameUtils'
import { version as appVersion } from '../../package.json'
import AchievementUnlockModal from './AchievementUnlockModal'
import AvatarPickerModal from './AvatarPickerModal'
import ChatBox from './ChatBox'
import { useModal } from './ModalContext'
import {
  WorkstationStatus,
  detectNewUnlockedAchievement,
  AchievementInfo,
  renderEquippedSkin,
  getEquippedSkin,
} from './Achievement'
import './OnlineDrawer.css'


// ─── Portal Tooltip ───────────────────────────────────────────────────────────
// Renders into document.body so it escapes the drawer's overflow:auto container.
// Positioned via getBoundingClientRect so it always aligns to the hovered avatar.

function AchievementTooltipPortal({
  anchorRef,
  computerName,
  achievements,
  equippedSkin,
}: {
  anchorRef: React.RefObject<HTMLDivElement>
  computerName: string
  achievements: WorkstationStatus['achievements']
  equippedSkin?: string
}) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = anchorRef.current
    if (!el) return

    const show = () => {
      setRect(el.getBoundingClientRect())
      setVisible(true)
    }
    const hide = () => setVisible(false)
    const updatePos = () => {
      if (visible) setRect(el.getBoundingClientRect())
    }

    el.addEventListener('mouseenter', show)
    el.addEventListener('mouseleave', hide)
    window.addEventListener('scroll', updatePos, true)

    return () => {
      el.removeEventListener('mouseenter', show)
      el.removeEventListener('mouseleave', hide)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [anchorRef, visible])

  if (!visible || !rect) return null

  const TOOLTIP_WIDTH = 280
  const left = rect.left - TOOLTIP_WIDTH - 20
  const top = rect.top + rect.height / 2

  const skin = getEquippedSkin(computerName, achievements, equippedSkin)

  return createPortal(
    <div
      className="avatar-achievements-tooltip portal-tooltip equipped-skin-tooltip"
      style={{
        position: 'fixed',
        left,
        top,
        transform: 'translateY(-50%)',
        opacity: 1,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      <div className="tooltip-header">
        <h4>{computerName}</h4>
        <span className={`tooltip-ach-rarity-badge ${skin.rarity}`}>{skin.rarity}</span>
      </div>
      <div className="tooltip-body equipped-skin-body">
        <div className="tooltip-skin-info">
          <span className="tooltip-skin-label">{skin.label}</span>
          <span className="tooltip-skin-desc">{skin.description}</span>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── WorkstationCard ──────────────────────────────────────────────────────────
// Extracted into its own component so it can legally own a useRef for the
// avatar anchor — hooks cannot be called inside a .map() callback.

interface WorkstationCardProps {
  ws: WorkstationStatus
  status: string
  isMe: boolean
  isWaving: boolean
  myComputerName: string
  appVersion: string
  onSendWave: (target: string) => void
  onEditAvatar?: () => void
  formatRelative: (date: string) => string
  getStatusLabel: (status: string) => string
  stripEmoji: (str: string) => string
  onOpenChat?: (username: string, displayName: string) => void
  unreadCount?: number
}

function WorkstationCard({
  ws,
  status,
  isMe,
  isWaving,
  myComputerName,
  appVersion,
  onSendWave,
  onEditAvatar,
  formatRelative,
  getStatusLabel,
  stripEmoji,
  onOpenChat,
  unreadCount = 0,
}: WorkstationCardProps) {
  const avatarRef = useRef<HTMLDivElement>(null)

  const isMinimized = ws.active_module?.startsWith('💤')
  const cleanModule = stripEmoji(isMinimized ? ws.active_module.replace('💤', '').trim() : (ws.active_module || ''))
  const isOutdated = ws.version && ws.version !== appVersion
  const isOffline = status === 'status-offline'

  return (
    <div
      className={`online-user-card ${status} ${isOffline ? 'offline-card' : ''} ${(!isMe && ws.current_user) ? 'clickable' : ''}`}
      onClick={() => {
        if (!isMe && ws.current_user && onOpenChat) {
          onOpenChat(ws.current_user, ws.display_name || getDisplayName(ws.current_user) || ws.current_user)
        }
      }}
    >
      <div className="avatar-container" ref={avatarRef}>
        <div className="user-avatar" style={isOffline ? { filter: 'grayscale(1)', opacity: 0.8 } : undefined}>
          {renderEquippedSkin(ws.computer_name || ws.ip_address, ws.achievements, ws.equipped_skin)}
        </div>
        <span className={`status-badge-dot ${status}`} title={getStatusLabel(status)}></span>

        {/* Edit avatar button — only shows on your own card */}
        {isMe && onEditAvatar && (
          <button
            className="avatar-edit-btn"
            onClick={(e) => {
              e.stopPropagation()
              onEditAvatar()
            }}
            title="Customize your avatar"
          >
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
        )}

        {/* Portal tooltip — renders at document.body level, no overflow clipping */}
        <AchievementTooltipPortal
          anchorRef={avatarRef}
          computerName={ws.computer_name || ws.ip_address}
          achievements={ws.achievements}
          equippedSkin={ws.equipped_skin}
        />
      </div>

      <div className="user-info-section">
        <div className="user-header-row">
          <span className="user-name" title={ws.computer_name || ws.ip_address}>
            {ws.display_name || getDisplayName(ws.current_user || '') || ws.current_user || ws.computer_name || ws.ip_address}
            {unreadCount > 0 && <span className="card-unread-badge">{unreadCount}</span>}
            {ws.streaks?.includes(myComputerName) && (
              <span className="streak-flame active" title={`You have an active wave streak with ${ws.computer_name || 'this workstation'}! 🔥`}>
                🔥
              </span>
            )}
            {!ws.streaks?.includes(myComputerName) && ws.streaks && ws.streaks.length > 0 && (
              <span className="streak-flame" title={`${ws.computer_name || 'This workstation'} has active wave streaks with other workstations! 🔥`}>
                🔥
              </span>
            )}
          </span>
          <span className="last-seen">{formatRelative(ws.last_ping)}</span>
        </div>

        <div className="user-detail-row">
          <span className={`active-module ${isOffline ? 'offline-text' : ''}`} title={cleanModule || 'Offline'}>
            {isOffline ? 'Last seen: ' : ''}
            {isOffline && cleanModule === 'offline' ? 'Logged Out' : (cleanModule || 'Idle')}
          </span>
          {/* Only show the pc-name if it differs from the displayed name — avoids showing
              e.g. "Raysan" twice when the computer name matches the display name. */}
          {(() => {
            const displayedName = (ws.display_name || getDisplayName(ws.current_user || '') || ws.current_user || '').toLowerCase()
            const pcName = (ws.computer_name || ws.ip_address || '').toLowerCase()
            if (pcName && pcName !== displayedName) {
              return (
                <span className="pc-name" title={ws.computer_name || ws.ip_address}>
                  {ws.computer_name || ws.ip_address}
                </span>
              )
            }
            return null
          })()}
        </div>

        <div className="user-version-row">
          <span className={`app-ver ${isOutdated ? 'outdated' : ''}`}>
            v{ws.version || 'unknown'}
          </span>
          {isOutdated && <span className="update-flag">Outdated</span>}
        </div>
      </div>

      {/* Interactions Area */}
      {!isMe && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {!isOffline && (
            <button
              className={`wave-action-btn ${isWaving ? 'waving-sent' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                onSendWave(ws.computer_name || ws.ip_address)
              }}
              title={`Send Wave to ${ws.computer_name || 'Workstation'}`}
              aria-label={`Send Wave to ${ws.computer_name || 'Workstation'}`}
              disabled={isWaving}
            >
              👋
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── OnlineDrawer ─────────────────────────────────────────────────────────────

const playEasterEggChime = () => {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (AudioContextClass) {
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const playNote = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.05, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };
    playNote(523.25, now, 0.1);
    playNote(659.25, now + 0.05, 0.1);
    playNote(783.99, now + 0.1, 0.1);
    playNote(1046.50, now + 0.15, 0.3);
  }
};

const playMessageChime = () => {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (AudioContextClass) {
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const playNote = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.06, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };
    playNote(659.25, now, 0.08); // E5
    playNote(880.00, now + 0.06, 0.15); // A5
  }
};

export default function OnlineDrawer() {
  const { user, hasRole } = useAuth()
  const { confirm } = useModal()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'chats' | 'online' | 'offline'>('chats')
  const [searchQuery, setSearchQuery] = useState('')
  const [workstations, setWorkstations] = useState<WorkstationStatus[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [myComputerName, setMyComputerName] = useState<string>('')

  // Daily Shift highlights aggregates state
  const [stats, setStats] = useState<{
    peak_users: number;
    waves_exchanged: number;
    wave_leader: string;
    most_active_module: string;
  } | null>(null)

  // Title click counter for Easter Egg Hunter achievement
  const [titleClicks, setTitleClicks] = useState(0)

  // Wave/Ping states
  const [toasts, setToasts] = useState<{ id: string; sender: string; type?: 'wave' | 'login' }[]>([])
  const [isWaving, setIsWaving] = useState<Record<string, boolean>>({}) // click throttling

  // Chat system states
  const [chatPeer, setChatPeer] = useState<string | null>(null)
  const [chatGroupId, setChatGroupId] = useState<number | null>(null)
  const [chatPeerLabel, setChatPeerLabel] = useState<string>('')
  const [activeChats, setActiveChats] = useState<{
    peer: string | null
    groupId: number | null
    peerLabel: string
    isMinimized: boolean
  }[]>([])
  const [chatUnreadCounts, setChatUnreadCounts] = useState<Record<string, number>>({})
  const [chatPreviews, setChatPreviews] = useState<Record<string, { text: string, timestamp: number }>>({})

  // Groups and Users Lists
  const [threads, setThreads] = useState<any[]>([])
  const [usersList, setUsersList] = useState<any[]>([])

  // Group Modal states
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [groupModalMode, setGroupModalMode] = useState<'create' | 'edit'>('create')
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null)
  const [groupFormName, setGroupFormName] = useState('')
  const [groupFormMembers, setGroupFormMembers] = useState<string[]>([])


  // Achievement unlock modal
  const [pendingAchievement, setPendingAchievement] = useState<AchievementInfo | null>(null)

  // Avatar picker
  const [showAvatarSelector, setShowAvatarSelector] = useState(false)
  const [equippedSkinTrigger, setEquippedSkinTrigger] = useState(0)

  // Track previously seen achievements for THIS workstation (to detect new unlocks)
  const prevAchievementsRef = useRef<Record<string, boolean>>({})

  const prevPingsRef = useRef<Record<string, { ping: string; module: string }>>({})
  const isInitialFetchRef = useRef(true)
  const drawerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Sync Socket.IO auth credentials on user change and reconnect
  useEffect(() => {
    const socket = (window as any).kmtiSocket
    if (!socket || !user?.username) return

    const doAuth = () => {
      socket.emit('authenticate', { username: user.username })
      console.log(`[Socket] Emitted authenticate for ${user.username}`)
    }

    if (socket.connected) {
      doAuth()
    }

    socket.on('connect', doAuth)
    return () => {
      socket.off('connect', doAuth)
    }
  }, [user])

  // Focus search when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus({ preventScroll: true }), 300)
    }
  }, [isOpen])

  // Fetch local hostname/workstation name on mount
  useEffect(() => {
    if ((window as any).electronAPI?.getWorkstationInfo) {
      (window as any).electronAPI.getWorkstationInfo()
        .then((info: any) => {
          setMyComputerName(info.computerName)
        })
        .catch(() => {
          const name = sessionStorage.getItem('kmti_dev_name') || 'Browser'
          setMyComputerName(name)
        });
    } else {
      const name = sessionStorage.getItem('kmti_dev_name') || 'Browser'
      setMyComputerName(name)
    }
  }, []);

  // Listen to received waves/pings
  useEffect(() => {
    const handleWave = (e: any) => {
      const sender = e.detail?.sender || 'Someone';
      const newToast = { id: Math.random().toString(), sender };
      setToasts(prev => [...prev, newToast]);

      // Auto-remove toast after 4.5 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newToast.id));
      }, 4500);
    };

    window.addEventListener('kmti:wave-received', handleWave);
    return () => window.removeEventListener('kmti:wave-received', handleWave);
  }, []);

  // Escape key to minimize active chats
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveChats(prev => prev.map(c => ({ ...c, isMinimized: true })))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ─── Chat System Hooks & Handlers ──────────────────────────────────────────

  // Fetch threads and users list
  const fetchGroupsAndUsers = async () => {
    if (!user?.username) return
    try {
      const [tList, uList] = await Promise.all([
        chatApi.getThreads(),
        chatApi.getUsers()
      ])
      setThreads(tList || [])
      setUsersList(uList || [])
    } catch (err) {
      console.error('Failed to fetch threads/users list:', err)
    }
  }

  useEffect(() => {
    fetchGroupsAndUsers()
    // Poll list every 15 seconds
    const interval = setInterval(fetchGroupsAndUsers, 15000)
    return () => clearInterval(interval)
  }, [user])

  // Fetch initial unread counts
  const fetchUnreadCounts = async () => {
    if (!user?.username) return
    try {
      const counts = await chatApi.getUnreadCounts()
      setChatUnreadCounts(counts || {})
    } catch (err) {
      console.error('Failed to fetch unread counts:', err)
    }
  }

  useEffect(() => {
    fetchUnreadCounts()
  }, [user])

  // Listen to Socket.IO incoming chat messages to maintain unread badges and refresh threads
  useEffect(() => {
    const handleReceiveChatMessage = (e: any) => {
      const msg = e.detail
      if (!msg) return

      const expandedChat = activeChats.find(c => !c.isMinimized)
      const expandedPeer = expandedChat ? expandedChat.peer : null
      const expandedGroupId = expandedChat ? expandedChat.groupId : null

      if (msg.type === 'thread_deleted') {
        fetchGroupsAndUsers()
        setActiveChats(prev => prev.filter(c => !(c.peer === msg.peer && c.groupId === null)))
        return
      }
      if (msg.type === 'group_deleted') {
        fetchGroupsAndUsers()
        setActiveChats(prev => prev.filter(c => !(c.groupId === msg.group_id)))
        return
      }

      const isCurrentGroup = expandedGroupId !== null && msg.group_id === expandedGroupId
      const isCurrentP2P = expandedGroupId === null && expandedPeer !== null &&
        ((msg.sender === expandedPeer && msg.recipient === user?.username) ||
          (msg.sender === user?.username && msg.recipient === expandedPeer))

      // Refresh threads on any new message to update last message preview and sorting
      fetchGroupsAndUsers()

      // Increment unread count and set preview bubble if we are not actively viewing this conversation
      if (!isCurrentGroup && !isCurrentP2P) {
        const key = msg.group_id !== null ? `group:${msg.group_id}` : msg.sender
        setChatUnreadCounts(prev => ({
          ...prev,
          [key]: (prev[key] || 0) + 1
        }))

        // Show preview bubble
        if (msg.sender && msg.sender !== user?.username) {
          const timestamp = Date.now()
          let previewText = msg.content
          if (!previewText?.trim() && msg.attachment_name) {
            if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(msg.attachment_name)) {
              previewText = 'Sent an image'
            } else if (/\.(mp4|webm|ogg|mov)$/i.test(msg.attachment_name)) {
              previewText = 'Sent a video'
            } else {
              previewText = 'Sent a file'
            }
          } else if (msg.attachment_name) {
            previewText = `📎 ${previewText}`
          }
          setChatPreviews(prev => ({
            ...prev,
            [key]: { text: previewText, timestamp }
          }))

          // Auto clear preview after 4.5 seconds
          setTimeout(() => {
            setChatPreviews(prev => {
              if (prev[key]?.timestamp === timestamp) {
                const newPreviews = { ...prev }
                delete newPreviews[key]
                return newPreviews
              }
              return prev
            })
          }, 4500)
        }
      }

      // If this is an incoming message from someone else, trigger chime, flash window (only if hidden), and auto-open as minimized
      if (msg.sender && msg.sender !== user?.username) {
        playMessageChime()
        if (document.visibilityState === 'hidden') {
          window.electronAPI?.flashWindow?.(true)
        }

        if (msg.group_id !== null) {
          const groupName = threads.find(t => t.type === 'group' && t.group_id === msg.group_id)?.name || 'Group Chat'
          handleOpenChat(null, groupName, msg.group_id, true)
        } else {
          const senderUsername = msg.sender
          const ws = workstations.find(w => w.current_user === senderUsername)
          const displayName = ws?.display_name || getDisplayName(senderUsername) || senderUsername
          handleOpenChat(senderUsername, displayName, null, true)
        }
      }
    };

    const handleGroupNotification = () => {
      fetchGroupsAndUsers()
    }

    const socket = (window as any).kmtiSocket
    if (socket) {
      socket.on('group_created', handleGroupNotification)
      socket.on('group_updated', handleGroupNotification)
    }

    window.addEventListener('kmti:receive_chat_message', handleReceiveChatMessage);
    return () => {
      window.removeEventListener('kmti:receive_chat_message', handleReceiveChatMessage);
      if (socket) {
        socket.off('group_created', handleGroupNotification)
        socket.off('group_updated', handleGroupNotification)
      }
    }
  }, [activeChats, user, threads, workstations])

  const handleOpenChat = async (peer: string | null, label: string, groupId: number | null = null, spawnMinimized: boolean = false) => {
    setActiveChats(prev => {
      const existsIdx = prev.findIndex(c =>
        (groupId !== null && c.groupId === groupId) ||
        (groupId === null && c.peer === peer && c.groupId === null)
      )

      if (spawnMinimized) {
        if (existsIdx !== -1) {
          const newArr = [...prev]
          const chat = newArr.splice(existsIdx, 1)[0]
          return [chat, ...newArr] // Move to front but keep current minimized state
        } else {
          return [{ peer, groupId, peerLabel: label, isMinimized: true }, ...prev]
        }
      }

      // Minimize all other chats
      const minimized = prev.map(c => ({ ...c, isMinimized: true }))
      if (existsIdx !== -1) {
        const chat = minimized.splice(existsIdx, 1)[0]
        chat.isMinimized = false
        return [chat, ...minimized]
      } else {
        return [{ peer, groupId, peerLabel: label, isMinimized: false }, ...minimized]
      }
    })

    if (!spawnMinimized) {
      const key = groupId !== null ? `group:${groupId}` : (peer || '')
      setChatUnreadCounts(prev => ({
        ...prev,
        [key]: 0
      }))

      try {
        await chatApi.markRead(peer || undefined, groupId || undefined)
        fetchGroupsAndUsers() // Refresh to clear unread indicator or update state
      } catch (err) {
        console.error(err)
      }
    }
  }

  const handleDeleteConversation = (e: React.MouseEvent, peer: string | null, groupId: number | null) => {
    e.stopPropagation()
    confirm('Are you sure to delete this conversation?', async () => {
      try {
        if (groupId !== null) {
          await chatApi.deleteGroup(groupId)
        } else if (peer !== null) {
          await chatApi.deleteDm(peer)
        }
        setActiveChats(prev => prev.filter(c =>
          !(groupId !== null && c.groupId === groupId) &&
          !(groupId === null && c.peer === peer && c.groupId === null)
        ))
        fetchGroupsAndUsers()
      } catch (err) {
        console.error('Failed to delete conversation:', err)
      }
    })
  }

  const handleOpenCreateGroup = () => {
    setGroupModalMode('create')
    setSelectedGroup(null)
    setGroupFormName('')
    setGroupFormMembers([])
    setShowGroupModal(true)
  }

  const handleOpenEditGroup = (g: any) => {
    setGroupModalMode('edit')
    setSelectedGroup(g)
    setGroupFormName(g.name)
    setGroupFormMembers(g.members.filter((m: string) => m !== user?.username))
    setShowGroupModal(true)
  }

  const handleGroupFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupFormName.trim()) return

    try {
      if (groupModalMode === 'create') {
        const res = await chatApi.createGroup(groupFormName.trim(), groupFormMembers)
        if (res.success) {
          fetchGroupsAndUsers()
          setShowGroupModal(false)
          // Open the group chat instantly!
          handleOpenChat(null, res.name, res.id)
        }
      } else if (groupModalMode === 'edit' && selectedGroup) {
        const targetId = selectedGroup.group_id || selectedGroup.id
        const res = await chatApi.editGroup(targetId, groupFormName.trim(), groupFormMembers)
        if (res.success) {
          fetchGroupsAndUsers()
          setShowGroupModal(false)
          // Update chat header label if it's currently open
          if (chatGroupId === targetId) {
            setChatPeerLabel(groupFormName.trim())
          }
        }
      }
    } catch (err) {
      console.error('Failed to save group:', err)
    }
  }

  const toggleGroupMember = (username: string) => {
    setGroupFormMembers(prev =>
      prev.includes(username) ? prev.filter(m => m !== username) : [...prev, username]
    )
  }

  // Listen to toggle event
  useEffect(() => {
    const handleToggle = () => {
      setIsOpen(prev => !prev)
    }

    const handleClose = () => {
      setIsOpen(false)
    }

    window.addEventListener('kmti:toggle-online-drawer', handleToggle)
    window.addEventListener('kmti:close-online-drawer', handleClose)

    return () => {
      window.removeEventListener('kmti:toggle-online-drawer', handleToggle)
      window.removeEventListener('kmti:close-online-drawer', handleClose)
    }
  }, [])

  // Sync open state changes back to Titlebar cleanly to avoid rendering warnings
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('kmti:online-drawer-status', { detail: { open: isOpen } }))
  }, [isOpen])

  // Fetch daily shift highlight stats for admin monitoring
  const fetchStats = async (signal?: AbortSignal) => {
    try {
      const res = await telemetryApi.getStats({ signal })
      if (res.data?.success) {
        setStats(res.data)
      }
    } catch (err: any) {
      if (err.name !== 'CanceledError' && err.message !== 'canceled') {
        console.error('[ONLINE DRAWER] Failed to fetch shift statistics:', err)
      }
    }
  }

  // Detect newly unlocked achievements and trigger the modal
  const detectNewAchievements = useCallback((newWorkstations: WorkstationStatus[]) => {
    const result = detectNewUnlockedAchievement(
      newWorkstations,
      myComputerName,
      user?.username,
      prevAchievementsRef.current
    )
    if (result) {
      setPendingAchievement({ key: result.key, ...result.info })
    }

    const myWs = newWorkstations.find(
      ws => ws.computer_name === myComputerName && myComputerName !== ''
    )
    if (myWs?.achievements) {
      prevAchievementsRef.current = { ...(myWs.achievements as Record<string, boolean>) }
    }
  }, [myComputerName, user?.username])

  // Fetch workstations telemetry
  const fetchWorkstations = async (signal?: AbortSignal) => {
    setIsLoading(true)
    try {
      const res = await telemetryApi.getStatuses({ signal, params: { include_offline: true } })
      if (res.data?.data) {
        const newWorkstations: WorkstationStatus[] = res.data.data
        setWorkstations(newWorkstations)
        detectNewAchievements(newWorkstations)

        // Handle Toast Logic
        const nowMs = Date.now()
        const newPingsMap: Record<string, { ping: string; module: string }> = {}
        const fiveMins = 5 * 60 * 1000

        newWorkstations.forEach(ws => {
          const compName = ws.computer_name || ws.ip_address
          if (ws.last_ping) {
            newPingsMap[compName] = { ping: ws.last_ping, module: ws.active_module || '' }

            if (!isInitialFetchRef.current) {
              const prevState = prevPingsRef.current[compName]
              if (prevState) {
                const prevPingMs = new Date(prevState.ping).getTime()
                const newPingMs = new Date(ws.last_ping).getTime()

                const wasGenuinelyOffline = (nowMs - prevPingMs >= fiveMins) || (prevState.module === 'offline')
                const isNowOnline = (nowMs - newPingMs < fiveMins) && (ws.active_module !== 'offline')

                if (wasGenuinelyOffline && isNowOnline) {
                  const toastId = Math.random().toString()
                  const name = ws.display_name || getDisplayName(ws.current_user || '') || ws.current_user || compName
                  setToasts(prev => [...prev, { id: toastId, sender: name, type: 'login' }])

                  setTimeout(() => {
                    setToasts(prev => prev.filter(t => t.id !== toastId))
                  }, 4500)
                }
              }
            }
          }
        })

        prevPingsRef.current = newPingsMap
        if (isInitialFetchRef.current) {
          isInitialFetchRef.current = false
        }
      }
    } catch (err: any) {
      if (err.name !== 'CanceledError' && err.message !== 'canceled') {
        console.error('[ONLINE DRAWER] Failed to fetch telemetry statuses:', err)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchWorkstations(controller.signal)
    fetchStats(controller.signal)

    const interval = setInterval(() => {
      fetchWorkstations(controller.signal)
      fetchStats(controller.signal)
    }, 15000)

    return () => {
      clearInterval(interval)
      controller.abort()
    }
  }, [])

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        window.dispatchEvent(new CustomEvent('kmti:online-drawer-status', { detail: { open: false } }))
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      // Don't close if clicking on the titlebar buttons (which might toggle the drawer)
      const target = e.target as HTMLElement
      if (target.closest('.titlebar-btn')) return

      // Don't close if clicking inside modals that are portalled to the body
      if (
        target.closest('.apm-backdrop') ||
        target.closest('.apm-modal') ||
        target.closest('.achievement-modal-overlay') ||
        target.closest('.achievement-modal-card')
      ) {
        return
      }

      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        window.dispatchEvent(new CustomEvent('kmti:online-drawer-status', { detail: { open: false } }))
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Utility helpers
  const formatRelative = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000)
    if (diff < 1) return 'Just now'
    if (diff < 60) return `${diff}m ago`
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
    return `${Math.floor(diff / 1440)}d ago`
  }

  const getStatusClass = (lastPing: string | undefined | null, activeModule?: string) => {
    if (!lastPing || activeModule === 'offline') return 'status-offline';
    const diffSeconds = (new Date().getTime() - new Date(lastPing).getTime()) / 1000;

    if (diffSeconds >= 300) return 'status-offline'; // >= 5 mins

    return 'status-active';
  }

  // Filter and sort workstations: Active users first, alphabetically by username or PC name
  const filteredWorkstations = useMemo(() => {
    const fiveMinsAgo = Date.now() - (5 * 60 * 1000)

    return workstations
      .filter(ws => {
        const pingTime = ws.last_ping ? new Date(ws.last_ping).getTime() : 0
        const isOnline = pingTime >= fiveMinsAgo && ws.active_module !== 'offline'

        if (activeTab === 'online' && !isOnline) return false
        if (activeTab === 'offline' && isOnline) return false

        const term = searchQuery.toLowerCase()
        const u = (ws.current_user || 'Guest').toLowerCase()
        const comp = (ws.computer_name || ws.ip_address).toLowerCase()
        const mod = (ws.active_module || '').toLowerCase()
        return u.includes(term) || comp.includes(term) || mod.includes(term)
      })
      .sort((a, b) => {
        if (activeTab === 'offline') {
          // Sort offline by most recently seen (descending)
          const tA = a.last_ping ? new Date(a.last_ping).getTime() : 0
          const tB = b.last_ping ? new Date(b.last_ping).getTime() : 0
          return tB - tA
        }

        const statusA = getStatusClass(a.last_ping, a.active_module)
        const statusB = getStatusClass(b.last_ping, b.active_module)

        // Rank by status: Active > Offline
        const rank: Record<string, number> = {
          'status-active': 2,
          'status-offline': 1
        }

        const rankA = rank[statusA] || 0
        const rankB = rank[statusB] || 0

        if (rankA !== rankB) {
          return rankB - rankA
        }

        const nameA = a.current_user || 'Guest'
        const nameB = b.current_user || 'Guest'
        return nameA.localeCompare(nameB)
      })
  }, [workstations, searchQuery, activeTab])

  const filteredGroups = useMemo(() => {
    const groupThreads = threads.filter(t => t.type === 'group')
    if (!searchQuery) return groupThreads
    return groupThreads.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [threads, searchQuery])

  const filteredActiveDms = useMemo(() => {
    const dmThreads = threads.filter(t => t.type === 'dm')
    if (!searchQuery) return dmThreads
    return dmThreads.filter(dm => dm.peer.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [threads, searchQuery])

  // Strip leading emoji / non-ASCII symbols from module name strings
  const stripEmoji = (str: string) =>
    str.replace(/^[\p{Emoji}\p{So}\p{Sk}\s]+/u, '').trim()

  const handleSendWave = async (targetCompName: string) => {
    const sender = myComputerName || user?.username || 'Guest';
    if (!targetCompName) return;

    // Avoid double click / spam
    if (isWaving[targetCompName]) return;
    setIsWaving(prev => ({ ...prev, [targetCompName]: true }));

    try {
      await telemetryApi.wave(sender, targetCompName);
    } catch (err) {
      console.error('Failed to send wave:', err);
    }

    // Reset throttle after 3.5 seconds
    setTimeout(() => {
      setIsWaving(prev => ({ ...prev, [targetCompName]: false }));
    }, 3500);
  };



  // Get status label
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'status-active': return 'Active'
      case 'status-offline': return 'Offline'
      default: return 'Unknown'
    }
  }

  return (
    <>
      {/* Received Waves Floating Toasts Overlay — rendered unconditionally (independent
          of isOpen) so login/wave toasts still fire while the drawer is closed. The
          drawer itself now also stays mounted at all times (see isOpen && wrapper
          below) so polling/prevPingsRef never resets on close. This container is
          position:fixed in CSS, so it doesn't need to live inside the drawer wrapper. */}
      <div className={`received-waves-toasts-container${isOpen ? ' drawer-open' : ''}`} aria-live="polite">
        {toasts.map(toast => (
          <div key={toast.id} className="wave-received-toast">
            {toast.type === 'login' ? (
              <div className="wave-toast-icon-login">🟢</div>
            ) : (
              <div className="wave-toast-hand">👋</div>
            )}
            <div className="wave-toast-content">
              {toast.type === 'login' ? (
                <><span className="wave-toast-sender">{toast.sender}</span> is online</>
              ) : (
                <><span className="wave-toast-sender">{toast.sender}</span> waved at you!</>
              )}
            </div>
          </div>
        ))}
      </div>

      {isOpen && (
        <div className="online-drawer-wrapper" ref={drawerRef}>
          <div className="online-drawer-header">
            <div className="online-drawer-title-row">
              <h3
                onClick={() => {
                  const newClicks = titleClicks + 1;
                  setTitleClicks(newClicks);
                  if (newClicks === 5) {
                    telemetryApi.unlockAchievement(myComputerName, 'easter_egg_hunter')
                      .then(() => {
                        fetchWorkstations();
                        // Play a quick cute unlock chime!
                        playEasterEggChime();
                      });
                  }
                }}
                style={{ cursor: 'pointer', userSelect: 'none' }}
                title="Click 5 times for a secret reward! 🤫"
              >
                Online Users
              </h3>
              <button
                className="online-drawer-close-btn"
                onClick={() => {
                  setIsOpen(false)
                  window.dispatchEvent(new CustomEvent('kmti:online-drawer-status', { detail: { open: false } }))
                }}
                title="Close Panel"
                aria-label="Close Online Users Panel"
              >
                &times;
              </button>
            </div>

            {/* Tab Toggle */}
            <div className="online-drawer-tabs">
              <button
                className={`drawer-tab ${activeTab === 'chats' ? 'active' : ''}`}
                onClick={() => setActiveTab('chats')}
              >
                Chats
              </button>
              <button
                className={`drawer-tab ${activeTab === 'online' ? 'active' : ''}`}
                onClick={() => setActiveTab('online')}
              >
                Online
              </button>
              <button
                className={`drawer-tab ${activeTab === 'offline' ? 'active' : ''}`}
                onClick={() => setActiveTab('offline')}
              >
                Offline
              </button>
            </div>

            <div className="online-drawer-search-wrapper">
              <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                ref={searchInputRef}
                className="online-drawer-search"
                placeholder={activeTab === 'chats' ? 'Search chats or groups...' : 'Search active users...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search users or chats"
              />
              {searchQuery && (
                <button className="search-clear-btn" onClick={() => setSearchQuery('')}>&times;</button>
              )}
            </div>
          </div>

          <div className="online-drawer-body">
            {isLoading && workstations.length === 0 ? (
              <div className="online-drawer-loading">
                <svg className="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="8" />
                </svg>
                <span>Fetching status...</span>
              </div>
            ) : (
              <div className="online-drawer-list">
                {activeTab === 'chats' ? (
                  <>
                    <button className="create-group-btn" onClick={handleOpenCreateGroup}>
                      <span>+ Create Group Chat</span>
                    </button>

                    <div className="chat-section-title">Group Chats</div>
                    {filteredGroups.length === 0 ? (
                      <div className="online-drawer-empty" style={{ padding: '10px 0' }}>No groups joined.</div>
                    ) : (
                      filteredGroups.map(g => {
                        const unread = chatUnreadCounts[`group:${g.group_id}`] || g.unread_count || 0
                        const subtitle = g.last_message
                          ? `${g.last_message.sender === user?.username ? 'You' : g.last_message.sender}: ${g.last_message.content}`
                          : `${g.members.length} members`
                        return (
                          <div
                            key={`group_${g.group_id}`}
                            className={`global-chat-entry-card group-card ${unread > 0 ? 'is-unread' : 'is-read'}`}
                            onClick={() => handleOpenChat(null, g.name, g.group_id)}
                          >
                            <div className="global-chat-icon">👥</div>
                            <div className="global-chat-info">
                              <span className="global-chat-title">{g.name}</span>
                              <span className="global-chat-subtitle">{subtitle}</span>
                            </div>
                            {unread > 0 && <span className="drawer-unread-badge">{unread}</span>}
                            <button
                              className="chat-thread-delete-btn"
                              onClick={(e) => handleDeleteConversation(e, null, g.group_id)}
                              title="Delete conversation"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </button>
                          </div>
                        )
                      })
                    )}

                    <div className="chat-section-title">Direct Messages</div>
                    {filteredActiveDms.length === 0 ? (
                      <div className="online-drawer-empty" style={{ padding: '10px 0' }}>No active conversations.</div>
                    ) : (
                      filteredActiveDms.map(dm => {
                        const dmUsername = dm.peer
                        const ws = workstations.find(w => w.current_user === dmUsername)
                        const status = ws ? getStatusClass(ws.last_ping, ws.active_module) : 'status-offline'
                        const displayName = ws?.display_name || getDisplayName(dmUsername) || dmUsername
                        const unread = chatUnreadCounts[dmUsername] || dm.unread_count || 0
                        const subtitle = dm.last_message
                          ? `${dm.last_message.sender === user?.username ? 'You' : dm.last_message.sender}: ${dm.last_message.content}`
                          : 'No messages yet'

                        return (
                          <div
                            key={`dm_${dmUsername}`}
                            className={`global-chat-entry-card dm-card ${status} ${unread > 0 ? 'is-unread' : 'is-read'}`}
                            onClick={() => handleOpenChat(dmUsername, displayName)}
                          >
                            <div className="global-chat-icon" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                              <div className="user-avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden' }}>
                                {ws ? (
                                  renderEquippedSkin(ws.computer_name || ws.ip_address, ws.achievements, ws.equipped_skin)
                                ) : (
                                  renderEquippedSkin('', null, 'rookie')
                                )}
                              </div>
                              <span className={`status-badge-dot ${status}`} style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '8px', height: '8px', border: '1.5px solid var(--bg-primary)', borderRadius: '50%' }}></span>
                            </div>
                            <div className="global-chat-info">
                              <span className="global-chat-title">{displayName}</span>
                              <span className="global-chat-subtitle">{subtitle}</span>
                            </div>
                            {unread > 0 && <span className="drawer-unread-badge">{unread}</span>}
                            <button
                              className="chat-thread-delete-btn"
                              onClick={(e) => handleDeleteConversation(e, dmUsername, null)}
                              title="Delete conversation"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </button>
                          </div>
                        )
                      })
                    )}
                  </>
                ) : filteredWorkstations.length === 0 ? (
                  <div className="online-drawer-empty">
                    {searchQuery ? 'No matching users found.' : 'No active users seen recently.'}
                  </div>
                ) : (
                  filteredWorkstations.map(ws => {
                    const status = getStatusClass(ws.last_ping, ws.active_module)
                    const isMe = ws.computer_name === myComputerName && myComputerName !== ''

                    return (
                      <WorkstationCard
                        key={`${ws.ip_address}_${isMe ? equippedSkinTrigger : 0}`}
                        ws={ws}
                        status={status}
                        isMe={isMe}
                        isWaving={!!isWaving[ws.computer_name || '']}
                        myComputerName={myComputerName}
                        appVersion={appVersion}
                        onSendWave={handleSendWave}
                        onEditAvatar={isMe ? () => setShowAvatarSelector(true) : undefined}
                        formatRelative={formatRelative}
                        getStatusLabel={getStatusLabel}
                        stripEmoji={stripEmoji}
                        onOpenChat={handleOpenChat}
                        unreadCount={ws.current_user ? chatUnreadCounts[ws.current_user] : 0}
                      />
                    )
                  })
                )}
              </div>
            )}
          </div>

          <div className="online-drawer-footer">
            {hasRole('admin', 'it') && stats && (
              <div className="shift-ticker-container">
                <div className="shift-ticker-inner">
                  <span className="ticker-item">🔥 Peak Active Workstations Today: {stats.peak_users}</span>
                  <span className="ticker-item">👋 Wave Signals Transmitted: {stats.waves_exchanged}</span>
                  <span className="ticker-item">🏆 Friendly Wave Leader: {stats.wave_leader}</span>
                  <span className="ticker-item">⚙️ Active Workstation Focus: {stats.most_active_module}</span>
                </div>
              </div>
            )}
            <div className="status-legend-bar">
              <div className="legend-badge"><span className="legend-dot status-active"></span> Active</div>
              <div className="legend-badge"><span className="legend-dot status-idle"></span> Idle</div>
              <div className="legend-badge"><span className="legend-dot status-offline"></span> Offline</div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded active Chat Boxes */}
      {activeChats.filter(c => !c.isMinimized).map(chat => {
        const peerStatus = chat.peer ? workstations.find(w => w.current_user === chat.peer) : null
        return (
          <ChatBox
            key={chat.groupId !== null ? `chat_g_${chat.groupId}` : `chat_p_${chat.peer}`}
            peer={chat.peer}
            groupId={chat.groupId}
            peerLabel={chat.peerLabel}
            onClose={() => {
              setActiveChats(prev => prev.filter(c =>
                !(chat.groupId !== null && c.groupId === chat.groupId) &&
                !(chat.groupId === null && c.peer === chat.peer && c.groupId === null)
              ))
            }}
            onMinimize={() => {
              setActiveChats(prev => prev.map(c =>
                ((chat.groupId !== null && c.groupId === chat.groupId) ||
                  (chat.groupId === null && c.peer === chat.peer && c.groupId === null))
                  ? { ...c, isMinimized: true }
                  : c
              ))
            }}
            currentUsername={user?.username}
            onEditGroup={() => {
              const g = threads.find(x => x.type === 'group' && x.group_id === chat.groupId)
              if (g) handleOpenEditGroup(g)
            }}
            peerStatus={peerStatus}
            drawerOpen={isOpen}
          />
        )
      })}

      {/* Radial Arc Chatheads (All active conversations) */}
      {(() => {
        const N = activeChats.length
        if (N === 0) return null

        // Orbit coordinates math around FAB
        const R = 105 // Moved closer to the FAB as requested
        const base_y = 30
        const base_x = isOpen ? 345 : 30 // Dynamic offset based on drawer open/closed status

        const visibleChats = activeChats.slice(0, 3)
        const hiddenCount = Math.max(0, N - 3)
        const totalArcItems = visibleChats.length + (hiddenCount > 0 ? 1 : 0)

        const elements: JSX.Element[] = []

        const getCoordinates = (i: number, total: number) => {
          let theta = Math.PI / 4 // default 45 degrees
          if (total > 1) {
            const startAngle = 0 // 0 degrees (Bottom-Left) - Newest chat
            const endAngle = Math.PI / 2 // 90 degrees (Top-Right) - Oldest/+N badge
            theta = startAngle + i * ((endAngle - startAngle) / (total - 1))
          }
          const x = base_x + R * Math.cos(theta)
          const y = base_y + R * Math.sin(theta)
          return { x, y }
        }

        visibleChats.forEach((chat, i) => {
          const { x, y } = getCoordinates(i, totalArcItems)

          const peerStatus = chat.peer ? workstations.find(w => w.current_user === chat.peer) : null
          const isOffline = chat.peer && (!peerStatus || (peerStatus.last_ping && (Date.now() - new Date(peerStatus.last_ping).getTime() > 300000)) || peerStatus.active_module === 'offline')
          const isCurrentExpanded = !chat.isMinimized

          elements.push(
            <div
              key={chat.groupId !== null ? `head_g_${chat.groupId}` : `head_p_${chat.peer}`}
              className={`online-drawer-chat-box is-minimized ${isCurrentExpanded ? 'is-expanded-head' : ''}`}
              style={{
                position: 'fixed',
                right: `${x}px`,
                bottom: `${y}px`,
                zIndex: 3100 - i, // Newest active chat (index 0) gets highest z-index
                transition: 'right 0.3s cubic-bezier(0.16, 1, 0.3, 1), bottom 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              onClick={() => {
                if (isCurrentExpanded) {
                  setActiveChats(prev => prev.map(c => {
                    const isTarget = (chat.groupId !== null && c.groupId === chat.groupId) ||
                      (chat.groupId === null && c.peer === chat.peer && c.groupId === null)
                    if (isTarget) {
                      return { ...c, isMinimized: true }
                    }
                    return c
                  }))
                } else {
                  handleOpenChat(chat.peer, chat.peerLabel, chat.groupId, false)
                }
              }}
              title={isCurrentExpanded ? `Minimize chat with ${chat.peerLabel}` : `Open chat with ${chat.peerLabel}`}
            >
              <div className="chathead-avatar-wrapper" style={{ position: 'relative', width: '48px', height: '48px', cursor: 'pointer' }}>
                {chat.groupId !== null ? (
                  <div className="chathead-group-avatar" style={{ fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: 'var(--accent, #0099ff)', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>👥</div>
                ) : chat.peer === '__global__' ? (
                  <div className="chathead-group-avatar" style={{ fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: 'var(--accent, #0099ff)', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>🌐</div>
                ) : (
                  <>
                    <div
                      className="user-avatar"
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        filter: isOffline ? 'grayscale(1)' : 'none',
                        opacity: isOffline ? 0.6 : 1
                      }}
                    >
                      {peerStatus ? (
                        renderEquippedSkin(peerStatus.computer_name || peerStatus.ip_address, peerStatus.achievements, peerStatus.equipped_skin)
                      ) : (
                        renderEquippedSkin('', null, 'rookie')
                      )}
                    </div>
                    <span
                      className={`status-badge-dot ${isOffline ? 'status-offline' : 'status-active'}`}
                      style={{
                        position: 'absolute',
                        bottom: '0px',
                        right: '0px',
                        width: '12px',
                        height: '12px',
                        border: '2px solid var(--bg-primary, #ffffff)',
                        borderRadius: '50%'
                      }}
                    ></span>
                  </>
                )}

                {(() => {
                  const key = chat.groupId !== null ? `group:${chat.groupId}` : chat.peer || ''
                  const unread = chatUnreadCounts[key] || 0
                  if (unread > 0) {
                    return (
                      <div
                        style={{
                          position: 'absolute',
                          top: '-4px',
                          right: '-4px',
                          background: '#ef4444',
                          color: 'white',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          minWidth: '18px',
                          height: '18px',
                          borderRadius: '9px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 10,
                          padding: '0 4px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                      >
                        {unread > 99 ? '99+' : unread}
                      </div>
                    )
                  }
                  return null
                })()}

                {(() => {
                  const key = chat.groupId !== null ? `group:${chat.groupId}` : chat.peer || ''
                  const preview = chatPreviews[key]
                  if (preview && !isCurrentExpanded) {
                    return (
                      <div className="chathead-preview-bubble">
                        {preview.text}
                      </div>
                    )
                  }
                  return null
                })()}

                {isCurrentExpanded && (
                  <div
                    className="chathead-expanded-overlay"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(0, 0, 0, 0.65)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontSize: '24px',
                      fontWeight: 'bold',
                      zIndex: 5
                    }}
                  >
                    &times;
                  </div>
                )}

                <button
                  className="chathead-close-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveChats(prev => prev.filter(c =>
                      !(chat.groupId !== null && c.groupId === chat.groupId) &&
                      !(chat.groupId === null && c.peer === chat.peer && c.groupId === null)
                    ))
                  }}
                  title="Close chat"
                >
                  &times;
                </button>
              </div>
            </div>
          )
        })

        if (hiddenCount > 0) {
          const { x, y } = getCoordinates(totalArcItems - 1, totalArcItems)
          elements.push(
            <div
              key="head_hidden_count"
              className="online-drawer-chat-box is-minimized"
              style={{
                position: 'fixed',
                right: `${x}px`,
                bottom: `${y}px`,
                zIndex: 3100 - totalArcItems, // Badge gets lowest z-index
                transition: 'right 0.3s cubic-bezier(0.16, 1, 0.3, 1), bottom 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              title={`${hiddenCount} more active chats`}
            >
              <div className="chathead-avatar-wrapper" style={{ position: 'relative', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary, #1e293b)', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '14px' }}>
                +{hiddenCount}
              </div>
            </div>
          )
        }

        return elements
      })()}

      {/* Group Creation/Editing Modal */}
      {showGroupModal && (
        <div className="group-modal-backdrop">
          <form className="group-modal-content" onSubmit={handleGroupFormSubmit}>
            <div className="group-modal-header">
              <h4>{groupModalMode === 'create' ? 'Create Group Chat' : 'Edit Group Members'}</h4>
              <button type="button" className="group-modal-close" onClick={() => setShowGroupModal(false)}>&times;</button>
            </div>
            <div className="group-modal-body">
              <div className="form-group">
                <label>Group Name</label>
                <input
                  type="text"
                  value={groupFormName}
                  onChange={(e) => setGroupFormName(e.target.value)}
                  placeholder="Enter group name..."
                  required
                />
              </div>
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label>Select Members</label>
                <div className="members-checkbox-list">
                  {usersList
                    .filter(u => u.username !== user?.username)
                    .map(u => (
                      <label key={u.id || u.username} className="member-checkbox-row">
                        <input
                          type="checkbox"
                          checked={groupFormMembers.includes(u.username)}
                          onChange={() => toggleGroupMember(u.username)}
                        />
                        <span>{u.fullName || getDisplayName(u.username) || u.username}</span>
                      </label>
                    ))
                  }
                </div>
              </div>
            </div>
            <div className="group-modal-footer">
              <button type="button" className="group-btn-secondary" onClick={() => setShowGroupModal(false)}>Cancel</button>
              <button type="submit" className="group-btn-primary">
                {groupModalMode === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Achievement Unlock Modal — appears when a new achievement is detected for THIS workstation */}
      <AchievementUnlockModal
        achievement={pendingAchievement}
        onClose={() => setPendingAchievement(null)}
      />

      {/* Avatar Picker Modal — opened via the pencil button on the user's own card */}
      {showAvatarSelector && (
        <AvatarPickerModal
          computerName={myComputerName}
          achievements={workstations.find(ws => ws.computer_name === myComputerName && myComputerName !== '')?.achievements}
          equippedSkinFromServer={workstations.find(ws => ws.computer_name === myComputerName && myComputerName !== '')?.equipped_skin}
          onClose={() => setShowAvatarSelector(false)}
          onSaved={() => {
            setEquippedSkinTrigger(prev => prev + 1)
            // Immediately refresh so peers see the new skin without waiting for next poll
            fetchWorkstations()
          }}
        />
      )}
    </>
  )
}
