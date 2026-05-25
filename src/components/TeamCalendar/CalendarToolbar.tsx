import { ChevronLeftIcon, ChevronRightIcon, LockIcon } from './Icons'
import { formatLocalDate } from '../../utils/teamCalendarUtils'

interface CalendarToolbarProps {
  viewMode: 'month' | 'week' | 'agenda' | 'timeline'
  setViewMode: (mode: 'month' | 'week' | 'agenda' | 'timeline') => void
  monthName: string
  yearNum: number
  navigateDate: (direction: 'prev' | 'next' | 'today') => void
  setIsAddingDayOff: (val: boolean) => void
  setDayOffStart: (val: string) => void
  setDayOffEnd: (val: string) => void
}

export default function CalendarToolbar({
  viewMode,
  setViewMode,
  monthName,
  yearNum,
  navigateDate,
  setIsAddingDayOff,
  setDayOffStart,
  setDayOffEnd
}: CalendarToolbarProps) {
  return (
    <header className="calendar-toolbar">
      <div className="toolbar-left">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h2 className="calendar-month-title" style={{ minWidth: 'auto', lineHeight: '1.2' }}>
            {viewMode === 'month'
              ? `${monthName} ${yearNum}`
              : viewMode === 'week'
                ? `Week View — ${monthName}`
                : viewMode === 'timeline'
                  ? `Timeline — ${monthName}`
                  : `Agenda — Next 14 Days`}
          </h2>
          <div className="work-hours-badge" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color: 'var(--cal-text-muted)',
            fontWeight: '550',
            borderRadius: '12px',
            width: 'fit-content'
          }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--cal-primary)' }}></span>
            <span>Mon–Thu: 7 AM – 6 PM</span>
            <span style={{ color: 'var(--cal-card-border)' }}>|</span>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--cal-accent)' }}></span>
            <span>Fri: 7 AM – 4 PM <span style={{ opacity: 0.8 }}>(Short Day)</span></span>
            <span style={{ color: 'var(--cal-card-border)' }}>|</span>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--cal-text-muted)' }}></span>
            <span>Sat–Sun: Non-working</span>
          </div>
        </div>
        <div className="nav-controls">
          <button className="nav-chevron-btn" onClick={() => navigateDate('prev')} title="Previous">
            <ChevronLeftIcon />
          </button>
          <button className="nav-today-btn" onClick={() => navigateDate('today')}>
            Today
          </button>
          <button className="nav-chevron-btn" onClick={() => navigateDate('next')} title="Next">
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      <div className="toolbar-right">
        <div className="view-toggle">
          <button
            className={`view-toggle-btn ${viewMode === 'month' ? 'active' : ''}`}
            onClick={() => setViewMode('month')}
          >
            Month
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'week' ? 'active' : ''}`}
            onClick={() => setViewMode('week')}
          >
            Week
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'agenda' ? 'active' : ''}`}
            onClick={() => setViewMode('agenda')}
          >
            Agenda
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'timeline' ? 'active' : ''}`}
            onClick={() => setViewMode('timeline')}
          >
            Timeline
          </button>
        </div>

        <button className="btn-absence-trigger" onClick={() => {
          setDayOffStart(formatLocalDate(new Date()))
          setDayOffEnd(formatLocalDate(new Date()))
          setIsAddingDayOff(true)
        }}>
          <span className="absence-btn-icon"><LockIcon /></span>
          <span>Request Leave</span>
        </button>
      </div>
    </header>
  )
}
