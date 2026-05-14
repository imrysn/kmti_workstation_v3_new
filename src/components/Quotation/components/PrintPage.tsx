import { memo } from 'react'
import type { CompanyInfo, QuotationDetails, BillingDetails, Task, Signatures, ManualOverrides, TaskOverrides } from '../../../hooks/quotation'
import PrintHeader from './PrintHeader'
import { getUnitPageCount } from '../../../utils/quotation'

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
  onTaskOverride?: (taskId: number, updates: Partial<TaskOverrides>) => void
  allTasks: Task[]
}

export const PrintPage = memo(({
  pageTasks, startIndex, isFirstPage, isLastPage, isContinuation,
  companyInfo, clientInfo, quotationDetails, billingDetails,
  signatures, manualOverrides,
  grandTotal, overheadTotal, printMode,
  isCompressed, showAdmin, fillerRowCount, pageTotals,
  layoutVariant = 'special',
  lastAssemblyId,
  onTaskOverride,
  allTasks
}: PrintPageProps) => {

  const fmt = (n: number) => '¥' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  const resolveField = (task: Task, field: string, defaultValue: any) => {
    const override = manualOverrides.tasks[task.id] as any
    return override?.[field] !== undefined ? override[field] : defaultValue
  }

  const resolveUnitPage = (task: Task) => getUnitPageCount(task.id, allTasks, manualOverrides)

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

  const renderTable = () => {
    const assemblyPercentages: Record<number, number> = {}
    if (layoutVariant === 'kemco' && allTasks.length > 0) {
      const childrenMap: Record<number, number[]> = {}
      allTasks.forEach(t => {
        if (t.parentId !== null) {
          if (!childrenMap[t.parentId]) childrenMap[t.parentId] = []
          childrenMap[t.parentId].push(t.id)
        }
      })

      const countSubtree = (tid: number): number => {
        let count = 1
        const children = childrenMap[tid] || []
        children.forEach(cid => {
          count += countSubtree(cid)
        })
        return count
      }

      const topLevelCounts: { id: number, count: number }[] = allTasks
        .filter(t => t.level === 0)
        .map(t => ({ id: t.id, count: countSubtree(t.id) }))
      
      const totalWeight = topLevelCounts.reduce((acc, t) => acc + t.count, 0)
      
      topLevelCounts.forEach(t => {
        assemblyPercentages[t.id] = totalWeight > 0 ? (t.count / totalWeight) * 100 : 0
      })
    }

    return (
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
                const indent = 0
                const getConstNoSpan = (idx: number) => {
                  const t = pageTasks[idx]
                  // If it's the first row and a continuation of previous page assembly, it should merge
                  const isContinuationOfPrev = idx === 0 && isContinuation && t.level !== 0 && t.parentId === lastAssemblyId
                  
                  if (!isContinuationOfPrev && t.level !== 0 && idx > 0) return 0
                  
                  let span = 1
                  for (let j = idx + 1; j < pageTasks.length; j++) {
                    if (pageTasks[j].level === 0) break
                    span++
                  }
                  return span
                }

                const span = getConstNoSpan(i)
                let targetId = task.id
                let groupRef = task.referenceNumber || ''
                let groupMachine = task.level === 0 ? (task.machineCode || '') : ''
                let groupPercentage = task.level === 0 ? (assemblyPercentages[task.id] || 0) : 0
                
                if (task.level === 1 && i === 0) {
                  const fullIdx = allTasks.findIndex(at => at.id === task.id)
                  if (fullIdx !== -1) {
                    for (let k = fullIdx - 1; k >= 0; k--) {
                      if (allTasks[k].level === 0) {
                        targetId = allTasks[k].id
                        groupRef = allTasks[k].referenceNumber || ''
                        groupMachine = allTasks[k].machineCode || ''
                        groupPercentage = assemblyPercentages[allTasks[k].id] || 0
                        break
                      }
                    }
                  }
                }

                const resRef = resolveField({ id: targetId } as Task, 'referenceNumber', groupRef)
                const resMachine = resolveField({ id: targetId } as Task, 'machineCode', groupMachine)
                const resUnit = resolveField(task, 'unitCode', task.level === 1 ? (task.unitCode || '') : '')
                const resDesc = resolveField(task, 'description', task.description)
                const resPercent = resolveField({ id: targetId } as Task, 'percentage', groupPercentage)
                const resType = resolveField(task, 'type', task.type || '3D')

                return (
                  <tr key={task.id} className={`level-${task.level} ${task.level === 0 ? 'print-assembly-header' : ''}`}>
                    <td>{startIndex + i + 1}</td>
                    {span > 0 && (
                      <>
                        <td className="col-ref-cell" rowSpan={span} style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                          <input type="text" className="ppm-unit-input" style={{ textAlign: 'center', width: '100%', fontWeight: 'bold' }} value={resRef} onChange={e => onTaskOverride?.(targetId, { referenceNumber: e.target.value })} />
                        </td>
                        <td className="col-machine-cell" rowSpan={span} style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                          <input type="text" className="ppm-unit-input" style={{ textAlign: 'center', width: '100%', fontWeight: 'bold' }} value={resMachine} onChange={e => onTaskOverride?.(targetId, { machineCode: e.target.value })} />
                        </td>
                      </>
                    )}
                    <td className="col-unit-cell">
                      {task.level === 1 && (
                        <input type="text" className="ppm-unit-input" style={{ textAlign: 'center', width: '100%' }} value={resUnit} onChange={e => onTaskOverride?.(task.id, { unitCode: e.target.value })} />
                      )}
                    </td>
                    <td className="description-cell">
                      <div className="desc-indent-wrapper" style={{ '--indent': `${indent}px` } as React.CSSProperties}>
                        <input type="text" className="ppm-unit-input" style={{ textAlign: 'left', width: '100%' }} value={resDesc} onChange={e => onTaskOverride?.(task.id, { description: e.target.value })} />
                      </div>
                    </td>
                    {span > 0 && (
                      <td rowSpan={span} style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        <input
                          type="text"
                          className="ppm-unit-input"
                          style={{ textAlign: 'center', width: '100%' }}
                          value={typeof resPercent === 'number' ? `${resPercent.toFixed(0)}%` : resPercent}
                          onChange={e => onTaskOverride?.(targetId, { percentage: parseFloat(e.target.value.replace('%', '')) || 0 })}
                        />
                      </td>
                    )}
                    <td>
                      <input type="text" className="ppm-unit-input" style={{ textAlign: 'center', width: '100%' }} value={resType} onChange={e => onTaskOverride?.(task.id, { type: e.target.value })} />
                    </td>
                    {i === 0 && (
                      <td className="price-cell kemco-merged-price" rowSpan={pageTasks.length} style={{ textAlign: 'right', verticalAlign: 'middle', borderLeft: '1px solid #000', paddingRight: '8px' }}>
                        ¥{(1848400).toLocaleString()}
                      </td>
                    )}
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
                      onTaskOverride?.(task.id, { unitPage: val })
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
  }

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
