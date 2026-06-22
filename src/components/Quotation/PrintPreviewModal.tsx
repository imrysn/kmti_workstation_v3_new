import { memo, useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type {
  Task, BaseRates, Signatures, CompanyInfo, ClientInfo, QuotationDetails, BillingDetails, ManualOverrides, TaskOverrides
} from '../../types/quotation'
import { calculateTaskTotal as calculateTaskSubtotal, calculateOverhead, getUnitPageCount } from '../../utils/quotation'
import { LAYOUT } from './constants'
import PrintPage from './components/PrintPage'
import { exportToExcel } from './utils/excelExport'
import { projectInchargesApi, clientsApi } from '../../services/api'

import { PrintTutorial } from './PrintTutorial'

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
  onQuotationDetailsChange?: (updates: Partial<QuotationDetails>) => void
  onBillingDetailsChange?: (updates: Partial<BillingDetails>) => void
  onClientInfoChange?: (updates: Partial<ClientInfo>) => void
  autoStartTutorial?: boolean
  onCompleteTutorial?: () => void
  layoutVariant?: 'special' | 'kemco'
  /** If false (role === 'user'), the Billing Preview tab is hidden entirely */
  canViewBilling?: boolean
}

/** A single page slice produced by computePages(). */
interface PageSlice<T> {
  tasks: T[]
  totals: number[]
  startIndex: number
}

const { A4_W_PX, A4_H_PX, TASKS_PER_PAGE_BILLING_STANDARD, TASKS_PER_PAGE_BILLING_FINAL, TASKS_PER_PAGE_QUOTATION_STANDARD, TASKS_PER_PAGE_QUOTATION_FINAL } = LAYOUT

// ── Pagination engine ──────────────────────────────────────────────────────

/**
 * Splits `items` into page slices of at most items per page.
 * Returns an array of PageSlice objects — one per rendered PrintPage.
 */
function computePages<T>(
  items: T[],
  calculateTotal: (item: T) => number,
  mode: 'quotation' | 'billing',
): PageSlice<T>[] {
  const finalLimit = mode === 'billing' ? TASKS_PER_PAGE_BILLING_FINAL : TASKS_PER_PAGE_QUOTATION_FINAL
  const standardLimit = mode === 'billing' ? TASKS_PER_PAGE_BILLING_STANDARD : TASKS_PER_PAGE_QUOTATION_STANDARD

  // Case 1: Simple one-page fit
  if (items.length <= finalLimit) {
    return [{
      tasks: items,
      totals: items.map(calculateTotal),
      startIndex: 0,
    }]
  }

  // Case 2: Multi-page logic
  const pages: PageSlice<T>[] = []
  let i = 0

  while (i < items.length) {
    const remainingCount = items.length - i
    const isLastPage = remainingCount <= finalLimit
    const limit = isLastPage ? finalLimit : standardLimit

    const slice = items.slice(i, i + limit)
    pages.push({
      tasks: slice,
      totals: slice.map(calculateTotal),
      startIndex: i,
    })
    i += limit

    // If we finished the items but the last page we rendered wasn't a "final" page
    if (i === items.length && !isLastPage) {
      pages.push({ tasks: [], totals: [], startIndex: i })
    }
  }

  return pages.length === 0
    ? [{ tasks: [], totals: [], startIndex: 0 }]
    : pages
}

// ── Component ──────────────────────────────────────────────────────────────

