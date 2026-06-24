import { useState, useEffect, useRef, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { WorkScheduleProvider, useWorkScheduleContext, formatPercentDisplay } from './context/WorkScheduleContext'
import TimelineGrid from './components/TimelineGrid'
import ScheduleModals from './components/ScheduleModals'
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
    getStatusClass
  } = useWorkScheduleContext()

  const { normalComps, postponedComps, sentinels } = useMemo(() => {
    const allComps = j.components || []
    return {
      sentinels: allComps.filter(c => c.unit_code.toUpperCase().trim() === 'POSTPONED'),
      normalComps: allComps.filter(c => c.unit_code.toUpperCase().trim() !== 'POSTPONED' && !c.is_postponed),
      postponedComps: allComps.filter(c => c.unit_code.toUpperCase().trim() !== 'POSTPONED' && c.is_postponed)
    }
  }, [j.components])

  const renderRow = (c: IComponent, tinted = false) => (
    <tr key={c.id} style={tinted ? { background: 'rgba(245,158,11,0.06)' } : undefined}>
      <td><strong>{c.unit_code}</strong></td>
      <td><span className="param-pill">{formatPercentDisplay(c.assembly_3d)}</span></td>
      <td><span className="param-pill">{formatPercentDisplay(c.parts_3d)}</span></td>
      <td><span className="param-pill">{formatPercentDisplay(c.assembly_2d)}</span></td>
      <td><span className="param-pill">{formatPercentDisplay(c.parts_2d)}</span></td>
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
              style={{ padding: '4px 8px', fontSize: '11px' }}
              onClick={() => { setSelectedJob(j); openEditModal(c) }}
            >
              Edit
            </button>
            <button
              className="btn-schedule-action danger"
              style={{ padding: '4px 8px', fontSize: '11px' }}
              onClick={() => { setSelectedJob(j); handleDeleteComponent(c) }}
            >
              Delete
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
    <div className="schedule-main-panel" style={{ height: 'auto', flexShrink: 0 }}>
      {/* Header actions inside card */}
      <div className="schedule-header-actions" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '12px' }}>
        <div className="active-job-details">
          <h2>Job {j.job_id}</h2>
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
              className="btn-schedule-action danger"
              style={{ padding: '6px 8px', borderRadius: '6px' }}
              title="Delete this Job Group"
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

function WorkScheduleContent() {
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
    handleMouseUpCell
  } = useWorkScheduleContext()

  const [visibleCount, setVisibleCount] = useState(10)
  const loaderRef = useRef<HTMLDivElement | null>(null)

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
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            KMTI Work Schedule Monitoring
          </h3>

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
        <div className="jobs-cards-scroll-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {isLoadingJobs ? (
            <div className="schedule-loading-spinner" style={{ height: '200px' }}>
              <svg className="spinner-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="8" />
              </svg>
              <span>Loading jobs...</span>
            </div>
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

export default function WorkSchedule() {
  return (
    <WorkScheduleProvider>
      <WorkScheduleContent />
    </WorkScheduleProvider>
  )
}
