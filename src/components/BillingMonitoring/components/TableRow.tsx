import React from 'react'
import type { IQuotation } from '../../../types'
import type { IActiveCell } from '../../../hooks/useBillingMonitoring'

interface TableRowProps {
  q: IQuotation
  idx: number
  rowNumber: number
  selectedIds: number[]
  setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>
  clientsList: string[]
  handleSingleFieldSave: (id: number, updates: Partial<IQuotation>) => Promise<void>
  handleGoToQuotation: (q: IQuotation) => void
  formatDateToSlash: (dateStr?: string | null) => string
  formatCurrency: (val?: number) => string
  activeCell: IActiveCell | null
  setActiveCell: (cell: IActiveCell | null) => void
  editForm: Partial<IQuotation>
  setEditForm: (form: Partial<IQuotation>) => void
}

export default function TableRow({
  q,
  idx,
  rowNumber,
  selectedIds,
  setSelectedIds,
  clientsList,
  handleSingleFieldSave,
  handleGoToQuotation,
  formatDateToSlash,
  formatCurrency,
  activeCell,
  setActiveCell,
  editForm,
  setEditForm
}: TableRowProps) {
  const isEven = idx % 2 === 1
  const isSelected = selectedIds.includes(q.id)

  const isCustomerEditing = activeCell?.id === q.id && activeCell?.field === 'clientName'
  const isQStatusEditing = activeCell?.id === q.id && activeCell?.field === 'quotationStatus'
  const isPStatusEditing = activeCell?.id === q.id && activeCell?.field === 'projectStatus'
  const isBillToEditing = activeCell?.id === q.id && activeCell?.field === 'billTo'
  const isBStatusEditing = activeCell?.id === q.id && activeCell?.field === 'billingStatus'
  const isDateEditing = activeCell?.id === q.id && activeCell?.field === 'date'
  const isSubmittedEditing = activeCell?.id === q.id && activeCell?.field === 'submittedToAdminAt'
  const isDatePaidEditing = activeCell?.id === q.id && activeCell?.field === 'datePaid'
  const isLastUpdatedEditing = activeCell?.id === q.id && activeCell?.field === 'lastUpdatedAt'
  const isUpdateDetailEditing = activeCell?.id === q.id && activeCell?.field === 'updateDetail'

  return (
    <tr
      key={q.id}
      className={[
        isSelected ? 'editing-row-highlight' : '',
        isEven ? 'row-stripe' : '',
        (q.quotationStatus === 'CANCELLED' || q.quotationStatus === 'REVISED') ? 'row-cancelled' : ''
      ].filter(Boolean).join(' ')}
    >
      {/* Index */}
      <td className="cell-index sticky-col-index" title={`Row ${rowNumber}`}>{rowNumber}</td>

      {/* Checkbox */}
      <td className="cell-checkbox" style={{ textAlign: 'center' }}>
        <input
          type="checkbox"
          className="row-checkbox"
          checked={isSelected}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedIds(prev => [...prev, q.id])
            } else {
              setSelectedIds(prev => prev.filter(id => id !== q.id))
            }
          }}
        />
      </td>

      {/* Project Incharge (Designer Name) - Read-only */}
      <td className="sticky-col-name">
        {q.designerName || <span className="cell-empty">—</span>}
      </td>

      {/* Customer Incharge - Read-only */}
      <td>
        {q.customerIncharge || <span className="cell-empty">—</span>}
      </td>

      {/* Customer (Client Name) - Click-to-Edit Dropdown */}
      <td style={{ padding: '2px 4px', cursor: 'pointer' }} onClick={() => { if (!isCustomerEditing) setActiveCell({ id: q.id, field: 'clientName' }) }}>
        {isCustomerEditing ? (
          <select
            className="cell-input cell-select"
            value={q.clientName || ''}
            autoFocus
            onBlur={() => setActiveCell(null)}
            onChange={async e => {
              const val = e.target.value
              await handleSingleFieldSave(q.id, { clientName: val })
              setActiveCell(null)
            }}
          >
            <option value="">-- Select Customer --</option>
            {clientsList.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        ) : (
          <div style={{ padding: '6px 8px', width: '100%', minHeight: '30px', display: 'flex', alignItems: 'center' }}>
            {q.clientName || <span className="cell-empty">—</span>}
          </div>
        )}
      </td>

      {/* Quotation Number - Read-only Link */}
      <td className="cell-qno" style={{ padding: '0px', textAlign: 'left' }}>
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

      {/* Date - Click-to-Edit Date */}
      <td className={isDateEditing ? 'editing-cell' : ''}>
        {isDateEditing ? (
          <input
            type="date"
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
            autoFocus
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

      {/* Amount - Read-only */}
      <td className="cell-amount">
        {formatCurrency(q.grandTotal)}
      </td>

      {/* Quotation Status - Click-to-Edit Dropdown */}
      <td style={{ textAlign: 'center', padding: '2px 4px', cursor: 'pointer' }} onClick={() => { if (!isQStatusEditing) setActiveCell({ id: q.id, field: 'quotationStatus' }) }}>
        {isQStatusEditing ? (
          <select
            className="cell-input cell-select"
            value={q.quotationStatus || 'DRAFT'}
            autoFocus
            onBlur={() => setActiveCell(null)}
            onChange={async e => {
              const val = e.target.value
              await handleSingleFieldSave(q.id, { quotationStatus: val })
              setActiveCell(null)
            }}
          >
            <option value="DRAFT">DRAFT</option>
            <option value="For Approval">For Approval</option>
            <option value="Approved">Approved</option>
            <option value="Partial Billing">Partial Billing</option>
            <option value="Billing Completion">Billing Completion</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="REVISED">REVISED</option>
          </select>
        ) : (
          <div style={{ display: 'inline-flex', padding: '4px' }}>
            <span className={`status-badge ${q.quotationStatus === 'Approved' ? 'status-q-approved' :
              q.quotationStatus === 'Partial Billing' ? 'status-q-partial' :
                q.quotationStatus === 'Billing Completion' ? 'status-q-completion' :
                  q.quotationStatus === 'CANCELLED' ? 'status-q-cancelled' :
                    q.quotationStatus === 'For Approval' ? 'status-q-for-approval' :
                      q.quotationStatus === 'REVISED' ? 'status-q-revised' :
                        'status-q-draft'
              }`}>
              {q.quotationStatus || 'DRAFT'}
            </span>
          </div>
        )}
      </td>

      {/* Project Status - Click-to-Edit Dropdown */}
      <td style={{ textAlign: 'center', padding: '2px 4px', cursor: 'pointer' }} onClick={() => { if (!isPStatusEditing) setActiveCell({ id: q.id, field: 'projectStatus' }) }}>
        {isPStatusEditing ? (
          <select
            className="cell-input cell-select"
            value={q.projectStatus || 'On Going'}
            disabled={q.quotationStatus === 'CANCELLED'}
            autoFocus
            onBlur={() => setActiveCell(null)}
            onChange={async e => {
              const val = e.target.value
              await handleSingleFieldSave(q.id, { projectStatus: val })
              setActiveCell(null)
            }}
          >
            <option value="On Going">On Going</option>
            <option value="Finished">Finished</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="REVISED">REVISED</option>
          </select>
        ) : (
          <div style={{ display: 'inline-flex', padding: '4px' }}>
            <span className={`status-badge ${q.projectStatus === 'Finished' ? 'status-p-finished' :
              q.projectStatus === 'CANCELLED' ? 'status-p-cancelled' :
                q.projectStatus === 'REVISED' ? 'status-p-revised' :
                  'status-p-ongoing'
              }`}>
              {q.projectStatus || 'On Going'}
            </span>
          </div>
        )}
      </td>

      {/* Submitted to Admin - Click-to-Edit Date */}
      <td className={isSubmittedEditing ? 'editing-cell' : ''} onClick={(e) => { if (q.quotationStatus === 'CANCELLED') e.stopPropagation() }}>
        {q.quotationStatus === 'CANCELLED' ? (
          <div style={{ color: '#ef4444', fontWeight: 'bold', textAlign: 'center' }}>CANCELLED</div>
        ) : isSubmittedEditing ? (
          <input
            type="date"
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
            autoFocus
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
            {formatDateToSlash(q.submittedToAdminAt) !== '-' ? formatDateToSlash(q.submittedToAdminAt) : <span className="cell-empty">—</span>}
          </div>
        )}
      </td>

      {/* Bill To - Click-to-Edit Dropdown */}
      <td style={{ padding: '2px 4px', cursor: 'pointer' }} onClick={() => { if (!isBillToEditing) setActiveCell({ id: q.id, field: 'billTo' }) }}>
        {isBillToEditing ? (
          <select
            className="cell-input cell-select"
            value={q.billTo || ''}
            autoFocus
            onBlur={() => setActiveCell(null)}
            onChange={async e => {
              const val = e.target.value
              await handleSingleFieldSave(q.id, { billTo: val })
              setActiveCell(null)
            }}
          >
            <option value="">-- Select Client --</option>
            <option value="AGC Ceramics Co., Ltd.">AGC Ceramics Co., Ltd.</option>
            <option value="NEXT ENGINEERING Co., Ltd.">NEXT ENGINEERING Co., Ltd.</option>
            <option value="Kusakabe Electric and Machinery Co., Ltd.">Kusakabe Electric and Machinery Co., Ltd.</option>
            <option value="MAENO GIKEN INC.">MAENO GIKEN INC.</option>
          </select>
        ) : (
          <div style={{ padding: '6px 8px', width: '100%', minHeight: '30px', display: 'flex', alignItems: 'center' }}>
            {q.billTo || '-'}
          </div>
        )}
      </td>

      {/* Billing Status - Click-to-Edit Dropdown */}
      <td style={{ textAlign: 'center', padding: '2px 4px', cursor: 'pointer' }} onClick={() => { if (!isBStatusEditing) setActiveCell({ id: q.id, field: 'billingStatus' }) }}>
        {isBStatusEditing ? (
          <select
            className="cell-input cell-select"
            value={q.billingStatus || ''}
            autoFocus
            onBlur={() => setActiveCell(null)}
            onChange={async e => {
              const val = e.target.value
              await handleSingleFieldSave(q.id, { billingStatus: val || null })
              setActiveCell(null)
            }}
          >
            <option value="">— Not Set —</option>
            <option value="FOR BILLING">FOR BILLING</option>
            <option value="BILLED">BILLED</option>
            <option value="PAID">PAID</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="REVISED">REVISED</option>
          </select>
        ) : (
          <div style={{ display: 'inline-flex', padding: '4px' }}>
            <span className={`status-badge ${q.billingStatus === 'FOR BILLING' ? 'status-b-for-billing' :
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

      {/* Date Paid - Click-to-Edit Date */}
      <td className={isDatePaidEditing ? 'editing-cell' : ''}>
        {isDatePaidEditing ? (
          <input
            type="date"
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
            autoFocus
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
            {formatDateToSlash(q.datePaid) !== '-' ? formatDateToSlash(q.datePaid) : <span className="cell-empty">—</span>}
          </div>
        )}
      </td>

      {/* Updated By - Read-only */}
      <td>
        {q.updatedBy || <span className="cell-empty">—</span>}
      </td>

      {/* Update Date - Click-to-Edit Date */}
      <td className={`cell-date ${isLastUpdatedEditing ? 'editing-cell' : ''}`}>
        {isLastUpdatedEditing ? (
          <input
            type="date"
            className="cell-input"
            value={editForm.lastUpdatedAt || ''}
            onChange={e => setEditForm({ ...editForm, lastUpdatedAt: e.target.value })}
            onBlur={async () => {
              const val = q.lastUpdatedAt ? q.lastUpdatedAt.substring(0, 10) : ''
              if (editForm.lastUpdatedAt !== val) {
                await handleSingleFieldSave(q.id, { lastUpdatedAt: editForm.lastUpdatedAt || null })
              }
              setActiveCell(null)
            }}
            onKeyDown={async e => {
              if (e.key === 'Enter') {
                const val = q.lastUpdatedAt ? q.lastUpdatedAt.substring(0, 10) : ''
                if (editForm.lastUpdatedAt !== val) {
                  await handleSingleFieldSave(q.id, { lastUpdatedAt: editForm.lastUpdatedAt || null })
                }
                setActiveCell(null)
              } else if (e.key === 'Escape') {
                setActiveCell(null)
              }
            }}
            autoFocus
          />
        ) : (
          <div
            className="clickable-cell-trigger editable-text-cell"
            onClick={() => {
              const val = q.lastUpdatedAt ? q.lastUpdatedAt.substring(0, 10) : ''
              setActiveCell({ id: q.id, field: 'lastUpdatedAt' })
              setEditForm({ lastUpdatedAt: val })
            }}
          >
            {formatDateToSlash(q.lastUpdatedAt) !== '-' ? formatDateToSlash(q.lastUpdatedAt) : <span className="cell-empty">—</span>}
          </div>
        )}
      </td>

      {/* Update Detail - Click-to-Edit Text */}
      <td className={`tooltip-cell ${isUpdateDetailEditing ? 'editing-cell' : ''}`} data-tooltip={q.updateDetail || 'No details'}>
        {isUpdateDetailEditing ? (
          <input
            type="text"
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
            autoFocus
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
}
