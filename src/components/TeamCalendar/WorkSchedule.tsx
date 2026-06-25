import { useState, useEffect, useRef, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { WorkScheduleProvider, useWorkScheduleContext, formatPercentDisplay } from './context/WorkScheduleContext'
import TimelineGrid from './components/TimelineGrid'
import ScheduleModals from './components/ScheduleModals'
import { useModal } from '../ModalContext'
import type { IJob, IComponent } from '../../hooks/useWorkSchedule'
import './WorkSchedule.css'

function JobCard({ j }: { j: IJob }) {
  const {
    canWrite,
    setSelectedJob,
    setIsAddingComponent,
    handleDeleteJob,
    openEditModal,
    handleDeleteComponent,
    getStatusClass,
    setEditingJob
  } = useWorkScheduleContext()

  const { normalComps, postponedComps, sentinels } = useMemo(() => {
    const allComps = j.components || []
    return {
      sentinels: allComps.filter(c => c.unit_code.toUpperCase().trim() === 'POSTPONED'),
      normalComps: allComps.filter(c => c.unit_code.toUpperCase().trim() !== 'POSTPONED' && !c.is_postponed),
      postponedComps: allComps.filter(c => c.unit_code.toUpperCase().trim() !== 'POSTPONED' && c.is_postponed)
    }
  }, [j.components])

  const renderPercent = (val: string) => {
    const display = formatPercentDisplay(val)
    const isRed = display === '100%'
    return (
      <span style={isRed ? { color: 'var(--danger, #ef4444)', fontWeight: 'bold' } : undefined}>
        {display}
      </span>
    )
  }

  const renderRow = (c: IComponent, tinted = false) => (
    <tr key={c.id} style={tinted ? { background: 'rgba(245,158,11,0.06)' } : undefined}>
      <td><strong>{c.unit_code}</strong></td>
      <td>{renderPercent(c.assembly_3d)}</td>
      <td>{renderPercent(c.parts_3d)}</td>
      <td>{renderPercent(c.assembly_2d)}</td>
      <td>{renderPercent(c.parts_2d)}</td>
      <td>
        <span className={`status-badge-schedule ${getStatusClass(c.status)}`}>
          {c.status}
        </span>
      </td>
      <td>{c.submitted_date || '-'}</td>
      {canWrite && (
        <td>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button
              className="btn-schedule-action"
              style={{ padding: '6px 8px', borderRadius: '6px' }}
              title="Edit drawing details"
              onClick={() => { setSelectedJob(j); openEditModal(c) }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button
              className="btn-schedule-action danger"
              style={{ padding: '6px 8px', borderRadius: '6px' }}
              title="Delete row"
              onClick={() => { setSelectedJob(j); handleDeleteComponent(c) }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </td>
      )}
    </tr>
  )

  const postponedDivider = (key: string) => (
    <tr key={key} style={{ background: 'rgba(245,158,11,0.1)', fontWeight: 'bold' }}>
      <td colSpan={canWrite ? 8 : 7} style={{ padding: '10px 16px', color: 'var(--warning, #f59e0b)', fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase' }}>
        <strong>&bull; POSTPONED</strong>
      </td>
    </tr>
  )

  return (
    <div className="schedule-main-panel" style={{ height: 'auto', flexShrink: 0, breakInside: 'avoid', marginBottom: '20px' }}>
      {/* Header actions inside card */}
      <div className="schedule-header-actions" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '12px' }}>
        <div className="active-job-details">
          <h2>{j.job_id} Job Status</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Deadline: {j.deadline || 'Not Specified'} &bull; Completion: {j.progress_percent}% ({j.completed_components}/{j.total_components} Units)
          </p>
        </div>
        <div className="action-buttons-group">
          {canWrite && (
            <button
              className="btn-schedule-action primary"
              style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px' }}
              onClick={() => {
                setSelectedJob(j)
                setIsAddingComponent(true)
              }}
            >
              + Add
            </button>
          )}
          {canWrite && (
            <button
              className="btn-schedule-action"
              style={{ padding: '6px 8px', borderRadius: '6px' }}
              title="Edit Job"
              onClick={() => setEditingJob(j)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          )}
          {canWrite && (
            <button
              className="btn-schedule-action danger"
              style={{ padding: '6px 8px', borderRadius: '6px' }}
              title="Delete this Job"
              onClick={() => handleDeleteJob(j.job_id)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Card Table */}
      <div className="components-table-container custom-scrollbar" style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
        <table className="components-table">
          <thead>
            <tr>
              <th>Machine/Unit Code</th>
              <th>3D Assembly</th>
              <th>3D Parts</th>
              <th>2D Assembly</th>
              <th>2D Parts</th>
              <th>Status</th>
              <th>Submitted Date</th>
              {canWrite && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {normalComps.map(c => renderRow(c))}
            {/* Render DB sentinel rows if present (legacy), otherwise auto-insert divider */}
            {sentinels.length > 0
              ? sentinels.map(c => postponedDivider(`sentinel-${c.id}`))
              : postponedComps.length > 0 && postponedDivider('auto-divider')
            }
            {postponedComps.map(c => renderRow(c, true))}
            {(!j.components || j.components.length === 0) && (
              <tr>
                <td colSpan={canWrite ? 8 : 7} style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)' }}>
                  No component drawings monitored for this job.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function WorkScheduleContent({ isVisible }: { isVisible: boolean }) {
  const { alert } = useModal()
  const {
    flags,
    isAdminOrIT,
    canWrite,
    searchQuery,
    setSearchQuery,
    isLoadingJobs,
    isExporting,
    timelineMembers,
    timelineDays,
    displayYear,
    setDisplayYear,
    availableYears,
    isLoadingTimeline,
    timelineScrollRef,
    dragStartCell,
    dragHoverCol,
    setIsAddingJob,
    filteredJobs,
    handleExport,
    getDayClass,
    isToday,
    handleMouseDown,
    handleMouseEnter,
    handleMouseUpCell,
    sortBy,
    setSortBy,
    statusFilter,
    setStatusFilter
  } = useWorkScheduleContext()

  const [visibleCount, setVisibleCount] = useState(10)
  const loaderRef = useRef<HTMLDivElement | null>(null)

  // Scroll to today whenever the tab becomes visible and timeline data is ready.
  // We can't rely on the mount-time scroll because WorkSchedule is always mounted
  // (display:none when hidden), so scrollIntoView on a hidden element is a no-op.
  useEffect(() => {
    if (!isVisible || timelineDays.length === 0) return
    // requestAnimationFrame ensures display:block has been applied before we scroll
    const raf = requestAnimationFrame(() => {
      const el = timelineScrollRef.current
      if (!el) return
      const todayCell = el.querySelector('.cell-today')
      if (todayCell) {
        todayCell.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' })
      } else {
        // Today is not in the current year view — jump to end
        el.scrollLeft = el.scrollWidth
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [isVisible, timelineDays])

  useEffect(() => {
    setVisibleCount(10)
  }, [searchQuery])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && filteredJobs.length > visibleCount) {
          setVisibleCount((prev) => prev + 10)
        }
      },
      { rootMargin: '200px' }
    )

    const currentLoader = loaderRef.current
    if (currentLoader) {
      observer.observe(currentLoader)
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader)
      }
    }
  }, [filteredJobs.length, visibleCount])

  if ((!flags.work_schedule_enabled || flags.work_schedule_maintenance) && !isAdminOrIT) {
    return <Navigate to="/closed" replace />
  }

  return (
    <div className="work-schedule-dashboard">

      {/* ── TOP TIMELINE CARD ─────────────────────────────────────── */}
      <div className="timeline-card">
        <div className="timeline-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              KMTI Work Schedule Monitoring
            </h3>
            {availableYears.length > 1 && (
              <select
                value={displayYear}
                onChange={(e) => setDisplayYear(parseInt(e.target.value))}
                className="year-selector"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: 'none',
                  marginTop: '-2px'
                }}
              >
                {availableYears.map((y) => (
                  <option key={y} value={y} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                    {y}
                  </option>
                ))}
              </select>
            )}
            {canWrite && (
              <button
                className="btn-schedule-action primary"
                style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginLeft: '8px'
                }}
                onClick={() => alert('This feature is still in development.', 'System Notification')}
              >
                + Add Employee
              </button>
            )}
          </div>

          {/* Legend container */}
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '6px 16px', borderRadius: '20px', border: '1px solid var(--border)', fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
            <span style={{ color: 'var(--text-secondary)', marginRight: '4px', letterSpacing: '0.5px' }}>LEGEND:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#ef4444', border: '1px solid rgba(255,255,255,0.1)' }}></div>
              <span>Deadline</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#f59e0b', border: '1px solid rgba(255,255,255,0.1)' }}></div>
              <span>Delivered</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#00a6ff', border: '1px solid rgba(255,255,255,0.1)' }}></div>
              <span>3D</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#eab308', border: '1px solid rgba(255,255,255,0.1)' }}></div>
              <span>2D</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#ec4899', border: '1px solid rgba(255,255,255,0.1)' }}></div>
              <span>Holiday</span>
            </div>
          </div>

          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
            {canWrite ? '* Click/Double-click assignment block to edit cell value' : '* View Mode (Read-Only)'}
          </span>
        </div>

        <TimelineGrid
          timelineMembers={timelineMembers}
          timelineDays={timelineDays}
          isLoadingTimeline={isLoadingTimeline}
          timelineScrollRef={timelineScrollRef}
          dragStartCell={dragStartCell}
          dragHoverCol={dragHoverCol}
          getDayClass={getDayClass}
          isToday={isToday}
          handleMouseDown={handleMouseDown}
          handleMouseEnter={handleMouseEnter}
          handleMouseUpCell={handleMouseUpCell}
        />
      </div>

      {/* ── BOTTOM MAIN DETAILS PANEL (JOBS & DRAWINGS) ────────────────── */}
      <div className="work-schedule-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Top filter and actions bar */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div className="search-input-wrapper" style={{ width: '300px' }}>
              <svg className="search-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search Jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="year-selector"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
                height: '38px'
              }}
            >
              <option value="name-asc">Sort by: Name (A-Z)</option>
              <option value="name-desc">Sort by: Name (Z-A)</option>
              <option value="deadline-asc">Sort by: Deadline (Soonest)</option>
              <option value="deadline-desc">Sort by: Deadline (Latest)</option>
              <option value="status">Sort by: Status (Complete First)</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="year-selector"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
                height: '38px'
              }}
            >
              <option value="all">Status: All</option>
              <option value="completed">Status: Complete/Completed</option>
              <option value="checking">Status: For Checking</option>
              <option value="pending">Status: Pending/Not Started</option>
              <option value="excluded">Status: Excluded/NA</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn-schedule-action"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? 'Exporting...' : 'Export Excel'}
            </button>
            {canWrite && (
              <button
                className="btn-schedule-action primary"
                onClick={() => setIsAddingJob(true)}
              >
                + New Job
              </button>
            )}
          </div>
        </div>
        <div className="jobs-cards-scroll-wrapper" style={{ columnCount: 2, columnGap: '20px', display: 'block' }}>
          {isLoadingJobs ? (
            // ── Job Cards Skeleton ──────────────────────────────────
            <>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="sk-job-card">
                  {/* Card header */}
                  <div className="skeleton-cell sk-card-title" style={{ width: i % 2 === 0 ? '50%' : '62%' }} />
                  <div className="skeleton-cell sk-card-meta" style={{ width: i % 2 === 0 ? '78%' : '68%' }} />
                  <div className="skeleton-cell sk-card-divider" />
                  {/* Table header row */}
                  <div className="sk-table-row" style={{ marginBottom: '14px' }}>
                    <div className="skeleton-cell sk-col-main" style={{ height: '11px', opacity: 0.5 }} />
                    <div className="skeleton-cell sk-col-sm" style={{ height: '11px', opacity: 0.5 }} />
                    <div className="skeleton-cell sk-col-sm" style={{ height: '11px', opacity: 0.5 }} />
                    <div className="skeleton-cell sk-col-sm" style={{ height: '11px', opacity: 0.5 }} />
                    <div className="skeleton-cell sk-col-sm" style={{ height: '11px', opacity: 0.5 }} />
                    <div className="skeleton-cell sk-col-badge" style={{ height: '11px', opacity: 0.5 }} />
                  </div>
                  {/* Data rows */}
                  {[0, 1, 2].map((r) => (
                    <div key={r} className="sk-table-row">
                      <div className="skeleton-cell sk-col-main" style={{ width: r === 1 ? '30%' : undefined }} />
                      <div className="skeleton-cell sk-col-sm" />
                      <div className="skeleton-cell sk-col-sm" />
                      <div className="skeleton-cell sk-col-sm" />
                      <div className="skeleton-cell sk-col-sm" />
                      <div className="skeleton-cell sk-col-badge" />
                    </div>
                  ))}
                </div>
              ))}
            </>
          ) : filteredJobs.length === 0 ? (
            <div className="no-schedule-selected" style={{ height: '200px' }}>
              <h3>No Jobs Found</h3>
              <p>Try searching for a different Job ID or create a new job group above.</p>
            </div>
          ) : (
            filteredJobs.slice(0, visibleCount).map((j) => (
              <JobCard key={j.job_id} j={j} />
            ))
          )}
          {filteredJobs.length > visibleCount && (
            <div ref={loaderRef} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
              Loading more jobs...
            </div>
          )}
        </div>
      </div>

      <ScheduleModals />
    </div>
  )
}

export default function WorkSchedule({ isVisible }: { isVisible: boolean }) {
  return (
    <WorkScheduleProvider>
      <WorkScheduleContent isVisible={isVisible} />
    </WorkScheduleProvider>
  )
}
