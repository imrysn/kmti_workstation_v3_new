import { memo, useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type {
  Task, BaseRates, Signatures, CompanyInfo, ClientInfo, QuotationDetails, ManualOverrides
} from '../../hooks/quotation'
import { calculateTaskTotal as calculateTaskSubtotal, calculateOverhead } from '../../utils/quotation'
import Logo from '../../assets/kmti_logo.png'

interface Props {
  isOpen: boolean
  onClose: () => void
  companyInfo: CompanyInfo
  clientInfo: ClientInfo
  quotationDetails: QuotationDetails
  tasks: Task[]
  baseRates: BaseRates
  signatures: Signatures
  manualOverrides?: ManualOverrides
}

// A4 dimensions in px at 96dpi
const A4_W_PX = 794   // 210mm
const A4_H_PX = 1123  // 297mm

const PrintPreviewModal = memo(({
  isOpen, onClose,
  companyInfo, clientInfo, quotationDetails, tasks, baseRates, signatures,
  manualOverrides = {}
}: Props) => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [printMode, setPrintMode] = useState<'quotation' | 'billing'>('quotation')
  const [baseScale, setBaseScale] = useState(1)
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit')
  const actualScale = zoomMode === 'fit' ? baseScale : zoomMode

  const previewRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scale A4 sheet to fit the preview container
  useEffect(() => {
    if (!isOpen) return
    const el = containerRef.current
    if (!el) return

    const measure = () => {
      const availW = el.clientWidth - 64   // 32px padding each side
      const availH = el.clientHeight - 64
      const scaleW = availW / A4_W_PX
      const scaleH = availH / A4_H_PX
      setBaseScale(Math.min(scaleW, scaleH, 1))  // never up-scale automatically
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isOpen])

  // ── Task total calculation ─────────────────────────────────────────────────
  const calculateTaskTotal = useCallback((task: Task): number => {
    return calculateTaskSubtotal(task, tasks, baseRates, manualOverrides).total
  }, [tasks, baseRates, manualOverrides])

  // ── Pagination / layout memo ──────────────────────────────────────────────
  const {
    firstPageTasks, secondPageTasks, needsPagination,
    firstPageTotals, secondPageTotals,
    grandTotal, overheadTotal, actualTaskCount, maxRows,
    totalPages, secondPageEmptyRows
  } = useMemo(() => {
    const mainTasks = tasks.filter(t => t.isMainTask).slice(0, 27)
    const count = mainTasks.length
    // If overhead is enabled, 15 tasks + overhead row + "nothing follow" + grand total row 
    // already fills the page. Threshold should be 15 if overhead > 0.
    const threshold = baseRates.overheadPercentage > 0 ? 15 : 16
    const needsPagination = count >= threshold
    const useCompression = count >= 9 && count <= 15 && !needsPagination

    const firstPageTasks = needsPagination ? mainTasks.slice(0, 15) : mainTasks
    const secondPageTasks = needsPagination ? mainTasks.slice(15) : []

    const overheadRowCount = baseRates.overheadPercentage > 0 ? 1 : 0
    const secondPageEmptyRows = needsPagination
      ? Math.max(0, 10 - secondPageTasks.length - overheadRowCount - 1)
      : 0

    const firstPageTotals = firstPageTasks.map(calculateTaskTotal)
    const secondPageTotals = secondPageTasks.map(calculateTaskTotal)

    const subtotal = [...firstPageTotals, ...secondPageTotals].reduce((s, t) => s + t, 0)
    const footerOverrides = (manualOverrides as any)[-1] || {}
    const overhead = footerOverrides.overhead !== undefined
      ? footerOverrides.overhead
      : calculateOverhead(subtotal, baseRates.overheadPercentage)

    // SMART ROUNDING SYNC: Always sum up (Subtotal + Overhead + Adjustment)
    const grand = subtotal + overhead + (footerOverrides.adjustment || 0)
    const taskCount = count + (baseRates.overheadPercentage > 0 ? 1 : 0) + 1
    const rows = needsPagination ? 15
      : useCompression ? taskCount
        : taskCount > 10 ? Math.min(taskCount, 20) : 10

    return {
      firstPageTasks, secondPageTasks, needsPagination,
      firstPageTotals, secondPageTotals,
      grandTotal: grand, overheadTotal: overhead,
      actualTaskCount: taskCount, maxRows: rows,
      totalPages: needsPagination ? 2 : 1, secondPageEmptyRows
    }
  }, [tasks, baseRates, calculateTaskTotal])

  const fmt = useCallback((n: number) => `¥${n.toLocaleString()}`, [])

  const getUnitPageCount = useCallback((task: Task) => {
    const ov = manualOverrides[task.id]
    if (ov?.unitPage !== undefined) return ov.unitPage
    return 1 + tasks.filter(t => t.parentId === task.id).length
  }, [tasks, manualOverrides])

  // ── Print / PDF ───────────────────────────────────────────────────────────
  const handlePrint = useCallback(async () => {
    setIsProcessing(true)
    try {
      const el = (window as any).electronAPI
      if (el?.print) {
        // Native Electron Print
        const result = await el.print({
          silent: false,
          printBackground: true,
          color: true,
          pageSize: 'A4',
          margins: { marginType: 'custom', top: 5, bottom: 5, left: 5, right: 5 },
          landscape: false
        })
        if (result?.error) console.error('Print error:', result.error)
      } else {
        window.print()
      }
    } catch (err) {
      console.error('Print failed:', err)
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const handleDownloadPDF = useCallback(async () => {
    setIsProcessing(true)
    try {
      const el = (window as any).electronAPI
      if (!el || !el.printToPDF || !el.showSaveDialog || !el.writeFile) {
        window.print()
        return
      }

      const docType = printMode === 'billing' ? 'BillingStatement' : 'Quotation'
      const docNo = printMode === 'billing'
        ? (quotationDetails.invoiceNo || quotationDetails.quotationNo || 'Draft')
        : (quotationDetails.quotationNo || 'Draft')
      const defaultName = `KMTI_${docType}_${docNo.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`

      // Give UI state a moment to settle (Generating... text)
      await new Promise(r => setTimeout(r, 500))

      // 1. Generate PDF Buffer
      const pdfResult = await el.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        pageSize: 'A4',
        landscape: false,
        margins: { marginType: 'none' }
      })

      if (!pdfResult.success || !pdfResult.data) {
        throw new Error(pdfResult.error || 'Failed to generate PDF')
      }

      // 2. Show Save Dialog
      const saveResult = await el.showSaveDialog({
        title: `Save ${docType}`,
        defaultPath: defaultName,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
      })

      if (saveResult.canceled || !saveResult.filePath) return

      // 3. Write File
      const writeResult = await el.writeFile(saveResult.filePath, pdfResult.data)
      if (!writeResult.success) {
        throw new Error(writeResult.error || 'Failed to write file')
      }

      // Success! Maybe show a toast if available
    } catch (err: any) {
      console.error('PDF Download failed:', err)
      alert(`Error generating PDF: ${err.message}`)
    } finally {
      setIsProcessing(false)
    }
  }, [printMode, quotationDetails])

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderHeader = (isSecondPage = false) => (
    <div className={`header-visual${printMode === 'billing' ? ' billing-header' : ''}`}>
      <div className="logo-visual">
        <img src={Logo} alt="KMTI Logo" />
      </div>
      <div className="center-text-visual">
        <div className="company-name-visual">
          {printMode === 'billing'
            ? 'KUSAKABE & MAENO TECH., INC'
            : <><span>KUSAKABE & MAENO</span><br /><span>TECH., INC.</span></>}
        </div>
        {printMode === 'billing' && (
          <div className="company-address-visual">
            {[companyInfo.address, companyInfo.city, companyInfo.location]
              .filter(Boolean)
              .join(', ')}<br />
            Vat Reg. TIN: 008-883-390-000
          </div>
        )}
        <div className="quotation-title-visual">
          {printMode === 'billing' ? 'BILLING STATEMENT' : 'Quotation'}
        </div>
      </div>
      {printMode !== 'billing' && (
        <div className="right-details-visual">
          <div className="company-info-visual">
            <div className="company-name-info">KUSAKABE & MAENO TECH., INC</div>
            {companyInfo.address}<br />
            {companyInfo.city}<br />
            {companyInfo.location}<br />
            {companyInfo.phone}
          </div>
          {!isSecondPage && (
            <div className="quotation-details-visual">
              <div className="detail-row-visual">
                <span className="detail-label-visual">Quotation NO.:</span>
                <span className="detail-value-visual">{quotationDetails.quotationNo || ''}</span>
              </div>
              <div className="detail-row-visual">
                <span className="detail-label-visual">REFERENCE NO.:</span>
                <span className="detail-value-visual">{quotationDetails.referenceNo || ''}</span>
              </div>
              <div className="detail-row-visual">
                <span className="detail-label-visual">DATE:</span>
                <span className="detail-value-visual">{quotationDetails.date || ''}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )

  /**
   * renderTable — all summary rows live HERE. No duplicate Total Amount.
   * Rule:
   *  - First page with pagination → show "CONTINUED ON NEXT PAGE" only, no totals
   *  - Second page or single page → show overhead + NOTHING FOLLOW + empty rows + Total Amount
   */
  const renderTable = (pageTasks: Task[], pageTotals: number[], startIndex = 0) => {
    const isLastPage = !needsPagination || startIndex > 0
    const emptyCount = isLastPage
      ? (startIndex === 0
        ? Math.max(0, maxRows - pageTasks.length - (baseRates.overheadPercentage > 0 ? 1 : 0) - 1)
        : secondPageEmptyRows)
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
            {/* Task rows */}
            {pageTasks.map((task, i) => (
              <tr key={task.id}>
                <td>{startIndex + i + 1}</td>
                <td>{task.referenceNumber || ''}</td>
                <td className="description-cell">{task.description}</td>
                <td>{getUnitPageCount(task)}</td>
                <td>{task.type || '3D'}</td>
                <td className="price-cell">{fmt(pageTotals[i])}</td>
              </tr>
            ))}

            {/* ── Last page (or single page): show overhead + nothing follow + empties + total ── */}
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
                {Array.from({ length: emptyCount }, (_, i) => (
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
            {/* Dummy row to prevent css :last-child from assigning thick top border to the normal row */}
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
          <div className="sig-name-visual">{signatures.billing.preparedBy.name || 'MS. PAULYN MAURIEL BEJER'}</div>
          <div className="sig-title-visual">{signatures.billing.preparedBy.title || 'Accounting Staff'}</div>
        </div>
        <div className="signature-right-visual">
          <div className="sig-label-visual">Approved by:</div>
          <div className="sig-line-visual" />
          <div className="sig-name-visual">{signatures.billing.approvedBy.name || 'MR. MICHAEL PEÑANO'}</div>
          <div className="sig-title-visual">{signatures.billing.approvedBy.title || 'Engineering Manager'}</div>
        </div>
      </div>
      <div className="signature-row-visual">
        <div className="signature-left-visual" />
        <div className="signature-right-visual">
          <div className="sig-line-visual" />
          <div className="sig-name-visual">{signatures.billing.finalApprover.name || 'MR. YUICHIRO MAENO'}</div>
          <div className="sig-title-visual">{signatures.billing.finalApprover.title || 'President'}</div>
        </div>
      </div>
    </div>
  ) : (
    <div className="signatures-visual">
      <div className="signature-row-visual">
        <div className="signature-left-visual">
          <div className="sig-label-visual">Prepared by:</div>
          <div className="sig-line-visual" />
          <div className="sig-name-visual">{signatures.quotation.preparedBy.name || 'MR. MICHAEL PEÑANO'}</div>
          <div className="sig-title-visual">{signatures.quotation.preparedBy.title || 'Engineering Manager'}</div>
        </div>
        <div className="signature-right-visual" />
      </div>
      <div className="signature-row-visual">
        <div className="signature-left-visual">
          <div className="sig-label-visual">Approved by:</div>
          <div className="sig-line-visual" />
          <div className="sig-name-visual">{signatures.quotation.approvedBy.name || 'MR. YUICHIRO MAENO'}</div>
          <div className="sig-title-visual">{signatures.quotation.approvedBy.title || 'President'}</div>
        </div>
        <div className="signature-right-visual">
          <div className="sig-label-visual">Received by:</div>
          <div className="sig-line-visual" />
          <div className="sig-name-visual">{signatures.quotation.receivedBy.label || '(Signature Over Printed Name)'}</div>
        </div>
      </div>
    </div>
  )

  const renderFooter = (isLastPage = false) => {
    if (printMode === 'billing' && !isLastPage) return null

    return printMode === 'billing' ? (
      <div className="footer-visual">
        <div className="bank-details-section">
          <div className="bank-details-title">BANK DETAILS (Yen)</div>
          <div className="bank-details-grid">
            {[
              ['BANK NAME:', 'RIZAL COMMERCIAL BANK CORPORATION'],
              ['SAVINGS ACCOUNT NAME:', 'KUSAKABE & MAENO TECH INC.'],
              ['SAVINGS ACCOUNT NUMBER:', '0000000011581337'],
              ['BANK ADDRESS:', "RCBC DASMARINAS BRANCH RCBS BLDG. FCIE COMPOUND, GOVERNOR'S DRIVE LANGKAAN, DASMARINAS CAVITE"],
              ['SWIFT CODE:', 'RCBCPHMM'],
              ['BRANCH CODE:', '358'],
            ].map(([label, value]) => (
              <div key={label} className="bank-detail-row">
                <span className="bank-label">{label}</span>
                <span className="bank-value">{value}</span>
              </div>
            ))}
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

  const renderFirstPage = () => (
    <div
      className={`quotation-visual-exact${needsPagination ? '' : ` task-count-${actualTaskCount}`}`}
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      <div className="q-top-content">
        {renderHeader()}
        {printMode === 'billing' && (
          <div className="quotation-details-visual">
            <div className="detail-row-visual">
              <span className="detail-label-visual">DATE:</span>
              <span className="detail-value-visual">{quotationDetails.date || ''}</span>
            </div>
            <div className="detail-row-visual">
              <span className="detail-label-visual">Invoice No.:</span>
              <span className="detail-value-visual">{quotationDetails.invoiceNo || ''}</span>
            </div>
            <div className="detail-row-visual">
              <span className="detail-label-visual">Quotation No.:</span>
              <span className="detail-value-visual">{quotationDetails.quotationNo || ''}</span>
            </div>
            <div className="detail-row-visual">
              <span className="detail-label-visual">Job Order No.:</span>
              <span className="detail-value-visual">{quotationDetails.jobOrderNo || ''}</span>
            </div>
          </div>
        )}
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

        {renderTable(firstPageTasks, firstPageTotals, 0)}

        {!needsPagination && (
          <div className="terms-visual">
            Upon receipt of this quotation sheet, kindly send us one copy with your signature.<br /><br />
            The price will be changed without prior notice due to frequent changes of conversion rate.
          </div>
        )}
      </div>

      <div className="q-bottom-content" style={{ marginTop: 'auto' }}>
        {!needsPagination && renderSignatures()}
        {renderFooter(!needsPagination)}
      </div>
    </div>
  )

  const renderSecondPage = () => (
    <>
      <div className="ppm-page-break-indicator">PAGE 2</div>
      <div
        className="quotation-visual-exact"
        style={{ pageBreakBefore: 'always', marginTop: '0', display: 'flex', flexDirection: 'column' }}
      >
        <div className="q-top-content">
          {renderHeader(true)}
          {renderTable(secondPageTasks, secondPageTotals, firstPageTasks.length)}
          <div className="terms-visual">
            Upon receipt of this quotation sheet, kindly send us one copy with your signature.<br /><br />
            The price will be changed without prior notice due to frequent changes of conversion rate.
          </div>
        </div>
        <div className="q-bottom-content" style={{ marginTop: 'auto' }}>
          {renderSignatures()}
          {renderFooter(true)}
        </div>
      </div>
    </>
  )

  const ZOOM_LEVELS = useMemo(() => [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3], [])

  const handleZoomIn = useCallback(() => {
    const next = ZOOM_LEVELS.find(z => z > (actualScale + 0.01))
    if (next) setZoomMode(next)
  }, [actualScale, ZOOM_LEVELS])

  const handleZoomOut = useCallback(() => {
    for (let i = ZOOM_LEVELS.length - 1; i >= 0; i--) {
      if (ZOOM_LEVELS[i] < (actualScale - 0.01)) {
        setZoomMode(ZOOM_LEVELS[i])
        break
      }
    }
  }, [actualScale, ZOOM_LEVELS])

  useEffect(() => {
    if (!isOpen) return
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        if (e.deltaY < 0) {
          handleZoomIn()
        } else if (e.deltaY > 0) {
          handleZoomOut()
        }
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [isOpen, handleZoomIn, handleZoomOut])

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="print-preview-modal">
      <div className="ppm-backdrop" onClick={onClose} />

      <div className="ppm-container">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="ppm-header">
          <div className="ppm-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <h2>Print Preview — {printMode === 'billing' ? 'Billing Statement' : 'Quotation'}</h2>
          </div>

          <div className="ppm-header-actions">
            {/* Mode toggle */}
            <div className="ppm-mode-toggle">
              <button
                id="ppm-btn-quotation"
                className={`ppm-mode-btn${printMode === 'quotation' ? ' active' : ''}`}
                onClick={() => setPrintMode('quotation')}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Quotation Preview
              </button>
              <button
                id="ppm-btn-billing"
                className={`ppm-mode-btn${printMode === 'billing' ? ' active' : ''}`}
                onClick={() => setPrintMode('billing')}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Billing Statement Preview
              </button>
            </div>

            <div className="ppm-sep" />

            {/* Print */}
            <button
              id="ppm-btn-print"
              className="ppm-action-btn primary"
              onClick={handlePrint}
              disabled={isProcessing}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              {isProcessing ? 'Processing…' : 'Print'}
            </button>

            {/* PDF */}
            <button
              id="ppm-btn-pdf"
              className="ppm-action-btn export"
              onClick={handleDownloadPDF}
              disabled={isProcessing}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {isProcessing ? 'Generating…' : 'Download PDF'}
            </button>

            {/* Close */}
            <button id="ppm-btn-close" className="ppm-close-btn" onClick={onClose}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body — scrollable preview ───────────────────────────────── */}
        <div className="ppm-body" ref={containerRef}>
          <div className="ppm-scroll-area">
            {/* Scaled A4 wrapper */}
            <div
              className="ppm-a4-scaler"
              style={{
                width: `${A4_W_PX * actualScale}px`,
                height: `${A4_H_PX * (needsPagination ? 2 : 1) * actualScale + (needsPagination ? 80 * actualScale : 0)}px`,
              }}
            >
              <div
                style={{
                  transform: `scale(${actualScale})`,
                  transformOrigin: 'top left',
                  width: `${A4_W_PX}px`,
                }}
              >
                <div ref={previewRef} className="preview-content">
                  {renderFirstPage()}
                  {needsPagination && renderSecondPage()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer bar ──────────────────────────────────────────────── */}
        <div className="ppm-footer-bar">
          <span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Page {totalPages > 1 ? `1–${totalPages}` : '1'} of {totalPages} · A4 Portrait
          </span>
          <div className="zoom-controls">
            <button className="zoom-button" onClick={handleZoomOut} disabled={actualScale <= ZOOM_LEVELS[0]} title="Zoom Out">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <span
              className="ppm-zoom-label"
              onClick={() => setZoomMode('fit')}
              style={{ cursor: 'pointer', minWidth: '70px', textAlign: 'center' }}
              title="Fit to Screen"
            >
              {zoomMode === 'fit' ? `Fit (${Math.round(actualScale * 100)}%)` : `${Math.round(actualScale * 100)}%`}
            </span>
            <button className="zoom-button" onClick={handleZoomIn} disabled={actualScale >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]} title="Zoom In">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          </div>
        </div>
      </div>

    </div>
  )
})

PrintPreviewModal.displayName = 'PrintPreviewModal'
export default PrintPreviewModal
