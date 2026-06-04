import { useState, useEffect } from 'react'
import type { IQuotation } from '../../types'
import type { IActiveCell } from '../../hooks/useBillingMonitoring'
import { useNavigate } from 'react-router-dom'
import { clientsApi } from '../../services/api'

interface BillingSpreadsheetTableProps {
  loading: boolean
  paginatedQuotations: IQuotation[]
  currentPage: number
  itemsPerPage: number
  setItemsPerPage: (val: number) => void
  setCurrentPage: (page: number | ((prev: number) => number)) => void
  totalItems: number
  totalPages: number
  activeCell: IActiveCell | null
  setActiveCell: (cell: IActiveCell | null) => void
  editForm: Partial<IQuotation>
  setEditForm: (form: Partial<IQuotation>) => void
  handleSingleFieldSave: (id: number, updates: Partial<IQuotation>) => Promise<void>
  formatDateToSlash: (dateStr?: string | null) => string
  formatDateTimeToSlash: (dateStr?: string | null) => string
  formatCurrency: (val?: number) => string
  sortColumn: string | null
  sortDirection: 'asc' | 'desc'
  handleSort: (column: string) => void
}

export default function BillingSpreadsheetTable({
  loading,
  paginatedQuotations,
  currentPage,
  itemsPerPage,
  setItemsPerPage,
  setCurrentPage,
  totalItems,
  totalPages,
  activeCell,
  setActiveCell,
  editForm,
  setEditForm,
  handleSingleFieldSave,
  formatDateToSlash,
  formatDateTimeToSlash,
  formatCurrency,
  sortColumn,
  sortDirection,
  handleSort
}: BillingSpreadsheetTableProps) {
  const navigate = useNavigate()
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [clientsList, setClientsList] = useState<string[]>([])

  useEffect(() => {
    clientsApi.list().then(res => {
      if (Array.isArray(res.data)) {
        const names = res.data.map((c: any) => c.englishName).filter(Boolean)
        setClientsList(names)
      }
    }).catch(err => console.error("Error loading clients:", err))
  }, [])

  const handleSaveCustomClient = async (quotationId: number, name: string) => {
    await handleSingleFieldSave(quotationId, { clientName: name })
    if (clientsList.includes(name)) return

    clientsApi.create({
      category: 'CLIENT',
      englishName: name,
      email: '',
      japaneseName: ''
    }).then(() => {
      setClientsList(prev => prev.includes(name) ? prev : [...prev, name])
    }).catch(err => {
      console.error("Error creating client preset:", err)
    })
  }

  useEffect(() => {
    setSelectedIds([])
  }, [paginatedQuotations, currentPage])

  const handleGoToQuotation = (q: IQuotation) => {
    const session = {
      quotId: q.id,
      quotNo: q.quotationNo || `KMTE-${q.id}`,
      displayName: q.displayName || q.quotationNo || `KMTE-${q.id}`,
      mode: 'join' as const,
      workstation: q.workstation || '',
      referrer: '/billing-monitoring'
    }
    sessionStorage.setItem('kmti_quot_current_session', JSON.stringify(session))
    navigate('/quotation')
  }

  const handleBulkStatus = async (status: string) => {
    const updates: Partial<IQuotation> = { quotationStatus: status }
    if (status === 'CANCELLED') {
      updates.projectStatus = 'CANCELLED'
      updates.updateDetail = 'CANCELLED'
    }
    try {
      for (const id of selectedIds) {
        await handleSingleFieldSave(id, updates)
      }
      setSelectedIds([])
    } catch (err) {
      console.error(err)
    }
  }

  const handleBulkDatePaid = async (dateVal: string) => {
    try {
      for (const id of selectedIds) {
        await handleSingleFieldSave(id, { datePaid: dateVal })
      }
      setSelectedIds([])
    } catch (err) {
      console.error(err)
    }
  }

  const handleBulkBillTo = async (billVal: string) => {
    try {
      for (const id of selectedIds) {
        await handleSingleFieldSave(id, { billTo: billVal })
      }
      setSelectedIds([])
    } catch (err) {
      console.error(err)
    }
  }

  return (
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
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      className="header-checkbox"
                      checked={paginatedQuotations.length > 0 && paginatedQuotations.every(q => selectedIds.includes(q.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(paginatedQuotations.map(q => q.id))
                        } else {
                          setSelectedIds([])
                        }
                      }}
                    />
                  </th>
                  <th style={{ width: '100px', cursor: 'pointer' }} onClick={() => handleSort('designerName')}>
                    Project<br />Incharge {sortColumn === 'designerName' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{ width: '130px', cursor: 'pointer' }} onClick={() => handleSort('customerIncharge')}>
                    Customer<br />Incharge {sortColumn === 'customerIncharge' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{ width: activeCell?.field === 'clientName' ? '150px' : '120px', transition: 'width 0.2s ease', cursor: 'pointer' }} onClick={() => handleSort('clientName')}>
                    Customer {sortColumn === 'clientName' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{ width: '140px', cursor: 'pointer' }} onClick={() => handleSort('quotationNo')}>
                    Quotation<br />Number {sortColumn === 'quotationNo' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{ width: activeCell?.field === 'date' ? '125px' : '85px', transition: 'width 0.2s ease', cursor: 'pointer' }} onClick={() => handleSort('date')}>
                    Date {sortColumn === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{ width: '110px', cursor: 'pointer' }} onClick={() => handleSort('grandTotal')}>
                    Amount {sortColumn === 'grandTotal' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{ width: activeCell?.field === 'quotationStatus' ? '150px' : '150px', transition: 'width 0.2s ease', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('quotationStatus')}>
                    Quotation<br />Status {sortColumn === 'quotationStatus' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{ width: activeCell?.field === 'projectStatus' ? '100px' : '100px', transition: 'width 0.2s ease', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('projectStatus')}>
                    Project<br />Status {sortColumn === 'projectStatus' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{ width: activeCell?.field === 'submittedToAdminAt' ? '125px' : '85px', transition: 'width 0.2s ease', cursor: 'pointer' }} onClick={() => handleSort('submittedToAdminAt')}>
                    Submitted To<br />Admin {sortColumn === 'submittedToAdminAt' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{ width: activeCell?.field === 'billTo' ? '180px' : '150px', transition: 'width 0.2s ease', cursor: 'pointer' }} onClick={() => handleSort('billTo')}>
                    Bill To {sortColumn === 'billTo' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{ width: activeCell?.field === 'billingStatus' ? '150px' : '130px', transition: 'width 0.2s ease', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('billingStatus')}>
                    Billing<br />Status {sortColumn === 'billingStatus' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{ width: activeCell?.field === 'datePaid' ? '140px' : '120px', transition: 'width 0.2s ease', cursor: 'pointer' }} onClick={() => handleSort('datePaid')}>
                    Date Paid {sortColumn === 'datePaid' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{ width: '80px', cursor: 'pointer' }} onClick={() => handleSort('updatedBy')}>
                    Update<br />By {sortColumn === 'updatedBy' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{ width: '100px', cursor: 'pointer' }} onClick={() => handleSort('lastUpdatedAt')}>
                    Update<br />Date {sortColumn === 'lastUpdatedAt' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{ width: '120px', cursor: 'pointer' }} onClick={() => handleSort('updateDetail')}>
                    Update<br />Detail {sortColumn === 'updateDetail' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedQuotations.map((q, idx) => {
                  const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1
                  const isRowEditing = activeCell?.id === q.id
                  const isEven = idx % 2 === 1

                  return (
                    <tr key={q.id} className={[
                      isRowEditing ? 'editing-row-highlight' : '',
                      isEven ? 'row-stripe' : ''
                    ].filter(Boolean).join(' ')}>
                      {/* Index */}
                      <td className="cell-index sticky-col-index" title={`Row ${rowNumber}`}>{rowNumber}</td>

                      {/* Checkbox */}
                      <td className="cell-checkbox" style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          className="row-checkbox"
                          checked={selectedIds.includes(q.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(prev => [...prev, q.id])
                            } else {
                              setSelectedIds(prev => prev.filter(id => id !== q.id))
                            }
                          }}
                        />
                      </td>

                      {/* Project Incharge (Designer Name) */}
                      <td className="sticky-col-name" title={q.designerName || ''}>
                        {q.designerName || <span className="cell-empty">—</span>}
                      </td>

                      {/* Customer Incharge */}
                      <td title={q.customerIncharge || ''}>
                        {q.customerIncharge || <span className="cell-empty">—</span>}
                      </td>

                      {/* Customer (Client Name) */}
                      <td className={activeCell?.id === q.id && activeCell?.field === 'clientName' ? 'editing-cell' : ''} title={q.clientName || ''}>
                        {activeCell?.id === q.id && activeCell?.field === 'clientName' ? (
                          editForm.clientName === '__CUSTOM__' ? (
                            <input
                              autoFocus
                              className="cell-input"
                              value={editForm.customClientName || ''}
                              onChange={e => setEditForm({ ...editForm, customClientName: e.target.value })}
                              onBlur={async (e) => {
                                const typed = e.target.value.trim()
                                if (typed) {
                                  await handleSaveCustomClient(q.id, typed)
                                }
                                setActiveCell(null)
                              }}
                              onKeyDown={async e => {
                                if (e.key === 'Enter') {
                                  const typed = (editForm.customClientName || '').trim()
                                  if (typed) {
                                    await handleSaveCustomClient(q.id, typed)
                                  }
                                  setActiveCell(null)
                                } else if (e.key === 'Escape') {
                                  setActiveCell(null)
                                }
                              }}
                              placeholder="Type custom..."
                            />
                          ) : (
                            <select
                              autoFocus
                              className="cell-input cell-select"
                              value={editForm.clientName || q.clientName || ''}
                              onChange={async e => {
                                const val = e.target.value
                                if (val === '__CUSTOM__') {
                                  setEditForm({ ...editForm, clientName: '__CUSTOM__', customClientName: '' })
                                } else {
                                  setEditForm({ ...editForm, clientName: val })
                                  await handleSingleFieldSave(q.id, { clientName: val })
                                  setActiveCell(null)
                                }
                              }}
                              onBlur={() => setActiveCell(null)}
                            >
                              {clientsList.map(name => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                              <option value="__CUSTOM__">[Type Custom Value...]</option>
                            </select>
                          )
                        ) : (
                          <div
                            className="clickable-cell-trigger editable-text-cell"
                            onClick={() => {
                              setActiveCell({ id: q.id, field: 'clientName' })
                              setEditForm({ clientName: q.clientName || '' })
                            }}
                          >
                            {q.clientName || <span className="cell-empty">—</span>}
                          </div>
                        )}
                      </td>

                      {/* Quotation Number */}
                      <td className="cell-qno" style={{ padding: '0px' }} title="Open in Quotation Workspace">
                        {q.quotationNo ? (
                          <button
                            className="btn-qno-link"
                            onClick={() => handleGoToQuotation(q)}
                          >
                            <svg className="qno-link-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                            {q.quotationNo}
                          </button>
                        ) : (
                          <span className="cell-empty">—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className={activeCell?.id === q.id && activeCell?.field === 'date' ? 'editing-cell' : ''} title={formatDateToSlash(q.date)}>
                        {activeCell?.id === q.id && activeCell?.field === 'date' ? (
                          <input
                            type="date"
                            ref={el => {
                              if (el) {
                                el.focus();
                                try {
                                  if (typeof el.showPicker === 'function') {
                                    el.showPicker();
                                  }
                                } catch (e) { }
                              }
                            }}
                            className="cell-input"
                            value={editForm.date || ''}
                            onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                            onBlur={async () => {
                              const val = q.date ? q.date.substring(0, 10) : ''
                              if (editForm.date !== val) {
                                await handleSingleFieldSave(q.id, { date: editForm.date || null })
                              }
                              setActiveCell(null)
                            }}
                            onKeyDown={async e => {
                              if (e.key === 'Enter') {
                                const val = q.date ? q.date.substring(0, 10) : ''
                                if (editForm.date !== val) {
                                  await handleSingleFieldSave(q.id, { date: editForm.date || null })
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
                              const val = q.date ? q.date.substring(0, 10) : ''
                              setActiveCell({ id: q.id, field: 'date' })
                              setEditForm({ date: val })
                            }}
                          >
                            {formatDateToSlash(q.date) !== '-' ? formatDateToSlash(q.date) : <span className="cell-empty">—</span>}
                          </div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="cell-amount" title={formatCurrency(q.grandTotal)}>{formatCurrency(q.grandTotal)}</td>

                      {/* Quotation Status */}
                      <td style={{ textAlign: 'center' }} className={activeCell?.id === q.id && activeCell?.field === 'quotationStatus' ? 'editing-cell' : ''} title={q.quotationStatus || 'DRAFT'}>
                        {activeCell?.id === q.id && activeCell?.field === 'quotationStatus' ? (
                          <select
                            autoFocus
                            className="cell-input cell-select"
                            value={editForm.quotationStatus || q.quotationStatus || 'DRAFT'}
                            onChange={async e => {
                              const val = e.target.value
                              setEditForm({ ...editForm, quotationStatus: val })
                              await handleSingleFieldSave(q.id, { quotationStatus: val })
                              setActiveCell(null)
                            }}
                            onBlur={() => setActiveCell(null)}
                          >
                            <option value="DRAFT">DRAFT</option>
                            <option value="For Approval">For Approval</option>
                            <option value="Approved">Approved</option>
                            <option value="Partial Billing">Partial Billing</option>
                            <option value="Billing Completion">Billing Completion</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                        ) : (
                          <div
                            className="clickable-cell-trigger"
                            style={{ justifyContent: 'center' }}
                            onClick={() => {
                              setActiveCell({ id: q.id, field: 'quotationStatus' })
                              setEditForm({ quotationStatus: q.quotationStatus || 'DRAFT' })
                            }}
                          >
                            <span className={`status-badge ${q.quotationStatus === 'Approved' ? 'status-q-approved' :
                              q.quotationStatus === 'Partial Billing' ? 'status-q-partial' :
                                q.quotationStatus === 'Billing Completion' ? 'status-q-completion' :
                                  q.quotationStatus === 'CANCELLED' ? 'status-q-cancelled' :
                                    q.quotationStatus === 'For Approval' ? 'status-q-for-approval' :
                                      'status-q-draft'
                              }`}>
                              {q.quotationStatus || 'DRAFT'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Project Status */}
                      <td style={{ textAlign: 'center' }} className={activeCell?.id === q.id && activeCell?.field === 'projectStatus' ? 'editing-cell' : ''} title={q.projectStatus || 'On Going'}>
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
                            style={{ justifyContent: 'center' }}
                            onClick={() => {
                              if (q.quotationStatus === 'CANCELLED') return
                              setActiveCell({ id: q.id, field: 'projectStatus' })
                              setEditForm({ projectStatus: q.projectStatus || 'On Going' })
                            }}
                          >
                            <span className={`status-badge ${q.projectStatus === 'Finished' ? 'status-p-finished' :
                              q.projectStatus === 'CANCELLED' ? 'status-p-cancelled' :
                                'status-p-ongoing'
                              }`}>
                              {q.projectStatus || 'On Going'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Submitted to Admin */}
                      <td className={activeCell?.id === q.id && activeCell?.field === 'submittedToAdminAt' ? 'editing-cell' : ''} title={formatDateToSlash(q.submittedToAdminAt)}>
                        {activeCell?.id === q.id && activeCell?.field === 'submittedToAdminAt' ? (
                          <input
                            type="date"
                            ref={el => {
                              if (el) {
                                el.focus();
                                try {
                                  if (typeof el.showPicker === 'function') {
                                    el.showPicker();
                                  }
                                } catch (e) { }
                              }
                            }}
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
                      <td className={activeCell?.id === q.id && activeCell?.field === 'billTo' ? 'editing-cell' : ''} title={q.billTo || '-'}>
                        {activeCell?.id === q.id && activeCell?.field === 'billTo' ? (
                          <select
                            autoFocus
                            className="cell-input cell-select"
                            value={editForm.billTo || q.billTo || ''}
                            onChange={async e => {
                              const val = e.target.value
                              setEditForm({ ...editForm, billTo: val })
                              await handleSingleFieldSave(q.id, { billTo: val })
                              setActiveCell(null)
                            }}
                            onBlur={() => setActiveCell(null)}
                          >
                            <option value="AGC Ceramics Co., Ltd.">AGC Ceramics Co., Ltd.</option>
                            <option value="NEXT ENGINEERING Co., Ltd.">NEXT ENGINEERING Co., Ltd.</option>
                            <option value="Kusakabe Electric and Machinery Co., Ltd.">Kusakabe Electric and Machinery Co., Ltd.</option>
                            <option value="MAENO GIKEN INC.">MAENO GIKEN INC.</option>
                          </select>
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

                       {/* Billing Status */}
                      <td style={{ textAlign: 'center' }} className={activeCell?.id === q.id && activeCell?.field === 'billingStatus' ? 'editing-cell' : ''} title={q.billingStatus || 'Not Set'}>
                        {activeCell?.id === q.id && activeCell?.field === 'billingStatus' ? (
                          <select
                            autoFocus
                            className="cell-input cell-select"
                            value={editForm.billingStatus || q.billingStatus || ''}
                            onChange={async e => {
                              const val = e.target.value
                              setEditForm({ ...editForm, billingStatus: val })
                              await handleSingleFieldSave(q.id, { billingStatus: val || null })
                              setActiveCell(null)
                            }}
                            onBlur={() => setActiveCell(null)}
                          >
                            <option value="">— Not Set —</option>
                            <option value="FOR BILLING">FOR BILLING</option>
                            <option value="BILLED">BILLED</option>
                            <option value="PAID">PAID</option>
                            <option value="CANCELLED">CANCELLED</option>
                            <option value="REVISED">REVISED</option>
                          </select>
                        ) : (
                          <div
                            className="clickable-cell-trigger"
                            style={{ justifyContent: 'center' }}
                            onClick={() => {
                              setActiveCell({ id: q.id, field: 'billingStatus' })
                              setEditForm({ billingStatus: q.billingStatus || '' })
                            }}
                          >
                            <span className={`status-badge ${
                              q.billingStatus === 'FOR BILLING' ? 'status-b-for-billing' :
                              q.billingStatus === 'BILLED' ? 'status-b-billed' :
                              q.billingStatus === 'PAID' ? 'status-b-paid' :
                              q.billingStatus === 'CANCELLED' ? 'status-b-cancelled' :
                              q.billingStatus === 'REVISED' ? 'status-b-revised' :
                              'status-b-none'
                            }`}>
                              {q.billingStatus || '—'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Date Paid */}
                      <td className={activeCell?.id === q.id && activeCell?.field === 'datePaid' ? 'editing-cell' : ''} title={formatDateToSlash(q.datePaid)}>
                        {activeCell?.id === q.id && activeCell?.field === 'datePaid' ? (
                          <input
                            type="date"
                            ref={el => {
                              if (el) {
                                el.focus();
                                try {
                                  if (typeof el.showPicker === 'function') {
                                    el.showPicker();
                                  }
                                } catch (e) { }
                              }
                            }}
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
                      <td className={activeCell?.id === q.id && activeCell?.field === 'updatedBy' ? 'editing-cell' : ''} title={q.updatedBy || ''}>
                        {activeCell?.id === q.id && activeCell?.field === 'updatedBy' ? (
                          <input
                            type="text"
                            autoFocus
                            className="cell-input"
                            value={editForm.updatedBy || ''}
                            onChange={e => setEditForm({ ...editForm, updatedBy: e.target.value })}
                            onBlur={async () => {
                              const val = (q.updatedBy || '').trim()
                              const typed = (editForm.updatedBy || '').trim()
                              if (typed !== val) {
                                await handleSingleFieldSave(q.id, { updatedBy: typed })
                              }
                              setActiveCell(null)
                            }}
                            onKeyDown={async e => {
                              if (e.key === 'Enter') {
                                const val = (q.updatedBy || '').trim()
                                const typed = (editForm.updatedBy || '').trim()
                                if (typed !== val) {
                                  await handleSingleFieldSave(q.id, { updatedBy: typed })
                                }
                                setActiveCell(null)
                              } else if (e.key === 'Escape') {
                                setActiveCell(null)
                              }
                            }}
                            placeholder="Name..."
                          />
                        ) : (
                          <div
                            className="clickable-cell-trigger editable-text-cell"
                            onClick={() => {
                              setActiveCell({ id: q.id, field: 'updatedBy' })
                              setEditForm({ updatedBy: q.updatedBy || '' })
                            }}
                          >
                            {q.updatedBy || '-'}
                          </div>
                        )}
                      </td>

                      {/* Update Date */}
                      <td title={q.lastUpdatedAt ? formatDateTimeToSlash(q.lastUpdatedAt) : ''}>
                        {q.lastUpdatedAt ? formatDateTimeToSlash(q.lastUpdatedAt) : '-'}
                      </td>

                      {/* Update Detail */}
                      <td className={`tooltip-cell ${activeCell?.id === q.id && activeCell?.field === 'updateDetail' ? 'editing-cell' : ''}`} data-tooltip={q.updateDetail || 'No details'} title={q.updateDetail || ''}>
                        {activeCell?.id === q.id && activeCell?.field === 'updateDetail' ? (
                          <input
                            type="text"
                            autoFocus
                            className="cell-input"
                            value={editForm.updateDetail || ''}
                            onChange={e => setEditForm({ ...editForm, updateDetail: e.target.value })}
                            onBlur={async () => {
                              const val = (q.updateDetail || '').trim()
                              const typed = (editForm.updateDetail || '').trim()
                              if (typed !== val) {
                                await handleSingleFieldSave(q.id, { updateDetail: typed })
                              }
                              setActiveCell(null)
                            }}
                            onKeyDown={async e => {
                              if (e.key === 'Enter') {
                                const val = (q.updateDetail || '').trim()
                                const typed = (editForm.updateDetail || '').trim()
                                if (typed !== val) {
                                  await handleSingleFieldSave(q.id, { updateDetail: typed })
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
            <div className="table-footer-info">
              Showing <strong>{Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1)}–{Math.min(totalItems, currentPage * itemsPerPage)}</strong> of <strong>{totalItems}</strong> quotations
            </div>
            <div className="pagination-group">
              <button
                className="btn btn-ghost pagination-btn"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                «
              </button>
              <button
                className="btn btn-ghost pagination-btn"
                onClick={() => setCurrentPage(prev => Math.max(1, typeof prev === 'number' ? prev - 1 : 1))}
                disabled={currentPage === 1}
              >
                ‹ Prev
              </button>

              {/* Page number pills */}
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let page = i + 1
                if (totalPages > 5) {
                  const half = 2
                  page = Math.min(
                    Math.max(currentPage - half + i, 1),
                    totalPages - 4 + i
                  )
                }
                return (
                  <button
                    key={page}
                    className={`btn pagination-btn pagination-page-btn ${currentPage === page ? 'pagination-page-active' : 'btn-ghost'}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                )
              })}

              <button
                className="btn btn-ghost pagination-btn"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, typeof prev === 'number' ? prev + 1 : totalPages))}
                disabled={currentPage === totalPages}
              >
                Next ›
              </button>
              <button
                className="btn btn-ghost pagination-btn"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                »
              </button>

              <div className="pagination-rows-label">
                Rows per page:
                <select
                  value={itemsPerPage}
                  onChange={e => {
                    setItemsPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="filter-input pagination-rows-select"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                </select>
              </div>
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="bulk-actions-toolbar">
              <div className="bulk-actions-info">
                Selected <strong>{selectedIds.length}</strong> items
              </div>
              <div className="bulk-actions-divider" />

              <div className="bulk-actions-group">
                <button className="bulk-action-btn" onClick={() => handleBulkStatus('Approved')}>
                  Approve
                </button>
                <button className="bulk-action-btn" onClick={() => handleBulkStatus('Billing Completion')}>
                  Complete Billing
                </button>
                <button className="bulk-action-btn" onClick={() => handleBulkStatus('CANCELLED')}>
                  Cancel
                </button>

                <div className="bulk-actions-divider" />

                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Set Paid Date:</span>
                <input
                  type="date"
                  className="bulk-action-date-input"
                  onChange={async (e) => {
                    const dateVal = e.target.value
                    if (dateVal) {
                      await handleBulkDatePaid(dateVal)
                    }
                  }}
                />

                <div className="bulk-actions-divider" />

                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Set Bill To:</span>
                <select
                  className="bulk-action-select"
                  defaultValue=""
                  onChange={async (e) => {
                    const billVal = e.target.value
                    if (billVal) {
                      await handleBulkBillTo(billVal)
                      e.target.value = "" // Reset
                    }
                  }}
                >
                  <option value="" disabled>Select Client...</option>
                  <option value="AGC Ceramics Co., Ltd.">AGC Ceramics</option>
                  <option value="NEXT ENGINEERING Co., Ltd.">NEXT ENGINEERING Co., Ltd.</option>
                  <option value="Kusakabe Electric and Machinery Co., Ltd.">Kusakabe</option>
                  <option value="MAENO GIKEN INC.">MAENO GIKEN INC.</option>
                </select>

                <div className="bulk-actions-divider" />

                <button
                  className="bulk-action-btn"
                  onClick={() => setSelectedIds([])}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
