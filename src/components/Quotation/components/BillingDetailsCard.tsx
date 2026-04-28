import { memo, useState } from 'react'
import type { BillingDetails } from '../../../hooks/quotation'
import { useCollaborationContext } from '../../../context/CollaborationContext'
import { CollaborativeField } from './CollaborativeField'

interface Props {
  billingDetails: BillingDetails
  onUpdateBilling?: (updates: Partial<BillingDetails>) => void
}

const BANK_FIELDS: Array<{ key: keyof BillingDetails; label: string; placeholder: string }> = [
  { key: 'bankName',      label: 'Bank Name',           placeholder: 'e.g. RIZAL COMMERCIAL BANK CORPORATION' },
  { key: 'accountName',   label: 'Account Name',        placeholder: 'Account holder name' },
  { key: 'accountNumber', label: 'Account Number',      placeholder: 'e.g. 0000000011581337' },
  { key: 'bankAddress',   label: 'Bank Address',        placeholder: 'Full branch address' },
  { key: 'swiftCode',     label: 'Swift Code',          placeholder: 'e.g. RCBCPHMM' },
  { key: 'branchCode',    label: 'Branch Code',         placeholder: 'e.g. 358' },
]

const BillingDetailsCard = memo(({ billingDetails, onUpdateBilling }: Props) => {
  const { remoteUsers, emitFocus, emitBlur } = useCollaborationContext()
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div className="section-card billing-card-full">
      <div className="card-header">
        <div className="section-icon billing-details">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"/>
            <line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
        </div>
        <h2 className="section-title">Billing Details</h2>

        {!isEditing && (billingDetails.invoiceNo || billingDetails.jobOrderNo) && (
          <div className="qdcard-badges">
            {billingDetails.invoiceNo && (
              <span className="qdcard-badge">Inv: {billingDetails.invoiceNo}</span>
            )}
            {billingDetails.jobOrderNo && (
              <span className="qdcard-badge">JO: {billingDetails.jobOrderNo}</span>
            )}
          </div>
        )}

        {onUpdateBilling && (
          <button
            className="info-card-edit-btn"
            onClick={() => setIsEditing(e => !e)}
            title={isEditing ? 'Done editing' : 'Edit billing details'}
          >
            {isEditing ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Done
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit
              </>
            )}
          </button>
        )}
      </div>

      <div className="card-content">
        {isEditing ? (
          <div className="qdcard-grid">
            {/* Invoice & Job Order */}
            <div className="input-group">
              <label>Invoice No.</label>
              <CollaborativeField
                fieldKey="billingDetails.invoiceNo"
                remoteUsers={remoteUsers}
                onFocus={() => emitFocus('billingDetails.invoiceNo')}
                onBlur={() => emitBlur('billingDetails.invoiceNo')}
              >
                <input
                  type="text"
                  value={billingDetails.invoiceNo}
                  onChange={e => onUpdateBilling?.({ invoiceNo: e.target.value })}
                  className="form-input"
                  placeholder="Invoice number"
                  autoFocus
                />
              </CollaborativeField>
            </div>
            <div className="input-group">
              <label>Job Order No.</label>
              <CollaborativeField
                fieldKey="billingDetails.jobOrderNo"
                remoteUsers={remoteUsers}
                onFocus={() => emitFocus('billingDetails.jobOrderNo')}
                onBlur={() => emitBlur('billingDetails.jobOrderNo')}
              >
                <input
                  type="text"
                  value={billingDetails.jobOrderNo}
                  onChange={e => onUpdateBilling?.({ jobOrderNo: e.target.value })}
                  className="form-input"
                  placeholder="Job order number"
                />
              </CollaborativeField>
            </div>

            {/* Divider */}
            <div className="billing-card-section-divider">
              <span>Bank Details (Yen)</span>
            </div>

            {/* Bank fields */}
            {BANK_FIELDS.map(({ key, label, placeholder }) => (
              <div className="input-group" key={key}>
                <label>{label}</label>
                <CollaborativeField
                  fieldKey={`billingDetails.${key}`}
                  remoteUsers={remoteUsers}
                  onFocus={() => emitFocus(`billingDetails.${key}`)}
                  onBlur={() => emitBlur(`billingDetails.${key}`)}
                >
                  <input
                    type="text"
                    value={billingDetails[key] as string}
                    onChange={e => onUpdateBilling?.({ [key]: e.target.value })}
                    className="form-input"
                    placeholder={placeholder}
                  />
                </CollaborativeField>
              </div>
            ))}
          </div>
        ) : (
          <div className="qdcard-display">
            {/* Invoice & JO */}
            <div className="qdcard-row">
              <span className="qdcard-label">Invoice No.</span>
              <span className="qdcard-value">{billingDetails.invoiceNo || '—'}</span>
            </div>
            <div className="qdcard-row">
              <span className="qdcard-label">Job Order No.</span>
              <span className="qdcard-value">{billingDetails.jobOrderNo || '—'}</span>
            </div>

            {/* Bank section header */}
            <div className="billing-card-section-label">Bank Details (Yen)</div>

            {/* Bank fields */}
            {BANK_FIELDS.map(({ key, label }) => (
              <div className="qdcard-row" key={key}>
                <span className="qdcard-label">{label}</span>
                <span className="qdcard-value qdcard-value--mono" style={{ fontSize: '11px' }}>
                  {(billingDetails[key] as string) || '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

BillingDetailsCard.displayName = 'BillingDetailsCard'
export default BillingDetailsCard
