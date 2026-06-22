/**
 * CollaborationBar.tsx
 * ─────────────────────────────────────────────────────────────────
 * Displays the real-time collaboration status at the top of the
 * Quotation page — connected users and Auto-Save status.
 * Uses workstation achievement skins for avatars when available.
 */

import { useState, useEffect } from 'react'
import type { RemoteUser } from '../../hooks/quotation/useCollaboration'
import { telemetryApi } from '../../services/api'
import { renderEquippedSkin } from '../Achievement'
import './CollaborationBar.css'

interface Props {
  remoteUsers: Record<string, RemoteUser>
  myColor: string
  userName: string
  quotNo: string | null
  isSyncing?: boolean
  onExportExcel?: () => void
}

export function CollaborationBar({ remoteUsers, myColor, userName, quotNo, isSyncing }: Props) {
  const [workstations, setWorkstations] = useState<any[]>([])

  // Fetch workstation statuses for avatar skins
  useEffect(() => {
    const fetchWS = () => {
      telemetryApi.getStatuses()
        .then(res => {
          if (res.data?.data) setWorkstations(res.data.data)
        })
        .catch(() => {})
    }
    fetchWS()
    const interval = setInterval(fetchWS, 15000)
    return () => clearInterval(interval)
  }, [])

  /** Find a workstation entry that matches by computerName, currentUser, or displayName */
  const findWS = (name: string) => {
    if (!name) return null
    const lower = name.toLowerCase()
    return workstations.find(w => {
      const pcName = (w.computer_name || '').toLowerCase()
      const curUser = (w.current_user || '').toLowerCase()
      const dispName = (w.display_name || '').toLowerCase()
      return pcName === lower || curUser === lower || dispName === lower
    }) ?? null
  }

  /** Returns a custom SVG skin node, or null if no workstation match */
  const getCustomAvatar = (name: string) => {
    const ws = findWS(name)
    if (!ws) return null
    return renderEquippedSkin(ws.computer_name || ws.ip_address, ws.achievements, ws.equipped_skin)
  }

  if (!quotNo) return null

  const others = Object.values(remoteUsers)

  return (
    <div className="collab-bar-mini collaboration-bar-root">
      {/* Sync Status */}
      <div className={`collab-sync-status ${isSyncing ? 'collab-sync-status--active' : ''}`}>
        {isSyncing ? (
          <>
            <svg className="sync-spinner" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <span>Syncing...</span>
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Saved</span>
          </>
        )}
      </div>

      {/* Active user avatars */}
      <div className="collab-bar__users">
        {/* Me */}
        {(() => {
          const customAvatar = getCustomAvatar(userName)
          return (
            <div
              className={`collab-avatar collab-avatar--me ${customAvatar ? 'collab-avatar--custom' : ''}`}
              style={customAvatar ? undefined : { background: myColor }}
              title={`${userName || 'User'} (You)`}
            >
              {customAvatar ?? (userName || 'U').charAt(0).toUpperCase()}
            </div>
          )
        })()}

        {/* Other connected users */}
        {others.map((u, idx) => {
          const customAvatar = getCustomAvatar(u.name)
          return (
            <div
              key={u.sid || `user-${idx}`}
              className={`collab-avatar ${customAvatar ? 'collab-avatar--custom' : ''}`}
              style={customAvatar ? undefined : { background: u.color }}
              title={u.name || 'Unknown User'}
            >
              {customAvatar ?? (u.name || 'U').charAt(0).toUpperCase()}
            </div>
          )
        })}
      </div>
    </div>
  )
}
