import { useState, useCallback } from 'react'
import { useModal } from '../components/ModalContext'
import { useInvoiceState, useFileOperations } from '../hooks/quotation'
import type { ManualOverrides, Task } from '../hooks/quotation'
import {
  QuotationDetails,
  CompanyInfo,
  ClientInfo,
  TasksTable,
  SignatureForm,
  PrintPreviewModal,
} from '../components/Quotation'
import './quotation/QuotationApp.css'
import './Quotation.css'

export default function Quotation() {
  const { notify } = useModal()
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false)
  const [manualOverrides, setManualOverrides] = useState<ManualOverrides>({})

  const {
    companyInfo, clientInfo, quotationDetails,
    tasks, baseRates, signatures,
    currentFilePath, hasUnsavedChanges, selectedMainTaskId,
    updateCompanyInfo, updateClientInfo, updateQuotationDetails,
    addTask, addSubTask, removeTask, updateTask, reorderTasks,
    updateBaseRate, updateSignatures,
    setSelectedMainTaskId, resetToNew, loadData, getSaveData,
    setCurrentFilePath, setHasUnsavedChanges,
  } = useInvoiceState()

  const { newInvoice, saveInvoice, loadInvoice } = useFileOperations({
    hasUnsavedChanges,
    getSaveData,
    loadData,
    resetToNew,
    setCurrentFilePath,
    setHasUnsavedChanges,
    notify,
  })

  const handleManualOverridesChange = useCallback(
    (overrides: ManualOverrides) => setManualOverrides(overrides),
    []
  )

  const handleUpdateTasks = useCallback(
    (editedTasks: Partial<Task>[]) => {
      editedTasks.forEach(edited => {
        if (edited.id != null) {
          const fields = Object.keys(edited).filter(k => k !== 'id') as (keyof Task)[]
          fields.forEach(field => updateTask(edited.id!, field, (edited as any)[field]))
        }
      })
    },
    [updateTask]
  )

  return (
    <div className="quot-app-root">
      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="quot-toolbar">
        <div className="quot-toolbar-info">
          {currentFilePath && (
            <span className="quot-file-status">
              {currentFilePath}{hasUnsavedChanges && ' • Edited'}
            </span>
          )}
          {!currentFilePath && hasUnsavedChanges && (
            <span className="quot-file-status">Unsaved • New document</span>
          )}
        </div>
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

          {/* Quotation Details */}
          <QuotationDetails
            quotationDetails={quotationDetails}
            onUpdate={updateQuotationDetails}
          />

          {/* Company + Client Info */}
          <div className="quot-info-row">
            <CompanyInfo companyInfo={companyInfo} onUpdate={updateCompanyInfo} />
            <ClientInfo clientInfo={clientInfo} onUpdate={updateClientInfo} />
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
            onManualOverridesChange={handleManualOverridesChange}
            notify={notify}
          />

          {/* Signature Forms */}
          <SignatureForm
            signatures={signatures}
            onUpdate={updateSignatures}
          />

        </div>
      </div>

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
        onUpdateTasks={handleUpdateTasks}
        onUpdateManualOverrides={setManualOverrides}
      />
    </div>
  )
}
