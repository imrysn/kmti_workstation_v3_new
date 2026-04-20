import { memo, useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type {
  Task, BaseRates, Signatures, CompanyInfo, ClientInfo, QuotationDetails, BillingDetails, ManualOverrides
} from '../../hooks/quotation'
import { calculateTaskTotal as calculateTaskSubtotal, calculateOverhead, getUnitPageCount } from '../../utils/quotation'
import { LAYOUT } from './constants'
import PrintPage from './components/PrintPage'

import './styles/PrintPreviewModal.css'
import './styles/VisualLayout.css'

// ── Types ──────────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean
  onClose: () => void
  companyInfo: CompanyInfo
  clientInfo: ClientInfo
  quotationDetails: QuotationDetails
  billingDetails: BillingDetails
  tasks: Task[]
  baseRates: BaseRates
  signatures: Signatures
  manualOverrides: ManualOverrides
  onManualOverrideChange: (updater: (prev: ManualOverrides) => ManualOverrides) => void
}

/** A single page slice produced by computePages(). */
interface PageSlice {
  tasks: Task[]
  totals: number[]
  /** 0-based index of the first task on this page within mainTasks[] */
  startIndex: number
}

const { A4_W_PX, A4_H_PX, TASKS_PER_PAGE } = LAYOUT

// ── Pagination engine ──────────────────────────────────────────────────────

/**
 * Splits `mainTasks` into page slices of at most TASKS_PER_PAGE each.
 * Returns an array of PageSlice objects — one per rendered PrintPage.
 *
 * This replaces the old hardcoded firstPageTasks / secondPageTasks split
 * and supports any number of pages without code changes.
 */
function computePages(
  mainTasks: Task[],
  calculateTotal: (task: Task) => number,
): PageSlice[] {
  const pages: PageSlice[] = []
  let i = 0
  while (i < mainTasks.length) {
    const slice = mainTasks.slice(i, i + TASKS_PER_PAGE)
    pages.push({
      tasks: slice,
      totals: slice.map(calculateTotal),
      startIndex: i,
    })
    i += TASKS_PER_PAGE
  }
  // Always produce at least one page (empty state)
  if (pages.length === 0) {
    pages.push({ tasks: [], totals: [], startIndex: 0 })
  }
  return pages
}

// ── Component ──────────────────────────────────────────────────────────────

