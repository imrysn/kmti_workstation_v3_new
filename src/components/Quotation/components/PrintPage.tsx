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
            {(() => {
              if (layoutVariant === 'kemco') {
                interface KemcoRenderRow {
                  type: 'assembly' | 'subgroup'
                  tasks: Task[]
                  assemblyTask: Task
                }
                const kemcoRows: KemcoRenderRow[] = []
                let currentAssembly: Task | null = null

                for (let idx = 0; idx < pageTasks.length; idx++) {
                  const t = pageTasks[idx]
                  if (t.level === 0) {
                    currentAssembly = t
                    kemcoRows.push({
                      type: 'assembly',
                      tasks: [t],
                      assemblyTask: t
                    })
                  } else {
                    if (!currentAssembly || currentAssembly.id !== t.parentId) {
                      currentAssembly = allTasks.find(at => at.id === t.parentId && at.level === 0) || t
                    }
                    
                    const lastRow = kemcoRows[kemcoRows.length - 1]
                    if (lastRow && lastRow.type === 'subgroup' && lastRow.assemblyTask.id === currentAssembly.id && lastRow.tasks.length < 2) {
                      lastRow.tasks.push(t)
                    } else {
                      kemcoRows.push({
                        type: 'subgroup',
                        tasks: [t],
                        assemblyTask: currentAssembly
                      })
                    }
                  }
                }

                const getSubgroupSpan = (rowIndex: number) => {
                  const row = kemcoRows[rowIndex]
                  if (row.type !== 'subgroup') return 0
                  
                  if (rowIndex > 0 && kemcoRows[rowIndex - 1].type === 'subgroup' && kemcoRows[rowIndex - 1].assemblyTask.id === row.assemblyTask.id) {
                    return 0
                  }
                  
                  let span = 1
                  for (let j = rowIndex + 1; j < kemcoRows.length; j++) {
                    if (kemcoRows[j].type === 'subgroup' && kemcoRows[j].assemblyTask.id === row.assemblyTask.id) {
                      span++
                    } else {
                      break
                    }
                  }
                  return span
                }

                return kemcoRows.map((row, rowIndex) => {
                  const targetId = row.assemblyTask.id
                  const resRef = resolveField(row.assemblyTask, 'referenceNumber', row.assemblyTask.referenceNumber || '')
                  const resMachine = resolveField(row.assemblyTask, 'machineCode', row.assemblyTask.machineCode || '')
                  const resPercent = resolveField(row.assemblyTask, 'percentage', assemblyPercentages[targetId] || 0)
                  
                  if (row.type === 'assembly') {
                    const resDesc = resolveField(row.assemblyTask, 'description', row.assemblyTask.description)
                    return (
                      <tr key={`assembly-${row.assemblyTask.id}`} className="level-0 print-assembly-header">
                        <td>{startIndex + rowIndex + 1}</td>
                        <td colSpan={6} style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9', textAlign: 'left', paddingLeft: '8px' }}>
                          <input 
                            type="text" 
                            className="ppm-unit-input" 
                            style={{ textAlign: 'left', width: '100%', fontWeight: 'bold' }} 
                            value={resDesc} 
                            onChange={e => onTaskOverride?.(targetId, { description: e.target.value })} 
                          />
                        </td>
                        {rowIndex === 0 && (
                          <td className="price-cell kemco-merged-price" rowSpan={kemcoRows.length} style={{ textAlign: 'right', verticalAlign: 'middle', borderLeft: '1px solid #000', paddingRight: '8px' }}>
                            ¥{(1848400).toLocaleString()}
                          </td>
                        )}
                      </tr>
                    )
                  }

                  const span = getSubgroupSpan(rowIndex)
                  const resUnit = row.tasks.map(t => resolveField(t, 'unitCode', t.unitCode || '')).filter(Boolean).join(', ')
                  const resType = resolveField(row.tasks[0], 'type', row.tasks[0].type || '3D')

                  return (
                    <tr key={`subgroup-${rowIndex}`} className="level-1">
                      <td>{startIndex + rowIndex + 1}</td>
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
                        <input 
                          type="text" 
                          className="ppm-unit-input" 
                          style={{ textAlign: 'center', width: '100%' }} 
                          value={resUnit} 
                          onChange={e => {
                            const parts = e.target.value.split(',').map(s => s.trim())
                            row.tasks.forEach((t, tIdx) => {
                              onTaskOverride?.(t.id, { unitCode: parts[tIdx] || '' })
                            })
                          }} 
                        />
                      </td>
                      <td>&nbsp;</td>
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
                        <input type="text" className="ppm-unit-input" style={{ textAlign: 'center', width: '100%' }} value={resType} onChange={e => onTaskOverride?.(row.tasks[0].id, { type: e.target.value })} />
                      </td>
                      {rowIndex === 0 && (
                        <td className="price-cell kemco-merged-price" rowSpan={kemcoRows.length} style={{ textAlign: 'right', verticalAlign: 'middle', borderLeft: '1px solid #000', paddingRight: '8px' }}>
                          ¥{(1848400).toLocaleString()}
                        </td>
                      )}
                    </tr>
                  )
                })
              }

              // Normal path (special)
              return pageTasks.map((task, i) => {
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
