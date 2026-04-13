import { memo, useEffect } from 'react'
import type { Signatures } from '../../hooks/quotation'

interface Props {
  signatures: Signatures
  onUpdate: (type: keyof Signatures, field: string, value: any) => void
}

// Common props to force input interactivity inside Electron
const forceInputProps = {
  autoComplete: 'off' as const,
  spellCheck: false as const,
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.readOnly = false
    e.target.removeAttribute('readonly')
  },
  onMouseDown: (e: React.MouseEvent<HTMLInputElement>) => {
    ;(e.target as HTMLInputElement).readOnly = false
    ;(e.target as HTMLInputElement).removeAttribute('readonly')
  },
}

const SignatureForm = memo(({ signatures, onUpdate }: Props) => {
  const handleUpdate = (type: keyof Signatures, field: string, value: any) => {
    onUpdate(type, field, value)
  }

  // Force window refocus in Electron when signatures update
  useEffect(() => {
    if ((window as any).electronAPI) {
      const timer = setTimeout(() => {
        window.focus()
        document.body.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [signatures])

  useEffect(() => {
    const handleInputClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' && target.closest('.signature-section')) {
        ;(target as HTMLInputElement).readOnly = false
        ;(target as HTMLInputElement).focus()
      }
    }
    document.addEventListener('click', handleInputClick, true)
    return () => document.removeEventListener('click', handleInputClick, true)
  }, [])

  return (
    <>
      {/* Quotation Signatures */}
      <div className="signature-section">
        <div className="signature-header">
          <div className="section-header">
            <div className="section-icon quotation-signatures">
              {/* FileSignature icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 19.5v.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8.5L18 5.5"/>
                <path d="M8 18h1l12.5-12.5a1.7 1.7 0 0 0-2.4-2.4L7 15.5V18"/>
                <path d="M14 7l3 3"/>
              </svg>
            </div>
            <h2 className="section-title">Quotation Signatures</h2>
          </div>
        </div>
        <div className="signature-content">
          <div className="signature-grid">
            <div className="signature-column">
              <div className="input-group">
                <label>Prepared by - Name</label>
                <input type="text" value={signatures.quotation.preparedBy.name}
                  onChange={e => handleUpdate('quotation', 'preparedBy', { ...signatures.quotation.preparedBy, name: e.target.value })}
                  className="form-input" placeholder="Enter name" {...forceInputProps} />
              </div>
              <div className="input-group">
                <label>Title</label>
                <input type="text" value={signatures.quotation.preparedBy.title}
                  onChange={e => handleUpdate('quotation', 'preparedBy', { ...signatures.quotation.preparedBy, title: e.target.value })}
                  className="form-input" placeholder="Enter title" {...forceInputProps} />
              </div>
            </div>
            <div className="signature-column">
              <div className="input-group">
                <label>Approved by - Name</label>
                <input type="text" value={signatures.quotation.approvedBy.name}
                  onChange={e => handleUpdate('quotation', 'approvedBy', { ...signatures.quotation.approvedBy, name: e.target.value })}
                  className="form-input" placeholder="Enter name" {...forceInputProps} />
              </div>
              <div className="input-group">
                <label>Title</label>
                <input type="text" value={signatures.quotation.approvedBy.title}
                  onChange={e => handleUpdate('quotation', 'approvedBy', { ...signatures.quotation.approvedBy, title: e.target.value })}
                  className="form-input" placeholder="Enter title" {...forceInputProps} />
              </div>
            </div>
            <div className="signature-column">
              <div className="input-group">
                <label>Received by - Label</label>
                <input type="text" value={signatures.quotation.receivedBy.label}
                  onChange={e => handleUpdate('quotation', 'receivedBy', { ...signatures.quotation.receivedBy, label: e.target.value })}
                  className="form-input" placeholder="Enter label" {...forceInputProps} />
              </div>
              <div className="input-group">
                <label>Title</label>
                <input type="text" value={signatures.quotation.receivedBy.title || ''}
                  onChange={e => handleUpdate('quotation', 'receivedBy', { ...signatures.quotation.receivedBy, title: e.target.value })}
                  className="form-input" placeholder="Enter title" {...forceInputProps} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Billing Statement Signatures */}
      <div className="signature-section">
        <div className="signature-header">
          <div className="section-header">
            <div className="section-icon billing-signatures">
              {/* Receipt icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
            </div>
            <h2 className="section-title">Billing Statement Signatures</h2>
          </div>
        </div>
        <div className="signature-content">
          <div className="signature-grid">
            <div className="signature-column">
              <div className="input-group">
                <label>Prepared by - Name</label>
                <input type="text" value={signatures.billing.preparedBy.name}
                  onChange={e => handleUpdate('billing', 'preparedBy', { ...signatures.billing.preparedBy, name: e.target.value })}
                  className="form-input" placeholder="Enter name" {...forceInputProps} />
              </div>
              <div className="input-group">
                <label>Title</label>
                <input type="text" value={signatures.billing.preparedBy.title}
                  onChange={e => handleUpdate('billing', 'preparedBy', { ...signatures.billing.preparedBy, title: e.target.value })}
                  className="form-input" placeholder="Enter title" {...forceInputProps} />
              </div>
            </div>
            <div className="signature-column">
              <div className="input-group">
                <label>Approved by - Name</label>
                <input type="text" value={signatures.billing.approvedBy.name}
                  onChange={e => handleUpdate('billing', 'approvedBy', { ...signatures.billing.approvedBy, name: e.target.value })}
                  className="form-input" placeholder="Enter name" {...forceInputProps} />
              </div>
              <div className="input-group">
                <label>Title</label>
                <input type="text" value={signatures.billing.approvedBy.title}
                  onChange={e => handleUpdate('billing', 'approvedBy', { ...signatures.billing.approvedBy, title: e.target.value })}
                  className="form-input" placeholder="Enter title" {...forceInputProps} />
              </div>
            </div>
            <div className="signature-column">
              <div className="input-group">
                <label>Final Approver - Name</label>
                <input type="text" value={signatures.billing.finalApprover.name}
                  onChange={e => handleUpdate('billing', 'finalApprover', { ...signatures.billing.finalApprover, name: e.target.value })}
                  className="form-input" placeholder="Enter name" {...forceInputProps} />
              </div>
              <div className="input-group">
                <label>Title</label>
                <input type="text" value={signatures.billing.finalApprover.title}
                  onChange={e => handleUpdate('billing', 'finalApprover', { ...signatures.billing.finalApprover, title: e.target.value })}
                  className="form-input" placeholder="Enter title" {...forceInputProps} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
})

SignatureForm.displayName = 'SignatureForm'
export default SignatureForm
