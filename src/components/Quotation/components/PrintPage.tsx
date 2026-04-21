/**
 * PrintPage.tsx
 * ─────────────────────────────────────────────────────────────────
 * Renders one A4 page of a quotation or billing statement.
 *
 * PAGINATION MODEL (v3.1)
 * ───────────────────────
 * PrintPreviewModal splits the full task list into chunks of
 * LAYOUT.TASKS_PER_PAGE and renders one <PrintPage> per chunk.
 * There is no longer a hard 2-page cap — pages are generated
 * dynamically from the actual task count.
 *
 * Props:
 *  pageIndex  — 0-based page number. Page 0 shows the full header
 *               (company info, client block, quotation details).
 *               Later pages show a compact continuation header.
 *  isLastPage — controls whether the grand-total footer / signature
 *               block and "NOTHING FOLLOW" row are rendered.
 */

import { memo, useCallback } from 'react'
import type {
  Task, CompanyInfo, ClientInfo, QuotationDetails, BillingDetails,
  Signatures, ManualOverrides, BaseRates,
} from '../../../hooks/quotation'
import { LAYOUT } from '../constants'
import PrintHeader from './PrintHeader'

// ── Types ──────────────────────────────────────────────────────────────────

interface PrintTask extends Task {
  unitPage?: number
}

interface Props {
  printMode: 'quotation' | 'billing'
  companyInfo: CompanyInfo
  clientInfo: ClientInfo
  quotationDetails: QuotationDetails
  billingDetails: BillingDetails
  pageTasks: PrintTask[]
  pageTotals: number[]
  startIndex: number
  isLastPage: boolean
  pageIndex: number
  grandTotal: number
  overheadTotal: number
  signatures: Signatures
  manualOverrides: ManualOverrides
  baseRates: BaseRates
  onUnitEdit?: (taskId: number, newValue: number) => void
}

const BANK_LABEL_MAP: Array<{ key: keyof BillingDetails; label: string }> = [
  { key: 'bankName',      label: 'BANK NAME:' },
  { key: 'accountName',   label: 'SAVINGS ACCOUNT NAME:' },
  { key: 'accountNumber', label: 'SAVINGS ACCOUNT NUMBER:' },
  { key: 'bankAddress',   label: 'BANK ADDRESS:' },
  { key: 'swiftCode',     label: 'SWIFT CODE:' },
  { key: 'branchCode',    label: 'BRANCH CODE:' },
]

// ── Component ──────────────────────────────────────────────────────────────

