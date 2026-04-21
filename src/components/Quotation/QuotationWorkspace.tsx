/**
 * QuotationWorkspace.tsx
 * ──────────────────────────────────────────────────────────────────────────
 * The full quotation editor. Only mounted AFTER the user has selected a
 * session in the Workspace lobby gate (QuotationEntryModal).
 *
 * Props are the session config decided in the lobby:
 *   - quotNo      : the collaboration room ID (already assigned)
 *   - password    : optional room password
 *   - displayName : optional human-readable room label
 *
 * This separation ensures that useCollaboration (and thus Socket.IO)
 * is never instantiated until a session is explicitly chosen, eliminating
 * ghost-room creation on the backend.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useModal } from '../ModalContext'
import {
  useInvoiceState,
  useFileOperations,
  makeBlankTask
} from '../../hooks/quotation'
import { useCollaboration } from '../../hooks/quotation/useCollaboration'
import { useAuth } from '../../context/AuthContext'
import { CollaborationProvider } from '../../context/CollaborationContext'
import {
  CompanyInfo,
  ClientInfo,
  QuotationDetailsCard,
  BillingDetailsCard,
  TasksTable,
  SignatureForm,
  PrintPreviewModal,
  BaseRatesPanel
} from './index'
import { CollaborationBar } from './CollaborationBar'
import { HistorySidebar } from './HistorySidebar'
import '../../pages/quotation/QuotationApp.css'
import '../../pages/Quotation.css'

export interface WorkspaceSession {
  quotNo: string
  password?: string
  displayName?: string
  /**
   * 'create'  — blank new room (resetToNew on mount)
   * 'join'    — existing room (server state syncs via socket on join)
   */
  mode: 'create' | 'join'
}

interface Props extends WorkspaceSession {
  /** Called when user clicks "Workspace" to return to the lobby. */
  onLeave: () => void
}

