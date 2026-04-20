import { memo, useState } from 'react'
import type { QuotationDetails } from '../../../hooks/quotation'
import { useCollaborationContext } from '../../../context/CollaborationContext'
import { CollaborativeField } from './CollaborativeField'

interface Props {
  quotationDetails: QuotationDetails
  onUpdate: (updates: Partial<QuotationDetails>) => void
}

// Pattern for auto-generated quotation numbers: KMTE-YYMMDD-NNN
const GENERATED_QUOT_PATTERN = /^KMTE-\d{6}-\d{3}$/

const QuotationDetailsCard = memo(({ quotationDetails, onUpdate }: Props) => {
  const { remoteUsers, emitFocus, emitBlur } = useCollaborationContext()
  const [isEditing, setIsEditing] = useState(false)
  const [quotNoManual, setQuotNoManual] = useState(
    !GENERATED_QUOT_PATTERN.test(quotationDetails.quotationNo)
  )

  const handleQuotNoChange = (value: string) => {
    setQuotNoManual(true)
    onUpdate({ quotationNo: value })
  }

  const handleQuotNoReset = () => {
    setQuotNoManual(false)
    const d = new Date(quotationDetails.date + 'T00:00:00')
    const yy = d.getFullYear().toString().slice(-2)
    const mm = (d.getMonth() + 1).toString().padStart(2, '0')
    const dd = d.getDate().toString().padStart(2, '0')
    onUpdate({ quotationNo: `KMTE-${yy}${mm}${dd}-001` })
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }

  return (
    <div className="section-card">
      <div className="card-header">
        <div className="section-icon doc-details">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </div>
        <h2 className="section-title">Document Details</h2>

        {!isEditing && (
          <div className="qdcard-badges">
            {quotationDetails.date && (
              <span className="qdcard-badge">
                {formatDate(quotationDetails.date)}
              </span>
            )}
            {quotationDetails.referenceNo && (
              <span className="qdcard-badge">
                Ref: {quotationDetails.referenceNo}
              </span>
            )}
          </div>
        )}

        <button
          className="info-card-edit-btn"
          onClick={() => setIsEditing(e => !e)}
          title={isEditing ? 'Done editing' : 'Edit document details'}
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
      </div>

      <div className="card-content">
        {isEditing ? (
          <div className="qdcard-grid">
            <div className="input-group">
              <label>Date</label>
              <CollaborativeField
                fieldKey="quotationDetails.date"
                remoteUsers={remoteUsers}
                onFocus={() => emitFocus('quotationDetails.date')}
                onBlur={() => emitBlur('quotationDetails.date')}
              >
                <input
                  type="date"
                  value={quotationDetails.date}
                  onChange={e => onUpdate({ date: e.target.value })}
                  className="form-input"
                  autoFocus
                />
              </CollaborativeField>
            </div>

            <div className="input-group">
              <label>Quotation No.</label>
              <div className="client-quot-no-row">
                <CollaborativeField
                  fieldKey="quotationDetails.quotationNo"
                  remoteUsers={remoteUsers}
                  onFocus={() => emitFocus('quotationDetails.quotationNo')}
                  onBlur={() => emitBlur('quotationDetails.quotationNo')}
                  style={{ flex: 1 }}
                >
                  <input
                    type="text"
                    value={quotationDetails.quotationNo}
                    onChange={e => handleQuotNoChange(e.target.value)}
                    className="form-input"
                    placeholder="e.g. KMTE-260413-001"
                  />
                </CollaborativeField>
                {quotNoManual && (
                  <button
                    type="button"
                    className="client-quot-reset-btn"
                    onClick={handleQuotNoReset}
                    title="Reset to auto-generated"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10"/>
                      <polyline points="1 20 1 14 7 14"/>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                    Auto
                  </button>
                )}
              </div>
              {quotNoManual && (
                <div className="client-quot-manual-hint">Manual — auto-update disabled</div>
              )}
            </div>

            <div className="input-group">
              <label>Reference Number</label>
              <CollaborativeField
                fieldKey="quotationDetails.referenceNo"
                remoteUsers={remoteUsers}
                onFocus={() => emitFocus('quotationDetails.referenceNo')}
                onBlur={() => emitBlur('quotationDetails.referenceNo')}
              >
                <input
                  type="text"
                  value={quotationDetails.referenceNo}
                  onChange={e => onUpdate({ referenceNo: e.target.value })}
                  className="form-input"
                  placeholder="e.g. NE-2026-04"
                />
              </CollaborativeField>
            </div>
          </div>
        ) : (
          <div className="qdcard-display">
            <div className="qdcard-row">
              <span className="qdcard-label">Date</span>
              <span className="qdcard-value">{formatDate(quotationDetails.date) || '—'}</span>
            </div>
            <div className="qdcard-row">
              <span className="qdcard-label">Quotation No.</span>
              <span className="qdcard-value qdcard-value--mono">
                {quotationDetails.quotationNo || '—'}
                {quotNoManual && <span className="qdcard-manual-tag">manual</span>}
              </span>
            </div>
            <div className="qdcard-row">
              <span className="qdcard-label">Reference No.</span>
              <span className="qdcard-value">{quotationDetails.referenceNo || '—'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

QuotationDetailsCard.displayName = 'QuotationDetailsCard'
export default QuotationDetailsCard
