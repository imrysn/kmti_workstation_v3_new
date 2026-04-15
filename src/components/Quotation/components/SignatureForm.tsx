import { memo, useState, useEffect, useRef } from 'react'
import type { Signatures } from '../../../hooks/quotation'

interface Props {
  signatures: Signatures
  onUpdate: (type: keyof Signatures, field: string, value: any) => void
}

// Shared props to force input interactivity inside Electron
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

// ── Edit / Done toggle button ─────────────────────────────────────────────────
function EditToggleBtn({ isEditing, onClick }: { isEditing: boolean; onClick: () => void }) {
  return (
    <button
      className="info-card-edit-btn"
      onClick={onClick}
      title={isEditing ? 'Done editing' : 'Edit signatures'}
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
  )
}

// ── Read-only person block ────────────────────────────────────────────────────
function SigPersonDisplay({ role, name, title }: { role: string; name: string; title: string }) {
  return (
    <div className="sig-person-display">
      <div className="sig-person-role">{role}</div>
      <div className="sig-person-name">{name || <span className="sig-person-empty">—</span>}</div>
      {title && <div className="sig-person-title">{title}</div>}
    </div>
  )
}

// ── Quotation Signatures card ─────────────────────────────────────────────────
const QuotationSignaturesCard = memo(({
  signatures,
  onUpdate,
}: {
  signatures: Signatures
  onUpdate: (type: keyof Signatures, field: string, value: any) => void
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const sig = signatures.quotation

  return (
    <div className="section-card">
      <div className="card-header">
        <div className="section-icon quotation-signatures">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 19.5v.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8.5L18 5.5"/>
            <path d="M8 18h1l12.5-12.5a1.7 1.7 0 0 0-2.4-2.4L7 15.5V18"/>
            <path d="M14 7l3 3"/>
          </svg>
        </div>
        <h2 className="section-title">Quotation Signatures</h2>
        <EditToggleBtn isEditing={isEditing} onClick={() => setIsEditing(e => !e)} />
      </div>

      <div className="card-content">
        {isEditing ? (
          <div className="signature-grid">
            {/* Prepared by */}
            <div className="signature-column">
              <div className="input-group">
                <label>Prepared by — Name</label>
                <input type="text" value={sig.preparedBy.name}
                  onChange={e => onUpdate('quotation', 'preparedBy', { ...sig.preparedBy, name: e.target.value })}
                  className="form-input" placeholder="Enter name" {...forceInputProps} />
              </div>
              <div className="input-group">
                <label>Title</label>
                <input type="text" value={sig.preparedBy.title}
                  onChange={e => onUpdate('quotation', 'preparedBy', { ...sig.preparedBy, title: e.target.value })}
                  className="form-input" placeholder="Enter title" {...forceInputProps} />
              </div>
            </div>
            {/* Approved by */}
            <div className="signature-column">
              <div className="input-group">
                <label>Approved by — Name</label>
                <input type="text" value={sig.approvedBy.name}
                  onChange={e => onUpdate('quotation', 'approvedBy', { ...sig.approvedBy, name: e.target.value })}
                  className="form-input" placeholder="Enter name" {...forceInputProps} />
              </div>
              <div className="input-group">
                <label>Title</label>
                <input type="text" value={sig.approvedBy.title}
                  onChange={e => onUpdate('quotation', 'approvedBy', { ...sig.approvedBy, title: e.target.value })}
                  className="form-input" placeholder="Enter title" {...forceInputProps} />
              </div>
            </div>
            {/* Received by */}
            <div className="signature-column">
              <div className="input-group">
                <label>Received by — Label</label>
                <input type="text" value={sig.receivedBy.label}
                  onChange={e => onUpdate('quotation', 'receivedBy', { ...sig.receivedBy, label: e.target.value })}
                  className="form-input" placeholder="Enter label" {...forceInputProps} />
              </div>
              <div className="input-group">
                <label>Title</label>
                <input type="text" value={sig.receivedBy.title || ''}
                  onChange={e => onUpdate('quotation', 'receivedBy', { ...sig.receivedBy, title: e.target.value })}
                  className="form-input" placeholder="Enter title" {...forceInputProps} />
              </div>
            </div>
          </div>
        ) : (
          <div className="sig-display-row">
            <SigPersonDisplay role="Prepared by" name={sig.preparedBy.name} title={sig.preparedBy.title} />
            <div className="sig-display-divider" />
            <SigPersonDisplay role="Approved by" name={sig.approvedBy.name} title={sig.approvedBy.title} />
            <div className="sig-display-divider" />
            <SigPersonDisplay role="Received by" name={sig.receivedBy.label} title={sig.receivedBy.title || ''} />
          </div>
        )}
      </div>
    </div>
  )
})

QuotationSignaturesCard.displayName = 'QuotationSignaturesCard'

// ── Billing Statement Signatures card ────────────────────────────────────────
const BillingSignaturesCard = memo(({
  signatures,
  onUpdate,
}: {
  signatures: Signatures
  onUpdate: (type: keyof Signatures, field: string, value: any) => void
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const sig = signatures.billing

  return (
    <div className="section-card">
      <div className="card-header">
        <div className="section-icon billing-signatures">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
        </div>
        <h2 className="section-title">Billing Statement Signatures</h2>
        <EditToggleBtn isEditing={isEditing} onClick={() => setIsEditing(e => !e)} />
      </div>

      <div className="card-content">
        {isEditing ? (
          <div className="signature-grid">
            {/* Prepared by */}
            <div className="signature-column">
              <div className="input-group">
                <label>Prepared by — Name</label>
                <input type="text" value={sig.preparedBy.name}
                  onChange={e => onUpdate('billing', 'preparedBy', { ...sig.preparedBy, name: e.target.value })}
                  className="form-input" placeholder="Enter name" {...forceInputProps} />
              </div>
              <div className="input-group">
                <label>Title</label>
                <input type="text" value={sig.preparedBy.title}
                  onChange={e => onUpdate('billing', 'preparedBy', { ...sig.preparedBy, title: e.target.value })}
                  className="form-input" placeholder="Enter title" {...forceInputProps} />
              </div>
            </div>
            {/* Approved by */}
            <div className="signature-column">
              <div className="input-group">
                <label>Approved by — Name</label>
                <input type="text" value={sig.approvedBy.name}
                  onChange={e => onUpdate('billing', 'approvedBy', { ...sig.approvedBy, name: e.target.value })}
                  className="form-input" placeholder="Enter name" {...forceInputProps} />
              </div>
              <div className="input-group">
                <label>Title</label>
                <input type="text" value={sig.approvedBy.title}
                  onChange={e => onUpdate('billing', 'approvedBy', { ...sig.approvedBy, title: e.target.value })}
                  className="form-input" placeholder="Enter title" {...forceInputProps} />
              </div>
            </div>
            {/* Final Approver */}
            <div className="signature-column">
              <div className="input-group">
                <label>Final Approver — Name</label>
                <input type="text" value={sig.finalApprover.name}
                  onChange={e => onUpdate('billing', 'finalApprover', { ...sig.finalApprover, name: e.target.value })}
                  className="form-input" placeholder="Enter name" {...forceInputProps} />
              </div>
              <div className="input-group">
                <label>Title</label>
                <input type="text" value={sig.finalApprover.title}
                  onChange={e => onUpdate('billing', 'finalApprover', { ...sig.finalApprover, title: e.target.value })}
                  className="form-input" placeholder="Enter title" {...forceInputProps} />
              </div>
            </div>
          </div>
        ) : (
          <div className="sig-display-row">
            <SigPersonDisplay role="Prepared by" name={sig.preparedBy.name} title={sig.preparedBy.title} />
            <div className="sig-display-divider" />
            <SigPersonDisplay role="Approved by" name={sig.approvedBy.name} title={sig.approvedBy.title} />
            <div className="sig-display-divider" />
            <SigPersonDisplay role="Final Approver" name={sig.finalApprover.name} title={sig.finalApprover.title} />
          </div>
        )}
      </div>
    </div>
  )
})

BillingSignaturesCard.displayName = 'BillingSignaturesCard'

// ── Main export — renders both cards ─────────────────────────────────────────
const SignatureForm = memo(({ signatures, onUpdate }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  // Force Electron window refocus once when an input is focused to ensure interactivity
  useEffect(() => {
    const isElectron = !!(window as any).electronAPI
    if (!isElectron) return

    const handleFocus = () => {
      // Small delay to ensure the event loop processes the focus before we manually refocus
      setTimeout(() => {
        if (!document.hasFocus()) {
          window.focus()
        }
      }, 50)
    }

    window.addEventListener('focusin', handleFocus)
    return () => window.removeEventListener('focusin', handleFocus)
  }, [])

  // Ensure inputs in signature cards stay interactive inside Electron
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const handleInputClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' && target.closest('.section-card')) {
        ;(target as HTMLInputElement).readOnly = false
        ;(target as HTMLInputElement).focus()
      }
    }
    container.addEventListener('click', handleInputClick, true)
    return () => container.removeEventListener('click', handleInputClick, true)
  }, [])

  return (
    <div className="sig-cards-layout" ref={containerRef}>
      <QuotationSignaturesCard signatures={signatures} onUpdate={onUpdate} />
      <BillingSignaturesCard signatures={signatures} onUpdate={onUpdate} />
    </div>
  )
})

SignatureForm.displayName = 'SignatureForm'
export default SignatureForm
