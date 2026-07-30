import React, { useState } from 'react'
import { notificationApi } from '../../services/api'
import { useNotifications } from '../../context/NotificationContext'
import './AdminBroadcastModal.css'

interface AdminBroadcastModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AdminBroadcastModal({ isOpen, onClose }: AdminBroadcastModalProps) {
  const { fetchNotifications } = useNotifications()
  const [category, setCategory] = useState<'UPDATE' | 'DOWNTIME' | 'ANNOUNCEMENT'>('UPDATE')
  const [title, setTitle] = useState('Software Update Available: v3.8.8')
  const [message, setMessage] = useState('Work Schedule Excel Export DrawingML floating shapes engine, responsive arrow lengths, and 12-month calendar bounds are now live!')
  const [targetRole, setTargetRole] = useState('all')
  const [link, setLink] = useState('/whats-new')
  const [isSending, setIsSending] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null)

  if (!isOpen) return null

  const handleSelectPreset = (cat: 'UPDATE' | 'DOWNTIME' | 'ANNOUNCEMENT') => {
    setCategory(cat)
    setStatusMsg(null)
    if (cat === 'UPDATE') {
      setTitle('Software Update: v3.8.8 Released')
      setMessage('Work Schedule Excel Export drawing shapes engine, responsive arrow line lengths, and clean 12-month calendar bounds are now available!')
      setLink('/whats-new')
    } else if (cat === 'DOWNTIME') {
      setTitle('Server Downtime Notice')
      setMessage('Scheduled server maintenance is planned for tonight. The server may be briefly offline for database optimization.')
      setLink('')
    } else {
      setTitle('System Announcement')
      setMessage('Important update from Administration. Please review current tasks and schedules.')
      setLink('')
    }
  }

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) {
      setStatusMsg({ text: 'Please fill in both title and message.', isError: true })
      return
    }

    setIsSending(true)
    setStatusMsg(null)

    try {
      const res = await notificationApi.broadcastNotification({
        category,
        title: title.trim(),
        message: message.trim(),
        target_role: targetRole,
        link: link.trim() || undefined
      })

      if (res.success) {
        setStatusMsg({ text: res.message || 'Broadcast sent successfully!', isError: false })
        await fetchNotifications()
        setTimeout(() => {
          onClose()
        }, 1200)
      } else {
        setStatusMsg({ text: res.message || 'Failed to send broadcast.', isError: true })
      }
    } catch (err: any) {
      setStatusMsg({ text: err.response?.data?.detail || err.message || 'Failed to send broadcast.', isError: true })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div
      className="abm-overlay"
      onClick={onClose}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="abm-modal"
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="abm-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(147, 51, 234, 0.25))',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#60A5FA'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <div>
              <h3 className="abm-title">Admin Broadcast Notice</h3>
              <p className="abm-subtitle">Notify workstations about Soft Updates or Server Downtime</p>
            </div>
          </div>
          <button className="abm-close-btn" onClick={onClose} title="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSendBroadcast} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Category Selector Tabs */}
          <div>
            <label className="abm-label">NOTICE TYPE</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleSelectPreset('UPDATE')}
                style={{
                  padding: '10px 8px',
                  borderRadius: '10px',
                  border: category === 'UPDATE' ? '1.5px solid #3B82F6' : '1px solid var(--border-color, rgba(0,0,0,0.1))',
                  background: category === 'UPDATE' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  color: category === 'UPDATE' ? '#3B82F6' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
                Software Update
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('DOWNTIME')}
                style={{
                  padding: '10px 8px',
                  borderRadius: '10px',
                  border: category === 'DOWNTIME' ? '1.5px solid #F59E0B' : '1px solid var(--border-color, rgba(0,0,0,0.1))',
                  background: category === 'DOWNTIME' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                  color: category === 'DOWNTIME' ? '#D97706' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Downtime
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('ANNOUNCEMENT')}
                style={{
                  padding: '10px 8px',
                  borderRadius: '10px',
                  border: category === 'ANNOUNCEMENT' ? '1.5px solid #06B6D4' : '1px solid var(--border-color, rgba(0,0,0,0.1))',
                  background: category === 'ANNOUNCEMENT' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                  color: category === 'ANNOUNCEMENT' ? '#0891B2' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12A10 10 0 0 0 12 2v10z" />
                  <path d="M18 8a6 6 0 0 0-6-6v6z" />
                  <path d="M22 12A10 10 0 1 1 12 2v10z" />
                </svg>
                Notice
              </button>
            </div>
          </div>

          {/* Target Role */}
          <div>
            <label className="abm-label">TARGET AUDIENCE</label>
            <select
              value={targetRole}
              onChange={e => setTargetRole(e.target.value)}
              className="abm-select"
            >
              <option value="me">Test Mode (Only Me)</option>
              <option value="all">All Workstations (All Users)</option>
              <option value="user">General Users Only</option>
              <option value="admin">Admin Role Only</option>
              <option value="team_leader">Team Leaders Only</option>
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="abm-label">NOTIFICATION TITLE</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Software Update Available: v3.8.8"
              required
              className="abm-input"
            />
          </div>

          {/* Message */}
          <div>
            <label className="abm-label">MESSAGE CONTENT</label>
            <textarea
              rows={3}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Describe the soft update features or scheduled server downtime details..."
              required
              className="abm-textarea"
            />
          </div>

          {/* Action Link (Optional) */}
          {category === 'UPDATE' && (
            <div>
              <label className="abm-label">ACTION LINK (OPTIONAL)</label>
              <input
                type="text"
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder="e.g. /whats-new"
                className="abm-input"
              />
            </div>
          )}

          {/* Status Message */}
          {statusMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 600,
              background: statusMsg.isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
              border: statusMsg.isError ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)',
              color: statusMsg.isError ? '#EF4444' : '#10B981'
            }}>
              {statusMsg.text}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 18px',
                borderRadius: '9px',
                border: '1px solid var(--border-color, rgba(0,0,0,0.15))',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSending}
              style={{
                padding: '9px 20px',
                borderRadius: '9px',
                border: 'none',
                background: category === 'DOWNTIME'
                  ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                  : category === 'ANNOUNCEMENT'
                    ? 'linear-gradient(135deg, #06B6D4, #0891B2)'
                    : 'linear-gradient(135deg, #3B82F6, #2563EB)',
                color: '#FFF',
                fontWeight: 700,
                fontSize: '13px',
                cursor: isSending ? 'not-allowed' : 'pointer',
                opacity: isSending ? 0.7 : 1,
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {isSending ? 'Sending...' : 'Broadcast Notice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
