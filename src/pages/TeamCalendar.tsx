import { useState, useEffect, useMemo } from 'react'
import { useTeamCalendar } from '../hooks/useTeamCalendar'
import CalendarSidebar from '../components/TeamCalendar/CalendarSidebar'
import CalendarToolbar from '../components/TeamCalendar/CalendarToolbar'
import CalendarGrid from '../components/TeamCalendar/CalendarGrid'
import AgendaView from '../components/TeamCalendar/AgendaView'
import CalendarTimeline from '../components/TeamCalendar/CalendarTimeline'

import DayOffModal from '../components/TeamCalendar/modals/DayOffModal'
import CompanyEventModal from '../components/TeamCalendar/modals/CompanyEventModal'
import EventDetailsModal from '../components/TeamCalendar/modals/EventDetailsModal'
import DayEventsPopover from '../components/TeamCalendar/modals/DayEventsPopover'
import LandingAgendaModal from '../components/TeamCalendar/modals/LandingAgendaModal'

import { formatLocalDate, inferTaskType, type TaskType } from '../utils/teamCalendarUtils'
import './TeamCalendar.css'

export default function TeamCalendar() {
  const cal = useTeamCalendar()
  const [showLandingAgenda, setShowLandingAgenda] = useState(false)
  const [pcName, setPcName] = useState<string>('')
  const [selectedTaskType, setSelectedTaskType] = useState<TaskType | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('kmti_calendar_sidebar_collapsed')
    return saved !== null ? saved === 'true' : false
  })

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev
      localStorage.setItem('kmti_calendar_sidebar_collapsed', String(next))
      return next
    })
  }

  useEffect(() => {
    const todayStr = formatLocalDate(new Date())
    const suppressedDate = localStorage.getItem('kmti_suppress_agenda_date')
    const shownThisSession = sessionStorage.getItem('kmti_landing_agenda_shown') === 'true'

    if (suppressedDate !== todayStr && !shownThisSession) {
      setShowLandingAgenda(true)
      sessionStorage.setItem('kmti_landing_agenda_shown', 'true')
    }

    if (window.electronAPI?.getWorkstationInfo) {
      window.electronAPI.getWorkstationInfo()
        .then(info => {
          if (info?.computerName) {
            setPcName(info.computerName)
          }
        })
        .catch(err => console.error("Failed to get workstation info:", err))
    }
  }, [])

  // Compute filteredEvents list
  const filteredEvents = useMemo(() => {
    const todayMidnight = new Date()
    todayMidnight.setHours(0, 0, 0, 0)

    return cal.events.filter(e => {
      // 1. Task Type Filter
      if (selectedTaskType) {
        if (e.event_type !== 'Task_Claim') return false
        const type = inferTaskType(e.todo_title || '', e.todo_description || '')
        if (type !== selectedTaskType) return false
      }

      // 2. Status Filter
      if (selectedStatus) {
        if (e.event_type !== 'Task_Claim') return false
        let status = 'Active'
        if (e.todo_status === 'Completed') {
          status = 'Completed'
        } else if (e.due_date && new Date(e.due_date) < todayMidnight) {
          status = 'Overdue'
        } else {
          status = 'Active'
        }
        if (status !== selectedStatus) return false
      }

      // 3. Team Filter
      if (selectedTeam) {
        if (e.team !== selectedTeam) return false
      }

      return true
    })
  }, [cal.events, selectedTaskType, selectedStatus, selectedTeam])

  return (
    <div className="team-calendar-page page-container">
      {isSidebarCollapsed && (
        <button className="sidebar-expand-btn" onClick={toggleSidebar} title="Expand">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      <div className={`team-calendar-layout${isSidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
        <CalendarSidebar
          visibleTaskTypes={cal.visibleTaskTypes}
          visibleTeams={cal.visibleTeams}
          showClaims={cal.showClaims}
          setShowClaims={cal.setShowClaims}
          showAbsences={cal.showAbsences}
          setShowAbsences={cal.setShowAbsences}
          showSpans={cal.showSpans}
          setShowSpans={cal.setShowSpans}
          pendingApprovals={cal.pendingApprovals}
          isAdminOrIT={cal.isAdminOrIT}
          onApproveLeave={cal.handleApproveEvent}
          isCollapsed={isSidebarCollapsed}
          onToggle={toggleSidebar}
          events={cal.events}
          selectedTaskType={selectedTaskType}
          onSelectTaskType={setSelectedTaskType}
          selectedStatus={selectedStatus}
          onSelectStatus={setSelectedStatus}
          selectedTeam={selectedTeam}
          onSelectTeam={setSelectedTeam}
          onCancelLeave={(eventId, name) =>
            cal.confirm(
              `Decline leave request from ${name}? This will remove the pending event.`,
              async () => {
                try {
                  const { teamCalendarApi } = await import('../services/teamCalendarService')
                  const res = await teamCalendarApi.deleteEvent(eventId)
                  if (res.success) {
                    cal.notify('Leave request declined.', 'success')
                    cal.loadData()
                  }
                } catch {
                  cal.notify('Failed to decline leave request.', 'error')
                }
              },
              undefined,
              'danger',
              'Decline Leave Request'
            )
          }
        />

        <main className="calendar-main-content" onWheel={cal.handleCalendarWheel}>
          <CalendarToolbar
            viewMode={cal.viewMode}
            setViewMode={cal.setViewMode}
            monthName={cal.monthName}
            yearNum={cal.yearNum}
            navigateDate={cal.navigateDate}
            setIsAddingDayOff={cal.setIsAddingDayOff}
            setDayOffStart={cal.setDayOffStart}
            setDayOffEnd={cal.setDayOffEnd}
          />

          <div className={`calendar-grid-container ${cal.viewMode !== 'timeline' ? 'custom-scrollbar' : ''}`} style={cal.viewMode === 'timeline' ? { overflow: 'hidden' } : {}}>
            {cal.viewMode === 'agenda' ? (
              <AgendaView
                agendaDays={cal.agendaDays}
                events={filteredEvents}
                phHolidays={cal.phHolidays}
                showClaims={cal.showClaims}
                showAbsences={cal.showAbsences}
                showSpans={cal.showSpans}
                setSelectedEvent={cal.setSelectedEvent}
              />
            ) : cal.viewMode === 'timeline' ? (
              <CalendarTimeline
                isLoading={cal.isLoading}
                calendarDays={cal.calendarDays}
                events={filteredEvents}
                phHolidays={cal.phHolidays}
                showClaims={cal.showClaims}
                showAbsences={cal.showAbsences}
                setSelectedEvent={cal.setSelectedEvent}
              />
            ) : (
              <CalendarGrid
                isLoading={cal.isLoading}
                viewMode={cal.viewMode}
                calendarDays={cal.calendarDays}
                displayDate={cal.displayDate}
                events={filteredEvents}
                phHolidays={cal.phHolidays}
                showClaims={cal.showClaims}
                showAbsences={cal.showAbsences}
                showSpans={cal.showSpans}
                handleCellClick={cal.handleCellClick}
                setSelectedEvent={cal.setSelectedEvent}
                setActivePopoverDate={cal.setActivePopoverDate}
              />
            )}
          </div>
        </main>
      </div>



      {/* ── DAY OFF / ABSENCE LOCK MODAL ───────────────────────────── */}
      {cal.isAddingDayOff && (
        <DayOffModal
          engineerName={cal.engineerName}
          handleNameChange={cal.handleNameChange}
          dayOffStart={cal.dayOffStart}
          setDayOffStart={cal.setDayOffStart}
          dayOffEnd={cal.dayOffEnd}
          setDayOffEnd={cal.setDayOffEnd}
          handleRequestDayOffSubmit={cal.handleRequestDayOffSubmit}
          onClose={() => cal.setIsAddingDayOff(false)}
        />
      )}

      {/* ── CREATE COMPANY EVENT MODAL ─────────────────────────────── */}
      {cal.isAddingCompanyEvent && (
        <CompanyEventModal
          companyEventTitle={cal.companyEventTitle}
          setCompanyEventTitle={cal.setCompanyEventTitle}
          companyEventCategory={cal.companyEventCategory}
          setCompanyEventCategory={cal.setCompanyEventCategory}
          companyEventStart={cal.companyEventStart}
          setCompanyEventStart={cal.setCompanyEventStart}
          companyEventEnd={cal.companyEventEnd}
          setCompanyEventEnd={cal.setCompanyEventEnd}
          handleCreateCompanyEventSubmit={cal.handleCreateCompanyEventSubmit}
          onClose={() => cal.setIsAddingCompanyEvent(false)}
        />
      )}

      {/* ── EVENT DETAILS MODAL ───────────────────────────────────── */}
      {cal.selectedEvent && (
        <EventDetailsModal
          selectedEvent={cal.selectedEvent}
          isAdminOrIT={cal.isAdminOrIT}
          currentUser={cal.user}
          handleApproveEvent={cal.handleApproveEvent}
          handleCancelEvent={cal.handleCancelEvent}
          onClose={() => cal.setSelectedEvent(null)}
        />
      )}

      {/* ── DAILY EVENTS OVERVIEW POPOVER ──────────────────────────── */}
      {cal.activePopoverDate && (
        <DayEventsPopover
          activePopoverDate={cal.activePopoverDate}
          events={filteredEvents}
          phHolidays={cal.phHolidays}
          showClaims={cal.showClaims}
          showAbsences={cal.showAbsences}
          showSpans={cal.showSpans}
          isAdminOrIT={cal.isAdminOrIT}
          setSelectedEvent={cal.setSelectedEvent}
          setCompanyEventStart={cal.setCompanyEventStart}
          setCompanyEventEnd={cal.setCompanyEventEnd}
          setCompanyEventTitle={cal.setCompanyEventTitle}
          setCompanyEventCategory={cal.setCompanyEventCategory}
          setIsAddingCompanyEvent={cal.setIsAddingCompanyEvent}
          onClose={() => cal.setActivePopoverDate(null)}
        />
      )}
      {showLandingAgenda && (
        <LandingAgendaModal
          events={cal.events}
          currentUser={cal.user}
          pcName={pcName}
          showClaims={cal.showClaims}
          showAbsences={cal.showAbsences}
          showSpans={cal.showSpans}
          onClose={() => setShowLandingAgenda(false)}
        />
      )}
    </div>
  )
}
