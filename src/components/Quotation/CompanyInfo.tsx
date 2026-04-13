import { memo } from 'react'
import type { CompanyInfo } from '../../hooks/quotation'

interface Props {
  companyInfo: CompanyInfo
  onUpdate: (updates: CompanyInfo) => void
}

const CompanyInfoForm = memo(({ companyInfo, onUpdate }: Props) => {
  const handleChange = (field: keyof CompanyInfo, value: string) => {
    onUpdate({ ...companyInfo, [field]: value })
  }

  return (
    <div className="section-card">
      <div className="card-header">
        <div className="section-icon company">
          {/* Building icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <h2 className="section-title">Company Information</h2>
      </div>

      <div className="card-content">
        <div className="input-group">
          <label>Company Name</label>
          <input
            type="text"
            value={companyInfo.name}
            onChange={e => handleChange('name', e.target.value)}
            className="form-input"
          />
        </div>

        <div className="input-group">
          <label>Company Address</label>
          <div className="address-inputs">
            <input
              type="text"
              value={companyInfo.address}
              onChange={e => handleChange('address', e.target.value)}
              className="form-input"
              placeholder="Street / Building"
            />
            <input
              type="text"
              value={companyInfo.city}
              onChange={e => handleChange('city', e.target.value)}
              className="form-input"
              placeholder="City / Zone"
            />
            <input
              type="text"
              value={companyInfo.location}
              onChange={e => handleChange('location', e.target.value)}
              className="form-input"
              placeholder="Province / Country"
            />
          </div>
        </div>

        <div className="input-group">
          <label>Phone</label>
          <div className="input-with-icon">
            <input
              type="text"
              value={companyInfo.phone}
              onChange={e => handleChange('phone', e.target.value)}
              className="form-input"
            />
            {/* Phone icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="input-icon">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.55 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.13 6.13l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
})

CompanyInfoForm.displayName = 'CompanyInfoForm'
export default CompanyInfoForm
