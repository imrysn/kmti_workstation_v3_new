import { useState, useEffect } from 'react'
import { useWorkScheduleContext } from '../../context/WorkScheduleContext'
import { scheduleApi } from '../../../../services/api'

const Bell = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
)

const X = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
)

const Trash2 = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
)

const Check = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
)

const Send = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
)

const Megaphone = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
  </svg>
)

interface WorkstationUser {
  id: number
  username: string
  role: string
  is_active: boolean
}

export default function NotificationPanel() {
  const {
    isNotificationPanelOpen,
    setIsNotificationPanelOpen,
    notifications,
    markNotificationsRead,
    deleteNotification,
    deleteAllNotifications,
    canWrite,
    jobs
  } = useWorkScheduleContext()

  const [view, setView] = useState<'inbox' | 'ping'>('inbox')
  
  // Ping state
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [customMessage, setCustomMessage] = useState('')
  const [loadingMember, setLoadingMember] = useState<string | null>(null)
  const [activeUsers, setActiveUsers] = useState<WorkstationUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)

  // Fetch real workstation accounts when Ping tab is opened
  useEffect(() => {
    if (view === 'ping' && canWrite) {
      setUsersLoading(true)
      scheduleApi.getActiveUsers()
        .then(users => setActiveUsers(users.filter(u => u.is_active)))
        .catch(() => setActiveUsers([]))
        .finally(() => setUsersLoading(false))
    }
  }, [view, canWrite])

  if (!isNotificationPanelOpen) return null

  const handleClose = () => {
    setIsNotificationPanelOpen(false)
  }

  const defaultMessage = `What's the status of this Job (${selectedJobId || '[Select Job]'})? Please update the schedule.`

  const handleNotify = async (member: string) => {
    if (!selectedJobId) {
      alert('Please select a Job ID first.')
      return
    }
    setLoadingMember(member)
    try {
      const msg = customMessage.trim() || defaultMessage
      await scheduleApi.sendManualNotification(member, selectedJobId, msg)
      setTimeout(() => setLoadingMember(null), 1000)
    } catch (err) {
      console.warn('Failed to send notification', err)
      setLoadingMember(null)
    }
  }

  return (
    <>
      <div 
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          zIndex: 999998,
          backdropFilter: 'blur(2px)'
        }}
        onClick={handleClose}
      />
      <div 
        className="notification-panel"
        style={{
          position: 'fixed',
          top: 0, right: 0, bottom: 0,
          width: '400px',
          backgroundColor: 'var(--bg-primary)',
          boxShadow: '-4px 0 15px rgba(0, 0, 0, 0.1)',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          transform: isNotificationPanelOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease-in-out',
          borderLeft: '1px solid var(--border)'
        }}
      >
        <div style={{
          padding: '20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={20} />
            Notifications
          </h2>
          <button 
            onClick={handleClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {canWrite && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={() => setView('inbox')}
              style={{
                flex: 1,
                padding: '12px',
                background: 'transparent',
                border: 'none',
                borderBottom: view === 'inbox' ? '2px solid var(--primary)' : '2px solid transparent',
                color: view === 'inbox' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: view === 'inbox' ? 'bold' : 'normal',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Bell size={16} /> Inbox
            </button>
            <button
              onClick={() => setView('ping')}
              style={{
                flex: 1,
                padding: '12px',
                background: 'transparent',
                border: 'none',
                borderBottom: view === 'ping' ? '2px solid var(--primary)' : '2px solid transparent',
                color: view === 'ping' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: view === 'ping' ? 'bold' : 'normal',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Megaphone size={16} /> Ping Member
            </button>
          </div>
        )}

        {view === 'inbox' && (
          <>
            <div style={{
              padding: '10px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              gap: '10px'
            }}>
              <button 
                onClick={markNotificationsRead}
                disabled={notifications.length === 0}
                className="sys-btn sys-btn-secondary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
              >
                <Check size={16} /> Mark All Read
              </button>
              <button 
                onClick={deleteAllNotifications}
                disabled={notifications.length === 0}
                className="sys-btn sys-btn-danger"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
              >
                <Trash2 size={16} /> Delete All
              </button>
            </div>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '10px'
            }}>
              {notifications.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>
                  <Bell size={40} />
                  <p style={{ marginTop: '10px', opacity: 0.5 }}>No new notifications</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {notifications.map((notif: any) => (
                    <div 
                      key={notif.id}
                      style={{
                        padding: '15px',
                        borderRadius: '8px',
                        backgroundColor: notif.is_read ? 'var(--bg-secondary)' : 'color-mix(in srgb, var(--primary) 10%, var(--bg-secondary))',
                        border: '1px solid var(--border)',
                        borderLeft: notif.is_read ? '1px solid var(--border)' : '4px solid var(--primary)',
                        position: 'relative'
                      }}
                    >
                      <button
                        onClick={() => deleteNotification(notif.id)}
                        style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                      <p style={{ margin: '0 0 8px 0', fontSize: '0.95rem', paddingRight: '20px' }}>
                        {notif.message}
                      </p>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(notif.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {view === 'ping' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', gap: '20px', overflowY: 'auto' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                SELECT TARGET JOB
              </label>
              <select
                className="sys-input"
                style={{ width: '100%', padding: '10px', borderRadius: '6px' }}
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
              >
                <option value="">-- Select a Job --</option>
                {jobs.map(j => (
                  <option key={j.job_id} value={j.job_id}>{j.job_id}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                CUSTOM MESSAGE (OPTIONAL)
              </label>
              <textarea
                className="sys-input"
                style={{ width: '100%', height: '80px', padding: '10px', resize: 'none', borderRadius: '6px' }}
                placeholder={defaultMessage}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                SELECT MEMBER TO NOTIFY
              </label>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '8px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                background: 'var(--bg-secondary)',
                padding: '4px',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {usersLoading && (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading accounts...
                  </div>
                )}
                {!usersLoading && activeUsers.length === 0 && (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No active accounts found.
                  </div>
                )}
                {!usersLoading && activeUsers.map((user) => (
                  <div 
                    key={user.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 15px',
                      background: 'var(--bg-primary)',
                      borderRadius: '6px',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        flexShrink: 0
                      }}>
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '14px' }}>{user.username}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user.role}</div>
                      </div>
                    </div>
                    <button
                      className="sys-btn sys-btn-primary"
                      style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', flexShrink: 0 }}
                      onClick={() => handleNotify(user.username)}
                      disabled={loadingMember === user.username || !selectedJobId}
                      title={!selectedJobId ? "Select a job first" : `Ping ${user.username}`}
                    >
                      {loadingMember === user.username ? (
                        <span style={{ opacity: 0.7 }}>✓ Sent!</span>
                      ) : (
                        <><Send size={14} /> Ping</>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
