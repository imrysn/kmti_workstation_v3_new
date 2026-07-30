import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications, INotification } from '../context/NotificationContext'
import { useAuth } from '../context/AuthContext'
import { renderEquippedSkin } from './Achievement'
import AdminBroadcastModal from './modals/AdminBroadcastModal'
import './NotificationPopup.css'

interface Props {
  onClose: () => void
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function NotificationPopup({ onClose }: Props) {
  const { notifications, unreadCount, markNotificationRead, deleteNotification, deleteAllNotifications } = useNotifications()
  const { user } = useAuth()
  const navigate = useNavigate()
  const popupRef = useRef<HTMLDivElement>(null)
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false)

  const isAdmin = user?.role === 'admin' || user?.role === 'it'

  // Snapshot unread IDs when the popup opens so they remain visually unread
  // even after the context marks them as read globally.
  const [initialUnreadIds] = useState(() => new Set(notifications.filter(n => !n.is_read).map(n => n.id)))

  const handleNotifClick = (n: INotification) => {
    if (!n.is_read) {
      markNotificationRead(n.id)
    }
    if (n.link === '/whats-new' || n.reference_type === 'SYSTEM_UPDATE') {
      // Trigger WhatsNewModal or navigate
      window.dispatchEvent(new CustomEvent('open-whats-new-modal'))
      onClose()
    } else if (n.link) {
      navigate(n.link)
      onClose()
    } else if (n.reference_type === 'WORK_SCHEDULE' && n.reference_id) {
      navigate('/team-calendar?tab=schedule', { state: { searchJob: n.reference_id } })
      onClose()
    }
  }

  // Close on outside click or Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const handleClick = (e: MouseEvent) => {
      const targetEl = e.target as Element
      if (
        targetEl.closest('.titlebar-notif-btn') ||
        targetEl.closest('.abm-overlay') ||
        targetEl.closest('.abm-modal') ||
        targetEl.closest('.wnm-overlay') ||
        targetEl.closest('.wnm-modal')
      ) return
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  const sorted = [...notifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <>
      <div className="notif-popup-overlay" onClick={onClose} />
      <div className="notif-popup" ref={popupRef}>
        {/* Header */}
        <div className="notif-popup-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="notif-popup-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              Notifications
              {unreadCount > 0 && <span className="notif-popup-badge">{unreadCount}</span>}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsBroadcastOpen(true)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#60A5FA',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Send Software Update or Downtime Notice to Users"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                Notify All
              </button>
            )}
            <button className="notif-popup-close-btn" onClick={onClose} title="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="notif-popup-body">
          {sorted.length === 0 ? (
            <div className="notif-popup-empty">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <p>No notifications</p>
            </div>
          ) : (
            sorted.map((n: INotification) => {
              let parsedMsg: any = null
              try {
                if (n.message && n.message.startsWith('{')) {
                  parsedMsg = JSON.parse(n.message)
                }
              } catch (e) { }

              const isPing = parsedMsg?.type === 'ping'
              const senderName = parsedMsg?.sender
              const msgText = parsedMsg?.text || n.message || `System Update`
              const isUpdate = n.reference_type === 'SYSTEM_UPDATE' || n.reference_id === 'UPDATE'
              const isDowntime = n.reference_type === 'SERVER_DOWNTIME' || n.reference_id === 'DOWNTIME'
              const isAnnouncement = n.reference_type === 'ADMIN_ANNOUNCEMENT' || n.reference_id === 'ANNOUNCEMENT'

              const titleText = n.title || (isPing ? `Ping from ${senderName}` : isUpdate ? 'Software Update' : isDowntime ? 'Server Downtime Notice' : 'System Notice')

              const isUnread = !n.is_read || initialUnreadIds.has(n.id)

              return (
                <div
                  key={n.id}
                  className={`notif-item${isUnread ? ' unread' : ''}`}
                  onClick={() => handleNotifClick(n)}
                  style={{
                    borderLeft: isDowntime ? '3.5px solid #F59E0B' : isUpdate ? '3.5px solid #3B82F6' : isAnnouncement ? '3.5px solid #06B6D4' : undefined
                  }}
                >
                  <div className="notif-item-content">
                    <div className="notif-item-icon">
                      {isPing && senderName ? (
                        <div className="notif-avatar">
                          {renderEquippedSkin(senderName, null, 'rookie', senderName)}
                        </div>
                      ) : isDowntime ? (
                        <div style={{ color: '#FBBF24' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                        </div>
                      ) : isUpdate ? (
                        <div style={{ color: '#60A5FA' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                            <line x1="12" y1="22.08" x2="12" y2="12" />
                          </svg>
                        </div>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      )}
                    </div>
                    <div className="notif-item-text">
                      <div className="notif-item-header">
                        <span className="notif-item-title">
                          {titleText}
                        </span>
                        <span className="notif-item-time">{timeAgo(n.created_at)}</span>
                      </div>
                      {isUpdate && <span className="notif-job-badge" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60A5FA', border: '1px solid rgba(59, 130, 246, 0.3)' }}>Software Update</span>}
                      {isDowntime && <span className="notif-job-badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#FBBF24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>Server Downtime</span>}
                      {isAnnouncement && <span className="notif-job-badge" style={{ background: 'rgba(6, 182, 212, 0.2)', color: '#22D3EE', border: '1px solid rgba(6, 182, 212, 0.3)' }}>Announcement</span>}
                      {!isUpdate && !isDowntime && !isAnnouncement && n.reference_id && <span className="notif-job-badge">{n.reference_id}</span>}
                      <p className="notif-item-msg">{msgText}</p>
                    </div>
                  </div>
                  <button
                    className="notif-item-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNotification(n.id)
                    }}
                    title="Dismiss"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="notif-popup-footer">
            <button
              className="notif-popup-clear-all"
              onClick={() => {
                deleteAllNotifications()
                onClose()
              }}
              title="Clear all notifications"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Admin Broadcast Modal */}
      {isAdmin && (
        <AdminBroadcastModal
          isOpen={isBroadcastOpen}
          onClose={() => setIsBroadcastOpen(false)}
        />
      )}
    </>
  )
}
