import { useState, useMemo, useEffect } from 'react'
import { ICalendarEvent } from '../../../services/teamCalendarService'
import { inferTaskType, getTaskTypeColor, getTeamColor, formatLocalDate } from '../../../utils/teamCalendarUtils'
import { BriefcaseIcon, LockIcon, GlobeIcon, CalendarIcon } from '../Icons'

// ── Premium SVG Icons (Replacing Emojis) ────────────────────────
const SunIcon = () => (
  <svg className="greeting-svg-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--cal-primary)', flexShrink: 0 }}>
    <circle cx="12" cy="12" r="5" fill="rgba(245, 158, 11, 0.1)" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

const MoonIcon = () => (
  <svg className="greeting-svg-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--cal-primary)', flexShrink: 0 }}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="rgba(99, 102, 241, 0.1)" />
  </svg>
)

const SunriseIcon = () => (
  <svg className="greeting-svg-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--cal-primary)', flexShrink: 0 }}>
    <path d="M12 2v8M4.93 10.93l1.41 1.41M17.66 10.93l-1.41 1.41M2 18h20M16 18a4 4 0 0 0-8 0" fill="rgba(245, 158, 11, 0.1)" />
  </svg>
)

const CoffeeIcon = () => (
  <svg className="greeting-svg-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--cal-primary)', flexShrink: 0 }}>
    <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3" />
  </svg>
)

const BellIcon = () => (
  <svg className="svg-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

const SparkIcon = () => (
  <svg className="svg-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--cal-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.65, marginBottom: '8px' }}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="rgba(99, 102, 241, 0.1)" />
  </svg>
)

interface LandingAgendaModalProps {
  events: ICalendarEvent[]
  currentUser: any
  pcName?: string
  showClaims: boolean
  showAbsences: boolean
  showSpans: boolean
  onClose: () => void
}

export default function LandingAgendaModal({
  events,
  currentUser,
  pcName,
  showClaims,
  showAbsences,
  showSpans,
  onClose
}: LandingAgendaModalProps) {
  const [dontShowAgainToday, setDontShowAgainToday] = useState(false)

  const todayDate = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  // Filter today's active items (excluding weekends for tasks/leaves) matching calendar grid logic
  const todayEvents = useMemo(() => {
    const todayStr = formatLocalDate(todayDate)

    return events.filter(e => {
      // If it's a task claim and spans are disabled, it only displays on its due/end date
      if (e.event_type === 'Task_Claim' && !showSpans) {
        const targetDateStr = e.due_date || e.end_date
        return todayStr === targetDateStr
      }

      const start = new Date(e.start_date)
      const end = new Date(e.end_date)
      start.setHours(0, 0, 0, 0)
      end.setHours(0, 0, 0, 0)
      return todayDate >= start && todayDate <= end
    }).filter(e => {
      const isWeekend = todayDate.getDay() === 0 || todayDate.getDay() === 6
      if (isWeekend && (e.event_type === 'Task_Claim' || e.event_type === 'Day_Off')) return false
      if (e.event_type === 'Task_Claim' && !showClaims) return false
      if (e.event_type === 'Day_Off' && !showAbsences) return false
      return true
    })
  }, [events, todayDate, showClaims, showAbsences, showSpans])

  // Get upcoming deadlines (due next 7 days) if today is empty
  const upcomingDeadlines = useMemo(() => {
    if (todayEvents.length > 0) return []
    const sevenDaysLater = new Date(todayDate)
    sevenDaysLater.setDate(todayDate.getDate() + 7)

    return events
      .filter(e => {
        if (e.event_type !== 'Task_Claim') return false
        const dueDate = new Date(e.due_date || e.end_date)
        dueDate.setHours(0, 0, 0, 0)
        return dueDate > todayDate && dueDate <= sevenDaysLater
      })
      .sort((a, b) => {
        const dateA = new Date(a.due_date || a.end_date).getTime()
        const dateB = new Date(b.due_date || b.end_date).getTime()
        return dateA - dateB
      })
      .slice(0, 4) // Top 4 upcoming
  }, [events, todayEvents.length, todayDate])

  const greetingText = useMemo(() => {
    const hour = new Date().getHours()

    // Prioritize pcName, fall back to "Workstation" if not set or if username is 'admin'
    let nameStr = pcName || ''
    if (!nameStr) {
      const username = currentUser?.username || 'Workstation'
      if (username.toLowerCase() === 'admin') {
        nameStr = 'Workstation'
      } else {
        nameStr = username.charAt(0).toUpperCase() + username.slice(1)
      }
    }

    if (hour >= 5 && hour < 12) return `Good morning, ${nameStr}!`
    if (hour >= 12 && hour < 17) return `Good afternoon, ${nameStr}!`
    if (hour >= 17 && hour < 22) return `Good evening, ${nameStr}!`
    return `Working late, ${nameStr}?`
  }, [currentUser, pcName])

  const greetingIcon = useMemo(() => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) return <SunriseIcon />
    if (hour >= 12 && hour < 17) return <SunIcon />
    if (hour >= 17 && hour < 22) return <MoonIcon />
    return <CoffeeIcon />
  }, [])

  const longDateStr = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }, [])

  const getDaysRemainingText = (event: ICalendarEvent) => {
    const targetDateStr = event.due_date || event.end_date
    const target = new Date(targetDateStr)
    target.setHours(0, 0, 0, 0)
    const diffTime = target.getTime() - todayDate.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays === 1) return "Due tomorrow"
    if (diffDays === 0) return "Due today"
    return `Due in ${diffDays} days`
  }

  const handleClose = () => {
    if (dontShowAgainToday) {
      const todayStr = formatLocalDate(new Date())
      localStorage.setItem('kmti_suppress_agenda_date', todayStr)
    }
    onClose()
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dontShowAgainToday])

  const isTodayEmpty = todayEvents.length === 0
  const showUpcoming = isTodayEmpty && upcomingDeadlines.length > 0

  return (
    <div className="modal-backdrop landing-agenda-backdrop" onClick={handleClose}>
      <div className="modal-content cal-modal-card landing-agenda-modal animated zoomIn" onClick={e => e.stopPropagation()}>
        <div className="modal-header landing-agenda-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 className="landing-agenda-greeting">{greetingText}</h3>
              {greetingIcon}
            </div>
            <span className="landing-agenda-date">{longDateStr}</span>
          </div>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>

        <div className="landing-agenda-body">
          <h4 className="landing-agenda-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="landing-agenda-section-icon" style={{ display: 'flex', alignItems: 'center', color: 'var(--cal-primary)' }}>
              {showUpcoming ? <BellIcon /> : <CalendarIcon />}
            </span>
            <span>{showUpcoming ? "Upcoming Deadlines (Next 7 Days)" : "Today's Deadlines"}</span>
          </h4>

          {!isTodayEmpty ? (
            <div className="landing-agenda-list custom-scrollbar">
              {todayEvents.map(event => {
                const isAbsence = event.event_type === 'Day_Off'
                const isCompanyEvent = event.event_type === 'Company_Event'
                const displayName = event.engineer_name || event.username
                const taskType = inferTaskType(event.todo_title, event.todo_description)
                const taskColor = getTaskTypeColor(taskType)
                const teamAccent = getTeamColor(event.team)

                return (
                  <div
                    key={event.id}
                    className="landing-agenda-item"
                    style={(!isAbsence && !isCompanyEvent) ? {
                      borderLeft: `4px solid ${teamAccent !== 'transparent' ? teamAccent : taskColor.border}`,
                      background: taskColor.bg
                    } : isCompanyEvent ? {
                      borderLeft: `4px solid #6366f1`,
                      background: 'rgba(99, 102, 241, 0.04)'
                    } : {
                      borderLeft: `4px solid var(--cal-text-muted)`,
                      background: 'rgba(148, 163, 184, 0.04)'
                    }}
                  >
                    <div className="landing-agenda-item-left">
                      <span className="landing-agenda-item-icon" style={{
                        color: (!isAbsence && !isCompanyEvent)
                          ? (teamAccent !== 'transparent' ? teamAccent : taskColor.border)
                          : isCompanyEvent ? '#6366f1' : 'var(--cal-text-muted)'
                      }}>
                        {isCompanyEvent ? <GlobeIcon /> : isAbsence ? <LockIcon /> : <BriefcaseIcon />}
                      </span>
                      <div className="landing-agenda-item-content">
                        <span className="landing-agenda-item-title">
                          {isCompanyEvent
                            ? `Company Event: ${event.engineer_name}`
                            : isAbsence
                              ? `${displayName} (Absence)`
                              : event.todo_title}
                        </span>
                        <div className="landing-agenda-item-meta">
                          {(!isAbsence && !isCompanyEvent) && (
                            <span className="landing-agenda-meta-team">{event.team || 'No Team'}</span>
                          )}
                          {isCompanyEvent && (
                            <span className="landing-agenda-meta-team">{event.leave_type || 'Event'}</span>
                          )}
                          {isAbsence && (
                            <span className="landing-agenda-meta-team">{event.leave_type || 'Leave'}</span>
                          )}
                          <span className="landing-agenda-meta-separator">•</span>
                          <span>{isCompanyEvent ? "All Teams" : displayName}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : showUpcoming ? (
            <div className="landing-agenda-list custom-scrollbar">
              {upcomingDeadlines.map(event => {
                const displayName = event.engineer_name || event.username
                const taskType = inferTaskType(event.todo_title, event.todo_description)
                const taskColor = getTaskTypeColor(taskType)
                const teamAccent = getTeamColor(event.team)

                return (
                  <div
                    key={event.id}
                    className="landing-agenda-item"
                    style={{
                      borderLeft: `4px solid ${teamAccent !== 'transparent' ? teamAccent : taskColor.border}`,
                      background: taskColor.bg
                    }}
                  >
                    <div className="landing-agenda-item-left">
                      <span className="landing-agenda-item-icon" style={{
                        color: teamAccent !== 'transparent' ? teamAccent : taskColor.border
                      }}>
                        <BriefcaseIcon />
                      </span>
                      <div className="landing-agenda-item-content">
                        <span className="landing-agenda-item-title">{event.todo_title}</span>
                        <div className="landing-agenda-item-meta">
                          <span className="landing-agenda-meta-due-soon">{getDaysRemainingText(event)}</span>
                          <span className="landing-agenda-meta-separator">•</span>
                          <span>{displayName}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="landing-agenda-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 20px', color: 'var(--cal-text-muted)', gap: '8px', textAlign: 'center' }}>
              <SparkIcon />
              <span style={{ fontSize: '13px' }}>No active tasks or team absences scheduled for today.</span>
            </div>
          )}
        </div>

        <div className="landing-agenda-footer">
          <label className="landing-agenda-checkbox-label">
            <input
              type="checkbox"
              checked={dontShowAgainToday}
              onChange={e => setDontShowAgainToday(e.target.checked)}
              className="custom-checkbox-input"
            />
            <span className="custom-checkbox-styled"></span>
            <span style={{ fontSize: '11.5px', color: 'var(--cal-text-secondary)', userSelect: 'none' }}>
              Don't show this popup again today
            </span>
          </label>
          <button className="btn-agenda-dismiss" onClick={handleClose}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  )
}
