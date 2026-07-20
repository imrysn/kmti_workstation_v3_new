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
  onQuotationDetailsChange?: (updates: Partial<QuotationDetails>) => void
  onBillingDetailsChange?: (updates: Partial<BillingDetails>) => void
}

export const PrintPage = memo(({
  pageTasks, startIndex, isFirstPage, isLastPage, isContinuation,
  companyInfo, clientInfo, quotationDetails, billingDetails,
  signatures, manualOverrides,
  grandTotal, overheadTotal, printMode,
  isCompressed, showAdmin, fillerRowCount, pageTotals,
  layoutVariant = 'special',
  lastAssemblyId: _lastAssemblyId,
  onTaskOverride,
  allTasks,
  onQuotationDetailsChange,
  onBillingDetailsChange
}: PrintPageProps) => {

  const fmt = (n: number) => '¥' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  const resolveField = (task: Task, field: string, defaultValue: any) => {
    const override = manualOverrides.tasks[task.id] as any
    return override?.[field] !== undefined ? override[field] : defaultValue
  }

  const resolveUnitPage = (task: Task) => getUnitPageCount(task.id, allTasks, manualOverrides)

  // ── Parse KEMCO rows ───────────────────────────────────────────
  interface KemcoRenderRow {
    assemblyTask: Task
    subgroupTasks: Task[]
  }
  const kemcoRows: KemcoRenderRow[] = []

  if (layoutVariant === 'kemco' && allTasks.length > 0) {
    let currentAssembly: Task | null = null
    let currentSubgroup: Task[] = []
    let hasPushedForCurrentAssembly = false

    const pushCurrentGroup = () => {
      if (currentAssembly) {
        if (hasPushedForCurrentAssembly && currentSubgroup.length === 0) {
          return
        }
        kemcoRows.push({
          assemblyTask: currentAssembly,
          subgroupTasks: currentSubgroup
        })
        currentSubgroup = []
        hasPushedForCurrentAssembly = true
      }
    }

    for (let idx = 0; idx < pageTasks.length; idx++) {
      const t = pageTasks[idx]
      if (t.level === 0) {
        pushCurrentGroup()
        currentAssembly = t
        hasPushedForCurrentAssembly = false
      } else {
        const parent = allTasks.find(at => at.id === t.parentId && at.level === 0) || t
        if (!currentAssembly || currentAssembly.id !== parent.id) {
          pushCurrentGroup()
          currentAssembly = parent
          hasPushedForCurrentAssembly = false
        }

        currentSubgroup.push(t)
        if (currentSubgroup.length === 2) {
          pushCurrentGroup()
        }
      }
    }
    pushCurrentGroup()
  }

  const taskCountForCompression = layoutVariant === 'kemco'
    ? kemcoRows.length + (isLastPage ? 1 : 0)
    : pageTasks.length

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

      if (totalWeight > 0) {
        // Largest Remainder Method (Hare-Niemeyer) to ensure rounded sum is exactly 100%
        const items = topLevelCounts.map(t => {
          const exact = (t.count / totalWeight) * 100
          const floored = Math.floor(exact)
          const remainder = exact - floored
          return { id: t.id, count: t.count, floored, remainder }
        })

        const currentSum = items.reduce((acc, item) => acc + item.floored, 0)
        const difference = 100 - currentSum

        // Sort by remainder descending
        items.sort((a, b) => b.remainder - a.remainder || b.count - a.count || a.id - b.id)

        for (let i = 0; i < difference; i++) {
          if (items[i]) {
            items[i].floored += 1
          }
        }

        items.forEach(item => {
          assemblyPercentages[item.id] = item.floored
        })
      } else {
        topLevelCounts.forEach(t => {
          assemblyPercentages[t.id] = 0
        })
      }
    }

    const getAssemblyRowSpan = (rowIndex: number) => {
      const row = kemcoRows[rowIndex]
      if (!row) return 0

      if (rowIndex > 0 && kemcoRows[rowIndex - 1].assemblyTask.id === row.assemblyTask.id) {
        return 0
      }

      let span = 1
      for (let j = rowIndex + 1; j < kemcoRows.length; j++) {
        if (kemcoRows[j].assemblyTask.id === row.assemblyTask.id) {
          span++
        } else {
          break
        }
      }
      return span
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
            {layoutVariant === 'kemco' ? (
              kemcoRows.map((row, rowIndex) => {
                const span = getAssemblyRowSpan(rowIndex)
                const targetId = row.assemblyTask.id
                const resRef = resolveField(row.assemblyTask, 'referenceNumber', row.assemblyTask.referenceNumber || '')
                const resMachine = resolveField(row.assemblyTask, 'machineCode', row.assemblyTask.machineCode || '')
                const resDesc = resolveField(row.assemblyTask, 'description', row.assemblyTask.description || '')
                const resPercent = resolveField(row.assemblyTask, 'percentage', assemblyPercentages[targetId] || 0)

                const resUnit = row.subgroupTasks.map(t => resolveField(t, 'unitCode', t.unitCode || '')).filter(Boolean).join(', ')
                const resType = row.subgroupTasks.length > 0 ? resolveField(row.subgroupTasks[0], 'type', row.subgroupTasks[0].type || '3D') : '3D'

                const assemblyIndex = allTasks.filter(t => t.level === 0).findIndex(t => t.id === targetId)
                const displayNo = assemblyIndex !== -1 ? assemblyIndex + 1 : ''

                return (
                  <tr key={`kemco-row-${rowIndex}`} className="level-1">
                    {span > 0 && (
                      <td rowSpan={span} style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        {displayNo}
                      </td>
                    )}
                    {span > 0 && (
                      <>
                        <td className="col-ref-cell" rowSpan={span} style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                          <div
                            contentEditable
                            suppressContentEditableWarning
                            className="ppm-unit-input"
                            style={{ textAlign: 'center', width: '100%', fontWeight: 'bold', border: 'none', outline: 'none', background: 'transparent', cursor: 'text', minHeight: '16px' }}
                            onBlur={e => onTaskOverride?.(targetId, { referenceNumber: e.currentTarget.textContent || '' })}
                          >
                            {resRef}
                          </div>
                        </td>
                        <td className="col-machine-cell" rowSpan={span} style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                          <div
                            contentEditable
                            suppressContentEditableWarning
                            className="ppm-unit-input"
                            style={{ textAlign: 'center', width: '100%', fontWeight: 'bold', border: 'none', outline: 'none', background: 'transparent', cursor: 'text', minHeight: '16px' }}
                            onBlur={e => onTaskOverride?.(targetId, { machineCode: e.currentTarget.textContent || '' })}
                          >
                            {resMachine}
                          </div>
                        </td>
                      </>
                    )}
                    <td className="col-unit-cell">
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        className="ppm-unit-input"
                        style={{ textAlign: 'center', width: '100%', border: 'none', outline: 'none', background: 'transparent', cursor: 'text', minHeight: '16px' }}
                        onBlur={e => {
                          const parts = (e.currentTarget.textContent || '').split(',').map(s => s.trim())
                          row.subgroupTasks.forEach((t, tIdx) => {
                            onTaskOverride?.(t.id, { unitCode: parts[tIdx] || '' })
                          })
                        }}
                      >
                        {resUnit}
                      </div>
                    </td>
                    {span > 0 && (
                      <td className="description-cell" rowSpan={span} style={{ verticalAlign: 'middle', textAlign: 'left', paddingLeft: '8px' }}>
                        <div
                          contentEditable
                          suppressContentEditableWarning
                          className="ppm-unit-input"
                          style={{
                            textAlign: 'left',
                            width: '100%',
                            fontWeight: 'bold',
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            cursor: 'text',
                            minHeight: '20px'
                          }}
                          onBlur={e => {
                            onTaskOverride?.(targetId, { description: e.currentTarget.textContent || '' })
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.stopPropagation()
                            }
                          }}
                        >
                          {resDesc}
                        </div>
                      </td>
                    )}
                    {span > 0 && (
                      <td rowSpan={span} style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        <div
                          contentEditable
                          suppressContentEditableWarning
                          className="ppm-unit-input"
                          style={{ textAlign: 'center', width: '100%', border: 'none', outline: 'none', background: 'transparent', cursor: 'text', minHeight: '16px' }}
                          onBlur={e => {
                            const val = parseFloat((e.currentTarget.textContent || '').replace('%', ''))
                            onTaskOverride?.(targetId, { percentage: isNaN(val) ? 0 : val })
                          }}
                        >
                          {typeof resPercent === 'number' ? `${resPercent.toFixed(0)}%` : resPercent}
                        </div>
                      </td>
                    )}
                    {span > 0 && (
                      <td rowSpan={span} style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        <div
                          contentEditable
                          suppressContentEditableWarning
                          className="ppm-unit-input"
                          style={{ textAlign: 'center', width: '100%', border: 'none', outline: 'none', background: 'transparent', cursor: 'text', minHeight: '16px' }}
                          onBlur={e => {
                            if (row.subgroupTasks.length > 0) {
                              onTaskOverride?.(row.subgroupTasks[0].id, { type: e.currentTarget.textContent || '' })
                            }
                          }}
                        >
                          {resType}
                        </div>
                      </td>
                    )}
                    {rowIndex === 0 && isFirstPage && (
                      <td className="price-cell kemco-merged-price" rowSpan={kemcoRows.length} style={{ textAlign: 'right', verticalAlign: 'middle', borderLeft: '1px solid #000', paddingRight: '8px' }}>
                        ¥{(1848400).toLocaleString()}
                      </td>
                    )}
                  </tr>
                )
              })
            ) : (
              pageTasks.map((task, i) => {
                return (
                  <tr key={task.id}>
                    <td>{startIndex + i + 1}</td>
                    <td>{task.referenceNumber || ''}</td>
                    <td className="description-cell">{task.description}</td>
                    <td className="col-unitpage">
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        className="ppm-unit-input"
                        style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', height: '100%', textAlign: 'center', minHeight: '16px' }}
                        onBlur={e => {
                          const val = parseInt((e.currentTarget.textContent || '').replace(/\D/g, '')) || 0
                          onTaskOverride?.(task.id, { unitPage: val })
                        }}
                      >
                        {resolveUnitPage(task) === 0 ? '' : resolveUnitPage(task)}
                      </div>
                    </td>
                    <td>{task.type || '3D'}</td>
                    <td className="price-cell">{fmt(pageTotals[i])}</td>
                  </tr>
                )
              })
            )}

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
                {(() => {
                  const actualFillerCount = layoutVariant === 'kemco'
                    ? Math.max(0, 10 - kemcoRows.length)  // 10 = 11 target rows - 1 leasing fee
                    : fillerRowCount
                  return Array.from({ length: actualFillerCount }, (_, i) => (
                    <tr key={`empty-${i}`}>
                      {Array.from({ length: layoutVariant === 'kemco' ? 8 : 6 }).map((_, j) => <td key={j}>&nbsp;</td>)}
                    </tr>
                  ))
                })()}
                <tr className="total-amount-row">
                  <td colSpan={layoutVariant === 'kemco' ? 7 : 5} className="total-label-cell">Total Amount</td>
                  <td className="price-cell">
                    {layoutVariant === 'kemco' ? `¥${(1700000).toLocaleString()}` : fmt(grandTotal)}
                  </td>
                </tr>
              </>
            )}

            {!isLastPage && (
              <>
                {layoutVariant === 'kemco' && (() => {
                  // Fill non-last KEMCO pages to look full (20 row target - actual rows)
                  const fillers = Math.max(0, 18 - kemcoRows.length)
                  return Array.from({ length: fillers }, (_, i) => (
                    <tr key={`empty-nonlast-${i}`}>
                      {Array.from({ length: 8 }).map((_, j) => <td key={j}>&nbsp;</td>)}
                    </tr>
                  ))
                })()}
                <tr aria-hidden="true" style={{ display: 'none' }}><td /></tr>
              </>
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
        `task-count-${taskCountForCompression}`,
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
              <span className="qh-meta-value">
                <div
                  contentEditable={!!onQuotationDetailsChange}
                  suppressContentEditableWarning
                  className="ppm-unit-input"
                  style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', height: '100%', textAlign: 'center', minHeight: '13px' }}
                  onBlur={e => onQuotationDetailsChange?.({ quotationNo: e.currentTarget.textContent || '' })}
                >
                  {quotationDetails.quotationNo || ''}
                </div>
              </span>
            </div>
            <div className="qh-meta-row">
              <span className="qh-meta-label">REFERENCE NO.:</span>
              <span className="qh-meta-value">{quotationDetails.referenceNo || ''}</span>
            </div>
            <div className="qh-meta-row">
              <span className="qh-meta-label">DATE:</span>
              <span className="qh-meta-value">
                <div
                  contentEditable={!!onQuotationDetailsChange}
                  suppressContentEditableWarning
                  className="ppm-unit-input"
                  style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', height: '100%', textAlign: 'center', minHeight: '13px' }}
                  onBlur={e => {
                    const normalized = (e.currentTarget.textContent || '').replace(/\//g, '-')
                    onQuotationDetailsChange?.({ date: normalized })
                  }}
                >
                  {(quotationDetails.date || '').replace(/-/g, '/')}
                </div>
              </span>
            </div>
          </div>
        )}

        {printMode === 'billing' && isFirstPage && (
          <div className="quotation-details-visual">
            <div className="detail-row-visual">
              <span className="detail-label-visual">DATE:</span>
              <span className="detail-value-visual">
                <div
                  contentEditable={!!onQuotationDetailsChange}
                  suppressContentEditableWarning
                  className="ppm-unit-input"
                  style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', height: '100%', textAlign: 'center', minHeight: '14px' }}
                  onBlur={e => {
                    const normalized = (e.currentTarget.textContent || '').replace(/\//g, '-')
                    onQuotationDetailsChange?.({ date: normalized })
                  }}
                >
                  {(quotationDetails.date || '').replace(/-/g, '/')}
                </div>
              </span>
            </div>
            <div className="detail-row-visual">
              <span className="detail-label-visual">Invoice No.:</span>
              <span className="detail-value-visual">
                <div
                  contentEditable={!!onBillingDetailsChange}
                  suppressContentEditableWarning
                  className="ppm-unit-input"
                  style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', height: '100%', textAlign: 'center', minHeight: '14px' }}
                  onBlur={e => onBillingDetailsChange?.({ invoiceNo: e.currentTarget.textContent || '' })}
                >
                  {billingDetails.invoiceNo || ''}
                </div>
              </span>
            </div>
            <div className="detail-row-visual">
              <span className="detail-label-visual">Quotation No.:</span>
              <span className="detail-value-visual">
                <div
                  contentEditable={!!onQuotationDetailsChange}
                  suppressContentEditableWarning
                  className="ppm-unit-input"
                  style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', height: '100%', textAlign: 'center', minHeight: '14px' }}
                  onBlur={e => onQuotationDetailsChange?.({ quotationNo: e.currentTarget.textContent || '' })}
                >
                  {quotationDetails.quotationNo || ''}
                </div>
              </span>
            </div>
            <div className="detail-row-visual">
              <span className="detail-label-visual">Job Order No.:</span>
              <span className="detail-value-visual">
                <div
                  contentEditable={!!onBillingDetailsChange}
                  suppressContentEditableWarning
                  className="ppm-unit-input"
                  style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', height: '100%', textAlign: 'center', minHeight: '14px' }}
                  onBlur={e => onBillingDetailsChange?.({ jobOrderNo: e.currentTarget.textContent || '' })}
                >
                  {billingDetails.jobOrderNo || ''}
                </div>
              </span>
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
