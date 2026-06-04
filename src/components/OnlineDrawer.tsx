import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { telemetryApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { getDisplayName } from '../utils/nameUtils'
import { version as appVersion } from '../../package.json'
import AchievementUnlockModal from './AchievementUnlockModal'
import AvatarPickerModal from './AvatarPickerModal'
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
}: WorkstationCardProps) {
  const avatarRef = useRef<HTMLDivElement>(null)

  const isMinimized = ws.active_module?.startsWith('💤')
  const cleanModule = stripEmoji(isMinimized ? ws.active_module.replace('💤', '').trim() : (ws.active_module || ''))
  const isOutdated = ws.version && ws.version !== appVersion

  return (
    <div className={`online-user-card ${status}`}>
      <div className="avatar-container" ref={avatarRef}>
        <div className="user-avatar">
          {renderEquippedSkin(ws.computer_name || ws.ip_address, ws.achievements, ws.equipped_skin)}
        </div>
        <span className={`status-badge-dot ${status}`} title={getStatusLabel(status)}></span>

        {/* Edit avatar button — only shows on your own card */}
        {isMe && onEditAvatar && (
          <button
            className="avatar-edit-btn"
            onClick={onEditAvatar}
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
          <span className="active-module" title={cleanModule || 'Idle'}>
            {isMinimized && <span className="minimized-label">💤 </span>}
            {cleanModule || 'Idle'}
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

      {/* Wave Interaction Button */}
      {!isMe && (
        <button
          className={`wave-action-btn ${isWaving ? 'waving-sent' : ''}`}
          onClick={() => onSendWave(ws.computer_name || ws.ip_address)}
          title={`Send Wave to ${ws.computer_name || 'Workstation'}`}
          disabled={isWaving}
        >
          👋
        </button>
      )}
    </div>
  )
}

// ─── OnlineDrawer ─────────────────────────────────────────────────────────────

export default function OnlineDrawer() {
  const { user, hasRole } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
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
  const [toasts, setToasts] = useState<{ id: string; sender: string }[]>([])
  const [isWaving, setIsWaving] = useState<Record<string, boolean>>({}) // click throttling

  // Achievement unlock modal
  const [pendingAchievement, setPendingAchievement] = useState<AchievementInfo | null>(null)

  // Avatar picker
  const [showAvatarSelector, setShowAvatarSelector] = useState(false)
  const [equippedSkinTrigger, setEquippedSkinTrigger] = useState(0)

  // Track previously seen achievements for THIS workstation (to detect new unlocks)
  const prevAchievementsRef = useRef<Record<string, boolean>>({})

  const drawerRef = useRef<HTMLDivElement>(null)

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
  const fetchStats = async () => {
    try {
      const res = await telemetryApi.getStats()
      if (res.data?.success) {
        setStats(res.data)
      }
    } catch (err) {
      console.error('[ONLINE DRAWER] Failed to fetch shift statistics:', err)
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
  const fetchWorkstations = async () => {
    setIsLoading(true)
    try {
      const res = await telemetryApi.getStatuses()
      if (res.data?.data) {
        setWorkstations(res.data.data)
        detectNewAchievements(res.data.data)
      }
    } catch (err) {
      console.error('[ONLINE DRAWER] Failed to fetch telemetry statuses:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchWorkstations()
      fetchStats()
      const interval = setInterval(() => {
        fetchWorkstations()
        fetchStats()
      }, 15000)
      return () => clearInterval(interval)
    }
  }, [isOpen])

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return

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
    return () => document.removeEventListener('mousedown', handleClickOutside)
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
    if (activeModule?.startsWith('💤')) return 'status-minimized';
    if (!lastPing) return 'status-away';
    const diffSeconds = (new Date().getTime() - new Date(lastPing).getTime()) / 1000;
    if (diffSeconds < 90) return 'status-active';
    if (diffSeconds < 180) return 'status-idle';
    return 'status-away';
  }

  // Filter and sort workstations: Active users first, alphabetically by username or PC name
  const filteredWorkstations = useMemo(() => {
    return workstations
      .filter(ws => {
        const term = searchQuery.toLowerCase()
        const u = (ws.current_user || 'Guest').toLowerCase()
        const comp = (ws.computer_name || ws.ip_address).toLowerCase()
        const mod = (ws.active_module || '').toLowerCase()
        return u.includes(term) || comp.includes(term) || mod.includes(term)
      })
      .sort((a, b) => {
        const statusA = getStatusClass(a.last_ping, a.active_module)
        const statusB = getStatusClass(b.last_ping, b.active_module)

        // Rank by status: Active > Minimized > Idle > Away
        const rank: Record<string, number> = {
          'status-active': 4,
          'status-minimized': 3,
          'status-idle': 2,
          'status-away': 1
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
  }, [workstations, searchQuery])

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
      case 'status-minimized': return 'Minimized'
      case 'status-idle': return 'Idle'
      case 'status-away':
      default:
        return 'Offline'
    }
  }

  if (!isOpen) return null

  return (
    <>
    <div className="online-drawer-wrapper" ref={drawerRef}>
      {/* Received Waves Floating Toasts Overlay */}
      <div className="received-waves-toasts-container">
        {toasts.map(toast => (
          <div key={toast.id} className="wave-received-toast">
            <div className="wave-toast-hand">👋</div>
            <div className="wave-toast-content">
              <span className="wave-toast-sender">{toast.sender}</span> waved at you!
            </div>
          </div>
        ))}
      </div>

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
          >
            &times;
          </button>
        </div>
        <div className="online-drawer-search-wrapper">
          <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="online-drawer-search"
            placeholder="Search active users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
        ) : filteredWorkstations.length === 0 ? (
          <div className="online-drawer-empty">
            {searchQuery ? 'No matching users found.' : 'No active users seen recently.'}
          </div>
        ) : (
          <div className="online-drawer-list">
            {filteredWorkstations.map(ws => {
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
                />
              )
            })}
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
          <div className="legend-badge"><span className="legend-dot status-away"></span> Offline</div>
        </div>
      </div>
    </div>

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
