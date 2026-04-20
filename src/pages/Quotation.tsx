import { useState, useCallback, useEffect } from 'react'
import { useModal } from '../components/ModalContext'
import { 
  useInvoiceState, 
  useFileOperations,
  makeBlankTask,
  Task, 
  CompanyInfo as CompanyInfoType, 
  ClientInfo as ClientInfoType 
} from '../hooks/quotation'
import { useCollaboration } from '../hooks/quotation/useCollaboration'
import { useAuth } from '../context/AuthContext'
import { CollaborationProvider } from '../context/CollaborationContext'
import {
  CompanyInfo,
  ClientInfo,
  QuotationDetailsCard,
  BillingDetailsCard,
  TasksTable,
  SignatureForm,
  PrintPreviewModal,
  BaseRatesPanel
} from '../components/Quotation'
import { CollaborationBar } from '../components/Quotation/CollaborationBar'
import { HistorySidebar } from '../components/Quotation/HistorySidebar'
import QuotationEntryModal from '../components/Quotation/QuotationEntryModal'
import api from '../services/api'
import './quotation/QuotationApp.css'
import './Quotation.css'

export default function Quotation() {
  const { notify, alert } = useModal()
  const { user } = useAuth()

  // ── UI States ──────────────────────────────────────────────────
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false)
  const [isBaseRatesPanelOpen, setIsBaseRatesPanelOpen] = useState(false)
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [roomPassword, setRoomPassword] = useState<string | undefined>()
  const [roomDisplayName, setRoomDisplayName] = useState<string | undefined>()
  const [recentEdits, setRecentEdits] = useState<Record<string, { color: string; timestamp: number }>>({})

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

  const [isLobbyOpen, setIsLobbyOpen] = useState(!currentFilePath)

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
    mySessionId,
    emitFocus,
    emitBlur,
    emitSelection,
    emitPatch
  } = useCollaboration({
    quotNo: quotationDetails.quotationNo || null,
    password: roomPassword,
    displayName: roomDisplayName,
    userName: user?.username || 'User',
    onUserJoined: (u) => notify(`${u.name} joined the session`, 'success'),
    onUserLeft: (u) => notify(`${u.name} left the session`, 'info'),
    onRemotePatch: (patch, sid) => {
      // Find the user's color for the highlight
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
        updateQuotationDetails({ [key]: patch.value })
      } else if (patch.path.startsWith('billingDetails.')) {
        const key = patch.path.split('.')[1]
        updateBillingDetails({ [key]: patch.value })
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
      setAuditLogs(prev => [entry, ...prev.slice(0, 49)])
    },
    onError: (msg) => {
      notify?.(msg, 'error')
      setIsLobbyOpen(true)
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
    // We let useInvoiceState do its thing but we need to know the task it made
    // Actually it's easier to make it here so we have the ID to sync
    if (!mainTaskId) {
      notify?.('Please select a main task first to add a sub-task.', 'warning')
      return;
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
    const docName = quotationDetails.quotationNo || 'New Document'
    const unsaved = hasUnsavedChanges ? '● ' : ''
    document.title = `${unsaved}${docName} — KMTI Quotation`
    return () => { document.title = 'KMTI Workstation' }
  }, [quotationDetails.quotationNo, hasUnsavedChanges])

  // Ensure lobby state stays in sync if path changes externally
  useEffect(() => {
    if (currentFilePath) setIsLobbyOpen(false)
  }, [currentFilePath])

  const formatToolbarDate = useCallback((dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }, [])

  const handleJoinSession = async (quotNo: string, password?: string) => {
    try {
      setRoomPassword(password)
      // We try to load the file, but if it's a "New" room without a file, 
      // the backend now returns a blank template instead of 404.
      const res = await api.get(`/quotations/${encodeURIComponent(quotNo)}`)
      loadData(res.data, `${quotNo}.json`)
      setIsLobbyOpen(false)
    } catch (e) {
      notify?.('Failed to join session. The room might have been closed.', 'error')
    }
  }

  const handleCreateNew = async (roomName: string, password?: string) => {
    setRoomPassword(undefined)
    setRoomDisplayName(roomName || undefined)

    resetToNew()  // generates KMTE-YYMMDD-NNN

    setTimeout(() => {
      setRoomPassword(password)
      setIsLobbyOpen(false)
    }, 0)
  }

  const handleBrowse = async () => {
    // Wrap performLoad so we can detect success vs cancellation.
    // loadInvoice() is void — we check currentFilePath after a tick instead.
    const prevFilePath = currentFilePath

    // Perform the load — this mutates state directly via loadData()
    // We need to hook into the result, so we duplicate the electron/file logic
    // here at the Quotation level to also generate a new workspace ID.
    try {
      const electronAPI = (window as any).electronAPI
      const defaultNASPath = '\\\\KMTI-NAS\\Shared\\data\\template'

      let data: any = null
      let fileName = ''

      if (electronAPI?.showOpenDialog && electronAPI?.readFile) {
        const { filePath, canceled } = await electronAPI.showOpenDialog({
          title: 'Browse Quotation Templates on NAS',
          defaultPath: defaultNASPath,
          filters: [{ name: 'KMTI Quotations', extensions: ['json'] }],
          properties: ['openFile']
        })
        if (canceled || !filePath) return  // user cancelled — keep lobby open
        const contents = await electronAPI.readFile(filePath)
        if (!contents) throw new Error('File is empty or could not be read')
        data = JSON.parse(contents)
        fileName = filePath.split(/[\\/]/).pop() || 'Quotation'
        markSaved(filePath)
      } else {
        // Web fallback via File System Access API
        const [fileHandle] = await (window as any).showOpenFilePicker({
          types: [{ description: 'KMTI Quotation files', accept: { 'application/json': ['.json'] } }],
        })
        const file = await fileHandle.getFile()
        const contents = await file.text()
        data = JSON.parse(contents)
        fileName = fileHandle.name
      }

      if (!data) return

      // Generate a fresh workspace ID from the filename so this opens
      // as a new independent room, not the original file's room
      const baseName = fileName.replace(/\.json$/i, '').replace(/[^a-zA-Z0-9_-]/g, '-')
      const randId = Math.random().toString(36).substring(7).toUpperCase()
      const newWorkspaceId = `${baseName}-${randId}`

      setRoomPassword(undefined)  // disconnect from any existing room
      loadData({ ...data, quotationDetails: { ...data.quotationDetails, quotationNo: newWorkspaceId } }, fileName)
      notify?.(`Loaded: ${fileName} — new workspace ${newWorkspaceId}`, 'success')
      setIsLobbyOpen(false)
    } catch (err: any) {
      if (err?.name === 'AbortError') return  // cancelled
      notify?.(`Failed to load file: ${err?.message}`, 'error')
    }
  }

  const handleSaveAndReveal = async () => {
    await saveInvoice()
    // Open the NAS template path in explorer for easy sharing
    try {
      await (window as any).electronAPI?.openFolder?.('\\\\KMTI-NAS\\Shared\\data\\template')
    } catch (e) {
      console.warn('[Quotation] Failed to reveal NAS folder:', e)
    }
  }

  return (
    <CollaborationProvider value={{ isConnected, remoteUsers, myColor, recentEdits, emitFocus, emitBlur, emitSelection, emitPatch }}>
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
              quotNo={quotationDetails.quotationNo || null}
            />
            <button id="quot-btn-new" className="btn btn-ghost" onClick={newInvoice}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              New
            </button>
            <button id="quot-btn-save" className="btn btn-ghost" onClick={handleSaveAndReveal}>
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
            <button className="btn btn-ghost" onClick={() => setIsLobbyOpen(true)} title="Join room or start new">
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
            quotNo={quotationDetails.quotationNo || null}
            onRestore={(data) => {
              loadData(data, 'version_restore')
              // Broadcast the restore to collaborators
              emitPatch({ path: '__full_restore__', value: data }, data)
              notify('Version restored successfully!', 'success')
            }}
            auditLogs={auditLogs}
          />

          {/* Main scrollable content */}
          <div className="quot-main-area">
            <div className="quot-body">
              <div className="quot-content-wrapper">

                {/* Top info row: Company | Client | Document Details */}
                <div className="quot-info-row">
                  <CompanyInfo companyInfo={companyInfo} onUpdate={syncCompanyInfo} />
                  <ClientInfo clientInfo={clientInfo} onUpdate={syncClientInfo} />
                  <QuotationDetailsCard
                    quotationDetails={quotationDetails}
                    onUpdate={syncQuotationDetails}
                  />
                </div>

                {/* Tasks Computation Table */}
                <TasksTable
                  tasks={tasks}
                  baseRates={baseRates}
                  selectedMainTaskId={selectedMainTaskId}
                  onTaskUpdate={syncUpdateTask}
                  onTaskAdd={syncAddTask}
                  onSubTaskAdd={syncAddSubTask}
                  onTaskRemove={syncRemoveTask}
                  onTaskReorder={syncReorderTasks}
                  onMainTaskSelect={setSelectedMainTaskId}
                  onBaseRateUpdate={syncBaseRate}
                  manualOverrides={manualOverrides}
                  setManualOverrides={updateManualOverrides} // setManualOverrides is used for more complex updates, but footer uses specialized syncUpdateFooter via prop eventually?
                  // Wait, I should pass syncUpdateFooter to TasksTable if I want it to sync.
                  onFooterUpdate={syncUpdateFooter}
                  collapsedTasks={new Set(collapsedTaskIds)}
                  onCollapsedTasksChange={(set) => setCollapsedTaskIds(Array.from(set))}
                  onOpenRateSettings={() => setIsBaseRatesPanelOpen(true)}
                  notify={notify}
                />

                {/* Signature Forms */}
                <SignatureForm
                  signatures={signatures}
                  onUpdate={syncSignatures}
                />

                <BillingDetailsCard
                  billingDetails={billingDetails}
                  quotationDetails={quotationDetails}
                  onUpdateBilling={syncBillingDetails}
                  onUpdateQuotation={syncQuotationDetails}
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

        {isLobbyOpen && (
          <QuotationEntryModal
            onJoin={handleJoinSession}
            onCreateNew={handleCreateNew}
            onBrowse={handleBrowse}
            onClose={() => setIsLobbyOpen(false)}
          />
        )}
      </div>
    </CollaborationProvider>
  )
}
