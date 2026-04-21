import React, { useState, useEffect } from 'react'
import { quotationApi } from '../../services/api'
import { IQuotation } from '../../types'
import './QuotationLibraryModal.css'

interface Props {
  onSelect: (quotation: IQuotation) => void
  onClose: () => void
}

export default function QuotationLibraryModal({ onSelect, onClose }: Props) {
  const [quotations, setQuotations] = useState<IQuotation[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLibrary()
  }, [])

  const fetchLibrary = async () => {
    setLoading(true)
    try {
      const res = await quotationApi.list({ limit: 100 })
      // quotationApi.list returns { quotations: IQuotation[] } based on api.ts
      setQuotations((res.data as any).quotations || [])
    } catch (e) {
      console.error('Failed to fetch library')
    } finally {
      setLoading(false)
    }
  }

  const filtered = quotations.filter(q => 
    q.quotationNo.toLowerCase().includes(search.toLowerCase()) ||
    q.clientName.toLowerCase().includes(search.toLowerCase()) ||
    q.designerName.toLowerCase().includes(search.toLowerCase()) ||
    (q.displayName && q.displayName.toLowerCase().includes(search.toLowerCase()))
  )

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  return (
    <div className="quot-library-overlay">
      <div className="quot-library-modal">
        <header className="quot-library-header">
          <div className="quot-library-header-main">
            <h2>Quotation Library</h2>
            <p>Browse and resume saved collaborative workspaces</p>
          </div>
          <button className="quot-library-close" onClick={onClose}>
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
              placeholder="Search by number, client, or designer..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <button className="btn btn-ghost" onClick={fetchLibrary} title="Refresh library">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>

        <div className="quot-library-content">
          {loading ? (
            <div className="quot-library-loading">
              <div className="spinner"></div>
              <p>Fetching records from PET130...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="quot-library-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <p>No quotations found matching your search.</p>
            </div>
          ) : (
            <table className="quot-library-table">
              <thead>
                <tr>
                  <th>Quotation No</th>
                  <th>Display Name</th>
                  <th>Client</th>
                  <th>Designer</th>
                  <th>Date</th>
                  <th>Last Modified</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(q => (
                  <tr key={q.id} className={q.isActive ? 'is-active-row' : ''}>
                    <td className="quot-no-cell">
                      {q.quotationNo}
                      {q.isActive && <span className="active-badge">Live</span>}
                      {q.hasPassword && (
                         <svg className="lock-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                           <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                         </svg>
                      )}
                    </td>
                    <td>{q.displayName || '-'}</td>
                    <td>{q.clientName || '-'}</td>
                    <td>{q.designerName || '-'}</td>
                    <td>{formatDate(q.date)}</td>
                    <td className="text-secondary">{formatDate(q.modifiedAt)}</td>
                    <td className="text-right">
                      <button className="btn btn-sm btn-primary" onClick={() => onSelect(q)}>
                        {q.isActive ? 'Join' : 'Open'}
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
