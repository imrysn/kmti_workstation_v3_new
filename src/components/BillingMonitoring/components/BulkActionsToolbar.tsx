import type { IQuotation } from '../../../types'

interface BulkActionsToolbarProps {
  selectedIds: number[]
  setSelectedIds: (ids: number[]) => void
  clientsList: string[]
  paginatedQuotations: IQuotation[]
  filteredQuotations: IQuotation[]
  setEditingQuotation: (q: IQuotation | null) => void
  setEditForm: (form: Partial<IQuotation>) => void
  handleBulkCustomer: (val: string) => Promise<void>
  handleBulkStatus: (val: string) => Promise<void>
  handleBulkProjectStatus: (val: string) => Promise<void>
  handleBulkBillTo: (val: string) => Promise<void>
}

export default function BulkActionsToolbar({
  selectedIds,
  setSelectedIds,
  clientsList,
  paginatedQuotations,
  filteredQuotations,
  setEditingQuotation,
  setEditForm,
  handleBulkCustomer,
  handleBulkStatus,
  handleBulkProjectStatus,
  handleBulkBillTo
}: BulkActionsToolbarProps) {
  return (
    <div className="bulk-actions-toolbar">
      <div className="bulk-actions-info">
        Selected <strong>{selectedIds.length}</strong> items
      </div>
      <div className="bulk-actions-divider" />

      <div className="bulk-actions-group">
        {selectedIds.length === 1 && (
          <button
            className="bulk-action-btn"
            onClick={() => {
              const q = paginatedQuotations.find(item => item.id === selectedIds[0]) || filteredQuotations.find(item => item.id === selectedIds[0])
              if (q) {
                setEditingQuotation(q)
                setEditForm({
                  quotationNo: q.quotationNo || '',
                  designerName: q.designerName || '',
                  customerIncharge: q.customerIncharge || '',
                  clientName: q.clientName || '',
                  grandTotal: q.grandTotal || 0,
                  date: q.date ? q.date.substring(0, 10) : '',
                  datePaid: q.datePaid ? q.datePaid.substring(0, 10) : '',
                  quotationStatus: q.quotationStatus || 'DRAFT',
                  projectStatus: q.projectStatus || 'On Going',
                  billingStatus: q.billingStatus || '',
                  updatedBy: q.updatedBy || '',
                  updateDetail: q.updateDetail || '',
                })
              }
            }}
            style={{ background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)', display: 'inline-flex', alignItems: 'center' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Edit
          </button>
        )}

        <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: selectedIds.length === 1 ? '10px' : '0px' }}>CUSTOMER:</span>
        <select
          className="bulk-action-select"
          defaultValue=""
          onChange={async (e) => {
            const val = e.target.value
            if (val) {
              await handleBulkCustomer(val)
              e.target.value = "" // Reset
            }
          }}
        >
          <option value="" disabled>Select Customer...</option>
          {clientsList.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <div className="bulk-actions-divider" />

        <span style={{ fontSize: '12px', color: '#94a3b8' }}>Quotation Status:</span>
        <select
          className="bulk-action-select"
          defaultValue=""
          onChange={async (e) => {
            const val = e.target.value
            if (val) {
              await handleBulkStatus(val)
              e.target.value = "" // Reset
            }
          }}
        >
          <option value="" disabled>Select Status...</option>
          <option value="DRAFT">DRAFT</option>
          <option value="For Approval">For Approval</option>
          <option value="Approved">Approved</option>
          <option value="Partial Billing">Partial Billing</option>
          <option value="Billing Completion">Billing Completion</option>
          <option value="CANCELLED">CANCELLED</option>
          <option value="REVISED">REVISED</option>
        </select>

        <div className="bulk-actions-divider" />

        <span style={{ fontSize: '12px', color: '#94a3b8' }}>Project Status:</span>
        <select
          className="bulk-action-select"
          defaultValue=""
          onChange={async (e) => {
            const val = e.target.value
            if (val) {
              await handleBulkProjectStatus(val)
              e.target.value = "" // Reset
            }
          }}
        >
          <option value="" disabled>Select Status...</option>
          <option value="On Going">On Going</option>
          <option value="Finished">Finished</option>
          <option value="CANCELLED">CANCELLED</option>
          <option value="REVISED">REVISED</option>
        </select>

        <div className="bulk-actions-divider" />

        <span style={{ fontSize: '12px', color: '#94a3b8' }}>Bill To:</span>
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
  )
}
