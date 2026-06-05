import type { IQuotation } from '../../../types'

interface QuotationEditModalProps {
  editingQuotation: IQuotation | null
  setEditingQuotation: (q: IQuotation | null) => void
  editForm: Partial<IQuotation>
  setEditForm: (form: Partial<IQuotation>) => void
  clientsList: string[]
  handleSingleFieldSave: (id: number, updates: Partial<IQuotation>) => Promise<void>
}

export default function QuotationEditModal({
  editingQuotation,
  setEditingQuotation,
  editForm,
  setEditForm,
  clientsList,
  handleSingleFieldSave
}: QuotationEditModalProps) {
  if (!editingQuotation) return null

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div className="modal-content" style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        width: '500px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
            Edit Quotation Billing Details
          </h3>
          <button
            onClick={() => setEditingQuotation(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px' }}
          >
            &times;
          </button>
        </div>

        {/* Form Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left' }}>Quotation Number</label>
            <input
              type="text"
              className="filter-input"
              value={editForm.quotationNo || ''}
              onChange={e => setEditForm({ ...editForm, quotationNo: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left' }}>Project Incharge</label>
              <input
                type="text"
                className="filter-input"
                value={editForm.designerName || ''}
                onChange={e => setEditForm({ ...editForm, designerName: e.target.value })}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left' }}>Customer Incharge</label>
              <input
                type="text"
                className="filter-input"
                value={editForm.customerIncharge || ''}
                onChange={e => setEditForm({ ...editForm, customerIncharge: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left' }}>Customer (Client Name)</label>
              <select
                className="filter-input"
                value={editForm.clientName || ''}
                onChange={e => setEditForm({ ...editForm, clientName: e.target.value })}
              >
                <option value="">-- Select --</option>
                {clientsList.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left' }}>Amount</label>
              <input
                type="number"
                className="filter-input"
                value={editForm.grandTotal || 0}
                onChange={e => setEditForm({ ...editForm, grandTotal: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left' }}>Date</label>
              <input
                type="date"
                className="filter-input"
                value={editForm.date || ''}
                onChange={e => setEditForm({ ...editForm, date: e.target.value })}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left' }}>Date Paid</label>
              <input
                type="date"
                className="filter-input"
                value={editForm.datePaid || ''}
                onChange={e => setEditForm({ ...editForm, datePaid: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left' }}>Quotation Status</label>
              <select
                className="filter-input"
                value={editForm.quotationStatus || 'DRAFT'}
                onChange={e => setEditForm({ ...editForm, quotationStatus: e.target.value })}
              >
                <option value="DRAFT">DRAFT</option>
                <option value="For Approval">For Approval</option>
                <option value="Approved">Approved</option>
                <option value="Partial Billing">Partial Billing</option>
                <option value="Billing Completion">Billing Completion</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left' }}>Project Status</label>
              <select
                className="filter-input"
                value={editForm.projectStatus || 'On Going'}
                onChange={e => setEditForm({ ...editForm, projectStatus: e.target.value })}
              >
                <option value="On Going">On Going</option>
                <option value="Finished">Finished</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left' }}>Billing Status</label>
              <select
                className="filter-input"
                value={editForm.billingStatus || ''}
                onChange={e => setEditForm({ ...editForm, billingStatus: e.target.value })}
              >
                <option value="">— Not Set —</option>
                <option value="FOR BILLING">FOR BILLING</option>
                <option value="BILLED">BILLED</option>
                <option value="PAID">PAID</option>
                <option value="CANCELLED">CANCELLED</option>
                <option value="REVISED">REVISED</option>
              </select>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left' }}>Updated By</label>
              <input
                type="text"
                className="filter-input"
                value={editForm.updatedBy || ''}
                onChange={e => setEditForm({ ...editForm, updatedBy: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left' }}>Update Detail</label>
            <input
              type="text"
              className="filter-input"
              value={editForm.updateDetail || ''}
              onChange={e => setEditForm({ ...editForm, updateDetail: e.target.value })}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <button
            className="btn btn-ghost"
            onClick={() => setEditingQuotation(null)}
          >
            Cancel
          </button>
          <button
            className="btn"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onClick={async () => {
              const updates: Partial<IQuotation> = {
                quotationNo: editForm.quotationNo,
                designerName: editForm.designerName,
                customerIncharge: editForm.customerIncharge,
                clientName: editForm.clientName,
                grandTotal: editForm.grandTotal,
                date: editForm.date,
                datePaid: editForm.datePaid,
                quotationStatus: editForm.quotationStatus,
                projectStatus: editForm.projectStatus,
                billingStatus: editForm.billingStatus,
                updatedBy: editForm.updatedBy,
                updateDetail: editForm.updateDetail,
              }
              await handleSingleFieldSave(editingQuotation.id, updates)
              setEditingQuotation(null)
            }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
