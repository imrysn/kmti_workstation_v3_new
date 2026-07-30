import { useState, useRef, useEffect, useMemo } from 'react'
import { useWorkstationTelemetry } from '../hooks/useWorkstationTelemetry'
import { renderEquippedSkin } from './Achievement'
import { useAuth } from '../context/AuthContext'
import './TeammatesPill.css'

export default function TeammatesPill() {
  const { user } = useAuth()
  const { workstations } = useWorkstationTelemetry(user)
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Filter active online teammates (pinged within 5 minutes & not offline)
  const onlineList = useMemo(() => {
    return workstations.filter(w => {
      if (!w.last_ping || w.active_module === 'offline') return false
      const diff = Date.now() - new Date(w.last_ping).getTime()
      return diff <= 300000
    })
  }, [workstations])

  const onlineCount = onlineList.length
  const topTeammates = onlineList.slice(0, 3)

  const [pulseState, setPulseState] = useState<'green' | 'red' | null>(null)
  const prevCountRef = useRef<number | null>(null)

  // Trigger pulse animation when online count changes
  useEffect(() => {
    if (prevCountRef.current !== null && prevCountRef.current !== onlineCount) {
      if (onlineCount > prevCountRef.current) {
        setPulseState('green')
      } else if (onlineCount < prevCountRef.current) {
        setPulseState('red')
      }

      const timer = setTimeout(() => setPulseState(null), 4000)
      return () => clearTimeout(timer)
    }
    prevCountRef.current = onlineCount
  }, [onlineCount])

  // Trigger pulse animation on real-time presence events (login/logout)
  useEffect(() => {
    const handlePresenceEvent = (e: any) => {
      const { type } = e.detail || {}
      if (type === 'login') {
        setPulseState('green')
      } else if (type === 'logout') {
        setPulseState('red')
      }
      const timer = setTimeout(() => setPulseState(null), 3000)
      return () => clearTimeout(timer)
    }
    window.addEventListener('kmti:user-presence-change', handlePresenceEvent as EventListener)
    return () => window.removeEventListener('kmti:user-presence-change', handlePresenceEvent as EventListener)
  }, [])

  // Close popover on outside click, Escape, or when Drawer opens
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false) }
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleDrawerStatus = (e: any) => {
      if (e.detail?.open) {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('kmti:online-drawer-status', handleDrawerStatus as EventListener)

    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('kmti:online-drawer-status', handleDrawerStatus as EventListener)
    }
  }, [])

  const handleStartChat = (username?: string, computerName?: string) => {
    const targetUser = username || computerName
    if (!targetUser) return
    window.dispatchEvent(
      new CustomEvent('open-chat-with', {
        detail: { username: targetUser, displayName: targetUser }
      })
    )
    setIsOpen(false)
  }

  const handleOpenDrawer = () => {
    window.dispatchEvent(new CustomEvent('kmti:toggle-online-drawer'))
    setIsOpen(false)
  }

  return (
    <div className="teammates-pill-wrapper" ref={popoverRef}>
      {/* Live Teammates Pill Button */}
      <button
        type="button"
        className={`teammates-pill-btn${isOpen ? ' active' : ''}${pulseState ? ` pulse-${pulseState}` : ''}`}
        onClick={() => setIsOpen(v => !v)}
        title="Active Online Teammates — Click to view"
      >
        {/* Avatar Stack (Max 3) */}
        {topTeammates.length > 0 ? (
          <div className="teammates-avatar-stack">
            {topTeammates.map((w, idx) => (
              <div key={w.computer_name || w.ip_address || idx} className="teammates-mini-avatar" style={{ zIndex: 10 - idx }}>
                {renderEquippedSkin(
                  w.computer_name || w.ip_address,
                  w.achievements,
                  w.equipped_skin,
                  w.current_user || undefined
                )}
              </div>
            ))}
          </div>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        )}

        <span className="teammates-label">
          {onlineCount > 0 ? `${onlineCount} Online` : 'Teammates'}
        </span>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="teammates-popover">
          <div className="teammates-popover-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="teammates-pulse-dot" />
              <span className="teammates-popover-title">Online Teammates ({onlineCount})</span>
            </div>
            <button
              type="button"
              className="teammates-drawer-link"
              onClick={handleOpenDrawer}
              title="Open full drawer"
            >
              More ➔
            </button>
          </div>

          <div className="teammates-popover-body">
            {onlineList.length === 0 ? (
              <div className="teammates-popover-empty">
                <p>No teammates online right now</p>
              </div>
            ) : (
              onlineList.map(w => {
                const name = w.current_user || w.computer_name || 'Workstation'
                const moduleName = w.active_module || 'Active'
                const isMe = (w.current_user || w.computer_name || '').toLowerCase() === (user?.username || '').toLowerCase()

                return (
                  <div key={w.computer_name || w.ip_address} className={`teammate-row${isMe ? ' is-me' : ''}`}>
                    <div className="teammate-row-avatar">
                      {renderEquippedSkin(
                        w.computer_name || w.ip_address,
                        w.achievements,
                        w.equipped_skin,
                        w.current_user || undefined
                      )}
                    </div>

                    <div className="teammate-row-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="teammate-row-name">{name}</span>
                        {isMe && <span className="teammate-you-badge">You</span>}
                      </div>
                      <span className="teammate-row-module">{moduleName}</span>
                    </div>

                    {!isMe ? (
                      <button
                        type="button"
                        className="teammate-chat-btn"
                        onClick={() => handleStartChat(w.current_user, w.computer_name)}
                        title={`Start chat with ${name}`}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        Chat
                      </button>
                    ) : (
                      <span className="teammate-me-tag">Active</span>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
