import { memo, useCallback } from 'react'
import type { Task, CompanyInfo, ClientInfo, QuotationDetails, BillingDetails, Signatures, ManualOverrides, BaseRates } from '../../../hooks/quotation'
import { getUnitPageCount } from '../../../utils/quotation'
import PrintHeader from './PrintHeader'

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
  grandTotal: number
  overheadTotal: number
  actualTaskCount: number
  maxRows: number
  signatures: Signatures
  manualOverrides: ManualOverrides
  baseRates: BaseRates
  isSecondPage?: boolean
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

const PrintPage = memo(({
  printMode, companyInfo, clientInfo, quotationDetails, billingDetails,
  pageTasks, pageTotals, startIndex, isLastPage,
  grandTotal, overheadTotal, actualTaskCount, maxRows,
  signatures, manualOverrides, baseRates, isSecondPage = false,
  onUnitEdit
}: Props) => {

  const fmt = useCallback((n: number) => `¥${n.toLocaleString()}`, [])

  const resolveUnitPage = useCallback((task: PrintTask): number => {
    // If a manual override for unitPage exists, it takes absolute precedence.
    // Otherwise, use the unitPage value passed in the PrintTask object.
    const override = (manualOverrides?.tasks || {})[task.id]
    if (override?.unitPage !== undefined) return override.unitPage
    return task.unitPage ?? 1
  }, [manualOverrides])

  const renderTable = () => {
    const emptyCount = isLastPage
      ? (startIndex === 0
        ? Math.max(0, maxRows - pageTasks.length - (baseRates.overheadPercentage > 0 ? 1 : 0) - 1)
        : 10 - pageTasks.length - (baseRates.overheadPercentage > 0 ? 1 : 0) - 1)
      : 0

    return (
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
                    onChange={(e) => {
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
                {baseRates.overheadPercentage > 0 && (
                  <tr>
                    <td></td>
                    <td>Administrative overhead</td>
                    <td className="description-cell"></td>
                    <td></td>
                    <td></td>
                    <td className="price-cell">{fmt(overheadTotal)}</td>
                  </tr>
                )}
                <tr>
                  <td /><td />
                  <td className="description-cell nothing-follow" style={{ color: '#888' }}>--- NOTHING FOLLOW ---</td>
                  <td /><td /><td />
                </tr>
                {Array.from({ length: Math.max(0, emptyCount) }, (_, i) => (
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
            {!isLastPage && <tr aria-hidden="true" style={{ display: 'none' }}><td /></tr>}
          </tbody>
        </table>
        {!isLastPage && (
          <div className="nothing-follow" style={{ textAlign: 'center', color: '#888', fontWeight: 'bold', fontStyle: 'italic', padding: '50px 0', letterSpacing: '1px', fontSize: '11px' }}>
            --- CONTINUED ON NEXT PAGE ---
          </div>
        )}
      </>
    )
  }

  const renderSignatures = () => printMode === 'billing' ? (
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

  return (
    <div
      className={`quotation-visual-exact mode-${printMode}${isSecondPage ? ' page-break' : ''}${isLastPage && !isSecondPage ? ` task-count-${actualTaskCount}` : ''}`}
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      <div className="q-top-content">
        <PrintHeader
          printMode={printMode}
          companyInfo={companyInfo}
          quotationDetails={quotationDetails}
          isSecondPage={isSecondPage}
        />

        {printMode === 'billing' && !isSecondPage && (
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

        {!isSecondPage && (
          <div className="contact-section-visual">
            {printMode !== 'billing'
              ? <div className="quotation-to-visual">Quotation to:</div>
              : <div className="quotation-to-visual"></div>
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
        {isLastPage && renderSignatures()}
        {renderFooter()}
      </div>
    </div>
  )
})

PrintPage.displayName = 'PrintPage'
export default PrintPage
