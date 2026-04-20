import { useState, useCallback, useEffect, useRef } from 'react'
import { useDebounceCallback } from '../useDebounce'

// ─── Types ───────────────────────────────────────────────────────────────────

type NotificationType = 'success' | 'error' | 'info' | 'warning'

export interface Task {
  id: number
  description: string
  referenceNumber: string
  hours: number
  minutes: number
  overtimeHours: number
  softwareUnits: number
  type: string
  unitType: string
  isMainTask: boolean
  parentId: number | null
}

export interface BaseRates {
  timeChargeRate2D: number
  timeChargeRate3D: number
  timeChargeRateOthers: number
  otHoursMultiplier: number
  overtimeRate: number
  softwareRate: number
  overheadPercentage: number
}

export interface CompanyInfo {
  name: string
  address: string
  city: string
  location: string
  phone: string
}

export interface ClientInfo {
  company: string
  contact: string
  address: string
  phone: string
}

export interface QuotationDetails {
  quotationNo: string
  referenceNo: string
  date: string
}

export interface BillingDetails {
  invoiceNo: string
  jobOrderNo: string
  bankName: string
  accountName: string
  accountNumber: string
  bankAddress: string
  swiftCode: string
  branchCode: string
}

export interface SignaturePerson {
  name: string
  title: string
}

export interface ReceivedBy {
  label: string
  title?: string
}

export interface Signatures {
  quotation: {
    preparedBy: SignaturePerson
    approvedBy: SignaturePerson
    receivedBy: ReceivedBy
  }
  billing: {
    preparedBy: SignaturePerson
    approvedBy: SignaturePerson
    finalApprover: SignaturePerson
  }
}

/**
 * Manual overrides for task-level computed values.
 * Key -1 is reserved for footer-level overrides (overhead amount, grand total adjustment).
 * All other keys are task IDs.
 */
export interface FooterOverrides {
  overhead?: number
  adjustment?: number
}

export interface TaskOverrides {
  basicLabor?: number
  overtime?: number
  software?: number
  total?: number
  unitPage?: number
}

export interface ManualOverrides {
  tasks: Record<number, TaskOverrides>
  footer: FooterOverrides
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Pattern for auto-generated quotation numbers: KMTE-YYMMDD-NNN
const GENERATED_QUOT_PATTERN = /^KMTE-\d{6}-\d{3}$/

export function generateQuotationNumber(date: string, sequential = '001'): string {
  // Use T00:00:00 to ensure local date parsing instead of UTC
  const dateObj = new Date(date + 'T00:00:00')
  const year = dateObj.getFullYear().toString().slice(-2)
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0')
  const day = dateObj.getDate().toString().padStart(2, '0')
  return `KMTE-${year}${month}${day}-${sequential}`
}

const DEFAULT_COMPANY: CompanyInfo = {
  name: 'KUSAKABE & MAENO TECH., INC',
  address: 'Unit 2-B Building B, Vital Industrial Properties Inc.',
  city: 'First Cavite Industrial Estates, P-CIB PEZA Zone',
  location: 'Dasmariñas City, Cavite Philippines',
  phone: 'TEL: +63-46-414-4009',
}

const DEFAULT_CLIENT: ClientInfo = {
  company: 'NEXTENGINEERING Co, Ltd.',
  contact: 'MR. Masahiro Hasegawa',
  address: '7-7, Hashimoto-machi, Nagasaki City, Nagasaki, 852-8114, Japan',
  phone: 'TEL: +81-95-801-9012 / FAX: +81-95-801-9013',
}

const DEFAULT_BASE_RATES: BaseRates = {
  timeChargeRate2D: 2700,
  timeChargeRate3D: 2700,
  timeChargeRateOthers: 0,
  otHoursMultiplier: 1.3,
  overtimeRate: 3300,
  softwareRate: 500,
  overheadPercentage: 20,
}

const DEFAULT_BILLING_DETAILS: BillingDetails = {
  invoiceNo: '',
  jobOrderNo: '',
  bankName: 'RIZAL COMMERCIAL BANK CORPORATION',
  accountName: 'KUSAKABE & MAENO TECH INC.',
  accountNumber: '0000000011581337',
  bankAddress: "RCBC DASMARINAS BRANCH RCBC BLDG. FCIE COMPOUND, GOVERNOR'S DRIVE LANGKAAN, DASMARINAS CAVITE",
  swiftCode: 'RCBCPHMM',
  branchCode: '358',
}

const DEFAULT_SIGNATURES: Signatures = {
  quotation: {
    preparedBy: { name: 'MR. MICHAEL PEÑANO', title: 'Engineering Manager' },
    approvedBy: { name: 'MR. YUICHIRO MAENO', title: 'President' },
    receivedBy: { label: '(Signature Over Printed Name)' },
  },
  billing: {
    preparedBy: { name: 'MS. PAULYN MURRIEL BEJER', title: 'Accounting Staff' },
    approvedBy: { name: 'MR. MICHAEL PEÑANO', title: 'Engineering Manager' },
    finalApprover: { name: 'MR. YUICHIRO MAENO', title: 'President' },
  },
}

const EMPTY_MANUAL_OVERRIDES: ManualOverrides = { tasks: {}, footer: {} }

export function makeBlankTask(): Task {
  return {
    id: Date.now(),
    description: '',
    referenceNumber: '',
    hours: 0,
    minutes: 0,
    overtimeHours: 0,
    softwareUnits: 0,
    type: '3D',
    unitType: 'JD',
    isMainTask: true,
    parentId: null,
  }
}

// ─── Internal Helper for Session Persistence ─────────────────────────────────

function useStickyState<T>(defaultValue: T | (() => T), key: string): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const stickyValue = window.sessionStorage.getItem(key)
    if (stickyValue !== null) {
      try { return JSON.parse(stickyValue) } catch (e) { /* ignore */ }
    }
    return typeof defaultValue === 'function' ? (defaultValue as any)() : defaultValue
  })
  useEffect(() => {
    window.sessionStorage.setItem(key, JSON.stringify(value))
  }, [key, value])
  return [value, setValue]
}

