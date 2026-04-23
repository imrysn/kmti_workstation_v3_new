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
  const [quotations, setQuotations] = useState<IQuotation[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [myWorkstation, setMyWorkstation] = useState<string | null>(null)

  // ── Handlers ────────────────────────────────────────────────────
  const fetchLibrary = useCallback(async () => {
    setLoading(true)
    try {
      const res = await quotationApi.list({ limit: 100 })
      const data = res.data as unknown as { quotations: IQuotation[] }
      setQuotations(data.quotations || [])
    } catch (e) {
      console.error('[library] Failed to fetch records:', e)
      notify?.('Failed to load library. Please check your connection.', 'error')
    } finally {
      setLoading(false)
    }
  }, [notify])

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

    // Ownership Enforcement: 
    // Since accounts are shared, we identify the owner by the workstation Hostname.
    const isOwner = (myWorkstation && q.workstation === myWorkstation) || hasRole('admin', 'it')

    if (!isOwner) {
      notify?.(`Access Denied: This record belongs to workstation "${q.workstation || 'Legacy'}".`, 'error')
      return
    }

    confirm(
      `Are you sure you want to PERMANENTLY delete quotation ${q.quotationNo}?`,
      async () => {
        try {
          await quotationApi.delete(q.id)
          notify?.('Quotation record purged.', 'success')
          fetchLibrary()
        } catch (err) {
          notify?.('Server error: Deletion failed.', 'error')
        }
      },
      undefined,
      'danger',
      'Confirm Deletion',
      'Delete Record'
    )
  }

  // ── Helpers ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return quotations.filter(q =>
      q.quotationNo.toLowerCase().includes(s) ||
      (q.clientName || '').toLowerCase().includes(s) ||
      (q.designerName || '').toLowerCase().includes(s) ||
      (q.displayName || '').toLowerCase().includes(s)
    )
  }, [quotations, search])

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="quot-library-overlay">
      <div className="quot-library-modal">
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

        <div className="quot-library-toolbar">
          <div className="quot-library-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by ID, Client, or Designer..."
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
                  <th>Quotation No & Client</th>
                  <th>Owner</th>
                  <th>Last Modified</th>
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
                      <button
                        className={`btn btn-sm ${q.isActive ? 'btn-join' : 'btn-primary'}`}
                        onClick={() => onSelect(q)}
                        title={q.isActive ? 'Join live session' : 'Open workstation record'}
                      >
                        {q.isActive ? 'Join' : 'Open'}
                      </button>
                      <button
                        className="btn-delete-minimal"
                        onClick={(e) => handleDelete(e, q)}
                        title="Delete Record"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
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
