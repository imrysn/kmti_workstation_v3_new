import { memo, useState } from 'react'
import type { CompanyInfo } from '../../../hooks/quotation'
import { useCollaborationContext } from '../../../context/CollaborationContext'
import { CollaborativeField } from './CollaborativeField'

interface Props {
  companyInfo: CompanyInfo
  onUpdate: (updates: CompanyInfo) => void
}

const CompanyInfoForm = memo(({ companyInfo, onUpdate }: Props) => {
  const { remoteUsers, emitFocus, emitBlur } = useCollaborationContext()
  const [isEditing, setIsEditing] = useState(false)

  const handleChange = (field: keyof CompanyInfo, value: string) => {
    onUpdate({ ...companyInfo, [field]: value })
  }

  const hasContent = companyInfo.name || companyInfo.address || companyInfo.phone

  return (
    <div className="section-card">
      <div className="card-header">
        <div className="section-icon company">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <h2 className="section-title">Company Information</h2>
        <button
          className="info-card-edit-btn"
          onClick={() => setIsEditing(e => !e)}
          title={isEditing ? 'Done editing' : 'Edit company info'}
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
          /* ── Edit mode ── */
          <>
            <div className="input-group">
              <label>Company Name</label>
              <CollaborativeField
                fieldKey="companyInfo.name"
                remoteUsers={remoteUsers}
                onFocus={() => emitFocus('companyInfo.name')}
                onBlur={() => emitBlur('companyInfo.name')}
              >
                <input
                  type="text"
                  value={companyInfo.name}
                  onChange={e => handleChange('name', e.target.value)}
                  className="form-input"
                  placeholder="Company name"
                  autoFocus
                />
              </CollaborativeField>
            </div>
            <div className="input-group">
              <label>Street / Building</label>
              <CollaborativeField
                fieldKey="companyInfo.address"
                remoteUsers={remoteUsers}
                onFocus={() => emitFocus('companyInfo.address')}
                onBlur={() => emitBlur('companyInfo.address')}
              >
                <input
                  type="text"
                  value={companyInfo.address}
                  onChange={e => handleChange('address', e.target.value)}
                  className="form-input"
                  placeholder="Street / Building"
                />
              </CollaborativeField>
            </div>
            <div className="input-group">
              <label>City / Zone</label>
              <CollaborativeField
                fieldKey="companyInfo.city"
                remoteUsers={remoteUsers}
                onFocus={() => emitFocus('companyInfo.city')}
                onBlur={() => emitBlur('companyInfo.city')}
              >
                <input
                  type="text"
                  value={companyInfo.city}
                  onChange={e => handleChange('city', e.target.value)}
                  className="form-input"
                  placeholder="City / Zone"
                />
              </CollaborativeField>
            </div>
            <div className="input-group">
              <label>Province / Country</label>
              <CollaborativeField
                fieldKey="companyInfo.location"
                remoteUsers={remoteUsers}
                onFocus={() => emitFocus('companyInfo.location')}
                onBlur={() => emitBlur('companyInfo.location')}
              >
                <input
                  type="text"
                  value={companyInfo.location}
                  onChange={e => handleChange('location', e.target.value)}
                  className="form-input"
                  placeholder="Province / Country"
                />
              </CollaborativeField>
            </div>
            <div className="input-group">
              <label>Phone</label>
              <CollaborativeField
                fieldKey="companyInfo.phone"
                remoteUsers={remoteUsers}
                onFocus={() => emitFocus('companyInfo.phone')}
                onBlur={() => emitBlur('companyInfo.phone')}
              >
                <input
                  type="text"
                  value={companyInfo.phone}
                  onChange={e => handleChange('phone', e.target.value)}
                  className="form-input"
                  placeholder="TEL: ..."
                />
              </CollaborativeField>
            </div>
          </>
        ) : (
          /* ── Read-only display mode ── */
          <div className="info-card-display">
            {hasContent ? (
              <>
                {companyInfo.name && (
                  <div className="info-display-name">{companyInfo.name}</div>
                )}
                {(companyInfo.address || companyInfo.city || companyInfo.location) && (
                  <div className="info-display-address">
                    {[companyInfo.address, companyInfo.city, companyInfo.location]
                      .filter(Boolean)
                      .join('\n')}
                  </div>
                )}
                {companyInfo.phone && (
                  <div className="info-display-phone">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.55 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.13 6.13l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    {companyInfo.phone}
                  </div>
                )}
              </>
            ) : (
              <div className="info-display-empty">
                No company information entered.{' '}
                <button className="info-display-empty-link" onClick={() => setIsEditing(true)}>
                  Click Edit to add.
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

CompanyInfoForm.displayName = 'CompanyInfoForm'
export default CompanyInfoForm