const PrintPage = memo(({
  printMode, companyInfo, clientInfo, quotationDetails, billingDetails,
  pageTasks, pageTotals, startIndex, isLastPage, pageIndex,
  grandTotal, overheadTotal,
  signatures, manualOverrides, baseRates,
  onUnitEdit,
}: Props) => {
  const isFirstPage = pageIndex === 0
  const isContinuation = !isFirstPage

  const fmt = useCallback((n: number) => `¥${n.toLocaleString()}`, [])

  const resolveUnitPage = useCallback((task: PrintTask): number => {
    const override = (manualOverrides?.tasks || {})[task.id]
    if (override?.unitPage !== undefined) return override.unitPage
    return task.unitPage ?? 1
  }, [manualOverrides])

  const showAdmin = isLastPage && baseRates.overheadPercentage > 0
  const contentRowsCount = pageTasks.length + (showAdmin ? 1 : 0) + 1 // Tasks + Admin? + Nothing Follow
  
  // How many blank filler rows to add below the task list on the last page.
  // Enforcement: 1st page must have 10 rows minimum INCLUDING computed tasks.
  // If tasks are >= 10, we add 0 filler rows on the last page to prioritize signature space,
  // especially for the 14-task single-page requirement.
  const fillerRowCount = isLastPage
    ? Math.max(0, 10 - contentRowsCount)
    : 0

  // Apply compressed margins when page is nearly full
  const isCompressed = pageTasks.length >= LAYOUT.COMPRESSION_THRESHOLD

  // ── Render helpers ─────────────────────────────────────────────

  const renderTable = () => (
    <>
      <table className="table-visual">
        <thead>
          <tr>
            <th className="col-no">NO.</th>
            <th className="col-reference">REFERENCE NO.</th>
            <th className="col-description">DESCRIPTION</th>
            <th className="col-unitpage">UNIT (PAGE)</th>
            <th className="col-type">TYPE</th>
            <th className="col-price">PRICE</th>
          </tr>
        </thead>
        <tbody>
          {pageTasks.map((task, i) => (
            <tr key={task.id}>
              <td>{startIndex + i + 1}</td>
              <td>{task.referenceNumber || ''}</td>
              <td className="description-cell">{task.description}</td>
              <td className="col-unitpage">
                <input
                  type="text"
                  inputMode="numeric"
                  className="ppm-unit-input"
                  value={resolveUnitPage(task) === 0 ? '' : resolveUnitPage(task)}
                  onChange={e => {
                    const val = parseInt(e.target.value.replace(/\D/g, '')) || 0
                    onUnitEdit?.(task.id, val)
                  }}
                />
              </td>
              <td>{task.type || '3D'}</td>
              <td className="price-cell">{fmt(pageTotals[i])}</td>
            </tr>
          ))}

          {isLastPage && (
            <>
              {showAdmin && (
                <tr>
                  <td />
                  <td>Administrative overhead</td>
                  <td className="description-cell" />
                  <td /><td />
                  <td className="price-cell">{fmt(overheadTotal)}</td>
                </tr>
              )}
              <tr>
                <td /><td />
                <td className="description-cell nothing-follow" style={{ color: '#888', fontStyle: 'italic' }}>
                  --- NOTHING FOLLOW ---
                </td>
                <td /><td /><td />
              </tr>
              {Array.from({ length: fillerRowCount }, (_, i) => (
                <tr key={`empty-${i}`}>
                  <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                  <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 'bold', fontSize: '14px' }}>
                <td colSpan={5} style={{ textAlign: 'center' }}>Total Amount</td>
                <td className="price-cell">{fmt(grandTotal)}</td>
              </tr>
            </>
          )}

          {/* Continuation indicator on non-final pages */}
          {!isLastPage && (
            <tr aria-hidden="true" style={{ display: 'none' }}><td /></tr>
          )}
        </tbody>
      </table>

      {!isLastPage && (
        <div className="nothing-follow" style={{
          textAlign: 'center', color: '#888', fontWeight: 'bold',
          fontStyle: 'italic', padding: '50px 0', letterSpacing: '1px', fontSize: '11px',
        }}>
          --- CONTINUED ON NEXT PAGE ---
        </div>
      )}
    </>
  )

  const renderSignatures = () => {
    if (!isLastPage) return null
    return printMode === 'billing' ? (
      <div className="signatures-visual">
        <div className="signature-row-visual">
          <div className="signature-left-visual">
            <div className="sig-label-visual">Prepared by:</div>
            <div className="sig-line-visual" />
            <div className="sig-name-visual">{signatures.billing.preparedBy.name}</div>
            <div className="sig-title-visual">{signatures.billing.preparedBy.title}</div>
          </div>
          <div className="signature-right-visual">
            <div className="sig-label-visual">Approved by:</div>
            <div className="sig-line-visual" />
            <div className="sig-name-visual">{signatures.billing.approvedBy.name}</div>
            <div className="sig-title-visual">{signatures.billing.approvedBy.title}</div>
          </div>
        </div>
        <div className="signature-row-visual">
          <div className="signature-left-visual" />
          <div className="signature-right-visual">
            <div className="sig-line-visual" />
            <div className="sig-name-visual">{signatures.billing.finalApprover.name}</div>
            <div className="sig-title-visual">{signatures.billing.finalApprover.title}</div>
          </div>
        </div>
      </div>
    ) : (
      <div className="signatures-visual">
        <div className="signature-row-visual">
          <div className="signature-left-visual">
            <div className="sig-label-visual">Prepared by:</div>
            <div className="sig-line-visual" />
            <div className="sig-name-visual">{signatures.quotation.preparedBy.name}</div>
            <div className="sig-title-visual">{signatures.quotation.preparedBy.title}</div>
          </div>
          <div className="signature-right-visual" />
        </div>
        <div className="signature-row-visual">
          <div className="signature-left-visual">
            <div className="sig-label-visual">Approved by:</div>
            <div className="sig-line-visual" />
            <div className="sig-name-visual">{signatures.quotation.approvedBy.name}</div>
            <div className="sig-title-visual">{signatures.quotation.approvedBy.title}</div>
          </div>
          <div className="signature-right-visual">
            <div className="sig-label-visual">Received by:</div>
            <div className="sig-line-visual" />
            <div className="sig-name-visual">{signatures.quotation.receivedBy.label}</div>
          </div>
        </div>
      </div>
    )
  }

  const renderFooter = () => {
    if (printMode === 'billing' && !isLastPage) return null
    return printMode === 'billing' ? (
      <div className="footer-visual">
        <div className="bank-details-section">
          <div className="bank-details-title">BANK DETAILS (Yen)</div>
          <div className="bank-details-grid">
            {BANK_LABEL_MAP.map(({ key, label }) => {
              const value = billingDetails[key] as string
              if (!value) return null
              return (
                <div key={key} className="bank-detail-row">
                  <span className="bank-label">{label}</span>
                  <span className="bank-value">{value}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    ) : (
      <div className="footer-visual">
        <div>cc: admin/acctg/Engineering</div>
        <div>Admin Quotation Template v3.0-2026</div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div
      className={[
        'quotation-visual-exact',
        `mode-${printMode}`,
        `task-count-${pageTasks.length}`,
        isContinuation ? 'page-break' : '',
        isCompressed   ? 'compressed' : '',
      ].filter(Boolean).join(' ')}
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      <div className="q-top-content">
        <PrintHeader
          printMode={printMode}
          companyInfo={companyInfo}
          quotationDetails={quotationDetails}
          isSecondPage={isContinuation}
        />

        {/* Billing details block — first page only */}
        {printMode === 'billing' && isFirstPage && (
          <div className="quotation-details-visual">
            <div className="detail-row-visual">
              <span className="detail-label-visual">DATE:</span>
              <span className="detail-value-visual">{quotationDetails.date || ''}</span>
            </div>
            <div className="detail-row-visual">
              <span className="detail-label-visual">Invoice No.:</span>
              <span className="detail-value-visual">{billingDetails.invoiceNo || ''}</span>
            </div>
            <div className="detail-row-visual">
              <span className="detail-label-visual">Quotation No.:</span>
              <span className="detail-value-visual">{quotationDetails.quotationNo || ''}</span>
            </div>
            <div className="detail-row-visual">
              <span className="detail-label-visual">Job Order No.:</span>
              <span className="detail-value-visual">{billingDetails.jobOrderNo || ''}</span>
            </div>
          </div>
        )}

        {/* Client contact block — first page only */}
        {isFirstPage && (
          <div className="contact-section-visual">
            {printMode !== 'billing'
              ? <div className="quotation-to-visual">Quotation to:</div>
              : <div className="quotation-to-visual" />
            }
            <div className="client-details-visual">
              <div className="client-company-name">{clientInfo.company}</div>
              <div className="client-person-name">{clientInfo.contact}</div>
              {clientInfo.address}<br />{clientInfo.phone}
            </div>
          </div>
        )}

        {renderTable()}

        {isLastPage && printMode === 'quotation' && (
          <div className="terms-visual">
            Upon receipt of this quotation sheet, kindly send us one copy with your signature.<br /><br />
            The price will be changed without prior notice due to frequent changes of conversion rate.
          </div>
        )}
      </div>

      <div className="q-bottom-content" style={{ marginTop: 'auto' }}>
        {renderSignatures()}
        {renderFooter()}
      </div>
    </div>
  )
})

PrintPage.displayName = 'PrintPage'
export default PrintPage
