import { useState, useEffect, useRef, useMemo } from 'react'
import { telemetryApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { version as appVersion } from '../../package.json'
import './OnlineDrawer.css'

interface WorkstationStatus {
  ip_address: string;
  computer_name?: string;
  active_module: string;
  current_user: string;
  version: string;
  last_ping: string;
  status_message?: string;
}

export default function OnlineDrawer() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [workstations, setWorkstations] = useState<WorkstationStatus[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [myComputerName, setMyComputerName] = useState<string>('')

  // Wave/Ping states
  const [toasts, setToasts] = useState<{ id: string; sender: string }[]>([])
  const [isWaving, setIsWaving] = useState<Record<string, boolean>>({}) // click throttling

  const drawerRef = useRef<HTMLDivElement>(null)

  // Fetch local hostname/workstation name on mount
  useEffect(() => {
    if ((window as any).electronAPI?.getWorkstationInfo) {
      (window as any).electronAPI.getWorkstationInfo()
        .then((info: any) => setMyComputerName(info.computerName))
        .catch(() => setMyComputerName(sessionStorage.getItem('kmti_dev_name') || 'Browser'));
    } else {
      setMyComputerName(sessionStorage.getItem('kmti_dev_name') || 'Browser');
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

  // Fetch workstations telemetry
  const fetchWorkstations = async () => {
    setIsLoading(true)
    try {
      const res = await telemetryApi.getStatuses()
      if (res.data?.data) {
        setWorkstations(res.data.data)
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
      const interval = setInterval(fetchWorkstations, 15000)
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
        const user = (ws.current_user || 'Guest').toLowerCase()
        const comp = (ws.computer_name || ws.ip_address).toLowerCase()
        const mod = (ws.active_module || '').toLowerCase()
        return user.includes(term) || comp.includes(term) || mod.includes(term)
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

  // Cute, premium deterministic inline SVG Engineer avatar generator
  const renderCuteAvatar = (seed: string) => {
    // Roles corresponding to helmet colors in the industry:
    // White = Engineer / Supervisor
    // Yellow = Construction / Operator
    // Blue = Technical Operator / Electrician
    // Orange = Safety Inspector / Road Crew
    const HELMET_COLORS = [
      { name: 'white', dome: '#F8FAFC', brim: '#E2E8F0', crest: '#CBD5E1', badge: '#1E293B', text: 'ENG' },
      { name: 'yellow', dome: '#FBBF24', brim: '#F59E0B', crest: '#D97706', badge: '#1E293B', text: 'OPS' },
      { name: 'blue', dome: '#3B82F6', brim: '#2563EB', crest: '#1D4ED8', badge: '#FFFFFF', text: 'TEC' },
      { name: 'orange', dome: '#F97316', brim: '#EA580C', crest: '#C2410C', badge: '#FFFFFF', text: 'SAF' }
    ];

    const VEST_COLORS = ['#EF4444', '#10B981', '#F59E0B', '#3B82F6', '#6366F1'];
    const HAIR_COLORS = ['#1E293B', '#475569', '#78350F', '#B45309', '#0F172A'];
    const BG_GRADIENTS = [
      { bg1: '#0F172A', bg2: '#1E293B', grid: '#38BDF8' }, // Dark Tech / Blueprint Blue
      { bg1: '#0B132B', bg2: '#1C2541', grid: '#48CAE4' }, // Cyberpunk Navy
      { bg1: '#111827', bg2: '#374151', grid: '#9CA3AF' }  // Steel Grey
    ];

    const EYE_TYPES = ['round', 'happy', 'wink', 'goggles', 'cute-anime'];
    const MOUTH_TYPES = ['smile', 'happy-open', 'cat-mouth', 'shy'];
    const ACCESSORY_TYPES = ['none', 'headset', 'goggles-on-helmet', 'both'];

    // Simple hash function
    let hash = 0;
    const cleanSeed = seed.trim();
    for (let i = 0; i < cleanSeed.length; i++) {
      hash = cleanSeed.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);

    const helmet = HELMET_COLORS[hash % HELMET_COLORS.length];
    const vestColor = VEST_COLORS[(hash + 1) % VEST_COLORS.length];
    const hairColor = HAIR_COLORS[(hash + 2) % HAIR_COLORS.length];
    const bg = BG_GRADIENTS[(hash + 3) % BG_GRADIENTS.length];

    const eyeType = EYE_TYPES[(hash + 4) % EYE_TYPES.length];
    const mouthType = MOUTH_TYPES[(hash + 5) % MOUTH_TYPES.length];
    const accessory = ACCESSORY_TYPES[(hash + 6) % ACCESSORY_TYPES.length];
    const hasBlush = (hash + 7) % 2 === 0;

    const gradId = `avatar-grad-${hash}`;

    return (
      <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={bg.bg1} />
            <stop offset="100%" stopColor={bg.bg2} />
          </linearGradient>
        </defs>

        {/* Background Gradient */}
        <rect width="100" height="100" fill={`url(#${gradId})`} />

        {/* Engineering Blueprint Grid Overlay */}
        <g opacity="0.15" stroke={bg.grid} strokeWidth="0.5">
          <line x1="0" y1="20" x2="100" y2="20" />
          <line x1="0" y1="40" x2="100" y2="40" />
          <line x1="0" y1="60" x2="100" y2="60" />
          <line x1="0" y1="80" x2="100" y2="80" />
          <line x1="20" y1="0" x2="20" y2="100" />
          <line x1="40" y1="0" x2="40" y2="100" />
          <line x1="60" y1="0" x2="60" y2="100" />
          <line x1="80" y1="0" x2="80" y2="100" />
          {/* Blueprint Circles/Accents */}
          <circle cx="50" cy="50" r="45" fill="none" />
          <circle cx="50" cy="50" r="25" fill="none" />
        </g>

        {/* Headsets / Ear Defenders (behind the head) */}
        {(accessory === 'headset' || accessory === 'both') && (
          <g fill="#334155" stroke="#1E293B" strokeWidth="1.5">
            {/* Left Ear Muff */}
            <rect x="14" y="44" width="8" height="18" rx="4" />
            <rect x="16" y="47" width="4" height="12" rx="2" fill="#475569" />
            {/* Right Ear Muff */}
            <rect x="78" y="44" width="8" height="18" rx="4" />
            <rect x="80" y="47" width="4" height="12" rx="2" fill="#475569" />
            {/* Headband */}
            <path d="M 18 45 A 32 32 0 0 1 82 45" fill="none" stroke="#334155" strokeWidth="3" />
          </g>
        )}

        {/* Base Body/Shirt */}
        <path d="M 32 82 L 68 82 L 78 100 L 22 100 Z" fill="#334155" />

        {/* Safety Vest */}
        <path d="M 34 82 L 66 82 L 76 100 L 24 100 Z" fill={vestColor} />
        {/* Silver Reflective Vest Stripes */}
        <rect x="38" y="82" width="5" height="18" fill="#CBD5E1" />
        <rect x="57" y="82" width="5" height="18" fill="#CBD5E1" />
        {/* Inner Shirt Collar */}
        <polygon points="45,82 55,82 50,89" fill="#1E293B" />

        {/* Head/Face Base */}
        <circle cx="50" cy="58" r="24" fill="#FEE2E2" />

        {/* Hair Bangs under Helmet */}
        <path d="M 28 44 Q 38 52 46 44 Q 54 52 62 44 Q 70 50 72 44 Z" fill={hairColor} />

        {/* Hard Hat / Safety Helmet */}
        <g>
          {/* Helmet Crest */}
          <path d="M 45 28 C 45 18, 55 18, 55 28 Z" fill={helmet.crest} />
          {/* Helmet Dome */}
          <path d="M 26 44 C 26 24, 74 24, 74 44 Z" fill={helmet.dome} />
          {/* Helmet Brim */}
          <path d="M 18 44 Q 50 48 82 44 Q 82 41 78 41 Q 50 43 22 41 Q 18 41 18 44 Z" fill={helmet.brim} />
          {/* Tiny Badge on Helmet Center */}
          <circle cx="50" cy="34" r="5" fill={helmet.badge} />
          <polygon points="50,31 53,33 53,36 50,38 47,36 47,33" fill={helmet.dome} />
          <text x="50" y="37.2" fill={helmet.badge} fontSize="2.8" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="900" textAnchor="middle">{helmet.text}</text>
        </g>

        {/* Goggles resting on Helmet */}
        {(accessory === 'goggles-on-helmet' || accessory === 'both') && (
          <g>
            <rect x="30" y="36" width="40" height="7" rx="2" fill="#E2E8F0" opacity="0.9" stroke="#334155" strokeWidth="1" />
            <circle cx="40" cy="39.5" r="2.5" fill="#38BDF8" opacity="0.6" />
            <circle cx="60" cy="39.5" r="2.5" fill="#38BDF8" opacity="0.6" />
            <line x1="28" y1="39.5" x2="72" y2="39.5" stroke="#1E293B" strokeWidth="1.5" />
          </g>
        )}

        {/* Cheek Blush */}
        {hasBlush && (
          <g fill="#F43F5E" opacity="0.35">
            <ellipse cx="36" cy="62" rx="4" ry="2" />
            <ellipse cx="64" cy="62" rx="4" ry="2" />
          </g>
        )}

        {/* Eyes */}
        <g fill="#1E293B">
          {eyeType === 'round' && (
            <>
              <circle cx="40" cy="56" r="3.2" />
              <circle cx="60" cy="56" r="3.2" />
              {/* Catchlights */}
              <circle cx="41.2" cy="54.8" r="1" fill="#FFFFFF" />
              <circle cx="61.2" cy="54.8" r="1" fill="#FFFFFF" />
            </>
          )}

          {eyeType === 'happy' && (
            <>
              {/* Happy eyes ^ ^ */}
              <path d="M 35 58 Q 40 50 45 58" fill="none" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 55 58 Q 60 50 65 58" fill="none" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
            </>
          )}

          {eyeType === 'wink' && (
            <>
              {/* Wink left, open right */}
              <path d="M 35 56 Q 40 62 45 56" fill="none" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="60" cy="56" r="3.2" />
              <circle cx="61.2" cy="54.8" r="1" fill="#FFFFFF" />
            </>
          )}

          {eyeType === 'goggles' && (
            <g>
              {/* Engineering Safety Goggles / Protective Glasses */}
              <rect x="30" y="50" width="16" height="10" rx="3" fill="rgba(56, 189, 248, 0.4)" stroke="#1D4ED8" strokeWidth="1.5" />
              <rect x="54" y="50" width="16" height="10" rx="3" fill="rgba(56, 189, 248, 0.4)" stroke="#1D4ED8" strokeWidth="1.5" />
              <line x1="46" y1="55" x2="54" y2="55" stroke="#1D4ED8" strokeWidth="1.5" />
              {/* Goggle shines */}
              <line x1="33" y1="52" x2="38" y2="57" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
              <line x1="57" y1="52" x2="62" y2="57" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
            </g>
          )}

          {eyeType === 'cute-anime' && (
            <>
              <ellipse cx="40" cy="56" rx="4" ry="5.5" />
              <ellipse cx="60" cy="56" rx="4" ry="5.5" />
              <circle cx="41.2" cy="53.5" r="1.5" fill="#FFFFFF" />
              <circle cx="39" cy="58.5" r="0.7" fill="#FFFFFF" />
              <circle cx="61.2" cy="53.5" r="1.5" fill="#FFFFFF" />
              <circle cx="59" cy="58.5" r="0.7" fill="#FFFFFF" />
            </>
          )}
        </g>

        {/* Mouth */}
        <g>
          {mouthType === 'smile' && (
            <path d="M 46 65 Q 50 69 54 65" fill="none" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
          )}

          {mouthType === 'happy-open' && (
            <path d="M 46 64 Q 50 72 54 64 Z" fill="#F43F5E" stroke="#1E293B" strokeWidth="1.8" strokeLinecap="round" />
          )}

          {mouthType === 'cat-mouth' && (
            <path d="M 45 64 Q 47.5 66.5 50 64 Q 52.5 66.5 55 64" fill="none" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" />
          )}

          {mouthType === 'shy' && (
            <line x1="46" y1="65" x2="54" y2="65" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" />
          )}
        </g>
      </svg>
    )
  }

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
          <h3>Online Users</h3>
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
              const isMinimized = ws.active_module?.startsWith('💤')
              const cleanModule = stripEmoji(isMinimized ? ws.active_module.replace('💤', '').trim() : (ws.active_module || ''))
              const isOutdated = ws.version && ws.version !== appVersion
              const userDisplayName = ws.current_user || 'Guest'

              // Determine if it is the active user's own card to hide waving button
              const isMe = (ws.computer_name === myComputerName) || (ws.current_user === user?.username && ws.current_user !== 'USER');

              return (
                <div key={ws.ip_address} className={`online-user-card ${status}`}>
                  <div className="avatar-container">
                    <div className="user-avatar">
                      {renderCuteAvatar(ws.computer_name || ws.ip_address)}
                    </div>
                    <span className={`status-badge-dot ${status}`} title={getStatusLabel(status)}></span>
                  </div>

                  <div className="user-info-section">
                    <div className="user-header-row">
                      <span className="user-name" title={ws.computer_name || ws.ip_address}>
                        {ws.computer_name || ws.ip_address}
                      </span>
                      <span className="last-seen">{formatRelative(ws.last_ping)}</span>
                    </div>

                    <div className="user-detail-row">
                      <span className="active-module" title={cleanModule || 'Idle'}>
                        {isMinimized && <span className="minimized-label">💤 </span>}
                        {cleanModule || 'Idle'}
                      </span>
                      <span className="pc-name" title={userDisplayName}>
                        {userDisplayName}
                      </span>
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
                      className={`wave-action-btn ${isWaving[ws.computer_name || ''] ? 'waving-sent' : ''}`}
                      onClick={() => handleSendWave(ws.computer_name || ws.ip_address)}
                      title={`Send Wave to ${ws.computer_name || 'Workstation'}`}
                      disabled={isWaving[ws.computer_name || '']}
                    >
                      👋
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="online-drawer-footer">
        <div className="status-legend-bar">
          <div className="legend-badge"><span className="legend-dot status-active"></span> Active</div>
          <div className="legend-badge"><span className="legend-dot status-idle"></span> Idle</div>
          <div className="legend-badge"><span className="legend-dot status-away"></span> Offline</div>
        </div>
      </div>
    </div>
  )
}
