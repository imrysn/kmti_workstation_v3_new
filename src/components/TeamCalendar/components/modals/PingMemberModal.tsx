import { useState, useEffect } from 'react'
import { scheduleApi } from '../../../../services/api'
import { useWorkScheduleContext } from '../../context/WorkScheduleContext'
import { getDisplayName } from '../../../../utils/nameUtils'

interface ActiveUser {
  username: string
  fullName?: string
  role: string
  is_active: boolean
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function PingMemberModal({ isOpen, onClose }: Props) {
  const { jobs } = useWorkScheduleContext()
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([])
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([])
  const [isJobDropdownOpen, setIsJobDropdownOpen] = useState(false)
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false)
  const [customMessage, setCustomMessage] = useState('')
  const [selectedUsernames, setSelectedUsernames] = useState<Set<string>>(new Set())
  const [isPingingGlobal, setIsPingingGlobal] = useState(false)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const sortedJobs = [...jobs].sort((a, b) => b.job_id.localeCompare(a.job_id))

  // Fetch active users when modal opens
  useEffect(() => {
    if (!isOpen) return
    const fetchData = async () => {
      setIsLoadingUsers(true)
      try {
        const usersRes = await scheduleApi.getActiveUsers()

        let allUsers = usersRes || []
        // Optional: filter only "user" role if needed
        // allUsers = allUsers.filter(u => u.role === 'user')

        // Sort by active first, then alphabetically
        allUsers.sort((a, b) => {
          if (a.is_active && !b.is_active) return -1
          if (!a.is_active && b.is_active) return 1
          return a.username.localeCompare(b.username)
        })
        setActiveUsers(allUsers)
      } catch (err) {
        console.warn('[PingMemberModal] Failed to fetch data', err)
      } finally {
        setIsLoadingUsers(false)
      }
    }
    fetchData()

    // Reset state on open
    setSelectedJobIds([])
    setCustomMessage('')
    setSelectedUsernames(new Set())
    setIsJobDropdownOpen(false)
    setIsMemberDropdownOpen(false)
    setSearchQuery('')
  }, [isOpen])

  const toggleUser = (username: string) => {
    const next = new Set(selectedUsernames)
    if (next.has(username)) next.delete(username)
    else next.add(username)
    setSelectedUsernames(next)
  }

  const handleSendPing = async () => {
    if (selectedUsernames.size === 0) return
    setIsPingingGlobal(true)
    try {
      // Add a comma for spacing out jobs if there are multiple
      const combinedJobId = selectedJobIds.length > 0 ? selectedJobIds.join(', ') : ''
      const jobsPayload = combinedJobId.substring(0, 100) // Truncate to avoid DB overflow

      const promises = Array.from(selectedUsernames).map(username =>
        scheduleApi.sendManualNotification(username, jobsPayload, customMessage)
      )
      await Promise.all(promises)
      onClose() // Close modal on success
    } catch (err) {
      console.warn('[PingMemberModal] Failed to send bulk pings', err)
      // could show an error toast here
    } finally {
      setIsPingingGlobal(false)
    }
  }

  if (!isOpen) return null

