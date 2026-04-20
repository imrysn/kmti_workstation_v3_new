import { memo, useState } from 'react'
import type { ClientInfo } from '../../../hooks/quotation'
import { useCollaborationContext } from '../../../context/CollaborationContext'
import { CollaborativeField } from './CollaborativeField'

interface Props {
  clientInfo: ClientInfo
  onUpdate: (updates: ClientInfo) => void
}

const ClientInfoForm = memo(({ clientInfo, onUpdate }: Props) => {
  const { remoteUsers, emitFocus, emitBlur } = useCollaborationContext()
  const [isEditing, setIsEditing] = useState(false)

  const handleChange = (field: keyof ClientInfo, value: string) => {
    onUpdate({ ...clientInfo, [field]: value })
  }

  const hasContent = clientInfo.company || clientInfo.contact || clientInfo.address

  return (
    <div className="section-card">
      <div className="card-header">
        <div className="section-icon client">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <h2 className="section-title">Client Information</h2>

        <button
          className="info-card-edit-btn"
          onClick={() => setIsEditing(e => !e)}
          title={isEditing ? 'Done editing' : 'Edit client info'}
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
              <label>Client Company</label>
              <CollaborativeField
                fieldKey="clientInfo.company"
                remoteUsers={remoteUsers}
                onFocus={() => emitFocus('clientInfo.company')}
                onBlur={() => emitBlur('clientInfo.company')}
              >
                <input
                  type="text"
                  value={clientInfo.company}
                  onChange={e => handleChange('company', e.target.value)}
                  className="form-input"
                  placeholder="Company name"
                  autoFocus
                />
              </CollaborativeField>
            </div>
            <div className="input-group">
              <label>Contact Person</label>
              <CollaborativeField
                fieldKey="clientInfo.contact"
                remoteUsers={remoteUsers}
                onFocus={() => emitFocus('clientInfo.contact')}
                onBlur={() => emitBlur('clientInfo.contact')}
              >
                <input
                  type="text"
                  value={clientInfo.contact}
                  onChange={e => handleChange('contact', e.target.value)}
                  className="form-input"
                  placeholder="Mr. / Ms. ..."
                />
              </CollaborativeField>
            </div>
            <div className="input-group">
              <label>Address</label>
              <CollaborativeField
                fieldKey="clientInfo.address"
                remoteUsers={remoteUsers}
                onFocus={() => emitFocus('clientInfo.address')}
                onBlur={() => emitBlur('clientInfo.address')}
              >
                <textarea
                  value={clientInfo.address}
                  onChange={e => handleChange('address', e.target.value)}
                  className="form-textarea"
                  rows={3}
                  placeholder="Full address"
                />
              </CollaborativeField>
            </div>
            <div className="input-group">
              <label>Phone</label>
              <CollaborativeField
                fieldKey="clientInfo.phone"
                remoteUsers={remoteUsers}
                onFocus={() => emitFocus('clientInfo.phone')}
                onBlur={() => emitBlur('clientInfo.phone')}
              >
                <input
                  type="text"
                  value={clientInfo.phone}
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
                {clientInfo.company && (
                  <div className="info-display-name">{clientInfo.company}</div>
                )}
                {clientInfo.contact && (
                  <div className="info-display-contact">{clientInfo.contact}</div>
                )}
                {clientInfo.address && (
                  <div className="info-display-address">{clientInfo.address}</div>
                )}
                {clientInfo.phone && (
                  <div className="info-display-phone">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.55 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.13 6.13l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    {clientInfo.phone}
                  </div>
                )}
              </>
            ) : (
              <div className="info-display-empty">
                No client information entered.{' '}
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

ClientInfoForm.displayName = 'ClientInfoForm'
export default ClientInfoForm