// ─── Migrate legacy ManualOverrides format ────────────────────────────────────
// Old format used Record<number, ...> with key -1 for footer. New format uses { tasks, footer }.
function migrateLegacyOverrides(raw: any): ManualOverrides {
  if (!raw || typeof raw !== 'object') return EMPTY_MANUAL_OVERRIDES
  // Already in new format - but ensure properties are present and valid
  if (raw && typeof raw === 'object' && ('tasks' in raw || 'footer' in raw)) {
    return {
      tasks: raw.tasks || {},
      footer: raw.footer || {}
    } as ManualOverrides
  }
  // Legacy flat Record format
  const tasks: Record<number, TaskOverrides> = {}
  let footer: FooterOverrides = {}
  for (const key of Object.keys(raw)) {
    const numKey = Number(key)
    if (numKey === -1) {
      const { overhead, adjustment } = raw[key] || {}
      footer = { overhead, adjustment }
    } else {
      tasks[numKey] = raw[key] || {}
    }
  }
  return { tasks, footer }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useInvoiceState() {
  const today = new Date().toISOString().split('T')[0]

  const [companyInfo, setCompanyInfo] = useStickyState<CompanyInfo>(DEFAULT_COMPANY, 'quot_companyInfo')
  const [clientInfo, setClientInfo] = useStickyState<ClientInfo>(DEFAULT_CLIENT, 'quot_clientInfo')
  const [quotationDetails, setQuotationDetails] = useStickyState<QuotationDetails>(() => ({
    quotationNo: generateQuotationNumber(today),
    referenceNo: '',
    date: today,
  }), 'quot_details')
  const [billingDetails, setBillingDetails] = useStickyState<BillingDetails>(DEFAULT_BILLING_DETAILS, 'quot_billingDetails')
  const [tasks, setTasks] = useStickyState<Task[]>([], 'quot_tasks')
  const [baseRates, setBaseRates] = useStickyState<BaseRates>(DEFAULT_BASE_RATES, 'quot_baseRates')
  const [currentFilePath, setCurrentFilePath] = useStickyState<string | null>(null, 'quot_filePath')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useStickyState(false, 'quot_unsaved')
  const [selectedMainTaskId, setSelectedMainTaskId] = useState<number | null>(null)
  const [signatures, setSignatures] = useStickyState<Signatures>(DEFAULT_SIGNATURES, 'quot_signatures')
  const [manualOverrides, setManualOverrides] = useStickyState<ManualOverrides>(
    () => {
      // Migrate from legacy format if needed
      const raw = window.sessionStorage.getItem('quot_manualOverrides')
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          return migrateLegacyOverrides(parsed)
        } catch { /* ignore */ }
      }
      return EMPTY_MANUAL_OVERRIDES
    },
    'quot_manualOverrides'
  )
  const [collapsedTaskIds, setCollapsedTaskIds] = useStickyState<number[]>([], 'quot_collapsed')

  const debouncedQuotationUpdate = useDebounceCallback((date: string) => {
    const newQuotationNo = generateQuotationNumber(date)
    setQuotationDetails(prev => ({ ...prev, quotationNo: newQuotationNo }))
  }, 300)

  const updateCompanyInfo = useCallback((updates: CompanyInfo | ((prev: CompanyInfo) => CompanyInfo)) => {
    setCompanyInfo(prev => typeof updates === 'function' ? updates(prev) : updates)
    setHasUnsavedChanges(true)
  }, [])

  const updateClientInfo = useCallback((updates: ClientInfo | ((prev: ClientInfo) => ClientInfo)) => {
    setClientInfo(prev => typeof updates === 'function' ? updates(prev) : updates)
    setHasUnsavedChanges(true)
  }, [])

  const updateQuotationDetails = useCallback((updates: Partial<QuotationDetails> | ((prev: QuotationDetails) => QuotationDetails)) => {
    setQuotationDetails(prev => {
      const newDetails = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates }
      if (typeof updates === 'object' && updates.date && updates.date !== prev.date) {
        if (GENERATED_QUOT_PATTERN.test(prev.quotationNo)) {
          debouncedQuotationUpdate(updates.date)
        }
      }
      return newDetails
    })
    setHasUnsavedChanges(true)
  }, [debouncedQuotationUpdate])

  const updateBillingDetails = useCallback((updates: Partial<BillingDetails> | ((prev: BillingDetails) => BillingDetails)) => {
    setBillingDetails(prev => typeof updates === 'function' ? updates(prev) : { ...prev, ...updates })
    setHasUnsavedChanges(true)
  }, [])

  const addTask = useCallback((manualTask?: Task) => {
    setTasks(prev => [...prev, manualTask || makeBlankTask()])
    setHasUnsavedChanges(true)
  }, [])

  const addSubTask = useCallback((mainTaskId: number | null, notify?: (msg: string, type?: NotificationType) => void, manualTask?: Task) => {
    if (!mainTaskId && !manualTask) {
      if (notify) notify('Please select a main task first to add a sub-task.', 'warning')
      else alert('Please select a main task first to add a sub-task.')
      return
    }

    const effectiveParentId = manualTask ? manualTask.parentId : mainTaskId;
    if (!effectiveParentId && manualTask) return; // Should not happen

    const newSubTask: Task = manualTask || {
      id: Date.now(),
      description: '',
      referenceNumber: '',
      hours: 0,
      minutes: 0,
      overtimeHours: 0,
      softwareUnits: 0,
      type: '3D',
      unitType: 'JD',
      isMainTask: false,
      parentId: effectiveParentId,
    }

    setTasks(prev => {
      const parentIndex = prev.findIndex(task => task.id === effectiveParentId)
      if (parentIndex === -1) return prev

      let insertIndex = parentIndex + 1
      for (let i = parentIndex + 1; i < prev.length; i++) {
        if (prev[i].parentId === effectiveParentId) insertIndex = i + 1
        else break
      }

      const newTasks = [...prev]
      newTasks.splice(insertIndex, 0, newSubTask)
      return newTasks
    })
    setHasUnsavedChanges(true)
  }, [])

  const removeTask = useCallback((id: number) => {
    setTasks(prev => {
      const taskToRemove = prev.find(task => task.id === id)
      if (taskToRemove?.isMainTask) {
        return prev.filter(task => task.id !== id && task.parentId !== id)
      }
      return prev.filter(task => task.id !== id)
    })
    setHasUnsavedChanges(true)
  }, [])

  const updateTask = useCallback((id: number, field: keyof Task, value: any) => {
    setTasks(prev => prev.map(task => task.id !== id ? task : { ...task, [field]: value }))
    setHasUnsavedChanges(true)
  }, [setHasUnsavedChanges])

  const reorderTasks = useCallback((draggedTaskId: number, targetTaskId: number) => {
    setTasks(prev => {
      const newTasks = [...prev]
      const draggedIndex = newTasks.findIndex(t => t.id === draggedTaskId)
      const targetIndex = newTasks.findIndex(t => t.id === targetTaskId)
      if (draggedIndex === -1 || targetIndex === -1) return prev

      const draggedTask = newTasks[draggedIndex]
      const targetTask = newTasks[targetIndex]
      if (!draggedTask.isMainTask || !targetTask.isMainTask) return prev

      const draggedTaskAndSubs = newTasks.filter(t => t.id === draggedTaskId || t.parentId === draggedTaskId)
      const tasksWithoutDragged = newTasks.filter(t => t.id !== draggedTaskId && t.parentId !== draggedTaskId)
      const newTargetIndex = tasksWithoutDragged.findIndex(t => t.id === targetTaskId)

      return [
        ...tasksWithoutDragged.slice(0, newTargetIndex),
        ...draggedTaskAndSubs,
        ...tasksWithoutDragged.slice(newTargetIndex),
      ]
    })
    setHasUnsavedChanges(true)
  }, [])

  const updateBaseRate = useCallback((field: keyof BaseRates, value: number) => {
    setBaseRates(prev => {
      const newRates = { ...prev, [field]: value }
      if (field === 'otHoursMultiplier') {
        newRates.overtimeRate = Math.round(newRates.timeChargeRate3D * value)
      } else if (field === 'timeChargeRate3D') {
        newRates.overtimeRate = Math.round(value * newRates.otHoursMultiplier)
      } else if (field === 'overtimeRate') {
        newRates.otHoursMultiplier = newRates.timeChargeRate3D > 0
          ? Math.round((value / newRates.timeChargeRate3D) * 100) / 100
          : newRates.otHoursMultiplier
      }
      return newRates
    })
    setHasUnsavedChanges(true)
  }, [])

  const updateSignatures = useCallback((type: keyof Signatures, field: string, value: any) => {
    setSignatures(prev => ({
      ...prev,
      [type]: { ...(prev[type] as any), [field]: value },
    }))
    setHasUnsavedChanges(true)
  }, [])

  const updateManualOverrides = useCallback((updater: (prev: ManualOverrides) => ManualOverrides) => {
    setManualOverrides(prev => updater(prev))
    setHasUnsavedChanges(true)
  }, [setManualOverrides, setHasUnsavedChanges])

  const resetToNew = useCallback((forcedQuotNo?: string) => {
    const newToday = new Date().toISOString().split('T')[0]
    setQuotationDetails({
      quotationNo: forcedQuotNo || generateQuotationNumber(newToday),
      referenceNo: '',
      date: newToday,
    })
    setBillingDetails(prev => ({
      ...prev,
      invoiceNo: '',
      jobOrderNo: '',
    }))
    setTasks([makeBlankTask()])
    setSelectedMainTaskId(null)
    setBaseRates(DEFAULT_BASE_RATES)
    setSignatures(DEFAULT_SIGNATURES)
    setManualOverrides(EMPTY_MANUAL_OVERRIDES)
    setCollapsedTaskIds([])
    setCurrentFilePath(null)
    setHasUnsavedChanges(false)
  }, [])

  const loadData = useCallback((data: any, fileName: string) => {
    setCompanyInfo(data.companyInfo || { name: '', address: '', city: '', location: '', phone: '' })
    setClientInfo(data.clientInfo || { company: '', contact: '', address: '', phone: '' })

    // Support loading legacy files that had invoiceNo/jobOrderNo in quotationDetails
    const qd = data.quotationDetails || {}
    setQuotationDetails({
      quotationNo: qd.quotationNo || '',
      referenceNo: qd.referenceNo || '',
      date: qd.date || new Date().toISOString().split('T')[0],
    })

    // Merge billing details: prefer new field, fall back to legacy quotationDetails fields
    setBillingDetails({
      ...DEFAULT_BILLING_DETAILS,
      ...(data.billingDetails || {}),
      invoiceNo: data.billingDetails?.invoiceNo ?? qd.invoiceNo ?? '',
      jobOrderNo: data.billingDetails?.jobOrderNo ?? qd.jobOrderNo ?? '',
    })

    setTasks(data.tasks || [makeBlankTask()])
    setSelectedMainTaskId(null)
    setBaseRates(data.baseRates || DEFAULT_BASE_RATES)
    // Deep-merge with DEFAULT_SIGNATURES so legacy files missing 'billing'
    // or any sub-key don't crash components that expect the full shape.
    const loadedSig = data.signatures || {}
    setSignatures({
      quotation: { ...DEFAULT_SIGNATURES.quotation, ...loadedSig.quotation },
      billing:   { ...DEFAULT_SIGNATURES.billing,   ...loadedSig.billing   },
    })
    setManualOverrides(migrateLegacyOverrides(data.manualOverrides))
    setCollapsedTaskIds(data.collapsedTaskIds || [])
    setCurrentFilePath(fileName)
    setHasUnsavedChanges(false)
  }, [])

  const getSaveData = useCallback(() => ({
    companyInfo,
    clientInfo,
    quotationDetails,
    billingDetails,
    tasks,
    baseRates,
    signatures,
    manualOverrides,
    collapsedTaskIds,
    savedAt: new Date().toISOString(),
  }), [companyInfo, clientInfo, quotationDetails, billingDetails, tasks, baseRates, signatures, manualOverrides, collapsedTaskIds])

  const markSaved = useCallback((filePath: string) => {
    setCurrentFilePath(filePath)
    setHasUnsavedChanges(false)
  }, [setCurrentFilePath, setHasUnsavedChanges])

  return {
    companyInfo, clientInfo, quotationDetails, billingDetails, tasks, baseRates, signatures,
    manualOverrides, collapsedTaskIds,
    currentFilePath, hasUnsavedChanges, selectedMainTaskId,
    updateCompanyInfo, updateClientInfo, updateQuotationDetails, updateBillingDetails,
    addTask, addSubTask, removeTask, updateTask, reorderTasks,
    updateBaseRate, updateSignatures, setSelectedMainTaskId,
    updateManualOverrides, setCollapsedTaskIds,
    resetToNew, loadData, getSaveData, markSaved,
  }
}
