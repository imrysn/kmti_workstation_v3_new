import { memo } from 'react'
import type { CompanyInfo, QuotationDetails, BillingDetails, Task, Signatures, ManualOverrides } from '../../../hooks/quotation'
import PrintHeader from './PrintHeader'

interface PrintPageProps {
  pageTasks: Task[]
  startIndex: number
  isFirstPage: boolean
  isLastPage: boolean
  isContinuation: boolean
  companyInfo: CompanyInfo
  clientInfo: any
  quotationDetails: QuotationDetails
  billingDetails: BillingDetails
  signatures: Signatures
  manualOverrides: ManualOverrides
  grandTotal: number
  overheadTotal: number
  printMode: 'quotation' | 'billing'
  isCompressed?: boolean
  showAdmin?: boolean
  fillerRowCount: number
  pageTotals: number[]
  layoutVariant?: 'special' | 'kemco'
  lastAssemblyId?: number
  onUnitEdit?: (taskId: number, value: number) => void
}

export const PrintPage = memo(({
  pageTasks, startIndex, isFirstPage, isLastPage, isContinuation,
  companyInfo, clientInfo, quotationDetails, billingDetails,
  signatures, manualOverrides,
  grandTotal, overheadTotal, printMode,
  isCompressed, showAdmin, fillerRowCount, pageTotals,
  layoutVariant = 'special',
  lastAssemblyId,
  onUnitEdit
}: PrintPageProps) => {

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  const resolveUnitPage = (task: Task) => {
    return manualOverrides.tasks[task.id]?.unitPage !== undefined
      ? manualOverrides.tasks[task.id].unitPage
      : (task.minutes || 0)
  }

  const renderSignatures = () => {
    if (!isLastPage) return null
    return printMode === 'billing' ? (
      <div className="signatures-visual">
        <div className="signature-row-visual">
          <div className="signature-left-visual">
            <div className="sig-label-visual">Prepared by:</div>
            <div className="sig-line-visual" />
            <div className="sig-name-visual">{signatures.billing.preparedBy.name}</div>
          </div>
          <div className="signature-right-visual">
            <div className="sig-label-visual">Approved by:</div>
            <div className="sig-line-visual" />
            <div className="sig-name-visual">{signatures.billing.approvedBy.name}</div>
          </div>
        </div>
        <div className="signature-row-visual">
          <div className="signature-left-visual" />
          <div className="signature-right-visual">
            <div className="sig-line-visual" />
            <div className="sig-name-visual">{signatures.billing.finalApprover.name}</div>
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
          <div className="signature-right-visual">
            {layoutVariant === 'kemco' ? (
              <>
                <div className="sig-label-visual">Checked by:</div>
                <div className="sig-line-visual" />
                <div className="sig-name-visual">{signatures.quotation.checkedBy.name}</div>
                <div className="sig-title-visual">{signatures.quotation.checkedBy.title}</div>
              </>
            ) : null}
          </div>
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
            <div className="sig-name-visual">{signatures.quotation.receivedBy.label || '(Signature Over Printed Name)'}</div>
            <div className="sig-title-visual">{signatures.quotation.receivedBy.title}</div>
          </div>
        </div>
      </div>
    )
  }

  const renderFooter = () => {
    if (!isLastPage) return null
    return printMode === 'billing' ? (
      <div className="bank-details-section">
        <div className="bank-details-title">BANK ACCOUNT DETAILS:</div>
        <div className="bank-details-grid">
          <div className="bank-details-row"><span className="bank-label">Bank Name:</span> <span className="bank-value">METROPOLITAN BANK AND TRUST CO.</span></div>
          <div className="bank-details-row"><span className="bank-label">Branch:</span> <span className="bank-value">CARMONA BRANCH</span></div>
          <div className="bank-details-row"><span className="bank-label">Account Name:</span> <span className="bank-value">KMTI MANUFACTURING AND TRADING INC.</span></div>
          <div className="bank-details-row"><span className="bank-label">Account Number:</span> <span className="bank-value">554-3-55410115-3</span></div>
          <div className="bank-details-row"><span className="bank-label">TIN No.:</span> <span className="bank-value">008-831-508-000</span></div>
        </div>
      </div>
    ) : (
      <div className="footer-visual">
        <div>cc: admin/acctg/Engineering</div>
        <div>Admin Quotation Template v3.0-2026</div>
      </div>
    )
  }

  const renderTable = () => (
    <>
      <table className="table-visual">
        <thead>
          {layoutVariant === 'kemco' ? (
            <tr>
              <th className="col-no">No.</th>
              <th className="col-reference">Construction<br />No.</th>
              <th className="col-code">Machine<br />Code</th>
              <th className="col-unit">Unit<br />Code</th>
              <th className="col-description">DESCRIPTION</th>
              <th className="col-percent">Percent<br />%</th>
              <th className="col-type">Type</th>
              <th className="col-price">Price</th>
            </tr>
          ) : (
            <tr>
              <th className="col-no">NO.</th>
              <th className="col-reference">REFERENCE NO.</th>
              <th className="col-description">DESCRIPTION</th>
              <th className="col-unitpage">UNIT<br />(PAGE)</th>
              <th className="col-type">TYPE</th>
              <th className="col-price">PRICE</th>
            </tr>
          )}
        </thead>
        <tbody>
          {pageTasks.map((task, i) => {
            if (layoutVariant === 'kemco') {
              const indent = (task.level || 0) * 12
              return (
                <tr key={task.id} className={`level-${task.level} ${task.level === 0 ? 'print-assembly-header' : ''}`}>
                  <td>{startIndex + i + 1}</td>
                  <td className="col-ref-cell">{task.referenceNumber || ''}</td>
                  <td className="col-machine-cell">{task.level === 0 ? (task.machineCode || '') : ''}</td>
                  <td className="col-unit-cell">{task.level === 1 ? (task.unitCode || '') : ''}</td>
                  <td className="description-cell">
                    <div className="desc-indent-wrapper" style={{ '--indent': `${indent}px` } as React.CSSProperties}>
                      {task.level! > 0 && <span className="desc-arrow">↳</span>}
                      <span className="desc-text">{task.description}</span>
                    </div>
                  </td>
                  <td>{task.level === 0 ? (task.percentage ? `${task.percentage}%` : '') : ''}</td>
                  <td>{task.type || '3D'}</td>
                  <td className="price-cell">
                    {task.id === lastAssemblyId ? `¥${(1848400).toLocaleString()}` : ''}
                  </td>
                </tr>
              )
            }
            return (
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
            )
          })}

          {isLastPage && (
            <>
              {showAdmin && layoutVariant !== 'kemco' && (
                <tr className="admin-overhead-row">
                  <td />
                  <td>Administrative Overhead</td>
                  <td />
                  <td />
                  <td />
                  <td className="price-cell">{fmt(overheadTotal)}</td>
                </tr>
              )}
              {layoutVariant === 'kemco' && (
                <tr className="leasing-fee-row">
                  <td /><td /><td /><td />
                  <td className="description-cell text-red">Leasing fee</td>
                  <td /><td />
                  <td className="price-cell text-red">- ¥{(148400).toLocaleString()}</td>
                </tr>
              )}
              {layoutVariant !== 'kemco' && (
                <tr className="nothing-follow-row">
                  <td />
                  <td />
                  <td className="nothing-follow">
                    ----- NOTHING FOLLOW -----
                  </td>
                  <td />
                  <td />
                  <td />
                </tr>
              )}
              {Array.from({ length: fillerRowCount }, (_, i) => (
                <tr key={`empty-${i}`}>
                  {Array.from({ length: layoutVariant === 'kemco' ? 8 : 6 }).map((_, j) => <td key={j}>&nbsp;</td>)}
                </tr>
              ))}
              <tr className="total-amount-row">
                <td colSpan={layoutVariant === 'kemco' ? 7 : 5} className="total-label-cell">Total Amount</td>
                <td className="price-cell">
                  {layoutVariant === 'kemco' ? `¥${(1700000).toLocaleString()}` : fmt(grandTotal)}
                </td>
              </tr>
            </>
          )}

          {!isLastPage && (
            <tr aria-hidden="true" style={{ display: 'none' }}><td /></tr>
          )}
        </tbody>
      </table>

      {!isLastPage && (
        <div className="continuation-note">
          ---- CONTINUED ON NEXT PAGE ----
        </div>
      )}
    </>
  )

  return (
    <div
      className={[
        'quotation-visual-exact',
        `mode-${printMode}`,
        `variant-${layoutVariant}`,
        `task-count-${pageTasks.length}`,
        isContinuation ? 'page-break' : '',
        isCompressed ? 'compressed' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="q-top-content">
        <PrintHeader
          printMode={printMode}
          companyInfo={companyInfo}
          quotationDetails={quotationDetails}
          isSecondPage={isContinuation}
        />

        {printMode === 'quotation' && isFirstPage && (
          <div className="qh-meta-block">
            <div className="qh-meta-row">
              <span className="qh-meta-label">Quotation NO.:</span>
              <span className="qh-meta-value">{quotationDetails.quotationNo || ''}</span>
            </div>
            <div className="qh-meta-row">
              <span className="qh-meta-label">REFERENCE NO.:</span>
              <span className="qh-meta-value">{quotationDetails.referenceNo || ''}</span>
            </div>
            <div className="qh-meta-row">
              <span className="qh-meta-label">DATE:</span>
              <span className="qh-meta-value">{quotationDetails.date || ''}</span>
            </div>
          </div>
        )}

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

      <div className="q-bottom-content">
        {renderSignatures()}
        {renderFooter()}
      </div>
    </div>
  )
})

PrintPage.displayName = 'PrintPage'
export default PrintPage
