import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import './QuotationEntryModal.css'

interface ActiveSession {
  quotNo: string
  userCount: number
  hasPassword?: boolean
  users: { name: string; color: string }[]
}

interface NewRoomForm {
  name: string
  password?: string
}

interface Props {
  onJoin: (quotNo: string, password?: string) => void
  onCreateNew: (roomName: string, password?: string) => void
  onBrowse: () => void
  onClose?: () => void
}

export default function QuotationEntryModal({ onJoin, onCreateNew, onBrowse, onClose }: Props) {
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
    if (!newRoom.name.trim()) return
    onCreateNew(newRoom.name, newRoom.password)
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
    if (joiningRoom) {
      onJoin(joiningRoom.quotNo, joinPassword)
    }
  }

  return (
    <div className="quot-entry-overlay">
      <div className="quot-entry-card glass-panel">
        <header className="quot-entry-header">
          {onClose && (
            <button className="quot-entry-close" onClick={onClose} title="Back to editor">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
          <div className="quot-entry-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <h2>Quotation Workspace</h2>
          <p>Collaborate in real-time or start a new project</p>
        </header>

        <div className="quot-entry-body">
          {joiningRoom ? (
            <div className="quot-entry-form-container">
              <button className="quot-entry-back" onClick={() => setJoiningRoom(null)}>
                ← Back to lobby
              </button>
              <form onSubmit={handleJoinSubmit} className="quot-entry-form">
                <h3>Password Required</h3>
                <p>This room is protected. Enter password to join <strong>{joiningRoom.quotNo}</strong></p>
                <div className="form-group">
                  <input
                    type="password"
                    placeholder="Enter Room Password"
                    value={joinPassword}
                    onChange={e => setJoinPassword(e.target.value)}
                    autoFocus
                    required
                    className="form-input"
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-block">Join Document</button>
              </form>
            </div>
          ) : isCreating ? (
            <div className="quot-entry-form-container">
              <button className="quot-entry-back" onClick={() => setIsCreating(false)}>
                ← Back to lobby
              </button>
              <form onSubmit={handleCreateSubmit} className="quot-entry-form">
                <h3>Create New Room</h3>
                <div className="form-group">
                  <label>Room Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Project Tiger"
                    value={newRoom.name}
                    onChange={e => setNewRoom(prev => ({ ...prev, name: e.target.value }))}
                    autoFocus
                    required
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Room Password (Optional)</label>
                  <input
                    type="password"
                    placeholder="Leave blank for public"
                    value={newRoom.password || ''}
                    onChange={e => setNewRoom(prev => ({ ...prev, password: e.target.value }))}
                    className="form-input"
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-block">Create Collaborative Session</button>
              </form>
            </div>
          ) : (
            <>
              <section className="quot-entry-section">
                <h3>Active Collaborative Sessions</h3>
                <div className="quot-session-list">
                  {loading && sessions.length === 0 && <div className="quot-session-empty">Scanning network...</div>}
                  {!loading && sessions.length === 0 && <div className="quot-session-empty">No active rooms found.</div>}
                  {sessions.map(s => (
                    <div key={s.quotNo} className="quot-session-item" onClick={() => handleJoinClick(s)}>
                      <div className="quot-session-info">
                        <div className="quot-session-title-row">
                          <span className="quot-session-no">{s.quotNo}</span>
                          {s.hasPassword && (
                            <span className="quot-session-lock" title="Password Protected">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                              </svg>
                            </span>
                          )}
                        </div>
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
                          <span className="quot-session-count">{s.userCount} active</span>
                        </div>
                      </div>
                      <button className="btn btn-primary btn-sm">Join</button>
                    </div>
                  ))}
                </div>
              </section>

              <div className="quot-entry-divider"><span>OR</span></div>

              <section className="quot-entry-actions">
                <button className="quot-action-card" onClick={() => setIsCreating(true)}>
                  <div className="quot-action-icon create">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </div>
                  <div className="quot-action-text">
                    <strong>New Quotation</strong>
                    <span>Start from a blank template</span>
                  </div>
                </button>

                <button className="quot-action-card" onClick={onBrowse}>
                  <div className="quot-action-icon browse">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <div className="quot-action-text">
                    <strong>Browse NAS</strong>
                    <span>Open existing file from template folder</span>
                  </div>
                </button>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
