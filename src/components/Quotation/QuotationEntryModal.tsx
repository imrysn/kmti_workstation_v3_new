import { useState, useEffect } from 'react'
import { quotationApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import QuotationLibraryModal from './QuotationLibraryModal'
import './QuotationEntryModal.css'

interface ActiveSession {
  id: number
  quotNo: string
  displayName: string
  userCount: number
  users: Array<{ name: string; color: string }>
  hasPassword?: boolean
  workstation?: string
}

interface NewRoomForm {
  name: string
  password?: string
}

interface Props {
  onJoin: (id: number, password?: string) => void
  onCreateNew: (name: string, password?: string) => void
  onClose?: () => void
  mandatory?: boolean
}

export default function QuotationEntryModal({ onJoin, onCreateNew, onClose, mandatory }: Props) {
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const [newRoom, setNewRoom] = useState<NewRoomForm>({ name: '' })
  const [joiningSession, setJoiningSession] = useState<ActiveSession | null>(null)
  const [joinPassword, setJoinPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [myWorkstation, setMyWorkstation] = useState<string | null>(null)
  const { hasRole } = useAuth()

  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fetchSessions = async (silent = false) => {
    if (!silent) setLoading(true)
    setErrorMessage(null)
    try {
      const res = await quotationApi.getSessions()
      setSessions(res.data.sessions || [])
    } catch (e: any) {
      console.error('Failed to fetch active sessions')
      setErrorMessage('Server connection failed. Is the backend running?')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
    const timer = setInterval(() => fetchSessions(true), 10000)

    // Identify local workstation for bypass logic
    if ((window as any).electronAPI?.getWorkstationInfo) {
      (window as any).electronAPI.getWorkstationInfo().then((info: any) => {
        if (info?.computerName) setMyWorkstation(info.computerName)
      })
    }

    return () => clearInterval(timer)
  }, [])

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onCreateNew(newRoom.name.trim(), newRoom.password)
  }

  const handleJoinClick = (s: ActiveSession) => {
    // Ownership Bypass: Allow entry without password if owner workstation or Admin
    const isOwner = myWorkstation && s.workstation === myWorkstation
    const isAdmin = hasRole('admin', 'it')

    if (s.hasPassword && !isOwner && !isAdmin) {
      setJoiningSession(s)
    } else {
      onJoin(s.id)
    }
  }

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (joiningSession) onJoin(joiningSession.id, joinPassword)
  }

  return (
    <div className="quot-entry-overlay">
      <div className="quot-entry-card">

        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="quot-entry-header">
          <div className="quot-entry-header-text">
            <span className="quot-entry-eyebrow">Quotation</span>
            <h2>Workspace</h2>
          </div>
          {onClose && (
            <button
              className="quot-entry-close"
              onClick={onClose}
              title={mandatory ? 'Back to Dashboard' : 'Back to editor'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </header>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div className="quot-entry-body">
          {joiningSession ? (
            <div className="quot-entry-form-container">
              <button className="quot-entry-back" onClick={() => setJoiningSession(null)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back to lobby
              </button>
              <form onSubmit={handleJoinSubmit} className="quot-entry-form">
                <h3>Password Required</h3>
                <p>This workspace is protected. Enter the password to join <strong>{joiningSession.displayName}</strong>.</p>
                <div className="form-group">
                  <input
                    type="password"
                    placeholder="Workspace password"
                    value={joinPassword}
                    onChange={e => setJoinPassword(e.target.value)}
                    autoFocus
                    required
                    className="form-input"
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-block">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                  </svg>
                  Unlock & Join
                </button>
              </form>
            </div>
          ) : isCreating ? (
            <div className="quot-entry-form-container">
              <button className="quot-entry-back" onClick={() => setIsCreating(false)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back to lobby
              </button>
              <form onSubmit={handleCreateSubmit} className="quot-entry-form">
                <div className="form-group">
                  <label>Workspace Name</label>
                  <div className="input-with-icon">
                    <svg className="input-icon-prefix" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Leave blank to auto-generate"
                      value={newRoom.name}
                      onChange={e => setNewRoom(prev => ({ ...prev, name: e.target.value }))}
                      autoFocus
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Password (optional)</label>
                  <div className="input-with-icon">
                    <svg className="input-icon-prefix" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                    </svg>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Leave blank for public access"
                      value={newRoom.password || ''}
                      onChange={e => setNewRoom(prev => ({ ...prev, password: e.target.value }))}
                      className="form-input"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary btn-block">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Initialize Workspace
                </button>
              </form>
            </div>
          ) : (
            <>
              <div className="quot-entry-sessions">
                <h3>Active Workspaces</h3>
                {loading ? (
                  <div className="quot-entry-loading">
                    <div className="spinner-small" />
                    <span>Establishing secure connection...</span>
                  </div>
                ) : errorMessage ? (
                  <div className="quot-entry-error-msg">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e05c6b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{errorMessage}</span>
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="quot-entry-empty">
                    <div className="quot-empty-icon">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <p>No active workspaces</p>
                    <span>Start a new collaborative session below to begin working with your team.</span>
                  </div>
                ) : (
                  <div className="quot-session-list">
                    {sessions.map(s => (
                      <div key={s.id} className="quot-session-item" onClick={() => handleJoinClick(s)}>
                        <div className="quot-session-info">
                          <div className="quot-session-name-row">
                            <span className="quot-session-no">{s.displayName}</span>
                            {s.hasPassword && (
                              <div className="quot-session-lock" title="Password required">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="quot-session-meta">
                            <span className="quot-session-subno">{s.quotNo}</span>
                            <div className="quot-session-avatars">
                              {s.users.map((u, i) => (
                                <div
                                  key={i}
                                  className="quot-session-avatar"
                                  style={{ backgroundColor: u.color, marginLeft: i === 0 ? 0 : -8 }}
                                  title={u.name}
                                >
                                  {(u.name || 'U').charAt(0).toUpperCase()}
                                </div>
                              ))}
                            </div>
                            <span className="quot-session-count">
                              {s.userCount} {s.userCount === 1 ? 'user' : 'users'}
                            </span>
                          </div>
                        </div>
                        <div className="quot-session-action">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {!isCreating && !joiningSession && (
          <footer className="quot-entry-footer">
            <button className="quot-footer-btn" onClick={() => setIsCreating(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Start New Workspace
            </button>
            <div className="quot-footer-divider" />
            <button className="quot-footer-btn quot-btn-secondary" onClick={() => setIsLibraryOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              Open Quotation Library
            </button>
          </footer>
        )}
      </div>

      {/* Render outside of quot-entry-card to avoid CSS transform & overflow:hidden stacking context traps */}
      {isLibraryOpen && (
        <QuotationLibraryModal
          onClose={() => setIsLibraryOpen(false)}
          onSelect={(q) => {
            setIsLibraryOpen(false)
            
            // Ownership Bypass for Library Selection
            const isOwner = myWorkstation && q.workstation === myWorkstation
            const isAdmin = hasRole('admin', 'it')

            if (q.hasPassword && !isOwner && !isAdmin) {
              // Show password prompt — reuse the same joiningSession flow
              setJoiningSession({ 
                id: q.id, 
                quotNo: q.quotationNo, 
                displayName: q.displayName || q.quotationNo, 
                userCount: 0, 
                users: [],
                hasPassword: true,
                workstation: q.workstation
              })
              setJoinPassword('')
            } else {
              onJoin(q.id)
            }
          }}
        />
      )}
    </div>
  )
}
