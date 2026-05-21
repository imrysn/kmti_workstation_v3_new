import { useTeamCalendar } from '../hooks/useTeamCalendar'
import CalendarSidebar from '../components/TeamCalendar/CalendarSidebar'
import CalendarToolbar from '../components/TeamCalendar/CalendarToolbar'
import CalendarGrid from '../components/TeamCalendar/CalendarGrid'
import AgendaView from '../components/TeamCalendar/AgendaView'

import ConfirmClaimModal from '../components/TeamCalendar/modals/ConfirmClaimModal'
import AssignTaskModal from '../components/TeamCalendar/modals/AssignTaskModal'
import DayOffModal from '../components/TeamCalendar/modals/DayOffModal'
import CompanyEventModal from '../components/TeamCalendar/modals/CompanyEventModal'
import EventDetailsModal from '../components/TeamCalendar/modals/EventDetailsModal'
import DayEventsPopover from '../components/TeamCalendar/modals/DayEventsPopover'

import './TeamCalendar.css'

export default function TeamCalendar() {
  const cal = useTeamCalendar()

  return (
    <div className="team-calendar-page page-container">
      {cal.claimingTask && (
        <div className="interactive-claim-banner">
          <div className="banner-content">
            <span className="pulse-dot"></span>
            <span>
              Claiming Task: <strong>{cal.claimingTask.title}</strong>.{' '}
              {!cal.claimStartDate
                ? "Click on the start day in the calendar grid."
                : `Selected Start: ${cal.claimStartDate}. Now click on the end day.`}
            </span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={cal.cancelClaimMode}>Cancel Claim</button>
        </div>
      )}

      <div className="team-calendar-layout">
        <CalendarSidebar
          visibleEngineers={cal.visibleEngineers}
          showClaims={cal.showClaims}
          setShowClaims={cal.setShowClaims}
          showAbsences={cal.showAbsences}
          setShowAbsences={cal.setShowAbsences}
          showSpans={cal.showSpans}
          setShowSpans={cal.setShowSpans}
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

          <div className="calendar-grid-container custom-scrollbar">
            {cal.viewMode === 'agenda' ? (
              <AgendaView
                agendaDays={cal.agendaDays}
                events={cal.events}
                phHolidays={cal.phHolidays}
                showClaims={cal.showClaims}
                showAbsences={cal.showAbsences}
                showSpans={cal.showSpans}
                setSelectedEvent={cal.setSelectedEvent}
              />
            ) : (
              <CalendarGrid
                viewMode={cal.viewMode}
                calendarDays={cal.calendarDays}
                displayDate={cal.displayDate}
                events={cal.events}
                phHolidays={cal.phHolidays}
                showClaims={cal.showClaims}
                showAbsences={cal.showAbsences}
                showSpans={cal.showSpans}
                claimingTask={cal.claimingTask}
                claimStartDate={cal.claimStartDate}
                handleCellClick={cal.handleCellClick}
                setSelectedEvent={cal.setSelectedEvent}
                setActivePopoverDate={cal.setActivePopoverDate}
              />
            )}
          </div>
        </main>
      </div>

      {/* ── INTERACTIVE CLAIM CONFIRMATION MODAL ───────────────────── */}
      {cal.confirmingClaim && (
        <ConfirmClaimModal
          confirmingClaim={cal.confirmingClaim}
          engineerName={cal.engineerName}
          handleNameChange={cal.handleNameChange}
          handleConfirmClaimSubmit={cal.handleConfirmClaimSubmit}
          onClose={() => cal.setConfirmingClaim(null)}
        />
      )}

      {/* ── ADMIN ASSIGN TASK MODAL ────────────────────────────────── */}
      {cal.assigningTask && (
        <AssignTaskModal
          assigningTask={cal.assigningTask}
          assignSelectedTodoId={cal.assignSelectedTodoId}
          setAssignSelectedTodoId={cal.setAssignSelectedTodoId}
          backlog={cal.backlog}
          assignUserId={cal.assignUserId}
          setAssignUserId={cal.setAssignUserId}
          assignEngineerName={cal.assignEngineerName}
          setAssignEngineerName={cal.setAssignEngineerName}
          activeUsers={cal.activeUsers}
          assignStartDate={cal.assignStartDate}
          setAssignStartDate={cal.setAssignStartDate}
          assignEndDate={cal.assignEndDate}
          setAssignEndDate={cal.setAssignEndDate}
          handleAssignTaskSubmit={cal.handleAssignTaskSubmit}
          onClose={() => cal.setAssigningTask(null)}
        />
      )}

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
          events={cal.events}
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
    </div>
  )
}
