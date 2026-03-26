import { useAuth } from '../context/AuthContext'
import './SessionExpiredModal.css'

/**
 * SessionExpiredModal — shown when a 401 Unauthorized fires.
 * Gives the user a clear message and a "Re-Login" button that
 * triggers the animated logout → window-shrink sequence.
 */
export default function SessionExpiredModal() {
  const { sessionExpired, dismissSessionExpired } = useAuth()

  if (!sessionExpired) return null

  return (
    <div className="session-expired-backdrop">
      <div className="session-expired-modal">
        <div className="session-expired-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        <h2 className="session-expired-title">Session Expired</h2>
        <p className="session-expired-body">
          Your session has timed out due to inactivity or a credential change.
          Please sign in again to continue.
        </p>

        <button className="session-expired-btn" onClick={dismissSessionExpired}>
          Re-Login
        </button>
      </div>
    </div>
  )
}
