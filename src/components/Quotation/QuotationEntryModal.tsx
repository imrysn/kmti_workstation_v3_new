import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import './QuotationEntryModal.css'

interface ActiveSession {
  quotNo: string
  userCount: number
  hasPassword?: boolean
  displayName: string
  users: { name: string; color: string }[]
}

interface NewRoomForm {
  name: string
  password?: string
}

interface Props {
  onJoin: (quotNo: string, password?: string) => void
  onCreateNew: (roomName: string, password?: string) => void
  onClose?: () => void
  /**
   * When true the lobby is mandatory — closing it without a session
   * navigates away. The close button shows a ← instead of ✕.
   */
  mandatory?: boolean
}

export default function QuotationEntryModal({ onJoin, onCreateNew, onClose, mandatory }: Props) {
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [newRoom, setNewRoom] = useState<NewRoomForm>({ name: '' })
  const [joiningRoom, setJoiningRoom] = useState<ActiveSession | null>(null)
  const [joinPassword, setJoinPassword] = useState('')

  const fetchSessions = async () => {
    setLoading(true)
    try {
      const res = await api.get<{ sessions: ActiveSession[] }>('/quotations/sessions')
      setSessions(res.data.sessions || [])
    } catch (e) {
      console.error('Failed to fetch active sessions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
    const timer = setInterval(fetchSessions, 10000)
    return () => clearInterval(timer)
  }, [])

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onCreateNew(newRoom.name.trim(), newRoom.password)
  }

  const handleJoinClick = (s: ActiveSession) => {
    if (s.hasPassword) {
      setJoiningRoom(s)
    } else {
      onJoin(s.quotNo)
    }
  }

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (joiningRoom) onJoin(joiningRoom.quotNo, joinPassword)
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
              {mandatory ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
            </button>
          )}
        </header>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div className="quot-entry-body">
          {joiningRoom ? (
            <div className="quot-entry-form-container">
              <button className="quot-entry-back" onClick={() => setJoiningRoom(null)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back to lobby
              </button>
              <form onSubmit={handleJoinSubmit} className="quot-entry-form">
                <h3>Password required</h3>
                <p>This room is protected. Enter the password to join <strong>{joiningRoom.displayName}</strong>.</p>
                <div className="form-group">
                  <input
                    type="password"
                    placeholder="Room password"
                    value={joinPassword}
                    onChange={e => setJoinPassword(e.target.value)}
                    autoFocus
                    required
                    className="form-input"
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-block">Join session</button>
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
                  <label>
                    Room name
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Project Tiger"
                    value={newRoom.name}
                    onChange={e => setNewRoom(prev => ({ ...prev, name: e.target.value }))}
                    autoFocus
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>
                    Password
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>(optional)</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Leave blank for public room"
                    value={newRoom.password || ''}
                    onChange={e => setNewRoom(prev => ({ ...prev, password: e.target.value }))}
                    className="form-input"
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-block">Create workspace</button>
              </form>
            </div>
          ) : (
            <>
              <p className="quot-entry-section-label">Active sessions</p>
              <div className="quot-session-list">
                {loading && sessions.length === 0 && (
                  <div className="quot-session-empty">Scanning network…</div>
                )}
                {!loading && sessions.length === 0 && (
                  <div className="quot-session-empty">No active sessions found.</div>
                )}
                {sessions.map(s => (
                  <div key={s.quotNo} className="quot-session-item" onClick={() => handleJoinClick(s)}>
                    <div className="quot-session-info">
                      <div className="quot-session-name-row">
                        <span className="quot-session-no">{s.displayName}</span>
                        {s.hasPassword && (
                          <span className="quot-session-lock" title="Password protected">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <div className="quot-session-meta">
                        {s.displayName !== s.quotNo && (
                          <>
                            <span className="quot-session-subno">{s.quotNo}</span>
                            <span className="quot-session-dot" />
                          </>
                        )}
                        <div className="quot-session-avatars">
                          {s.users.map((u, i) => (
                            <div
                              key={i}
                              className="quot-session-avatar"
                              style={{ backgroundColor: u.color }}
                              title={u.name}
                            >
                              {u.name.substring(0, 2).toUpperCase()}
                            </div>
                          ))}
                        </div>
                        <span className="quot-session-count">{s.userCount} online</span>
                      </div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); handleJoinClick(s) }}>
                      Join
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Footer action strip — only on main lobby view ──────── */}
        {!isCreating && !joiningRoom && (
          <div className="quot-entry-footer">
            <button className="quot-footer-btn" onClick={() => setIsCreating(true)} style={{ width: '100%', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New quotation
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
