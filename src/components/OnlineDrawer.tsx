import React, { useState, useEffect, useRef, useMemo } from 'react'
import { telemetryApi } from '../services/api'
import { version as appVersion } from '../../package.json'
import './OnlineDrawer.css'

interface WorkstationStatus {
  ip_address: string;
  computer_name?: string;
  active_module: string;
  current_user: string;
  version: string;
  last_ping: string;
}

export default function OnlineDrawer() {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [workstations, setWorkstations] = useState<WorkstationStatus[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Listen to toggle event
  useEffect(() => {
    const handleToggle = () => {
      setIsOpen(prev => {
        const next = !prev
        window.dispatchEvent(new CustomEvent('kmti:online-drawer-status', { detail: { open: next } }))
        return next
      })
    }

    const handleClose = () => {
      setIsOpen(false)
      window.dispatchEvent(new CustomEvent('kmti:online-drawer-status', { detail: { open: false } }))
    }

    window.addEventListener('kmti:toggle-online-drawer', handleToggle)
    window.addEventListener('kmti:close-online-drawer', handleClose)

    return () => {
      window.removeEventListener('kmti:toggle-online-drawer', handleToggle)
      window.removeEventListener('kmti:close-online-drawer', handleClose)
    }
  }, [])

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

  // Get user avatar initials
  const getInitials = (name: string) => {
    const clean = name.trim()
    if (!clean) return 'U'
    const parts = clean.split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return clean.slice(0, 2).toUpperCase()
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

              return (
                <div key={ws.ip_address} className={`online-user-card ${status}`}>
                  <div className="avatar-container">
                    <div className="user-avatar">
                      {getInitials(userDisplayName)}
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
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="online-drawer-footer">
        <div className="status-legend-bar">
          <div className="legend-badge"><span className="legend-dot status-active"></span> Active</div>
          <div className="legend-badge"><span className="legend-dot status-minimized"></span> Minimized</div>
          <div className="legend-badge"><span className="legend-dot status-idle"></span> Idle</div>
          <div className="legend-badge"><span className="legend-dot status-away"></span> Offline</div>
        </div>
      </div>
    </div>
  )
}
