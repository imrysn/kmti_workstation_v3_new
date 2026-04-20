/**
 * CollaborationBar.tsx
 * ─────────────────────────────────────────────────────────────────
 * Displays the real-time collaboration status at the top of the
 * Quotation page — connected users and Auto-Save status.
 */

import type { RemoteUser } from '../../hooks/quotation/useCollaboration'
import './CollaborationBar.css'

interface Props {
  isConnected: boolean
  remoteUsers: Record<string, RemoteUser>
  myColor: string
  userName: string
  quotNo: string | null
}

export function CollaborationBar({ isConnected, remoteUsers, myColor, userName, quotNo }: Props) {
  if (!quotNo) return null

  const others = Object.values(remoteUsers)

  return (
    <div className={`collab-bar ${isConnected ? 'collab-bar--connected' : 'collab-bar--offline'}`}>
      {/* Connection status */}
      <div className="collab-bar__status">
        <span className={`collab-bar__dot ${isConnected ? 'collab-bar__dot--on' : 'collab-bar__dot--off'}`} />
        <span className="collab-bar__label">
          {isConnected ? 'Live · Auto-saving' : 'Offline'}
        </span>
      </div>

      {/* Active user avatars */}
      <div className="collab-bar__users">
        {/* Me */}
        <div
          className="collab-avatar collab-avatar--me"
          style={{ background: myColor }}
          title={`${userName} (You)`}
        >
          {userName.charAt(0).toUpperCase()}
        </div>

        {/* Other connected users */}
        {others.map((u, idx) => (
          <div
            key={u.sid || `user-${idx}`}
            className="collab-avatar"
            style={{ background: u.color }}
            title={u.name}
          >
            {u.name.charAt(0).toUpperCase()}
          </div>
        ))}

        {others.length > 0 && (
          <span className="collab-bar__count">
            +{others.length} editing
          </span>
        )}
      </div>
    </div>
  )
}
