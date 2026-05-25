import type { IQuotation } from '../../types'

interface BillingSpreadsheetTableProps {
  loading: boolean
  paginatedQuotations: IQuotation[]
  currentPage: number
  itemsPerPage: number
  setItemsPerPage: (val: number) => void
  setCurrentPage: (page: number | ((prev: number) => number)) => void
  totalItems: number
  totalPages: number
  activeCell: { id: number; field: string } | null
  setActiveCell: (cell: { id: number; field: string } | null) => void
  editForm: Partial<IQuotation>
  setEditForm: (form: Partial<IQuotation>) => void
  handleSingleFieldSave: (id: number, updates: Partial<IQuotation>) => Promise<void>
  formatDateToSlash: (dateStr?: string | null) => string
  formatDateTimeToSlash: (dateStr?: string | null) => string
  formatCurrency: (val?: number) => string
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
  formatCurrency
}: BillingSpreadsheetTableProps) {
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
                  const isEven = idx % 2 === 1

                  return (
                    <tr key={q.id} className={[
                      isRowEditing ? 'editing-row-highlight' : '',
                      isEven ? 'row-stripe' : ''
                    ].filter(Boolean).join(' ')}>
                      {/* Index */}
                      <td className="cell-index sticky-col-index">{rowNumber}</td>

                      {/* Project Incharge (Designer Name) */}
                      <td className="sticky-col-name" title={q.designerName || ''}>
                        {q.designerName || <span className="cell-empty">—</span>}
                      </td>

                      {/* Customer Incharge */}
                      <td title={q.customerIncharge || ''}>
                        {q.customerIncharge || <span className="cell-empty">—</span>}
                      </td>

                      {/* Customer (Client Name) */}
                      <td title={q.clientName || ''}>
                        {q.clientName || <span className="cell-empty">—</span>}
                      </td>

                      {/* Quotation Number */}
                      <td className="cell-qno" title={q.quotationNo || ''}>{q.quotationNo || <span className="cell-empty">—</span>}</td>

                      {/* Date */}
                      <td>{formatDateToSlash(q.date) !== '-' ? formatDateToSlash(q.date) : <span className="cell-empty">—</span>}</td>

                      {/* Amount */}
                      <td className="cell-amount">{formatCurrency(q.grandTotal)}</td>

                      {/* Quotation Status */}
                      <td className={activeCell?.id === q.id && activeCell?.field === 'quotationStatus' ? 'editing-cell' : ''}>
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
                      <td className={activeCell?.id === q.id && activeCell?.field === 'projectStatus' ? 'editing-cell' : ''}>
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
                      <td className={activeCell?.id === q.id && activeCell?.field === 'submittedToAdminAt' ? 'editing-cell' : ''}>
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
                      <td className={activeCell?.id === q.id && activeCell?.field === 'billTo' ? 'editing-cell' : ''}>
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
                      <td className={activeCell?.id === q.id && activeCell?.field === 'datePaid' ? 'editing-cell' : ''}>
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
                      <td className={activeCell?.id === q.id && activeCell?.field === 'updatedBy' ? 'editing-cell' : ''} title={q.updatedBy || ''}>
                        {activeCell?.id === q.id && activeCell?.field === 'updatedBy' ? (
                          <input
                            type="text"
                            autoFocus
                            className="cell-input"
                            value={editForm.updatedBy || ''}
                            onChange={e => setEditForm({ ...editForm, updatedBy: e.target.value })}
                            onBlur={async () => {
                              const val = q.updatedBy || ''
                              if (editForm.updatedBy !== val) {
                                await handleSingleFieldSave(q.id, { updatedBy: editForm.updatedBy || '' })
                              }
                              setActiveCell(null)
                            }}
                            onKeyDown={async e => {
                              if (e.key === 'Enter') {
                                const val = q.updatedBy || ''
                                if (editForm.updatedBy !== val) {
                                  await handleSingleFieldSave(q.id, { updatedBy: editForm.updatedBy || '' })
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
        </>
      )}
    </div>
  )
}
