import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications, INotification } from '../context/NotificationContext'
import { renderEquippedSkin } from './Achievement'
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
  const navigate = useNavigate()
  const popupRef = useRef<HTMLDivElement>(null)
  
  // Snapshot unread IDs when the popup opens so they remain visually unread
  // even after the context marks them as read globally.
  const [initialUnreadIds] = useState(() => new Set(notifications.filter(n => !n.is_read).map(n => n.id)))

  const handleNotifClick = (n: INotification) => {
    if (!n.is_read) {
      markNotificationRead(n.id)
    }
    if (n.job_id) {
      navigate('/team-calendar?tab=schedule', { state: { searchJob: n.job_id } })
      onClose()
    }
  }

  // Close on outside click or Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const handleClick = (e: MouseEvent) => {
      if ((e.target as Element).closest('.titlebar-notif-btn')) return
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
        <span className="notif-popup-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          Notifications
          {unreadCount > 0 && <span className="notif-popup-badge">{unreadCount}</span>}
        </span>
        <button className="notif-popup-close-btn" onClick={onClose} title="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="notif-popup-body">
        {sorted.length === 0 ? (
          <div className="notif-popup-empty">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
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
            } catch (e) {}

            const isPing = parsedMsg?.type === 'ping'
            const senderName = parsedMsg?.sender
            const msgText = parsedMsg?.text || n.message || `Status update for Job ${n.job_id}`

            const isUnread = !n.is_read || initialUnreadIds.has(n.id)

            return (
              <div 
                key={n.id} 
                className={`notif-item${isUnread ? ' unread' : ''}`}
                onClick={() => handleNotifClick(n)}
              >
                <div className="notif-item-content">
                  <div className="notif-item-icon">
                    {isPing && senderName ? (
                      <div className="notif-avatar">
                        {renderEquippedSkin(senderName)}
                      </div>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                    )}
                  </div>
                  <div className="notif-item-text">
                    <div className="notif-item-header">
                      <span className="notif-item-title">
                        {isPing ? `Ping from ${senderName}` : 'System Update'}
                      </span>
                      <span className="notif-item-time">{timeAgo(n.created_at)}</span>
                    </div>
                    {n.job_id && <span className="notif-job-badge">Job: {n.job_id}</span>}
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
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
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
    </>
  )
}
