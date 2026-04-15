import { useState, useCallback, useEffect } from 'react'
import { useModal } from '../components/ModalContext'
import { useInvoiceState, useFileOperations } from '../hooks/quotation'
import {
  CompanyInfo,
  ClientInfo,
  QuotationDetailsCard,
  TasksTable,
  SignatureForm,
  PrintPreviewModal,
} from '../components/Quotation'
import BaseRatesPanel from '../components/Quotation/BaseRatesPanel'
import './quotation/QuotationApp.css'
import './Quotation.css'

export default function Quotation() {
  const { notify } = useModal()
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false)
  const [isBaseRatesPanelOpen, setIsBaseRatesPanelOpen] = useState(false)

  const {
    companyInfo, clientInfo, quotationDetails,
    tasks, baseRates, signatures, manualOverrides, collapsedTaskIds,
    currentFilePath, hasUnsavedChanges, selectedMainTaskId,
    updateCompanyInfo, updateClientInfo, updateQuotationDetails,
    addTask, addSubTask, removeTask, updateTask, reorderTasks,
    updateBaseRate, updateSignatures,
    setSelectedMainTaskId, updateManualOverrides, setCollapsedTaskIds, resetToNew, loadData, getSaveData,
    markSaved,
  } = useInvoiceState()

  const getQuotationNo = useCallback(() => quotationDetails.quotationNo, [quotationDetails.quotationNo])

  const { newInvoice, saveInvoice, loadInvoice } = useFileOperations({
    hasUnsavedChanges,
    getSaveData,
    getQuotationNo,
    loadData,
    resetToNew,
    markSaved,
    notify,
  })

  // Sync window title with document identity + unsaved state
  useEffect(() => {
    const docName = quotationDetails.quotationNo || 'New Document'
    const unsaved = hasUnsavedChanges ? '● ' : ''
    document.title = `${unsaved}${docName} — KMTI Quotation`
    return () => { document.title = 'KMTI Workstation' }
  }, [quotationDetails.quotationNo, hasUnsavedChanges])


  // Format date for display in toolbar: "13 Apr 2026"
  const formatToolbarDate = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="quot-app-root">
      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="quot-toolbar">

        {/* Left: Document identity */}
        <div className="quot-toolbar-identity">
          <div className="quot-doc-icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div className="quot-doc-meta">
            <div className="quot-doc-primary">
              <span className="quot-doc-number">
                {quotationDetails.quotationNo || 'New Document'}
              </span>
              {hasUnsavedChanges && (
                <span className="quot-unsaved-dot" title="Unsaved changes" />
              )}
            </div>
            <div className="quot-doc-secondary">
              {quotationDetails.date
                ? formatToolbarDate(quotationDetails.date)
                : 'No date set'}
              {typeof currentFilePath === 'string' && (
                <span className="quot-file-path"> · {currentFilePath.split(/[\\/]/).pop()}</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="quot-toolbar-actions">
          <button id="quot-btn-new" className="btn btn-ghost" onClick={newInvoice}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            New
          </button>
          <button id="quot-btn-save" className="btn btn-ghost" onClick={saveInvoice}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
            </svg>
            Save
          </button>
          <button id="quot-btn-load" className="btn btn-ghost" onClick={loadInvoice}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            Load
          </button>
          <button id="quot-btn-print" className="btn btn-primary" onClick={() => setIsPrintPreviewOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Print / PDF
          </button>
        </div>
      </div>

      {/* ── Scrollable body ──────────────────────────────────── */}
      <div className="quot-body">
        <div className="quot-content-wrapper">

          {/* Top info row: Company | Client | Document Details */}
          <div className="quot-info-row">
            <CompanyInfo companyInfo={companyInfo} onUpdate={updateCompanyInfo} />
            <ClientInfo
              clientInfo={clientInfo}
              onUpdate={updateClientInfo}
            />
            <QuotationDetailsCard
              quotationDetails={quotationDetails}
              onUpdate={updateQuotationDetails}
            />
          </div>

          {/* Tasks Computation Table */}
          <TasksTable
            tasks={tasks}
            baseRates={baseRates}
            selectedMainTaskId={selectedMainTaskId}
            onTaskUpdate={updateTask}
            onTaskAdd={addTask}
            onSubTaskAdd={addSubTask}
            onTaskRemove={removeTask}
            onTaskReorder={reorderTasks}
            onMainTaskSelect={setSelectedMainTaskId}
            onBaseRateUpdate={updateBaseRate}
            manualOverrides={manualOverrides}
            setManualOverrides={updateManualOverrides}
            collapsedTasks={new Set(collapsedTaskIds)}
            onCollapsedTasksChange={(set) => setCollapsedTaskIds(Array.from(set))}
            onOpenRateSettings={() => setIsBaseRatesPanelOpen(true)}
            notify={notify}
          />

          {/* Signature Forms */}
          <SignatureForm
            signatures={signatures}
            onUpdate={updateSignatures}
          />

        </div>
      </div>

      {/* ── Base Rates Panel ──────────────────────────────────── */}
      <BaseRatesPanel
        isOpen={isBaseRatesPanelOpen}
        onClose={() => setIsBaseRatesPanelOpen(false)}
        baseRates={baseRates}
        onUpdate={updateBaseRate}
      />

      {/* ── Print / PDF Preview Modal ─────────────────────────── */}
      <PrintPreviewModal
        isOpen={isPrintPreviewOpen}
        onClose={() => setIsPrintPreviewOpen(false)}
        companyInfo={companyInfo}
        clientInfo={clientInfo}
        quotationDetails={quotationDetails}
        tasks={tasks}
        baseRates={baseRates}
        signatures={signatures}
        manualOverrides={manualOverrides}
      />
    </div>
  )
}
