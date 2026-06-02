import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { quotationApi } from '../../services/api'
import { IQuotation } from '../../types'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../ModalContext'
import './QuotationLibraryModal.css'

interface Props {
  onSelect: (quotation: IQuotation) => void
  onClose: () => void
}

/**
 * QuotationLibraryModal.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * A centralized library for browsing, searching, and managing collaborative 
 * quotation workspaces. 
 * 
 * Features:
 * - Real-time "Live" session indicators.
 * - Hostname-based deletion (True Ownership).
 * - Multi-field search (ID, Client, Designer).
 */
export default function QuotationLibraryModal({ onSelect, onClose }: Props) {
  const { hasRole } = useAuth()
  const { notify, confirm } = useModal()

  // ── State ───────────────────────────────────────────────────────
  const [view, setView] = useState<'active' | 'trash'>('active')
  const [quotations, setQuotations] = useState<IQuotation[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [myWorkstation, setMyWorkstation] = useState<string | null>(null)
  const [sortField, setSortField] = useState<'quotationNo' | 'workstation' | 'modifiedAt'>('modifiedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const handleSort = (field: 'quotationNo' | 'workstation' | 'modifiedAt') => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // ── Handlers ────────────────────────────────────────────────────
  const fetchLibrary = useCallback(async () => {
    setLoading(true)
    try {
      const res = await quotationApi.list({ limit: 100, trash_only: view === 'trash' })
      const data = res.data as unknown as { quotations: IQuotation[] }
      setQuotations(data.quotations || [])
    } catch (e) {
      console.error('[library] Failed to fetch records:', e)
      notify?.('Failed to load library. Please check your connection.', 'error')
    } finally {
      setLoading(false)
    }
  }, [notify, view])

  useEffect(() => {
    fetchLibrary()

    // Fetch local hardware ID/Hostname for "True Ownership" deletion logic
    const electron = (window as any).electronAPI
    if (electron?.getWorkstationInfo) {
      electron.getWorkstationInfo().then((info: any) => {
        if (info?.computerName) setMyWorkstation(info.computerName)
      })
    }
  }, [fetchLibrary])

  const handleDelete = async (e: React.MouseEvent, q: IQuotation) => {
    e.stopPropagation()

    if (hasRole('user')) {
      notify?.('Access Denied: Standard users are not permitted to delete records.', 'error')
      return
    }

    // Ownership Enforcement: 
    // Since accounts are shared, we identify the owner by the workstation Hostname.
    const isOwner = (myWorkstation && q.workstation === myWorkstation) || hasRole('admin', 'it')

    if (!isOwner) {
      notify?.(`Access Denied: This record belongs to workstation "${q.workstation || 'Legacy'}".`, 'error')
      return
    }

    confirm(
      `Are you sure you want to move quotation ${q.quotationNo} to the Trash Bin?`,
      async () => {
        try {
          await quotationApi.delete(q.id, myWorkstation || undefined) // soft delete
          notify?.('Quotation moved to Trash.', 'success')
          fetchLibrary()
        } catch (err) {
          notify?.('Server error: Deletion failed.', 'error')
        }
      },
      undefined,
      'danger',
      'Move to Trash Bin',
      'Move to Trash'
    )
  }

  const handleRestore = async (e: React.MouseEvent, q: IQuotation) => {
    e.stopPropagation()

    if (!hasRole('admin', 'it')) {
      notify?.('Access Denied: Only administrators can restore records.', 'error')
      return
    }

    confirm(
      `Are you sure you want to restore quotation ${q.quotationNo}?`,
      async () => {
        try {
          await quotationApi.restore(q.id)
          notify?.('Quotation record restored.', 'success')
          fetchLibrary()
        } catch (err) {
          notify?.('Server error: Restore failed.', 'error')
        }
      },
      undefined,
      'primary',
      'Confirm Restore',
      'Restore Record'
    )
  }

  const handlePermanentDelete = async (e: React.MouseEvent, q: IQuotation) => {
    e.stopPropagation()

    if (!hasRole('admin', 'it')) {
      notify?.('Access Denied: Only administrators can permanently delete records.', 'error')
      return
    }

    confirm(
      `Are you sure you want to PERMANENTLY purge quotation ${q.quotationNo}? This cannot be undone.`,
      async () => {
        try {
          await quotationApi.delete(q.id, undefined, true) // permanent = true
          notify?.('Quotation permanently purged.', 'success')
          fetchLibrary()
        } catch (err) {
          notify?.('Server error: Deletion failed.', 'error')
        }
      },
      undefined,
      'danger',
      'Confirm Permanent Deletion',
      'Purge Record'
    )
  }

  const handleReveal = (q: IQuotation) => {
    const pwd = q.password || 'Unknown'
    const isIT = hasRole('it')

    confirm(
      `Password for ${q.quotationNo} is: [ ${pwd} ]`,
      () => {
        navigator.clipboard.writeText(pwd)
        notify?.('Password copied to clipboard.', 'success')
      },
      undefined,
      'info',
      isIT ? 'IT OVERRIDE' : 'Password Recovery',
      'Copy to Clipboard'
    )
  }

  // ── Helpers ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    const list = quotations.filter(q =>
      q.quotationNo.toLowerCase().includes(s) ||
      (q.clientName || '').toLowerCase().includes(s) ||
      (q.designerName || '').toLowerCase().includes(s) ||
      (q.displayName || '').toLowerCase().includes(s)
    )

    list.sort((a, b) => {
      let valA: any = ''
      let valB: any = ''

      if (sortField === 'quotationNo') {
        valA = a.quotationNo.toLowerCase()
        valB = b.quotationNo.toLowerCase()
      } else if (sortField === 'workstation') {
        valA = (a.workstation || '').toLowerCase()
        valB = (b.workstation || '').toLowerCase()
      } else if (sortField === 'modifiedAt') {
        valA = a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0
        valB = b.modifiedAt ? new Date(b.modifiedAt).getTime() : 0
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return list
  }, [quotations, search, sortField, sortOrder])

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    const dStr = date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
    const tStr = date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    })
    return `${dStr}, ${tStr}`
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="quot-library-overlay" onClick={onClose}>
      <div className="quot-library-modal" onClick={e => e.stopPropagation()}>
        <header className="quot-library-header">
          <div className="quot-library-header-main">
            <h2>Quotation Library</h2>
            <p>Browse and resume saved collaborative workspaces</p>
          </div>
          <button className="quot-library-close" onClick={onClose} title="Close library">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {hasRole('admin', 'it') && (
          <div className="quot-library-tabs">
            <button
              className={`library-tab ${view === 'active' ? 'active' : ''}`}
              onClick={() => setView('active')}
            >
              Active Workspaces
            </button>
            <button
              className={`library-tab ${view === 'trash' ? 'active' : ''}`}
              onClick={() => setView('trash')}
            >
              Trash Bin
            </button>
          </div>
        )}

        <div className="quot-library-toolbar">
          <div className="quot-library-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <button className="btn btn-ghost" onClick={fetchLibrary} title="Refresh library">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>

        <div className="quot-library-content">
          {loading ? (
            <div className="quot-library-loading">
              <div className="spinner"></div>
              <p>Fetching records from backend...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="quot-library-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.15 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <p>No quotations found matching your search.</p>
            </div>
          ) : (
            <table className="quot-library-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('quotationNo')} className="sortable-header">
                    Quotation No & Client {sortField === 'quotationNo' && (sortOrder === 'asc' ? ' ▲' : ' ▼')}
                  </th>
                  <th onClick={() => handleSort('workstation')} className="sortable-header">
                    Owner {sortField === 'workstation' && (sortOrder === 'asc' ? ' ▲' : ' ▼')}
                  </th>
                  <th onClick={() => handleSort('modifiedAt')} className="sortable-header">
                    Last Modified {sortField === 'modifiedAt' && (sortOrder === 'asc' ? ' ▲' : ' ▼')}
                  </th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(q => (
                  <tr key={q.id} className={q.isActive ? 'is-active-row' : ''}>
                    <td className="quotation-no-cell">
                      <div className="quot-main-info">
                        <div className="quot-no-row">
                          <span className="quot-no-text">{q.quotationNo}</span>
                          {q.isActive && <span className="active-badge">Live</span>}
                          {q.hasPassword && (
                            <svg className="lock-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                          )}
                        </div>
                        <span className="client-subtext">{q.clientName || 'No Client Assigned'}</span>
                      </div>
                    </td>
                    <td className="owner-cell">
                      <div className="owner-info">
                        <span className="workstation-badge">{q.workstation || 'Legacy'}</span>
                      </div>
                    </td>
                    <td className="text-secondary">{formatDate(q.modifiedAt)}</td>
                    <td className="text-right action-cell">
                      {view === 'trash' ? (
                        <>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={(e) => handleRestore(e, q)}
                            title="Restore quotation to library"
                          >
                            Restore
                          </button>
                          <button
                            className="btn-delete-minimal"
                            onClick={(e) => handlePermanentDelete(e, q)}
                            title="Permanently Delete Record"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className={`btn btn-sm ${q.isActive ? 'btn-join' : 'btn-primary'}`}
                            onClick={() => onSelect(q)}
                            title={q.isActive ? 'Join live session' : 'Open workstation record'}
                          >
                            {q.isActive ? 'Join' : 'Open'}
                          </button>

                          {hasRole('admin', 'it') && q.hasPassword && (
                            <button
                              className="btn-reveal-pwd"
                              onClick={() => handleReveal(q)}
                              title="Show password"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                <circle cx="12" cy="16" r="1" />
                              </svg>
                            </button>
                          )}

                          {!hasRole('user') && (
                            <button
                              className="btn-delete-minimal"
                              onClick={(e) => handleDelete(e, q)}
                              title="Delete Record"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <footer className="quot-library-footer">
          <p className="library-stats">Showing {filtered.length} of {quotations.length} records</p>
          <div className="library-legend">
            <div className="legend-item">
              <span className="dot active"></span>
              Live Session
            </div>
            <div className="legend-item">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Protected
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
