/**
 * CollaborationBar.tsx
 * ─────────────────────────────────────────────────────────────────
 * Displays the real-time collaboration status at the top of the
 * Quotation page — connected users and Auto-Save status.
 */

import type { RemoteUser } from '../../hooks/quotation/useCollaboration'
import './CollaborationBar.css'

interface Props {
  remoteUsers: Record<string, RemoteUser>
  myColor: string
  userName: string
  quotNo: string | null
  isSyncing?: boolean
  onExportExcel?: () => void
}

const FileSpreadsheet = ({ size = 14, ...props }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M8 13h2" />
    <path d="M8 17h2" />
    <path d="M14 13h2" />
    <path d="M14 17h2" />
  </svg>
)

export function CollaborationBar({ remoteUsers, myColor, userName, quotNo, isSyncing, onExportExcel }: Props) {
  if (!quotNo) return null

  const others = Object.values(remoteUsers)

  return (
    <div className="collab-bar-mini">
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

      <div className="toolbar-divider" />

      {/* Primary Actions */}
      <div className="collab-bar__actions">
        {onExportExcel && (
          <button 
            className="collab-bar-btn collab-bar-btn--excel" 
            onClick={onExportExcel}
            title="Export to Excel (.xlsx)"
          >
            <FileSpreadsheet size={14} />
            <span>Excel</span>
          </button>
        )}
      </div>

      <div className="toolbar-divider" />

      {/* Active user avatars only */}
      <div className="collab-bar__users">
        {/* Me */}
        <div
          className="collab-avatar collab-avatar--me"
          style={{ background: myColor }}
          title={`${userName || 'User'} (You)`}
        >
          {(userName || 'U').charAt(0).toUpperCase()}
        </div>

        {/* Other connected users */}
        {others.map((u, idx) => (
          <div
            key={u.sid || `user-${idx}`}
            className="collab-avatar"
            style={{ background: u.color }}
            title={u.name || 'Unknown User'}
          >
            {(u.name || 'U').charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  )
}
