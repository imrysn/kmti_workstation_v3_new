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
    <div className="collab-bar-mini">
      {/* Active user avatars only */}
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
      </div>
    </div>
  )
}