  const filteredUsers = activeUsers.filter(u =>
    (u.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="schedule-modal-overlay">
      <div
        className="schedule-modal-card ping-member-modal"
        onClick={e => {
          e.stopPropagation()
          setIsJobDropdownOpen(false)
          setIsMemberDropdownOpen(false)
        }}
        style={{ maxWidth: 500, width: '95%' }}
      >
        <h3 className="schedule-modal-title">Notify Member</h3>

        {/* Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

          {/* Job selector */}
          <div className="schedule-form-group" style={{ position: 'relative', zIndex: 20 }}>
            <label>Select Jobs</label>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsJobDropdownOpen(!isJobDropdownOpen)
                  setIsMemberDropdownOpen(false)
                }}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 4,
                  border: '1px solid var(--border)', background: 'var(--bg-primary)',
                  color: 'var(--text-primary)', fontSize: 13, textAlign: 'left',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  cursor: 'pointer'
                }}
              >
                {selectedJobIds.length === 0 ? '-' : `${selectedJobIds.length} Job${selectedJobIds.length > 1 ? 's' : ''} selected`}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {isJobDropdownOpen && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                    background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4,
                    boxShadow: 'var(--shadow-md)', zIndex: 10, maxHeight: 200, overflowY: 'auto', padding: '6px 0'
                  }}
                >
                  {sortedJobs.map(j => {
                    const isSelected = selectedJobIds.includes(j.job_id)
                    return (
                      <label key={j.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer',
                        background: isSelected ? 'rgba(59,130,246,0.08)' : 'transparent'
                      }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedJobIds([...selectedJobIds, j.job_id])
                            else setSelectedJobIds(selectedJobIds.filter(id => id !== j.job_id))
                          }}
                        />
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{j.job_id}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Members Dropdown */}
          <div className="schedule-form-group" style={{ position: 'relative', zIndex: 10 }}>
            <label>Active Members</label>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsMemberDropdownOpen(!isMemberDropdownOpen)
                  setIsJobDropdownOpen(false)
                }}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 4,
                  border: '1px solid var(--border)', background: 'var(--bg-primary)',
                  color: 'var(--text-primary)', fontSize: 13,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  cursor: 'pointer'
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedUsernames.size === 0
                    ? '— Select members —'
                    : Array.from(selectedUsernames).map(u => {
                      const userObj = activeUsers.find(x => x.username === u)
                      return userObj?.fullName ? getDisplayName(userObj.fullName) : getDisplayName(u)
                    }).join(', ')}
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: isMemberDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isMemberDropdownOpen && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                    background: 'var(--bg-primary)', border: '1px solid var(--border)',
                    borderRadius: 4, boxShadow: 'var(--shadow-lg)', zIndex: 50,
                    maxHeight: 250, display: 'flex', flexDirection: 'column'
                  }}
                >
                  <div style={{ padding: 8, borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-primary)' }}>
                    <div style={{ position: 'relative' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search member..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{
                          width: '100%', padding: '6px 10px 6px 30px', borderRadius: 4,
                          border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ padding: 6, overflowY: 'auto' }}>
                    {isLoadingUsers ? (
                      <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                        Loading users...
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                        No matching members
                      </div>
                    ) : (
                      filteredUsers.map(u => {
                        const isSelected = selectedUsernames.has(u.username)
                        return (
                          <label
                            key={u.username}
                            className="job-dropdown-item"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '8px 10px', borderRadius: 4, cursor: 'pointer',
                              background: isSelected ? 'rgba(59,130,246,0.06)' : 'transparent',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleUser(u.username)}
                              style={{ width: 14, height: 14, cursor: 'pointer' }}
                            />

                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                              {u.fullName ? getDisplayName(u.fullName) : getDisplayName(u.username)}
                            </span>
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Custom message */}
          <div className="schedule-form-group">
            <label>Message</label>
            <textarea
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              placeholder="What is the status for this job?"
              rows={2}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 4,
                border: '1px solid var(--border)', background: 'var(--bg-primary)',
                color: 'var(--text-primary)', fontSize: 13, resize: 'vertical',
                boxSizing: 'border-box', fontFamily: 'inherit'
              }}
            />
          </div>
        </div>

        <div className="schedule-modal-buttons" style={{ marginTop: '20px' }}>
          <button
            type="button"
            className="btn-schedule-action"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-schedule-action primary"
            disabled={
              selectedJobIds.length === 0 ||
              customMessage.trim() === '' ||
              selectedUsernames.size === 0 ||
              isPingingGlobal
            }
            onClick={handleSendPing}
          >
            {isPingingGlobal ? 'Sending...' : `Notify ${selectedUsernames.size} ${selectedUsernames.size !== 1 ? '' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
