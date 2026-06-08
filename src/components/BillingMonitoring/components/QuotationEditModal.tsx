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
        borderRadius: '12px',
        width: '98vw',
        maxWidth: '98vw',
        maxHeight: '90vh',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
            Edit Quotation Billing Details
          </h3>
          <button
            onClick={() => setEditingQuotation(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px' }}
          >
            &times;
          </button>
        </div>

        {/* Form Fields - Ordered precisely in 1 single horizontal row matching TableRow, stretched using flex to fit the screen without scrolling */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '8px',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          width: '100%',
        }}>
          {/* 1. Project Incharge */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '60px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title="Project Incharge">Proj Incharge</label>
            <input
              type="text"
              className="filter-input"
              style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
              value={editForm.designerName || ''}
              onChange={e => setEditForm({ ...editForm, designerName: e.target.value })}
            />
          </div>

          {/* 2. Customer Incharge */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1.2, minWidth: '80px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title="Customer Incharge">Cust Incharge</label>
            <input
              type="text"
              className="filter-input"
              style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
              value={editForm.customerIncharge || ''}
              onChange={e => setEditForm({ ...editForm, customerIncharge: e.target.value })}
            />
          </div>

          {/* 3. Customer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1.2, minWidth: '90px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Customer</label>
            <select
              className="filter-input"
              style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
              value={editForm.clientName || ''}
              onChange={e => setEditForm({ ...editForm, clientName: e.target.value })}
            >
              <option value="">-- Client --</option>
              {clientsList.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* 4. Quotation Number */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1.4, minWidth: '100px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Quotation No</label>
            <input
              type="text"
              className="filter-input"
              style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
              value={editForm.quotationNo || ''}
              onChange={e => setEditForm({ ...editForm, quotationNo: e.target.value })}
            />
          </div>

          {/* 5. Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1.2, minWidth: '90px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Date</label>
            <input
              type="date"
              className="filter-input"
              style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
              value={editForm.date || ''}
              onChange={e => setEditForm({ ...editForm, date: e.target.value })}
            />
          </div>

          {/* 6. Amount */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '70px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Amount</label>
            <input
              type="number"
              className="filter-input"
              style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
              value={editForm.grandTotal || 0}
              onChange={e => setEditForm({ ...editForm, grandTotal: parseFloat(e.target.value) || 0 })}
            />
          </div>

          {/* 7. Quotation Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1.3, minWidth: '100px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Quotation Status</label>
            <select
              className="filter-input"
              style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
              value={editForm.quotationStatus || 'DRAFT'}
              onChange={e => setEditForm({ ...editForm, quotationStatus: e.target.value })}
            >
              <option value="DRAFT">DRAFT</option>
              <option value="For Approval">For Approval</option>
              <option value="Approved">Approved</option>
              <option value="Partial Billing">Partial Billing</option>
              <option value="Billing Completion">Billing Completion</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="REVISED">REVISED</option>
            </select>
          </div>

          {/* 8. Project Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1.1, minWidth: '80px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Project Status</label>
            <select
              className="filter-input"
              style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
              value={editForm.projectStatus || 'On Going'}
              onChange={e => setEditForm({ ...editForm, projectStatus: e.target.value })}
            >
              <option value="On Going">On Going</option>
              <option value="Finished">Finished</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="REVISED">REVISED</option>
            </select>
          </div>

          {/* 9. Submitted to Admin */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1.2, minWidth: '90px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Sub to Admin</label>
            <input
              type="date"
              className="filter-input"
              style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
              value={editForm.submittedToAdminAt || ''}
              onChange={e => setEditForm({ ...editForm, submittedToAdminAt: e.target.value })}
            />
          </div>

          {/* 10. Bill To */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1.6, minWidth: '110px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Bill To</label>
            <select
              className="filter-input"
              style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
              value={editForm.billTo || ''}
              onChange={e => setEditForm({ ...editForm, billTo: e.target.value })}
            >
              <option value="AGC Ceramics Co., Ltd.">AGC Ceramics Co., Ltd.</option>
              <option value="NEXT ENGINEERING Co., Ltd.">NEXT ENGINEERING Co., Ltd.</option>
              <option value="Kusakabe Electric and Machinery Co., Ltd.">Kusakabe Electric and Machinery Co., Ltd.</option>
              <option value="MAENO GIKEN INC.">MAENO GIKEN INC.</option>
            </select>
          </div>

          {/* 11. Billing Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1.2, minWidth: '90px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Billing Status</label>
            <select
              className="filter-input"
              style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
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

          {/* 12. Date Paid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1.2, minWidth: '90px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Date Paid</label>
            <input
              type="date"
              className="filter-input"
              style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
              value={editForm.datePaid || ''}
              onChange={e => setEditForm({ ...editForm, datePaid: e.target.value })}
            />
          </div>

          {/* 13. Updated By */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 0.8, minWidth: '60px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Updated By</label>
            <input
              type="text"
              className="filter-input"
              style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
              value={editForm.updatedBy || ''}
              onChange={e => setEditForm({ ...editForm, updatedBy: e.target.value })}
            />
          </div>

          {/* 14. Update Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1.2, minWidth: '90px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Update Date</label>
            <input
              type="date"
              className="filter-input"
              style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
              value={editForm.lastUpdatedAt || ''}
              onChange={e => setEditForm({ ...editForm, lastUpdatedAt: e.target.value })}
            />
          </div>

          {/* 15. Update Detail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 2, minWidth: '120px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Update Detail</label>
            <input
              type="text"
              className="filter-input"
              style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
              value={editForm.updateDetail || ''}
              onChange={e => setEditForm({ ...editForm, updateDetail: e.target.value })}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
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
                designerName: editForm.designerName,
                customerIncharge: editForm.customerIncharge,
                clientName: editForm.clientName,
                quotationNo: editForm.quotationNo,
                date: editForm.date,
                grandTotal: editForm.grandTotal,
                quotationStatus: editForm.quotationStatus,
                projectStatus: editForm.projectStatus,
                submittedToAdminAt: editForm.submittedToAdminAt,
                billTo: editForm.billTo,
                billingStatus: editForm.billingStatus,
                datePaid: editForm.datePaid,
                updatedBy: editForm.updatedBy,
                lastUpdatedAt: editForm.lastUpdatedAt,
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
