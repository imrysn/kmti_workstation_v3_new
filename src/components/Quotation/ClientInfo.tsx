import { memo } from 'react'
import type { ClientInfo } from '../../hooks/quotation'

interface Props {
  clientInfo: ClientInfo
  onUpdate: (updates: ClientInfo) => void
}

const ClientInfoForm = memo(({ clientInfo, onUpdate }: Props) => {
  const handleChange = (field: keyof ClientInfo, value: string) => {
    onUpdate({ ...clientInfo, [field]: value })
  }

  return (
    <div className="section-card">
      <div className="card-header">
        <div className="section-icon client">
          {/* User icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <h2 className="section-title">Client Information</h2>
      </div>

      <div className="card-content">
        <div className="input-group">
          <label>Client Company</label>
          <input
            type="text"
            value={clientInfo.company}
            onChange={e => handleChange('company', e.target.value)}
            className="form-input"
          />
        </div>

        <div className="input-group">
          <label>Contact Person</label>
          <input
            type="text"
            value={clientInfo.contact}
            onChange={e => handleChange('contact', e.target.value)}
            className="form-input"
          />
        </div>

        <div className="input-group">
          <label>Client Address</label>
          <div className="input-with-icon">
            <textarea
              value={clientInfo.address}
              onChange={e => handleChange('address', e.target.value)}
              className="form-textarea"
              rows={3}
              style={{ minHeight: '80px' }}
            />
            {/* MapPin icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="input-icon" style={{ top: '16px' }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        </div>

        <div className="input-group">
          <label>Client Phone</label>
          <div className="input-with-icon">
            <input
              type="text"
              value={clientInfo.phone}
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

ClientInfoForm.displayName = 'ClientInfoForm'
export default ClientInfoForm