const PrintPreviewModal = memo(({
  isOpen, onClose,
  companyInfo, clientInfo, quotationDetails, billingDetails, tasks, baseRates, signatures,
  manualOverrides, onManualOverrideChange,
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
      const availW = el.clientWidth - 64
      const availH = el.clientHeight - 64
      setBaseScale(Math.min(availW / A4_W_PX, availH / A4_H_PX, 1))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isOpen])

  // ── Per-task total calculation ─────────────────────────────────
  const calculateTaskTotal = useCallback(
    (task: Task): number => calculateTaskSubtotal(task, tasks, baseRates, manualOverrides).total,
    [tasks, baseRates, manualOverrides],
  )

  // ── Pagination ─────────────────────────────────────────────────
  const { pages, grandTotal, overheadTotal } = useMemo(() => {
    const mainTasks = tasks.filter(t => t.isMainTask)
    const slices = computePages(mainTasks, calculateTaskTotal)

    const subtotal = slices.flatMap(p => p.totals).reduce((s, t) => s + t, 0)
    const footer = manualOverrides?.footer || {}
    const overhead = footer.overhead !== undefined
      ? footer.overhead
      : calculateOverhead(subtotal, baseRates.overheadPercentage)
    const grand = subtotal + overhead + (footer.adjustment || 0)

    return { pages: slices, grandTotal: grand, overheadTotal: overhead }
  }, [tasks, baseRates, calculateTaskTotal, manualOverrides])

  const totalPages = pages.length

  // ── Unit-page helpers ──────────────────────────────────────────
  const resolveUnitPage = useCallback(
    (task: Task) => getUnitPageCount(task.id, tasks, manualOverrides),
    [tasks, manualOverrides],
  )

  const handleUnitEdit = useCallback((taskId: number, newValue: number) => {
    onManualOverrideChange(prev => ({
      ...prev,
      tasks: { ...prev.tasks, [taskId]: { ...(prev.tasks[taskId] || {}), unitPage: newValue } },
    }))
  }, [onManualOverrideChange])

  // ── Print style injection helper ────────────────────────────────
  // Shared between handlePrint and handleDownloadPDF to avoid duplication.
  const buildPrintStyleContent = () => `
    .ppm-header, .ppm-footer-bar, .ppm-backdrop,
    .ppm-page-break-indicator { display: none !important; }
    .ppm-container, .ppm-body, .ppm-scroll-area {
      position: static !important; display: block !important;
      width: 210mm !important; height: auto !important;
      overflow: visible !important; background: white !important;
      padding: 0 !important; margin: 0 !important;
      box-shadow: none !important; border: none !important;
    }
    .ppm-a4-scaler, .ppm-a4-scaler > div {
      position: static !important; display: block !important;
      width: 210mm !important; height: auto !important;
      transform: none !important; box-shadow: none !important;
      border-radius: 0 !important; background: white !important;
      overflow: visible !important;
    }
    .preview-content {
      display: block !important; width: 210mm !important;
      height: auto !important; transform: none !important;
      padding: 0 !important; margin: 0 !important;
      overflow: visible !important; background: white !important;
    }
    .quotation-visual-exact {
      display: flex !important; flex-direction: column !important;
      width: 210mm !important; height: 297mm !important;
      min-height: 297mm !important; max-height: 297mm !important;
      overflow: hidden !important; box-sizing: border-box !important;
      padding: 10mm !important; background: white !important;
      page-break-after: always !important; break-after: page !important;
      margin: 0 !important;
    }
    .quotation-visual-exact.compressed { padding: 5mm !important; }
    .quotation-visual-exact:last-of-type {
      page-break-after: avoid !important; break-after: avoid !important;
    }
    .quotation-visual-exact * { color: #000 !important; }
    .quotation-visual-exact .nothing-follow { color: #888 !important; }
    .quotation-visual-exact .contact-header,
    .quotation-visual-exact .table-header th,
    .quotation-visual-exact .total-amount-row { background: #f0f0f0 !important; }
    .quotation-visual-exact .q-bottom-content {
      margin-top: auto !important; display: flex !important;
      flex-direction: column !important; width: 100% !important;
      gap: 5px !important;
    }
  `

  // ── Print / PDF ────────────────────────────────────────────────
  const handlePrint = useCallback(async () => {
    setIsProcessing(true)
    let styleEl: HTMLStyleElement | null = null
    try {
      styleEl = document.createElement('style')
      styleEl.id = '__kmti-print-override'
      styleEl.textContent = buildPrintStyleContent()
      document.head.appendChild(styleEl)
      await new Promise(r => setTimeout(r, 300))

      const el = (window as any).electronAPI
      if (el?.print) {
        const result = await el.print({
          silent: false, printBackground: true, color: true,
          pageSize: 'A4', margins: { marginType: 'none' }, landscape: false,
        })
        if (result?.error) console.error('Print error:', result.error)
      } else {
        window.print()
      }
    } catch (err) {
      console.error('Print failed:', err)
    } finally {
      styleEl?.remove()
      setIsProcessing(false)
    }
  }, [])

  const handleDownloadPDF = useCallback(async () => {
    setIsProcessing(true)
    let styleEl: HTMLStyleElement | null = null
    try {
      const el = (window as any).electronAPI
      if (!el?.printToPDF || !el.showSaveDialog || !el.writeFile) {
        window.print(); return
      }

      const docType = printMode === 'billing' ? 'BillingStatement' : 'Quotation'
      const docNo = printMode === 'billing'
        ? (billingDetails.invoiceNo || quotationDetails.quotationNo || 'Draft')
        : (quotationDetails.quotationNo || 'Draft')
      const defaultName = `KMTI_${docType}_${docNo.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`

      styleEl = document.createElement('style')
      styleEl.id = '__kmti-pdf-print-override'
      styleEl.textContent = buildPrintStyleContent()
      document.head.appendChild(styleEl)
      await new Promise(r => setTimeout(r, 300))

      const pdfResult = await el.printToPDF({
        printBackground: true, preferCSSPageSize: false,
        pageSize: 'A4', landscape: false, margins: { marginType: 'none' },
      })
      if (!pdfResult.success || !pdfResult.data) throw new Error(pdfResult.error || 'Failed to generate PDF')

      const saveResult = await el.showSaveDialog({
        title: `Save ${docType}`, defaultPath: defaultName,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
      })
      if (saveResult.canceled || !saveResult.filePath) return

      const writeResult = await el.writeFile(saveResult.filePath, pdfResult.data)
      if (!writeResult.success) throw new Error(writeResult.error || 'Failed to write file')
    } catch (err: any) {
      console.error('PDF Download failed:', err)
      alert(`Error generating PDF: ${err.message}`)
    } finally {
      styleEl?.remove()
      setIsProcessing(false)
    }
  }, [printMode, quotationDetails, billingDetails])

  // ── Zoom controls ──────────────────────────────────────────────
  const ZOOM_LEVELS = useMemo(() => [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3], [])

  const handleZoomIn = useCallback(() => {
    const next = ZOOM_LEVELS.find(z => z > actualScale + 0.01)
    if (next) setZoomMode(next)
  }, [actualScale, ZOOM_LEVELS])

  const handleZoomOut = useCallback(() => {
    for (let i = ZOOM_LEVELS.length - 1; i >= 0; i--) {
      if (ZOOM_LEVELS[i] < actualScale - 0.01) { setZoomMode(ZOOM_LEVELS[i]); break }
    }
  }, [actualScale, ZOOM_LEVELS])

  useEffect(() => {
    if (!isOpen) return
    const container = containerRef.current
    if (!container) return
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      if (e.deltaY < 0) handleZoomIn(); else handleZoomOut()
    }
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [isOpen, handleZoomIn, handleZoomOut])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Total scaler height: sum of all page heights + gap between pages
  const PAGE_GAP_PX = 24
  const scalerHeight = totalPages * A4_H_PX * actualScale + (totalPages - 1) * PAGE_GAP_PX * actualScale

  const sharedPageProps = {
    printMode, companyInfo, clientInfo, quotationDetails, billingDetails,
    signatures, manualOverrides, baseRates, grandTotal, overheadTotal,
  }

  return (
    <div className="print-preview-modal">
      <div className="ppm-backdrop" onClick={onClose} />

      <div className="ppm-container">
        {/* ── Header ──────────────────────────────────────────────── */}
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
            <div className="ppm-mode-toggle">
              <button id="ppm-btn-quotation" className={`ppm-mode-btn${printMode === 'quotation' ? ' active' : ''}`} onClick={() => setPrintMode('quotation')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                Quotation Preview
              </button>
              <button id="ppm-btn-billing" className={`ppm-mode-btn${printMode === 'billing' ? ' active' : ''}`} onClick={() => setPrintMode('billing')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                Billing Statement Preview
              </button>
            </div>

            <div className="ppm-sep" />

            <button id="ppm-btn-print" className="ppm-action-btn primary" onClick={handlePrint} disabled={isProcessing}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              {isProcessing ? 'Processing…' : 'Print'}
            </button>

            <button id="ppm-btn-pdf" className="ppm-action-btn export" onClick={handleDownloadPDF} disabled={isProcessing}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {isProcessing ? 'Generating…' : 'Download PDF'}
            </button>

            <button id="ppm-btn-close" className="ppm-close-btn" onClick={onClose}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="ppm-body" ref={containerRef}>
          <div className="ppm-scroll-area">
            <div
              className="ppm-a4-scaler"
              style={{ width: `${A4_W_PX * actualScale}px`, height: `${scalerHeight}px` }}
            >
              <div style={{ transform: `scale(${actualScale})`, transformOrigin: 'top left', width: `${A4_W_PX}px` }}>
                <div ref={previewRef} className="preview-content">
                  {pages.map((page, pageIndex) => {
                    const isLastPage = pageIndex === pages.length - 1
                    return (
                      <div key={pageIndex}>
                        {pageIndex > 0 && (
                          <div className="ppm-page-break-indicator">PAGE {pageIndex + 1}</div>
                        )}
                        <PrintPage
                          {...sharedPageProps}
                          pageIndex={pageIndex}
                          pageTasks={page.tasks.map(t => ({ ...t, unitPage: resolveUnitPage(t) }))}
                          pageTotals={page.totals}
                          startIndex={page.startIndex}
                          isLastPage={isLastPage}
                          onUnitEdit={handleUnitEdit}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer bar ───────────────────────────────────────────── */}
        <div className="ppm-footer-bar">
          <span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            Page {totalPages > 1 ? `1–${totalPages}` : '1'} of {totalPages} · A4 Portrait
          </span>
          <div className="zoom-controls">
            <button className="zoom-button" onClick={handleZoomOut} disabled={actualScale <= ZOOM_LEVELS[0]} title="Zoom Out">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

PrintPreviewModal.displayName = 'PrintPreviewModal'
export default PrintPreviewModal
