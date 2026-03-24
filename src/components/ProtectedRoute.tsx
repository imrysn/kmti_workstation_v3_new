/**
 * ProtectedRoute — wraps a route element with role-based access control.
 *
 * Usage:
 *   <Route path="/settings" element={<ProtectedRoute roles={['admin', 'it']}><Settings /></ProtectedRoute>} />
 *
 * - If not authenticated: redirects to /login
 * - If authenticated but wrong role: renders AccessDenied inline
 * - If roles is omitted: any authenticated user can access
 */
import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth, UserRole } from '../context/AuthContext'

interface Props {
  children: ReactNode
  roles?: UserRole[]
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { user, hasRole } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 12,
        color: 'var(--text-muted)',
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>
          Access Denied
        </span>
        <span style={{ fontSize: 13 }}>
          Your account doesn't have permission to view this page.
        </span>
      </div>
    )
  }

  return <>{children}</>
}