export default function QuotationWorkspace({ quotNo, password, displayName, mode, onLeave }: Props) {
  const { notify } = useModal()
  const { user } = useAuth()

  // ── UI States ──────────────────────────────────────────────────
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false)
  const [isBaseRatesPanelOpen, setIsBaseRatesPanelOpen] = useState(false)
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [recentEdits, setRecentEdits] = useState<Record<string, { color: string; timestamp: number }>>({})
  const [previewData, setPreviewData] = useState<any | null>(null)
  const [activePreviewTs, setActivePreviewTs] = useState<string | null>(null)

  // ── Document State ─────────────────────────────────────────────
  const {
    companyInfo, clientInfo, quotationDetails, billingDetails,
    tasks, baseRates, signatures, manualOverrides, collapsedTaskIds,
    currentFilePath, hasUnsavedChanges, selectedMainTaskId,
    updateCompanyInfo, updateClientInfo, updateQuotationDetails, updateBillingDetails,
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
    currentFilePath, // crucial for silent overwrite
  })

  // ── Browse-payload hydration / initial state setup ────────────────
  // Runs once on mount to set the document into the correct initial state
  // based on how the session was entered.
  //
  // For browse mode, we also stash the loaded data in a ref so the Authority
  // Push effect below can emit it to the collab room once the socket connects.
  // This decouples hydration (synchronous, immediate) from the socket handshake
  // (async, may arrive 100–500ms later) and eliminates the race condition where
  // a collaborator joins before the room has any state.

  useEffect(() => {
    if (mode === 'create') {
      // New blank room — generate clean state with this room's quotNo
      resetToNew(quotNo)
    }
  }, []) // runs once on mount only

  // ── Real-Time Collaboration ──────────────────────────────────────
  // Clear old activity highlights every 3 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now()
      setRecentEdits(prev => {
        const next = { ...prev }
        let changed = false
        Object.entries(next).forEach(([path, info]) => {
          if (now - info.timestamp > 3000) {
            delete next[path]
            changed = true
          }
        })
        return changed ? next : prev
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const {
    isConnected,
    remoteUsers,
    myEffectiveName,
    myColor,
    emitFocus,
    emitBlur,
    emitSelection,
    emitPatch,
    emitSnapshot
  } = useCollaboration({
    quotNo: quotNo,
    password,
    displayName,
    userName: user?.username || 'User',
    onUserJoined: (u) => notify(`${u.name} joined the session`, 'success'),
    onUserLeft: (u) => notify(`${u.name} left the session`, 'info'),
    onRemotePatch: (patch: { path: string; value: any }, sid: string) => {
      const userColor = remoteUsers[sid]?.color || '#4A90D9'
      if (patch.path !== '__full_restore__') {
        setRecentEdits(prev => ({
          ...prev,
          [patch.path]: { color: userColor, timestamp: Date.now() }
        }))
      }

      if (patch.path === '__full_restore__') {
        loadData(patch.value, 'remote_restore')
      } else if (patch.path.startsWith('companyInfo.')) {
        const key = patch.path.split('.')[1]
        updateCompanyInfo(prev => ({ ...prev, [key]: patch.value }))
      } else if (patch.path.startsWith('clientInfo.')) {
        const key = patch.path.split('.')[1]
        updateClientInfo(prev => ({ ...prev, [key]: patch.value }))
      } else if (patch.path.startsWith('quotationDetails.')) {
        const key = patch.path.split('.')[1]
        updateQuotationDetails({ [key as any]: patch.value })
      } else if (patch.path.startsWith('billingDetails.')) {
        const key = patch.path.split('.')[1]
        updateBillingDetails({ [key as any]: patch.value })
      } else if (patch.path.startsWith('signatures.')) {
        const parts = patch.path.split('.')
        updateSignatures(parts[1] as any, parts[2], patch.value)
      } else if (patch.path.startsWith('task.')) {
        const parts = patch.path.split('.')
        const taskId = parseInt(parts[1])
        const field = parts[2] as any
        updateTask(taskId, field, patch.value)
      } else if (patch.path.startsWith('footer.')) {
        const footerKey = patch.path.split('.')[1]
        updateManualOverrides(prev => ({
          ...prev,
          footer: { ...prev.footer, [footerKey]: patch.value }
        }))
      } else if (patch.path.startsWith('baseRates.')) {
        const key = patch.path.split('.')[1] as keyof typeof baseRates
        updateBaseRate(key, patch.value)
      } else if (patch.path === 'tasks.add') {
        addTask(patch.value)
      } else if (patch.path === 'tasks.add_sub') {
        addSubTask(patch.value.parentId, undefined, patch.value)
      } else if (patch.path === 'tasks.remove') {
        removeTask(patch.value)
      } else if (patch.path === 'tasks.reorder') {
        reorderTasks(patch.value.draggedId, patch.value.targetId)
      }
    },
    onAuditEntry: (entry) => {
      setAuditLogs(prev => {
        const idx = prev.findIndex(item => item.id === entry.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = entry
          return next
        }
        return [entry, ...prev.slice(0, 49)]
      })
    },
    onError: (msg: string) => {
      notify?.(msg, 'error')
      // Session error — kick user back to lobby
      onLeave()
    }
  })


  // ── Wrapped Update Handlers for Sync ───────────────────────────
  const syncCompanyInfo = useCallback((updates: typeof companyInfo) => {
    updateCompanyInfo(updates)
    const fullState = getSaveData()
    Object.entries(updates).forEach(([k, v]) => {
      emitPatch({ path: `companyInfo.${k}`, value: v }, fullState)
    })
  }, [updateCompanyInfo, emitPatch, getSaveData])

  const syncClientInfo = useCallback((updates: typeof clientInfo) => {
    updateClientInfo(updates)
    const fullState = getSaveData()
    Object.entries(updates).forEach(([k, v]) => {
      emitPatch({ path: `clientInfo.${k}`, value: v }, fullState)
    })
  }, [updateClientInfo, emitPatch, getSaveData])

  const syncQuotationDetails = useCallback((updates: Partial<typeof quotationDetails>) => {
    updateQuotationDetails(updates)
    const fullState = getSaveData()
    Object.entries(updates).forEach(([k, v]) => {
      emitPatch({ path: `quotationDetails.${k}`, value: v }, fullState)
    })
  }, [updateQuotationDetails, emitPatch, getSaveData])

  const syncBillingDetails = useCallback((updates: Partial<typeof billingDetails>) => {
    updateBillingDetails(updates)
    const fullState = getSaveData()
    Object.entries(updates).forEach(([k, v]) => {
      emitPatch({ path: `billingDetails.${k}`, value: v }, fullState)
    })
  }, [updateBillingDetails, emitPatch, getSaveData])

  const syncSignatures = useCallback((type: keyof typeof signatures, field: string, value: any) => {
    updateSignatures(type, field, value)
    emitPatch({ path: `signatures.${type}.${field}`, value }, getSaveData())
  }, [updateSignatures, emitPatch, getSaveData])

  const syncUpdateTask = useCallback((id: number, field: any, value: any) => {
    updateTask(id, field, value)
    emitPatch({ path: `task.${id}.${field}`, value }, getSaveData())
  }, [updateTask, emitPatch, getSaveData])

  const syncAddTask = useCallback(() => {
    const newTask = makeBlankTask()
    addTask(newTask)
    emitPatch({ path: 'tasks.add', value: newTask }, getSaveData())
  }, [addTask, emitPatch, getSaveData])

  const syncAddSubTask = useCallback((mainTaskId: number | null) => {
    if (!mainTaskId) {
      notify?.('Please select a main task first to add a sub-task.', 'warning')
      return
    }
    const newSubTask = {
      ...makeBlankTask(),
      isMainTask: false,
      parentId: mainTaskId
    }
    addSubTask(mainTaskId, notify, newSubTask)
    emitPatch({ path: 'tasks.add_sub', value: newSubTask }, getSaveData())
  }, [addSubTask, emitPatch, getSaveData, notify])

  const syncRemoveTask = useCallback((id: number) => {
    removeTask(id)
    emitPatch({ path: 'tasks.remove', value: id }, getSaveData())
  }, [removeTask, emitPatch, getSaveData])

  const syncReorderTasks = useCallback((draggedId: number, targetId: number) => {
    reorderTasks(draggedId, targetId)
    emitPatch({ path: 'tasks.reorder', value: { draggedId, targetId } }, getSaveData())
  }, [reorderTasks, emitPatch, getSaveData])

  const syncUpdateFooter = useCallback((key: string, value: any) => {
    updateManualOverrides(prev => ({
      ...prev,
      footer: { ...prev.footer, [key]: value }
    }))
    emitPatch({ path: `footer.${key}`, value }, getSaveData())
  }, [updateManualOverrides, emitPatch, getSaveData])

  const syncBaseRate = useCallback((field: keyof typeof baseRates, value: number) => {
    updateBaseRate(field, value)
    emitPatch({ path: `baseRates.${field}`, value }, getSaveData())
  }, [updateBaseRate, emitPatch, getSaveData])

  // Sync window title with document identity + unsaved state
  useEffect(() => {
    const docName = quotationDetails.quotationNo || quotNo
    const unsaved = hasUnsavedChanges ? '● ' : ''
    document.title = `${unsaved}${docName} — KMTI Quotation`
    return () => { document.title = 'KMTI Workstation' }
  }, [quotNo, quotationDetails.quotationNo, hasUnsavedChanges])

  // Reset preview and logs when switching quotations
  useEffect(() => {
    handleExitPreview()
    setAuditLogs([])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotationDetails.quotationNo])

  const formatToolbarDate = useCallback((dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }, [])

  const handleSave = async () => {
    const savedPath = await saveInvoice()
    if (savedPath) {
      emitSnapshot(getSaveData(), 'Manual Save')
    }
  }

  // ── Auto-save (Every 5 minutes) ───────────────────────────────
  useEffect(() => {
    // Only auto-save if we are the primary "connected" workstation
    // and there are actual changes to save.
    if (!isConnected) return
    
    const interval = setInterval(async () => {
      if (hasUnsavedChanges) {
        const savedPath = await saveInvoice(true) // silent auto-save
        if (savedPath) {
          emitSnapshot(getSaveData(), 'Auto-save')
        }
      }
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [hasUnsavedChanges, isConnected, saveInvoice, emitSnapshot, getSaveData])

  const handlePreview = (data: any, ts: string) => {
    setPreviewData(data)
    setActivePreviewTs(ts)
    notify(`Previewing version from ${ts}`, 'info')
  }

  const handleExitPreview = () => {
    setPreviewData(null)
    setActivePreviewTs(null)
  }

  const handleFinalRestore = () => {
    if (!previewData) return
    loadData(previewData, 'version_restore')
    emitPatch({ path: '__full_restore__', value: previewData }, previewData)
    setPreviewData(null)
    setActivePreviewTs(null)
    notify('Version restored successfully!', 'success')
  }

  // Calculate effective data for rendering (preview vs live)
  const isPreview = !!previewData
  const effComp = previewData?.companyInfo || companyInfo
  const effClient = previewData?.clientInfo || clientInfo
  const effDetails = previewData?.quotationDetails || quotationDetails
  const effBilling = previewData?.billingDetails || billingDetails
  const effTasks = previewData?.tasks || tasks
  const effBaseRates = previewData?.baseRates || baseRates
  const effSignatures = previewData?.signatures || signatures
  const effOverrides = previewData?.manualOverrides || manualOverrides

  const collValue = useMemo(() => ({
    isConnected,
    remoteUsers,
    myColor,
    recentEdits,
    emitFocus,
    emitBlur,
    emitSelection,
    emitPatch,
    emitSnapshot
  }), [isConnected, remoteUsers, myColor, recentEdits, emitFocus, emitBlur, emitSelection, emitPatch, emitSnapshot])

  return (
    <CollaborationProvider value={collValue}>
      <div className="quot-app-root">
        {/* ── Toolbar ──────────────────────────────────────────── */}
        <div className="quot-toolbar">

          {/* Left: Document identity */}
          <div className="quot-toolbar-identity">
            <div className="quot-doc-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="quot-doc-meta">
              <div className="quot-doc-primary">
                <span className="quot-doc-number">
                  {quotationDetails.quotationNo || quotNo}
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
                  <span className="quot-file-path"> · {currentFilePath.split(/[\\\/]/).pop()}</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="quot-toolbar-actions">
            <CollaborationBar
              isConnected={isConnected}
              remoteUsers={remoteUsers}
              myColor={myColor}
              userName={myEffectiveName}
              quotNo={quotNo}
            />
            <button id="quot-btn-new" className="btn btn-ghost" onClick={newInvoice}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              New
            </button>
            <button id="quot-btn-save" className="btn btn-ghost" onClick={handleSave}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
              </svg>
              Save
            </button>
            <button id="quot-btn-load" className="btn btn-ghost" onClick={loadInvoice}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              Load
            </button>
            <button className="btn btn-ghost" onClick={onLeave} title="Return to lobby">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Workspace
            </button>
            <button id="quot-btn-print" className="btn btn-primary" onClick={() => setIsPrintPreviewOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print / PDF
            </button>
          </div>
        </div>

        {/* ── Sidebar + Main Area ──────────────────────────────── */}
        <div className="quot-layout">

          {/* Collapsible Version History Sidebar */}
          <HistorySidebar
            quotNo={quotNo}
            onRestore={(data) => {
              loadData(data, 'version_restore')
              emitPatch({ path: '__full_restore__', value: data }, data)
              notify('Version restored successfully!', 'success')
            }}
            onPreview={handlePreview}
            previewingTs={activePreviewTs}
            auditLogs={auditLogs}
            workstationName={myEffectiveName}
          />

          {/* Main scrollable content */}
          <div className="quot-main-area">
            {isPreview && (
              <div className="history-preview-banner">
                <div className="history-preview-banner__content">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span>Reviewing history version from <strong>{activePreviewTs}</strong>. This view is read-only.</span>
                </div>
                <div className="history-preview-banner__actions">
                  <button className="btn btn-outline btn-sm" onClick={handleExitPreview}>Exit Preview</button>
                  <button className="btn btn-primary btn-sm" onClick={handleFinalRestore}>Restore This Version</button>
                </div>
              </div>
            )}
            <div className="quot-body">
              <div className="quot-content-wrapper">

                {/* Top info row: Company | Client | Document Details */}
                <div className="quot-info-row">
                  <CompanyInfo companyInfo={effComp} onUpdate={isPreview ? undefined : syncCompanyInfo} />
                  <ClientInfo clientInfo={effClient} onUpdate={isPreview ? undefined : syncClientInfo} />
                  <QuotationDetailsCard
                    quotationDetails={effDetails}
                    onUpdate={isPreview ? undefined : syncQuotationDetails}
                  />
                </div>

                {/* Tasks Computation Table */}
                <TasksTable
                  tasks={effTasks}
                  baseRates={effBaseRates}
                  selectedMainTaskId={selectedMainTaskId}
                  onTaskUpdate={isPreview ? undefined : syncUpdateTask}
                  onTaskAdd={isPreview ? undefined : syncAddTask}
                  onSubTaskAdd={isPreview ? undefined : syncAddSubTask}
                  onTaskRemove={isPreview ? undefined : syncRemoveTask}
                  onTaskReorder={isPreview ? undefined : syncReorderTasks}
                  onMainTaskSelect={setSelectedMainTaskId}
                  onBaseRateUpdate={isPreview ? undefined : syncBaseRate}
                  manualOverrides={effOverrides}
                  setManualOverrides={isPreview ? undefined : updateManualOverrides}
                  onFooterUpdate={isPreview ? undefined : syncUpdateFooter}
                  collapsedTasks={new Set(collapsedTaskIds)}
                  onCollapsedTasksChange={(set) => setCollapsedTaskIds(Array.from(set))}
                  onOpenRateSettings={isPreview ? undefined : () => setIsBaseRatesPanelOpen(true)}
                  notify={notify}
                />

                {/* Signature Forms */}
                <SignatureForm
                  signatures={effSignatures}
                  onUpdate={isPreview ? undefined : syncSignatures}
                />

                <BillingDetailsCard
                  billingDetails={effBilling}
                  onUpdateBilling={isPreview ? undefined : syncBillingDetails}
                  onUpdateQuotation={isPreview ? undefined : syncQuotationDetails}
                />

                {/* Bottom Spacer */}
                <div className="quot-bottom-spacer" style={{ height: '40px', flexShrink: 0 }} />

              </div>
            </div>
          </div>
        </div>

        {/* ── Base Rates Panel ──────────────────────────────────── */}
        <BaseRatesPanel
          isOpen={isBaseRatesPanelOpen}
          onClose={() => setIsBaseRatesPanelOpen(false)}
          baseRates={baseRates}
          onUpdate={syncBaseRate}
        />

        <PrintPreviewModal
          isOpen={isPrintPreviewOpen}
          onClose={() => setIsPrintPreviewOpen(false)}
          companyInfo={companyInfo}
          clientInfo={clientInfo}
          quotationDetails={quotationDetails}
          billingDetails={billingDetails}
          tasks={tasks}
          baseRates={baseRates}
          signatures={signatures}
          manualOverrides={manualOverrides}
          onManualOverrideChange={updateManualOverrides}
        />
      </div>
    </CollaborationProvider>
  )
}