const PrintPreviewModal = memo(({
  isOpen, onClose,
  companyInfo, clientInfo, quotationDetails, billingDetails, tasks, baseRates, signatures,
  manualOverrides, onManualOverrideChange,
  onQuotationDetailsChange, onBillingDetailsChange,
  autoStartTutorial, onCompleteTutorial,
  layoutVariant = 'special',
  canViewBilling = false,
}: Props) => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [printMode, setPrintMode] = useState<'quotation' | 'billing'>('quotation')
  const [isCustomIncharge, setIsCustomIncharge] = useState(false)
  const [isCustomCustomer, setIsCustomCustomer] = useState(false)

  const [inchargesList, setInchargesList] = useState<string[]>([])
  const [clientsList, setClientsList] = useState<string[]>([])

  // Load project incharges and clients from API on mount/open
  useEffect(() => {
    if (isOpen) {
      projectInchargesApi.list().then(res => {
        if (Array.isArray(res.data)) {
          const names = res.data.map((i: any) => i.englishName).filter(Boolean)
          setInchargesList(names)
        }
      }).catch(err => console.error("Error fetching project incharges:", err))

      clientsApi.list().then(res => {
        if (Array.isArray(res.data)) {
          const names = res.data.map((c: any) => c.englishName).filter(Boolean)
          setClientsList(names)
        }
      }).catch(err => console.error("Error fetching clients:", err))
    }
  }, [isOpen])

  const handleAddIncharge = useCallback((val: string) => {
    if (!val) return
    onBillingDetailsChange?.({ projectInCharge: val })
    if (inchargesList.includes(val)) return

    projectInchargesApi.create({
      category: 'INCHARGE',
      englishName: val,
      email: '',
      japaneseName: ''
    }).then(() => {
      setInchargesList(prev => prev.includes(val) ? prev : [...prev, val])
    }).catch(err => {
      console.error("Error creating project incharge preset:", err)
    })
  }, [inchargesList, onBillingDetailsChange])

  const handleAddClient = useCallback((val: string) => {
    if (!val) return
    onBillingDetailsChange?.({ clientName: val })
    if (clientsList.includes(val)) return

    clientsApi.create({
      category: 'CLIENT',
      englishName: val,
      email: '',
      japaneseName: ''
    }).then(() => {
      setClientsList(prev => prev.includes(val) ? prev : [...prev, val])
    }).catch(err => {
      console.error("Error creating client preset:", err)
    })
  }, [clientsList, onBillingDetailsChange])

  // Guard: reset to quotation if billing tab is not permitted
  useEffect(() => {
    if (!canViewBilling && printMode === 'billing') setPrintMode('quotation')
  }, [canViewBilling])

  const [baseScale, setBaseScale] = useState(1)
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit')
  const [isTutorialOpen, setIsTutorialOpen] = useState(false)
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

  // Auto-start tutorial if requested
  useEffect(() => {
    if (isOpen && autoStartTutorial) {
      setIsTutorialOpen(true)
    }
  }, [isOpen, autoStartTutorial])

  // ── Per-task total calculation ─────────────────────────────────
  const calculateTaskTotal = useCallback(
    (task: Task): number => calculateTaskSubtotal(task, tasks, baseRates, manualOverrides).total,
    [tasks, baseRates, manualOverrides],
  )

  // ── Pagination ─────────────────────────────────────────────────
  const { pages, grandTotal, overheadTotal, lastAssemblyId } = useMemo(() => {
    if (layoutVariant === 'kemco') {
      // 1. Group tasks into KEMCO rows first
      interface KemcoRow {
        assemblyTask: Task
        subgroupTasks: Task[]
      }
      const kemcoRows: KemcoRow[] = []
      const level0Tasks = tasks.filter(t => t.level === 0)
      level0Tasks.forEach(assembly => {
        const subTasks = tasks.filter(t => t.parentId === assembly.id && t.level === 1)
        if (subTasks.length === 0) {
          kemcoRows.push({ assemblyTask: assembly, subgroupTasks: [] })
        } else {
          for (let k = 0; k < subTasks.length; k += 2) {
            kemcoRows.push({
              assemblyTask: assembly,
              subgroupTasks: subTasks.slice(k, k + 2)
            })
          }
        }
      })

      // 2. Paginate KEMCO rows with KEMCO-specific limits
      // KEMCO rows are more compact than standard tasks, so we use larger per-page limits
      // to avoid spurious 2nd pages with only the leasing fee row.
      const KEMCO_FINAL_LIMIT = 16   // max rows on final (only) page
      const KEMCO_STANDARD_LIMIT = 20 // max rows on non-final pages
      const computeKemcoPages = <T,>(items: T[]): PageSlice<T>[] => {
        if (items.length <= KEMCO_FINAL_LIMIT) {
          return [{ tasks: items, totals: items.map(() => 0), startIndex: 0 }]
        }
        const pages: PageSlice<T>[] = []
        let i = 0
        while (i < items.length) {
          const remainingCount = items.length - i
          const isLast = remainingCount <= KEMCO_FINAL_LIMIT
          const limit = isLast ? KEMCO_FINAL_LIMIT : KEMCO_STANDARD_LIMIT
          const slice = items.slice(i, i + limit)
          pages.push({ tasks: slice, totals: slice.map(() => 0), startIndex: i })
          i += limit
          if (i === items.length && !isLast) {
            pages.push({ tasks: [], totals: [], startIndex: i })
          }
        }
        return pages.length === 0 ? [{ tasks: [], totals: [], startIndex: 0 }] : pages
      }
      const slices = computeKemcoPages(kemcoRows)

      // 3. Map back to what PrintPage expects (pageTasks: Task[])
      const mappedPages = slices.map(slice => {
        const pageTasks: Task[] = []
        const seenAssemblyIds = new Set<number>()

        slice.tasks.forEach(row => {
          if (!seenAssemblyIds.has(row.assemblyTask.id)) {
            pageTasks.push(row.assemblyTask)
            seenAssemblyIds.add(row.assemblyTask.id)
          }
          pageTasks.push(...row.subgroupTasks)
        })

        return {
          tasks: pageTasks,
          totals: slice.totals,
          startIndex: slice.startIndex
        }
      })

      const allMainTasks = tasks.filter(t => t.isMainTask)
      const subtotal = allMainTasks.reduce((s, t) => s + calculateTaskTotal(t), 0)
      const footer = manualOverrides?.footer || {}
      const overhead = footer.overhead !== undefined
        ? footer.overhead
        : calculateOverhead(subtotal, baseRates.overheadPercentage)
      const grand = subtotal + overhead + (footer.adjustment || 0)

      const lastAssembly = tasks.slice().reverse().find(t => t.level === 0)
      const lastAssemblyId = lastAssembly?.id

      return { pages: mappedPages, grandTotal: grand, overheadTotal: overhead, lastAssemblyId }
    } else {
      const mainTasks = tasks.filter(t => t.isMainTask)
      const slices = computePages(mainTasks, calculateTaskTotal, printMode)

      const subtotal = slices.flatMap(p => p.totals).reduce((s, t) => s + t, 0)
      const footer = manualOverrides?.footer || {}
      const overhead = footer.overhead !== undefined
        ? footer.overhead
        : calculateOverhead(subtotal, baseRates.overheadPercentage)
      const grand = subtotal + overhead + (footer.adjustment || 0)

      return { pages: slices, grandTotal: grand, overheadTotal: overhead, lastAssemblyId: undefined }
    }
  }, [tasks, baseRates, calculateTaskTotal, manualOverrides, printMode, layoutVariant])

  const totalPages = pages.length

  // ── Unit-page helpers ──────────────────────────────────────────
  const resolveUnitPage = useCallback(
    (task: Task) => getUnitPageCount(task.id, tasks, manualOverrides),
    [tasks, manualOverrides],
  )

  const handleTaskOverride = useCallback((taskId: number, updates: Partial<TaskOverrides>) => {
    onManualOverrideChange(prev => ({
      ...prev,
      tasks: { ...prev.tasks, [taskId]: { ...(prev.tasks[taskId] || {}), ...updates } },
    }))
  }, [onManualOverrideChange])

  // ── Print style injection helper ────────────────────────────────
  // Shared between handlePrint and handleDownloadPDF to avoid duplication.
  const buildPrintStyleContent = () => `
    .ppm-header, .ppm-footer-bar, .ppm-backdrop, .ppm-sidebar,
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
    .quotation-visual-exact .text-red { color: red !important; }
    .quotation-visual-exact .nothing-follow { color: #888 !important; }
    .quotation-visual-exact input {
      border: none !important;
      background: transparent !important;
      outline: none !important;
      box-shadow: none !important;
      -webkit-appearance: none !important;
      appearance: none !important;
      color: inherit !important;
      padding: 0 !important;
      margin: 0 !important;
      width: 100% !important;
      height: 100% !important;
      line-height: inherit !important;
      font-family: inherit !important;
      font-size: inherit !important;
      font-weight: inherit !important;
      text-align: inherit !important;
    }
    .quotation-visual-exact [contenteditable] {
      border: none !important;
      outline: none !important;
      background: transparent !important;
      box-shadow: none !important;
      cursor: default !important;
      padding: 0 !important;
      margin: 0 !important;
      color: inherit !important;
      font-family: inherit !important;
      font-size: inherit !important;
      font-weight: inherit !important;
      text-align: inherit !important;
      white-space: pre-wrap !important;
    }
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
      const defaultName = `${docType}_${docNo.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`

      // Show save dialog first — before injecting print styles
      const dialogResult = await el.showSaveDialog({
        title: 'Save PDF',
        defaultPath: defaultName,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      })

      // User cancelled
      if (dialogResult.canceled || !dialogResult.filePath) return

      const savePath = dialogResult.filePath

      // Inject print styles
      styleEl = document.createElement('style')
      styleEl.id = '__kmti-pdf-print-override'
      styleEl.textContent = buildPrintStyleContent()
      document.head.appendChild(styleEl)
      await new Promise(r => setTimeout(r, 300))

      // Generate PDF
      const pdfResult = await el.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        landscape: false,
        margins: { marginType: 'none' }
      })

      if (!pdfResult.success || !pdfResult.data) {
        console.error('PDF generation failed:', pdfResult.error)
        return
      }

      // Write to disk
      await el.writeFile(savePath, pdfResult.data)
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      styleEl?.remove()
      setIsProcessing(false)
    }
  }, [printMode, billingDetails, quotationDetails])

  const handleExportExcel = useCallback(async () => {
    setIsProcessing(true)
    try {
      await exportToExcel({
        mode: printMode,
        quotNo: quotationDetails.quotationNo || 'Draft',
        clientInfo,
        quotationDetails,
        billingDetails,
        tasks,
        baseRates,
        manualOverrides,
        signatures,
        layoutVariant,
      })
    } catch (err) {
      console.error('Excel export failed:', err)
      alert('Failed to export Excel. Please check if the backend is running.')
    } finally {
      setIsProcessing(false)
    }
  }, [printMode, quotationDetails, clientInfo, billingDetails, tasks, baseRates, manualOverrides, signatures])

  // ── Status tracking change handler ─────────────────────────────
  const handleQuotationStatusChange = useCallback((val: string) => {
    if (!onBillingDetailsChange) return
    const updates: Partial<BillingDetails> = { quotationStatus: val }
    if (val === 'CANCELLED') {
      updates.projectStatus = 'CANCELLED'
      updates.updateDetail = 'CANCELLED'
    }
    onBillingDetailsChange(updates)
  }, [onBillingDetailsChange])

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
    layoutVariant, lastAssemblyId,
    onQuotationDetailsChange, onBillingDetailsChange,
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
            {canViewBilling && (
              <div className="ppm-mode-toggle">
                <div className={`ppm-mode-slider ${printMode}`} />
                <button
                  id="ppm-btn-quotation"
                  className={`ppm-mode-btn${printMode === 'quotation' ? ' active' : ''}`}
                  onClick={() => setPrintMode('quotation')}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                  Quotation Preview
                </button>
                <button
                  id="ppm-btn-billing"
                  className={`ppm-mode-btn${printMode === 'billing' ? ' active' : ''}`}
                  onClick={() => setPrintMode('billing')}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                  Billing Preview
                </button>
              </div>
            )}

            {canViewBilling && <div className="ppm-sep" />}

            <div className="ppm-export-group">
              <button id="ppm-btn-print" className="ppm-action-btn primary" onClick={handlePrint} disabled={isProcessing}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                {isProcessing ? 'Processing…' : 'Print'}
              </button>

              <button id="ppm-btn-pdf" className="ppm-action-btn export-pdf" onClick={handleDownloadPDF} disabled={isProcessing}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                PDF
              </button>

              <button id="ppm-btn-excel" className="ppm-action-btn export-excel" onClick={handleExportExcel} disabled={isProcessing}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
                Excel
              </button>
            </div>

            <button id="ppm-btn-close" className="ppm-close-btn" onClick={onClose}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="ppm-body" ref={containerRef}>
          <div className="ppm-body-content">
            <div className="ppm-scroll-area">
              <div
                className="ppm-a4-scaler"
                style={{ width: `${A4_W_PX * actualScale}px`, height: `${scalerHeight}px` }}
              >
                <div style={{ transform: `scale(${actualScale})`, transformOrigin: 'top left', width: `${A4_W_PX}px` }}>
                  <div ref={previewRef} className="preview-content">
                    {pages.map((page, pageIndex) => {
                      const isLastPage = pageIndex === pages.length - 1
                      const finalLimit = printMode === 'billing' ? TASKS_PER_PAGE_BILLING_FINAL : TASKS_PER_PAGE_QUOTATION_FINAL
                      const showAdmin = manualOverrides.footer?.showAdmin !== false

                      return (
                        <div key={pageIndex}>
                          {pageIndex > 0 && (
                            <div className="ppm-page-break-indicator">PAGE {pageIndex + 1}</div>
                          )}
                          <PrintPage
                            {...sharedPageProps}
                            allTasks={tasks}
                            isFirstPage={pageIndex === 0}
                            isContinuation={pageIndex > 0}
                            pageTasks={page.tasks.map(t => ({ ...t, unitPage: resolveUnitPage(t) }))}
                            pageTotals={page.totals}
                            startIndex={page.startIndex}
                            isLastPage={isLastPage}
                            onTaskOverride={handleTaskOverride}
                            showAdmin={showAdmin}
                            fillerRowCount={(() => {
                              // Strictly ensure exactly 10 rows total (or 14 for billing):
                              // Tasks + Admin + Nothing Follow + Fillers = finalLimit
                              const isKemco = layoutVariant === 'kemco'
                              const overheadCount = (!isKemco && showAdmin) ? 1 : 0
                              const nothingFollowCount = isKemco ? 0 : 1
                              const totalSoFar = page.tasks.length + overheadCount + nothingFollowCount

                              // Return exactly how many fillers are needed to hit the limit
                              return Math.max(0, finalLimit - totalSoFar)
                            })()}
                            isCompressed={layoutVariant === 'kemco' && page.tasks.length > 10}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Status & Tracking Controls */}
            <div className="ppm-sidebar">
              <div className="ppm-sidebar-header">
                <h3>Quotation Status</h3>
              </div>
              <div className="ppm-sidebar-body">
                <div className="ppm-sidebar-group">
                  <label htmlFor="ppm-sidebar-pincharge">Project Incharge</label>
                  {isCustomIncharge ? (
                    <input
                      type="text"
                      className="ppm-sidebar-input"
                      placeholder="Enter name..."
                      defaultValue={billingDetails?.projectInCharge || ''}
                      autoFocus
                      onBlur={e => {
                        const val = e.target.value.trim()
                        if (val) {
                          handleAddIncharge(val)
                        }
                        setIsCustomIncharge(false)
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const val = e.currentTarget.value.trim()
                          if (val) {
                            handleAddIncharge(val)
                          }
                          setIsCustomIncharge(false)
                        } else if (e.key === 'Escape') {
                          setIsCustomIncharge(false)
                        }
                      }}
                    />
                  ) : (
                    <select
                      id="ppm-sidebar-pincharge"
                      className="ppm-sidebar-select"
                      value={billingDetails?.projectInCharge || ''}
                      disabled={billingDetails?.quotationStatus === 'CANCELLED'}
                      onChange={e => {
                        const val = e.target.value
                        if (val === '__CUSTOM__') {
                          setIsCustomIncharge(true)
                        } else {
                          onBillingDetailsChange?.({ projectInCharge: val })
                        }
                      }}
                    >
                      <option value="">Select Incharge...</option>
                      {billingDetails?.projectInCharge && !inchargesList.includes(billingDetails.projectInCharge) && (
                        <option value={billingDetails.projectInCharge}>{billingDetails.projectInCharge}</option>
                      )}
                      {inchargesList.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                      <option value="__CUSTOM__">[ Add new ... ]</option>
                    </select>
                  )}
                </div>

                <div className="ppm-sidebar-group">
                  <label htmlFor="ppm-sidebar-customer">Customer</label>
                  {isCustomCustomer ? (
                    <input
                      type="text"
                      className="ppm-sidebar-input"
                      placeholder="Enter customer name"
                      defaultValue={billingDetails?.clientName || ''}
                      autoFocus
                      onBlur={e => {
                        const val = e.target.value.trim()
                        if (val) {
                          handleAddClient(val)
                        }
                        setIsCustomCustomer(false)
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const val = e.currentTarget.value.trim()
                          if (val) {
                            handleAddClient(val)
                          }
                          setIsCustomCustomer(false)
                        } else if (e.key === 'Escape') {
                          setIsCustomCustomer(false)
                        }
                      }}
                    />
                  ) : (
                    <select
                      id="ppm-sidebar-customer"
                      className="ppm-sidebar-select"
                      value={billingDetails?.clientName || ''}
                      disabled={billingDetails?.quotationStatus === 'CANCELLED'}
                      onChange={e => {
                        const val = e.target.value
                        if (val === '__CUSTOM__') {
                          setIsCustomCustomer(true)
                        } else {
                          onBillingDetailsChange?.({ clientName: val })
                        }
                      }}
                    >
                      <option value="">Select Customer...</option>
                      {billingDetails?.clientName && !clientsList.includes(billingDetails.clientName) && (
                        <option value={billingDetails.clientName}>{billingDetails.clientName}</option>
                      )}
                      {clientsList.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                      <option value="__CUSTOM__">[ Add new ... ]</option>
                    </select>
                  )}
                </div>

                {(canViewBilling || (billingDetails?.submittedToAdminAt && billingDetails?.quotationStatus !== 'DRAFT')) && (
                  <>
                    <div className="ppm-sidebar-group">
                      <label htmlFor="ppm-sidebar-qstatus">Quotation Status</label>
                      <select
                        id="ppm-sidebar-qstatus"
                        className="ppm-sidebar-select"
                        value={billingDetails?.quotationStatus || 'DRAFT'}
                        disabled={!canViewBilling}
                        onChange={e => handleQuotationStatusChange(e.target.value)}
                      >
                        <option value="DRAFT">DRAFT</option>
                        <option value="For Approval">For Approval</option>
                        <option value="Approved">Approved</option>
                        <option value="Partial Billing">Partial Billing</option>
                        <option value="Billing Completion">Billing Completion</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </div>

                    <div className="ppm-sidebar-group">
                      <label htmlFor="ppm-sidebar-pstatus">Project Status</label>
                      <select
                        id="ppm-sidebar-pstatus"
                        className="ppm-sidebar-select"
                        value={billingDetails?.projectStatus || 'On Going'}
                        disabled={!canViewBilling || billingDetails?.quotationStatus === 'CANCELLED'}
                        onChange={e => onBillingDetailsChange?.({ projectStatus: e.target.value })}
                      >
                        <option value="On Going">On Going</option>
                        <option value="Finished">Finished</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </div>

                    <div className="ppm-sidebar-group">
                      <label htmlFor="ppm-sidebar-submitted">Submitted to Admin</label>
                      <input
                        type="date"
                        id="ppm-sidebar-submitted"
                        className="ppm-sidebar-input"
                        value={billingDetails?.submittedToAdminAt || ''}
                        disabled={!canViewBilling}
                        onChange={e => onBillingDetailsChange?.({ submittedToAdminAt: e.target.value || null })}
                      />
                    </div>
                  </>
                )}

                {!canViewBilling && (!billingDetails?.submittedToAdminAt || billingDetails?.quotationStatus === 'DRAFT') && (() => {
                  const isMissingIncharge = !billingDetails?.projectInCharge;
                  const isMissingCustomer = !billingDetails?.clientName;
                  const isSubmitDisabled = isMissingIncharge || isMissingCustomer;

                  return (
                    <button
                      className="ppm-action-btn submit-to-admin-btn"
                      disabled={isSubmitDisabled}
                      style={{
                        width: '100%',
                        marginTop: '20px',
                        backgroundColor: isSubmitDisabled ? '#a3a3a3' : '#10b981',
                        color: 'white',
                        border: 'none',
                        padding: '10px',
                        borderRadius: '4px',
                        cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        opacity: isSubmitDisabled ? 0.75 : 1
                      }}
                      onClick={() => {
                        const todayStr = new Date().toISOString().split('T')[0]
                        onBillingDetailsChange?.({
                          quotationStatus: 'For Approval',
                          submittedToAdminAt: todayStr
                        })
                        // Close preview or update UI
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 2 11 13 22 2"></polyline>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                      </svg>
                      Submit to Admin
                    </button>
                  );
                })()}
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

      <PrintTutorial
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        onComplete={onCompleteTutorial}
      />
    </div>
  )
})

PrintPreviewModal.displayName = 'PrintPreviewModal'
export default PrintPreviewModal
