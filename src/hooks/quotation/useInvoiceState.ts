import { useState, useCallback, useEffect } from 'react'
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
  invoiceNo: string
  jobOrderNo: string
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

export type ManualOverrides = Record<number, Partial<{
  basicLabor: number
  overtime: number
  software: number
  overhead: number
  total: number
  unitPage: number
}>>

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Pattern for auto-generated quotation numbers: KMTE-YYMMDD-NNN
const GENERATED_QUOT_PATTERN = /^KMTE-\d{6}-\d{3}$/

function generateQuotationNumber(date: string, sequential = '001'): string {
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

const DEFAULT_SIGNATURES: Signatures = {
  quotation: {
    preparedBy: { name: 'MR. MICHAEL PEÑANO', title: 'Engineering Manager' },
    approvedBy: { name: 'MR. YUICHIRO MAENO', title: 'President' },
    receivedBy: { label: '(Signature Over Printed Name)' },
  },
  billing: {
    preparedBy: { name: 'MS. PAULYN MAURIEL BEJER', title: 'Accounting Staff' },
    approvedBy: { name: 'MR. MICHAEL PEÑANO', title: 'Engineering Manager' },
    finalApprover: { name: 'MR. YUICHIRO MAENO', title: 'President' },
  },
}

function makeBlankTask(): Task {
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

// ─── Internal Helper for Session Persistence ───────────────────────────────────

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

// ─── Hook ────────────────────────────────────────────────────────────────────


export function useInvoiceState() {
  const today = new Date().toISOString().split('T')[0]

  const [companyInfo, setCompanyInfo] = useStickyState<CompanyInfo>(DEFAULT_COMPANY, 'quot_companyInfo')
  const [clientInfo, setClientInfo] = useStickyState<ClientInfo>(DEFAULT_CLIENT, 'quot_clientInfo')
  const [quotationDetails, setQuotationDetails] = useStickyState<QuotationDetails>(() => ({
    quotationNo: generateQuotationNumber(today),
    referenceNo: '',
    date: today,
    invoiceNo: '',
    jobOrderNo: '',
  }), 'quot_details')
  const [tasks, setTasks] = useStickyState<Task[]>([], 'quot_tasks')
  const [baseRates, setBaseRates] = useStickyState<BaseRates>(DEFAULT_BASE_RATES, 'quot_baseRates')
  const [currentFilePath, setCurrentFilePath] = useStickyState<string | null>(null, 'quot_filePath')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useStickyState(false, 'quot_unsaved')
  const [selectedMainTaskId, setSelectedMainTaskId] = useState<number | null>(null) // Local memory only
  const [signatures, setSignatures] = useStickyState<Signatures>(DEFAULT_SIGNATURES, 'quot_signatures')
  const [manualOverrides, setManualOverrides] = useStickyState<ManualOverrides>({}, 'quot_manualOverrides')
  const [collapsedTaskIds, setCollapsedTaskIds] = useStickyState<number[]>([], 'quot_collapsed')

  const debouncedQuotationUpdate = useDebounceCallback((date: string) => {
    const newQuotationNo = generateQuotationNumber(date)
    setQuotationDetails(prev => ({ ...prev, quotationNo: newQuotationNo }))
  }, 300)

  const updateCompanyInfo = useCallback((updates: CompanyInfo) => {
    setCompanyInfo(updates)
    setHasUnsavedChanges(true)
  }, [])

  const updateClientInfo = useCallback((updates: ClientInfo) => {
    setClientInfo(updates)
    setHasUnsavedChanges(true)
  }, [])

  const updateQuotationDetails = useCallback((updates: Partial<QuotationDetails>) => {
    setQuotationDetails(prev => {
      const newDetails = { ...prev, ...updates }
      // Only auto-regenerate quotation number if:
      //   1. The date changed, AND
      //   2. The current quotation number matches the auto-generated pattern
      //      (meaning the user hasn't manually customised it)
      if (updates.date && updates.date !== prev.date) {
        if (GENERATED_QUOT_PATTERN.test(prev.quotationNo)) {
          debouncedQuotationUpdate(updates.date)
        }
      }
      return newDetails
    })
    setHasUnsavedChanges(true)
  }, [debouncedQuotationUpdate])

  const addTask = useCallback(() => {
    setTasks(prev => [...prev, makeBlankTask()])
    setHasUnsavedChanges(true)
  }, [])

  const addSubTask = useCallback((mainTaskId: number | null, notify?: (msg: string, type?: NotificationType) => void) => {
    if (!mainTaskId) {
      if (notify) notify('Please select a main task first to add a sub-task.', 'warning')
      else alert('Please select a main task first to add a sub-task.')
      return
    }

    const newSubTask: Task = {
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
      parentId: mainTaskId,
    }

    setTasks(prev => {
      const parentIndex = prev.findIndex(task => task.id === mainTaskId)
      if (parentIndex === -1) return prev

      let insertIndex = parentIndex + 1
      for (let i = parentIndex + 1; i < prev.length; i++) {
        if (prev[i].parentId === mainTaskId) insertIndex = i + 1
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

  const updateTaskBatch = useCallback((updates: Array<{ id: number } & Partial<Task>>) => {
    setTasks(prev => prev.map(task => {
      const update = updates.find(u => u.id === task.id)
      return update ? { ...task, ...update } : task
    }))
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
        // Back-calculate multiplier so the display stays in sync
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
      [type]: { ...prev[type], [field]: value },
    }))
    setHasUnsavedChanges(true)
  }, [])

  const resetToNew = useCallback(() => {
    const newToday = new Date().toISOString().split('T')[0]
    setCompanyInfo(DEFAULT_COMPANY)
    setClientInfo({ company: '', contact: '', address: '', phone: '' })
    setQuotationDetails({
      quotationNo: generateQuotationNumber(newToday),
      referenceNo: '',
      date: newToday,
      invoiceNo: '',
      jobOrderNo: '',
    })
    setTasks([makeBlankTask()])
    setSelectedMainTaskId(null)
    setBaseRates(DEFAULT_BASE_RATES)
    setSignatures(DEFAULT_SIGNATURES)
    setManualOverrides({})
    setCollapsedTaskIds([])
    setCurrentFilePath(null)
    setHasUnsavedChanges(false)
  }, [])

  const updateManualOverrides = useCallback((action: React.SetStateAction<ManualOverrides>) => {
    setManualOverrides(action)
    setHasUnsavedChanges(true)
  }, [setManualOverrides, setHasUnsavedChanges])

  const loadData = useCallback((data: any, fileName: string) => {
    setCompanyInfo(data.companyInfo || { name: '', address: '', city: '', location: '', phone: '' })
    setClientInfo(data.clientInfo || { company: '', contact: '', address: '', phone: '' })
    setQuotationDetails(data.quotationDetails || {
      quotationNo: '',
      referenceNo: '',
      date: new Date().toISOString().split('T')[0],
      invoiceNo: '',
      jobOrderNo: '',
    })
    setTasks(data.tasks || [makeBlankTask()])
    setSelectedMainTaskId(null)
    setBaseRates(data.baseRates || DEFAULT_BASE_RATES)
    setSignatures(data.signatures || DEFAULT_SIGNATURES)
    setManualOverrides(data.manualOverrides || {})
    setCollapsedTaskIds(data.collapsedTaskIds || [])
    setCurrentFilePath(fileName)
    setHasUnsavedChanges(false)
  }, [])

  const getSaveData = useCallback(() => ({
    companyInfo,
    clientInfo,
    quotationDetails,
    tasks,
    baseRates,
    signatures,
    manualOverrides,
    collapsedTaskIds,
    savedAt: new Date().toISOString(),
  }), [companyInfo, clientInfo, quotationDetails, tasks, baseRates, signatures, manualOverrides, collapsedTaskIds])

  const markSaved = useCallback((filePath: string) => {
    setCurrentFilePath(filePath)
    setHasUnsavedChanges(false)
  }, [setCurrentFilePath, setHasUnsavedChanges])

  const markUnsaved = useCallback(() => {
    setHasUnsavedChanges(true)
  }, [setHasUnsavedChanges])

  return {
    companyInfo, clientInfo, quotationDetails, tasks, baseRates, signatures,
    manualOverrides, collapsedTaskIds,
    currentFilePath, hasUnsavedChanges, selectedMainTaskId,
    updateCompanyInfo, updateClientInfo, updateQuotationDetails,
    addTask, addSubTask, removeTask, updateTask, updateTaskBatch, reorderTasks,
    updateBaseRate, updateSignatures, setSelectedMainTaskId,
    updateManualOverrides, setCollapsedTaskIds,
    resetToNew, loadData, getSaveData,
    markSaved, markUnsaved,
  }
}
