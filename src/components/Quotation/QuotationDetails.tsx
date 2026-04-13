import { memo } from 'react'
import type { QuotationDetails } from '../../hooks/quotation'

interface Props {
  quotationDetails: QuotationDetails
  onUpdate: (updates: Partial<QuotationDetails>) => void
}

const QuotationDetailsForm = memo(({ quotationDetails, onUpdate }: Props) => {
  const handleChange = (field: keyof QuotationDetails, value: string) => {
    onUpdate({ ...quotationDetails, [field]: value })
  }

  return (
    <div className="quotation-details-section">
      <div className="section-header">
        <div className="section-icon quotation">
          {/* FileText icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </div>
        <h2 className="section-title">Quotation Details</h2>
      </div>

      <div className="quotation-grid">
        <div className="input-group">
          <label>Quotation Number</label>
          <input
            type="text"
            value={quotationDetails.quotationNo}
            onChange={e => handleChange('quotationNo', e.target.value)}
            className="form-input"
          />
        </div>

        <div className="input-group">
          <label>Reference Number</label>
          <input
            type="text"
            value={quotationDetails.referenceNo}
            onChange={e => handleChange('referenceNo', e.target.value)}
            className="form-input"
          />
        </div>

        <div className="input-group">
          <label>Date</label>
          <div className="input-with-icon">
            <input
              type="date"
              value={quotationDetails.date}
              onChange={e => handleChange('date', e.target.value)}
              className="form-input"
            />
            {/* Calendar icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="input-icon">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
        </div>

        <div className="input-group">
          <label>Invoice Number</label>
          <input
            type="text"
            value={quotationDetails.invoiceNo || ''}
            onChange={e => handleChange('invoiceNo', e.target.value)}
            className="form-input"
            placeholder="Used in billing mode"
          />
        </div>

        <div className="input-group">
          <label>Job Order Number</label>
          <input
            type="text"
            value={quotationDetails.jobOrderNo || ''}
            onChange={e => handleChange('jobOrderNo', e.target.value)}
            className="form-input"
            placeholder="Used in billing mode"
          />
        </div>
      </div>
    </div>
  )
})

QuotationDetailsForm.displayName = 'QuotationDetailsForm'
export default QuotationDetailsForm
