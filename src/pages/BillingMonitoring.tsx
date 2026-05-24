import { useState, useEffect } from 'react'
import { quotationApi, designersApi } from '../services/api'
import { useModal } from '../components/ModalContext'
import type { IQuotation } from '../types'
import './BillingMonitoring.css'

export default function BillingMonitoring() {
  const [quotations, setQuotations] = useState<IQuotation[]>([])
  const [designers, setDesigners] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Filters State
  const [search, setSearch] = useState('')
  const [selectedDesigner, setSelectedDesigner] = useState('')
  const [selectedQStatus, setSelectedQStatus] = useState('')
  const [selectedPStatus, setSelectedPStatus] = useState('')
  const [selectedBillTo, setSelectedBillTo] = useState('')

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)

  // Per-Cell Editing State
  const [activeCell, setActiveCell] = useState<{ id: number; field: string } | null>(null)
  const [editForm, setEditForm] = useState<Partial<IQuotation>>({})

  const { notify } = useModal()

  // Date slash formatters (always yyyy/mm/dd)
  const formatDateToSlash = (dateStr?: string | null) => {
    if (!dateStr) return '-'
    const base = dateStr.substring(0, 10).trim()
    return base.replace(/[- ]/g, '/')
  }

  const formatDateTimeToSlash = (dateStr?: string | null) => {
    if (!dateStr) return '-'
    return dateStr.replace(/-/g, '/')
  }

  // Load Initial Data
  const loadData = async () => {
    setLoading(true)
    try {
      const qRes = await quotationApi.list({ limit: 1000 })
      setQuotations(qRes.data.quotations || [])

      // Extract unique designers from loaded quotations and designers table
      const uniqueDesigners = new Set<string>()
      qRes.data.quotations.forEach(q => {
        if (q.designerName) uniqueDesigners.add(q.designerName)
      })

      try {
        const dRes = await designersApi.list()
        dRes.data.forEach((d: any) => {
          if (d.englishName) uniqueDesigners.add(d.englishName)
        })
      } catch (err) {
        console.warn('Could not fetch designers table, falling back to quotation records only.', err)
      }

      setDesigners(Array.from(uniqueDesigners).sort())
    } catch (err) {
      console.error(err)
      notify('Failed to load quotations and billing monitoring records', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, selectedDesigner, selectedQStatus, selectedPStatus, selectedBillTo])

  // Filter Logic
  const filteredQuotations = quotations.filter(q => {
    const matchesSearch = !search || 
      (q.quotationNo && q.quotationNo.toLowerCase().includes(search.toLowerCase())) ||
      (q.clientName && q.clientName.toLowerCase().includes(search.toLowerCase())) ||
      (q.customerIncharge && q.customerIncharge.toLowerCase().includes(search.toLowerCase())) ||
      (q.designerName && q.designerName.toLowerCase().includes(search.toLowerCase()))

    const matchesDesigner = !selectedDesigner || q.designerName === selectedDesigner
    const matchesQStatus = !selectedQStatus || q.quotationStatus === selectedQStatus
    const matchesPStatus = !selectedPStatus || q.projectStatus === selectedPStatus
    const matchesBillTo = !selectedBillTo || q.billTo === selectedBillTo

    return matchesSearch && matchesDesigner && matchesQStatus && matchesPStatus && matchesBillTo
  })

  // Pagination Logic
  const totalItems = filteredQuotations.length
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1
  const paginatedQuotations = filteredQuotations.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // JPY Currency Formatter
  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return '¥0'
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0
    }).format(val)
  }

  // Statistics Computations
  const totalBillingValue = filteredQuotations.reduce((sum, q) => sum + (q.grandTotal || 0), 0)
  const pendingApprovalsCount = filteredQuotations.filter(q => q.quotationStatus === 'For Approval').length
  const billedCompletionCount = filteredQuotations.filter(q => q.quotationStatus === 'Billing Completion').length

  // Single Field Save Handler
  const handleSingleFieldSave = async (id: number, updates: Partial<IQuotation>) => {
    try {
      const finalUpdates = { ...updates }
      if (updates.quotationStatus === 'CANCELLED') {
        finalUpdates.projectStatus = 'CANCELLED'
        finalUpdates.updateDetail = 'CANCELLED'
      }

      const res = await quotationApi.updateBilling(id, finalUpdates)
      if (res.data?.success) {
        notify('Saved successfully', 'success')
        const qRes = await quotationApi.list({ limit: 1000 })
        setQuotations(qRes.data.quotations || [])
      } else {
        notify('Failed to save changes', 'error')
      }
    } catch (err: any) {
      console.error(err)
      notify(err.response?.data?.detail || 'Error saving changes', 'error')
    }
  }

  const resetFilters = () => {
    setSearch('')
    setSelectedDesigner('')
    setSelectedQStatus('')
    setSelectedPStatus('')
    setSelectedBillTo('')
  }

  // Helpers to get unique Bill To values present in quotations for filters
  const uniqueBillToValues = Array.from(
    new Set(quotations.map(q => q.billTo).filter(Boolean))
  ).sort() as string[]

  return (
    <div className="billing-monitoring-page">
      {/* Header */}
      <div className="billing-header">
        <div className="billing-header-title">
          <h1>Billing Monitoring</h1>
          <p className="page-subtitle">Track, audit and update invoice statuses and payment states</p>
        </div>
        <button className="btn btn-ghost" onClick={loadData} title="Reload records">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Refresh Data
        </button>
      </div>

      {/* Summary Cards */}
      <div className="billing-stats">
        <div className="stat-card blue">
          <div className="stat-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Items</span>
            <span className="stat-value">{totalItems}</span>
          </div>
        </div>

        <div className="stat-card green">
          <div className="stat-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-label">Billing Value</span>
            <span className="stat-value">{formatCurrency(totalBillingValue)}</span>
          </div>
        </div>

        <div className="stat-card amber">
          <div className="stat-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-label">Pending Approval</span>
            <span className="stat-value">{pendingApprovalsCount}</span>
          </div>
        </div>

        <div className="stat-card purple">
          <div className="stat-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-label">Billed Completion</span>
            <span className="stat-value">{billedCompletionCount}</span>
          </div>
        </div>
      </div>

      {/* Search & Filtering Bar */}
      <div className="filter-bar">
        <div className="filter-group search">
          <label className="filter-label">Search</label>
          <input
            type="text"
            className="filter-input"
            placeholder="Search Quotation No, Customer, Incharge..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label className="filter-label">Project Incharge</label>
          <select
            className="filter-input"
            value={selectedDesigner}
            onChange={e => setSelectedDesigner(e.target.value)}
          >
            <option value="">All Incharges</option>
            {designers.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Quotation Status</label>
          <select
            className="filter-input"
            value={selectedQStatus}
            onChange={e => setSelectedQStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="For Approval">For Approval</option>
            <option value="Approved">Approved</option>
            <option value="Partial Billing">Partial Billing</option>
            <option value="Billing Completion">Billing Completion</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Project Status</label>
          <select
            className="filter-input"
            value={selectedPStatus}
            onChange={e => setSelectedPStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="On Going">On Going</option>
            <option value="Finished">Finished</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Bill To</label>
          <select
            className="filter-input"
            value={selectedBillTo}
            onChange={e => setSelectedBillTo(e.target.value)}
          >
            <option value="">All Clients</option>
            {uniqueBillToValues.map(bt => (
              <option key={bt} value={ bt }>{ bt }</option>
            ))}
          </select>
        </div>

        <div className="filter-group buttons">
          <button className="btn btn-ghost" onClick={resetFilters} style={{ padding: '8px 16px', height: '36px' }}>Reset</button>
        </div>
      </div>

      {/* Spreadsheet Table Container */}
      <div className="table-container">
        {loading ? (
          <div className="table-loading">
            <div className="loading-spinner"></div>
            <div>Loading billing monitoring spreadsheet...</div>
          </div>
        ) : paginatedQuotations.length === 0 ? (
          <div className="table-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            <div>No billing monitoring records match the selected filters.</div>
          </div>
        ) : (
          <>
            <div className="table-scroll-wrapper">
              <table className="spreadsheet-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th style={{ width: '130px' }}>Project Incharge</th>
                    <th style={{ width: '130px' }}>Customer Incharge</th>
                    <th style={{ width: '150px' }}>Customer</th>
                    <th style={{ width: '140px' }}>Quotation Number</th>
                    <th style={{ width: '100px' }}>Date</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>Amount</th>
                    <th style={{ width: '160px' }}>Quotation Status</th>
                    <th style={{ width: '130px' }}>Project Status</th>
                    <th style={{ width: '140px' }}>Submitted To Admin</th>
                    <th style={{ width: '150px' }}>Bill To</th>
                    <th style={{ width: '120px' }}>Date Paid</th>
                    <th style={{ width: '110px' }}>Update By</th>
                    <th style={{ width: '110px' }}>Update Date</th>
                    <th style={{ width: '180px' }}>Update Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedQuotations.map((q, idx) => {
                    const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1
                    const isRowEditing = activeCell?.id === q.id

                    return (
                      <tr key={q.id} className={isRowEditing ? 'editing-row-highlight' : ''}>
                        {/* Index */}
                        <td className="cell-index">{rowNumber}</td>

                        {/* Project Incharge (Designer Name) */}
                        <td title={q.designerName || ''}>{q.designerName || '-'}</td>

                        {/* Customer Incharge */}
                        <td title={q.customerIncharge || ''}>{q.customerIncharge || '-'}</td>

                        {/* Customer (Client Name) */}
                        <td title={q.clientName || ''}>{q.clientName || '-'}</td>

                        {/* Quotation Number */}
                        <td className="cell-qno" title={q.quotationNo || ''}>{q.quotationNo || '-'}</td>

                        {/* Date */}
                        <td>{formatDateToSlash(q.date)}</td>

                        {/* Amount */}
                        <td className="cell-amount">{formatCurrency(q.grandTotal)}</td>

                        {/* Quotation Status */}
                        <td>
                          {activeCell?.id === q.id && activeCell?.field === 'quotationStatus' ? (
                            <select
                              autoFocus
                              className="cell-input cell-select"
                              value={editForm.quotationStatus || q.quotationStatus || 'For Approval'}
                              onChange={async e => {
                                const val = e.target.value
                                setEditForm({ ...editForm, quotationStatus: val })
                                await handleSingleFieldSave(q.id, { quotationStatus: val })
                                setActiveCell(null)
                              }}
                              onBlur={() => setActiveCell(null)}
                            >
                              <option value="For Approval">For Approval</option>
                              <option value="Approved">Approved</option>
                              <option value="Partial Billing">Partial Billing</option>
                              <option value="Billing Completion">Billing Completion</option>
                              <option value="CANCELLED">CANCELLED</option>
                            </select>
                          ) : (
                            <div
                              className="clickable-cell-trigger"
                              onClick={() => {
                                setActiveCell({ id: q.id, field: 'quotationStatus' })
                                setEditForm({ quotationStatus: q.quotationStatus || 'For Approval' })
                              }}
                            >
                              <span className={`status-badge ${
                                q.quotationStatus === 'Approved' ? 'status-q-approved' :
                                q.quotationStatus === 'Partial Billing' ? 'status-q-partial' :
                                q.quotationStatus === 'Billing Completion' ? 'status-q-completion' :
                                q.quotationStatus === 'CANCELLED' ? 'status-q-cancelled' :
                                'status-q-for-approval'
                              }`}>
                                {q.quotationStatus || 'For Approval'}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Project Status */}
                        <td>
                          {activeCell?.id === q.id && activeCell?.field === 'projectStatus' ? (
                            <select
                              autoFocus
                              className="cell-input cell-select"
                              value={editForm.projectStatus || q.projectStatus || 'On Going'}
                              disabled={q.quotationStatus === 'CANCELLED'}
                              onChange={async e => {
                                const val = e.target.value
                                setEditForm({ ...editForm, projectStatus: val })
                                await handleSingleFieldSave(q.id, { projectStatus: val })
                                setActiveCell(null)
                              }}
                              onBlur={() => setActiveCell(null)}
                            >
                              <option value="On Going">On Going</option>
                              <option value="Finished">Finished</option>
                              <option value="CANCELLED">CANCELLED</option>
                            </select>
                          ) : (
                            <div
                              className="clickable-cell-trigger"
                              onClick={() => {
                                if (q.quotationStatus === 'CANCELLED') return
                                setActiveCell({ id: q.id, field: 'projectStatus' })
                                setEditForm({ projectStatus: q.projectStatus || 'On Going' })
                              }}
                            >
                              <span className={`status-badge ${
                                q.projectStatus === 'Finished' ? 'status-p-finished' :
                                q.projectStatus === 'CANCELLED' ? 'status-p-cancelled' :
                                'status-p-ongoing'
                              }`}>
                                {q.projectStatus || 'On Going'}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Submitted to Admin */}
                        <td>
                          {activeCell?.id === q.id && activeCell?.field === 'submittedToAdminAt' ? (
                            <input
                              type="date"
                              autoFocus
                              className="cell-input"
                              value={editForm.submittedToAdminAt || ''}
                              onChange={e => setEditForm({ ...editForm, submittedToAdminAt: e.target.value })}
                              onBlur={async () => {
                                const val = q.submittedToAdminAt ? q.submittedToAdminAt.substring(0, 10) : ''
                                if (editForm.submittedToAdminAt !== val) {
                                  await handleSingleFieldSave(q.id, { submittedToAdminAt: editForm.submittedToAdminAt || null })
                                }
                                setActiveCell(null)
                              }}
                              onKeyDown={async e => {
                                if (e.key === 'Enter') {
                                  const val = q.submittedToAdminAt ? q.submittedToAdminAt.substring(0, 10) : ''
                                  if (editForm.submittedToAdminAt !== val) {
                                    await handleSingleFieldSave(q.id, { submittedToAdminAt: editForm.submittedToAdminAt || null })
                                  }
                                  setActiveCell(null)
                                } else if (e.key === 'Escape') {
                                  setActiveCell(null)
                                }
                              }}
                            />
                          ) : (
                            <div
                              className="clickable-cell-trigger editable-text-cell"
                              onClick={() => {
                                const val = q.submittedToAdminAt ? q.submittedToAdminAt.substring(0, 10) : ''
                                setActiveCell({ id: q.id, field: 'submittedToAdminAt' })
                                setEditForm({ submittedToAdminAt: val })
                              }}
                            >
                              {formatDateToSlash(q.submittedToAdminAt)}
                            </div>
                          )}
                        </td>

                        {/* Bill To */}
                        <td>
                          {activeCell?.id === q.id && activeCell?.field === 'billTo' ? (
                            <>
                              <input
                                list="bill-to-options"
                                autoFocus
                                className="cell-input"
                                value={editForm.billTo || ''}
                                onChange={e => setEditForm({ ...editForm, billTo: e.target.value })}
                                onBlur={async () => {
                                  const val = q.billTo || ''
                                  if (editForm.billTo !== val) {
                                    await handleSingleFieldSave(q.id, { billTo: editForm.billTo || '' })
                                  }
                                  setActiveCell(null)
                                }}
                                onKeyDown={async e => {
                                  if (e.key === 'Enter') {
                                    const val = q.billTo || ''
                                    if (editForm.billTo !== val) {
                                      await handleSingleFieldSave(q.id, { billTo: editForm.billTo || '' })
                                    }
                                    setActiveCell(null)
                                  } else if (e.key === 'Escape') {
                                    setActiveCell(null)
                                  }
                                }}
                                placeholder="Select or type..."
                              />
                              <datalist id="bill-to-options">
                                <option value="NEXT ENG." />
                                <option value="KEMCO" />
                                <option value="AGCC" />
                              </datalist>
                            </>
                          ) : (
                            <div
                              className="clickable-cell-trigger editable-text-cell"
                              onClick={() => {
                                setActiveCell({ id: q.id, field: 'billTo' })
                                setEditForm({ billTo: q.billTo || '' })
                              }}
                            >
                              {q.billTo || '-'}
                            </div>
                          )}
                        </td>

                        {/* Date Paid */}
                        <td>
                          {activeCell?.id === q.id && activeCell?.field === 'datePaid' ? (
                            <input
                              type="date"
                              autoFocus
                              className="cell-input"
                              value={editForm.datePaid || ''}
                              onChange={e => setEditForm({ ...editForm, datePaid: e.target.value })}
                              onBlur={async () => {
                                const val = q.datePaid ? q.datePaid.substring(0, 10) : ''
                                if (editForm.datePaid !== val) {
                                  await handleSingleFieldSave(q.id, { datePaid: editForm.datePaid || null })
                                }
                                setActiveCell(null)
                              }}
                              onKeyDown={async e => {
                                if (e.key === 'Enter') {
                                  const val = q.datePaid ? q.datePaid.substring(0, 10) : ''
                                  if (editForm.datePaid !== val) {
                                    await handleSingleFieldSave(q.id, { datePaid: editForm.datePaid || null })
                                  }
                                  setActiveCell(null)
                                } else if (e.key === 'Escape') {
                                  setActiveCell(null)
                                }
                              }}
                            />
                          ) : (
                            <div
                              className="clickable-cell-trigger editable-text-cell"
                              onClick={() => {
                                const val = q.datePaid ? q.datePaid.substring(0, 10) : ''
                                setActiveCell({ id: q.id, field: 'datePaid' })
                                setEditForm({ datePaid: val })
                              }}
                            >
                              {formatDateToSlash(q.datePaid)}
                            </div>
                          )}
                        </td>

                        {/* Update By */}
                        <td title={q.updatedBy || ''}>{q.updatedBy || '-'}</td>

                        {/* Update Date */}
                        <td title={q.lastUpdatedAt ? formatDateTimeToSlash(q.lastUpdatedAt) : ''}>
                          {q.lastUpdatedAt ? formatDateTimeToSlash(q.lastUpdatedAt) : '-'}
                        </td>

                        {/* Update Detail */}
                        <td className="tooltip-cell" data-tooltip={q.updateDetail || 'No details'} title={q.updateDetail || ''}>
                          {activeCell?.id === q.id && activeCell?.field === 'updateDetail' ? (
                            <input
                              type="text"
                              autoFocus
                              className="cell-input"
                              value={editForm.updateDetail || ''}
                              onChange={e => setEditForm({ ...editForm, updateDetail: e.target.value })}
                              onBlur={async () => {
                                const val = q.updateDetail || ''
                                if (editForm.updateDetail !== val) {
                                  await handleSingleFieldSave(q.id, { updateDetail: editForm.updateDetail || '' })
                                }
                                setActiveCell(null)
                              }}
                              onKeyDown={async e => {
                                if (e.key === 'Enter') {
                                  const val = q.updateDetail || ''
                                  if (editForm.updateDetail !== val) {
                                    await handleSingleFieldSave(q.id, { updateDetail: editForm.updateDetail || '' })
                                  }
                                  setActiveCell(null)
                                } else if (e.key === 'Escape') {
                                  setActiveCell(null)
                                }
                              }}
                              placeholder="Enter details..."
                            />
                          ) : (
                            <div
                              className="clickable-cell-trigger editable-text-cell"
                              onClick={() => {
                                setActiveCell({ id: q.id, field: 'updateDetail' })
                                setEditForm({ updateDetail: q.updateDetail || '' })
                              }}
                            >
                              {q.updateDetail || '-'}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="table-footer">
              <div>
                Showing <strong>{Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(totalItems, currentPage * itemsPerPage)}</strong> of <strong>{totalItems}</strong> quotations
              </div>
              <div className="pagination-group">
                <button
                  className="btn btn-ghost"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  «
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  Prev
                </button>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 8px', fontSize: '12px' }}>
                  Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                </span>
                <button
                  className="btn btn-ghost"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  Next
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  »
                </button>
                <select
                  value={itemsPerPage}
                  onChange={e => {
                    setItemsPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="filter-input"
                  style={{ width: '80px', padding: '2px 6px', height: '26px', fontSize: '12px', marginLeft: '8px' }}
                >
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                  <option value={250}>250 / page</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
