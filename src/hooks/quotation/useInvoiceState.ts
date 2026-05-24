import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useDebounceCallback } from '../useDebounce'
import { getKemcoRankAndPrice } from '../../utils/quotation'

import type {
  Task, BaseRates, CompanyInfo, ClientInfo, QuotationDetails, BillingDetails,
  Signatures, FooterOverrides, TaskOverrides, ManualOverrides, ChatMsg,
} from '../../types/quotation'

// Re-export all types for backward compatibility
export type {
  Task, BaseRates, CompanyInfo, ClientInfo, QuotationDetails, BillingDetails,
  SignaturePerson, ReceivedBy, Signatures, FooterOverrides, TaskOverrides,
  ManualOverrides, ChatMsg,
} from '../../types/quotation'

// ─── Local alias ─────────────────────────────────────────────────────────────
type NotificationType = 'success' | 'error' | 'info' | 'warning'


const GENERATED_QUOT_PATTERN = /^KMTE-\d{6}-\d{3}$/

export function generateQuotationNumber(date: string, sequential = '001'): string {
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
  contact: 'MR. Masahiko Hasegawa',
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
  quotationStatus: 'For Approval',
  projectStatus: 'On Going',
  submittedToAdminAt: '',
  updateDetail: '',
  projectInCharge: '',
  billTo: '',
}

const DEFAULT_SIGNATURES: Signatures = {
  quotation: {
    preparedBy: { name: 'MR. MICHAEL PEÑANO', title: 'Engineering Manager' },
    checkedBy: { name: 'MR. YUICHIRO MAENO', title: 'President' },
    approvedBy: { name: 'MR. YUICHIRO MAENO', title: 'President' },
    receivedBy: { label: '(Signature Over Printed Name)' },
  },
  billing: {
    preparedBy: { name: 'MS. PAULYN MURRIEL BEJER', title: '' },
    approvedBy: { name: 'MR. MICHAEL PEÑANO', title: '' },
    finalApprover: { name: 'MR. YUICHIRO MAENO', title: '' },
  },
}

const EMPTY_MANUAL_OVERRIDES: ManualOverrides = { tasks: {}, footer: {} }

export function makeBlankTask(level: number = 0, parentId: number | null = null): Task {
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
    isMainTask: level === 0,
    parentId: parentId,
    amount: 0,
    percentage: 0,
    level: level,
  }
}

// ─── sessionStorage namespace helpers ────────────────────────────────────────

function safeNs(quotNo: string): string {
  return quotNo.replace(/[^a-zA-Z0-9_-]/g, '_') || 'default'
}

function nsKey(ns: string, key: string): string {
  return `quot:${ns}:${key}`
}

/**
 * Write a full document snapshot into sessionStorage under a given namespace.
 * Call this BEFORE calling setNs() so that when useStickyState's resync
 * effect fires it reads pre-populated data, not empty defaults.
 */
function seedNamespace(ns: string, slots: Record<string, any>) {
  const safe = safeNs(ns)
  try {
    for (const [key, value] of Object.entries(slots)) {
      window.sessionStorage.setItem(nsKey(safe, key), JSON.stringify(value))
    }
    window.sessionStorage.setItem('quot:bootstrap', safe)
  } catch { /* ignore quota errors */ }
}

// ─── useStickyState ───────────────────────────────────────────────────────────

/**
 * useState that is backed by sessionStorage under a namespaced key.
 *
 * Key format: `quot:{ns}:{key}`
 *
 * When `ns` changes (because loadData switched documents), the resync effect
 * reads the new bucket and updates React state. loadData pre-seeds that bucket
 * via seedNamespace() before calling setNs(), so the resync always finds data.
 *
 * Write-back: value changes are persisted to the current nsKey automatically.
 */
function useStickyState<T>(
  defaultValue: T | (() => T),
  key: string,
  ns: string,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const currentNsKey = nsKey(ns, key)

  const [value, setValueRaw] = useState<T>(() => {
    const stored = window.sessionStorage.getItem(currentNsKey)
    if (stored !== null) {
      try { return JSON.parse(stored) } catch { /* ignore */ }
    }
    return typeof defaultValue === 'function' ? (defaultValue as () => T)() : defaultValue
  })

  // Resync when namespace changes. loadData pre-seeds the bucket so this
  // effect always finds the correct data — never empty defaults.
  const prevNsKeyRef = useRef<string>(currentNsKey)
  useEffect(() => {
    if (prevNsKeyRef.current === currentNsKey) return
    prevNsKeyRef.current = currentNsKey

    const stored = window.sessionStorage.getItem(currentNsKey)
    if (stored !== null) {
      try { setValueRaw(JSON.parse(stored)); return } catch { /* ignore */ }
    }
    setValueRaw(typeof defaultValue === 'function' ? (defaultValue as () => T)() : defaultValue)
  // defaultValue is stable (module-level const), safe to omit
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNsKey])

  // Write-back
  useEffect(() => {
    window.sessionStorage.setItem(currentNsKey, JSON.stringify(value))
  }, [currentNsKey, value])

  return [value, setValueRaw]
}

// ─── Migrate legacy ManualOverrides format ────────────────────────────────────
function migrateLegacyOverrides(raw: any): ManualOverrides {
  if (!raw || typeof raw !== 'object') return EMPTY_MANUAL_OVERRIDES
  if ('tasks' in raw || 'footer' in raw) {
    return { tasks: raw.tasks || {}, footer: raw.footer || {} } as ManualOverrides
  }
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

  // ns is React state so that setNs() triggers a re-render, causing every
  // useStickyState to receive the updated namespace and resync from storage.
  const [ns, setNsState] = useState<string>(() => {
    try { return window.sessionStorage.getItem('quot:bootstrap') || 'default' } catch { return 'default' }
  })

  const setNs = useCallback((quotNo: string) => {
    const safe = safeNs(quotNo)
    setNsState(safe)
    try { window.sessionStorage.setItem('quot:bootstrap', safe) } catch { /* ignore */ }
  }, [])

  const [companyInfo, setCompanyInfo] = useStickyState<CompanyInfo>(DEFAULT_COMPANY, 'companyInfo', ns)
  const [clientInfo, setClientInfo] = useStickyState<ClientInfo>(DEFAULT_CLIENT, 'clientInfo', ns)
  const [quotationDetails, setQuotationDetails] = useStickyState<QuotationDetails>(() => ({
    quotationNo: '',
    referenceNo: '',
    date: today,
  }), 'details', ns)
  const [billingDetails, setBillingDetails] = useStickyState<BillingDetails>(DEFAULT_BILLING_DETAILS, 'billingDetails', ns)
  const [tasks, setTasks] = useStickyState<Task[]>([], 'tasks', ns)
  const [baseRates, setBaseRates] = useStickyState<BaseRates>(DEFAULT_BASE_RATES, 'baseRates', ns)
  const [currentFilePath, setCurrentFilePath] = useStickyState<string | null>(null, 'filePath', ns)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useStickyState(false, 'unsaved', ns)
  const [selectedMainTaskId, setSelectedMainTaskId] = useState<number | null>(null)
  const [signatures, setSignatures] = useStickyState<Signatures>(DEFAULT_SIGNATURES, 'signatures', ns)
  const [manualOverrides, setManualOverrides] = useStickyState<ManualOverrides>(
    EMPTY_MANUAL_OVERRIDES,
    'manualOverrides',
    ns,
  )
  const [collapsedTaskIds, setCollapsedTaskIds] = useStickyState<number[]>([], 'collapsed', ns)
  const [chatLog, setChatLog] = useStickyState<ChatMsg[]>([], 'chatLog', ns)
  const [layoutVariantRaw, setLayoutVariantRaw] = useStickyState<'special' | 'kemco'>('special', 'layoutVariant', ns)

  const setLayoutVariant = useCallback((variant: 'special' | 'kemco') => {
    setLayoutVariantRaw(variant)
    if (variant === 'kemco') {
      setTasks(prev => prev.map(task => {
        const { rank, price } = getKemcoRankAndPrice(
          task.time || 0,
          task.level || 0,
          task.type || '3D'
        )
        return {
          ...task,
          drawingRank: rank,
          unitPrice: price,
          amount: price
        }
      }))
    }
  }, [setLayoutVariantRaw, setTasks])

  const layoutVariant = layoutVariantRaw

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
    setTasks(prev => [...prev, manualTask || makeBlankTask(0, null)])
    setHasUnsavedChanges(true)
  }, [])

  const addChildTask = useCallback((parentId: number, level: number, manualTask?: Task) => {
    const newTask: Task = manualTask || makeBlankTask(level, parentId)

    setTasks(prev => {
      const parentIndex = prev.findIndex(task => task.id === parentId)
      if (parentIndex === -1) return prev
      
      // Insert after the last existing child (or after parent if no children)
      let insertIndex = parentIndex + 1
      for (let i = parentIndex + 1; i < prev.length; i++) {
        let isDescendant = false
        let curr = prev[i]
        while (curr.parentId) {
          if (curr.parentId === parentId) { isDescendant = true; break }
          curr = prev.find(t => t.id === curr.parentId) || { parentId: null } as any
        }
        
        if (isDescendant) insertIndex = i + 1
        else break
      }
      const newTasks = [...prev]
      newTasks.splice(insertIndex, 0, newTask)
      return newTasks
    })
    setHasUnsavedChanges(true)
  }, [])

  const addSubTask = useCallback((mainTaskId: number | null, notify?: (msg: string, type?: NotificationType) => void, manualTask?: Task) => {
    if (!mainTaskId && !manualTask) {
      if (notify) notify('Please select a main task first to add a sub-task.', 'warning')
      else alert('Please select a main task first to add a sub-task.')
      return
    }
    const parentId = manualTask ? manualTask.parentId! : mainTaskId!
    addChildTask(parentId, 1, manualTask)
  }, [addChildTask])

  const removeTask = useCallback((id: number) => {
    setTasks(prev => {
      const idsToRemove = new Set<number>([id])
      
      // Multi-pass to find all descendants (safe for flat list)
      let foundNew = true
      while (foundNew) {
        foundNew = false
        prev.forEach(task => {
          if (task.parentId && idsToRemove.has(task.parentId) && !idsToRemove.has(task.id)) {
            idsToRemove.add(task.id)
            foundNew = true
          }
        })
      }
      
      return prev.filter(task => !idsToRemove.has(task.id))
    })
    setHasUnsavedChanges(true)
  }, [])

  const updateTask = useCallback((id: number, fieldOrUpdates: keyof Task | Partial<Task>, value?: any) => {
    setTasks(prev => prev.map(task => {
      if (task.id !== id) return task
      let updatedTask = typeof fieldOrUpdates === 'object'
        ? { ...task, ...fieldOrUpdates }
        : { ...task, [fieldOrUpdates]: value }

      if (layoutVariant === 'kemco') {
        const { rank, price } = getKemcoRankAndPrice(
          updatedTask.time || 0,
          updatedTask.level || 0,
          updatedTask.type || '3D'
        )
        updatedTask.drawingRank = rank
        updatedTask.unitPrice = price
        updatedTask.amount = price
      }
      return updatedTask
    }))
    setHasUnsavedChanges(true)
  }, [setHasUnsavedChanges, layoutVariant])

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

  const updateChatLog = useCallback((updater: (prev: ChatMsg[]) => ChatMsg[]) => {
    setChatLog(prev => updater(prev))
    setHasUnsavedChanges(true)
  }, [setChatLog, setHasUnsavedChanges])

  const resetToNew = useCallback((forcedQuotNo?: string, variant: 'special' | 'kemco' = 'special') => {
    const newToday = new Date().toISOString().split('T')[0]
    const newQuotNo = forcedQuotNo || generateQuotationNumber(newToday)
    const newDetails: QuotationDetails = { quotationNo: newQuotNo, referenceNo: '', date: newToday }
    const newBilling: BillingDetails = { ...DEFAULT_BILLING_DETAILS, invoiceNo: '', jobOrderNo: '' }
    const newTasks: Task[] = [makeBlankTask(0, null)]

    // Pre-seed the new namespace before switching so useStickyState resync
    // reads correct values (not empty defaults) when ns changes.
    seedNamespace(newQuotNo, {
      companyInfo: DEFAULT_COMPANY,
      clientInfo: DEFAULT_CLIENT,
      details: newDetails,
      billingDetails: newBilling,
      tasks: newTasks,
      baseRates: DEFAULT_BASE_RATES,
      signatures: DEFAULT_SIGNATURES,
      manualOverrides: EMPTY_MANUAL_OVERRIDES,
      collapsed: [],
      chatLog: [],
      layoutVariant: variant,
      filePath: null,
      unsaved: false,
    })

    setNs(newQuotNo)
    setQuotationDetails(newDetails)
    setBillingDetails(newBilling)
    setTasks(newTasks)
    setSelectedMainTaskId(null)
    setBaseRates(DEFAULT_BASE_RATES)
    setSignatures(DEFAULT_SIGNATURES)
    setManualOverrides(EMPTY_MANUAL_OVERRIDES)
    setCollapsedTaskIds([])
    setChatLog([])
    setLayoutVariant(variant)
    setCurrentFilePath(null)
    setHasUnsavedChanges(false)
  }, [])

  const loadData = useCallback((data: any, fileName: string) => {
    const qd = data.quotationDetails || {}
    const targetQuotNo = qd.quotationNo || ''

    const resolvedCompany  = data.companyInfo   || { name: '', address: '', city: '', location: '', phone: '' }
    const resolvedClient   = data.clientInfo    || { company: '', contact: '', address: '', phone: '' }
    const resolvedDetails: QuotationDetails = {
      quotationNo: targetQuotNo,
      referenceNo: qd.referenceNo || '',
      date: qd.date || new Date().toISOString().split('T')[0],
    }
    const resolvedBilling: BillingDetails = {
      ...DEFAULT_BILLING_DETAILS,
      ...(data.billingDetails || {}),
      invoiceNo:  data.billingDetails?.invoiceNo  ?? qd.invoiceNo  ?? '',
      jobOrderNo: data.billingDetails?.jobOrderNo ?? qd.jobOrderNo ?? '',
      quotationStatus: data.billingDetails?.quotationStatus ?? 'For Approval',
      projectStatus: data.billingDetails?.projectStatus ?? 'On Going',
      submittedToAdminAt: data.billingDetails?.submittedToAdminAt ?? '',
      updateDetail: data.billingDetails?.updateDetail ?? '',
      projectInCharge: data.billingDetails?.projectInCharge ?? '',
      billTo: data.billingDetails?.billTo ?? '',
    }
    const resolvedVariant = data.layoutVariant || 'special'
    let resolvedTasks = data.tasks || [makeBlankTask()]
    if (resolvedVariant === 'kemco') {
      resolvedTasks = resolvedTasks.map((task: Task) => {
        const { rank, price } = getKemcoRankAndPrice(
          task.time || 0,
          task.level || 0,
          task.type || '3D'
        )
        return {
          ...task,
          drawingRank: rank,
          unitPrice: price,
          amount: price
        }
      })
    }
    const resolvedRates    = data.baseRates || DEFAULT_BASE_RATES
    const loadedSig        = data.signatures || {}
    const resolvedSigs: Signatures = {
      quotation: { ...DEFAULT_SIGNATURES.quotation, ...loadedSig.quotation },
      billing:   { ...DEFAULT_SIGNATURES.billing,   ...loadedSig.billing   },
    }
    const resolvedOverrides = migrateLegacyOverrides(data.manualOverrides)
    const resolvedCollapsed = data.collapsedTaskIds || []
    const resolvedChatLog = data.chatLog || []

    // ── Critical: pre-seed sessionStorage under the new namespace BEFORE
    // calling setNs(). useStickyState's resync useEffect fires on the next
    // render after setNs(), reads from the new namespace key, and will find
    // the correct data instead of falling back to defaults.
    if (targetQuotNo) {
      seedNamespace(targetQuotNo, {
        companyInfo:     resolvedCompany,
        clientInfo:      resolvedClient,
        details:         resolvedDetails,
        billingDetails:  resolvedBilling,
        tasks:           resolvedTasks,
        baseRates:       resolvedRates,
        signatures:      resolvedSigs,
        manualOverrides: resolvedOverrides,
        collapsed:       resolvedCollapsed,
        chatLog:         resolvedChatLog,
        layoutVariant:   resolvedVariant,
        filePath:        fileName,
        unsaved:         false,
      })
      setNs(targetQuotNo)
    }

    // Also call the React setters so the current render cycle shows correct
    // values immediately (before the resync effect fires).
    setCompanyInfo(resolvedCompany)
    setClientInfo(resolvedClient)
    setQuotationDetails(resolvedDetails)
    setBillingDetails(resolvedBilling)
    setTasks(resolvedTasks)
    setSelectedMainTaskId(null)
    setBaseRates(resolvedRates)
    setSignatures(resolvedSigs)
    setManualOverrides(resolvedOverrides)
    setCollapsedTaskIds(resolvedCollapsed)
    setChatLog(resolvedChatLog)
    setLayoutVariant(resolvedVariant)
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
    chatLog,
    layoutVariant,
    savedAt: new Date().toISOString(),
  }), [companyInfo, clientInfo, quotationDetails, billingDetails, tasks, baseRates, signatures, manualOverrides, collapsedTaskIds, chatLog, layoutVariant])

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
    updateManualOverrides, setCollapsedTaskIds, updateChatLog, chatLog,
    layoutVariant, setLayoutVariant,
    resetToNew, loadData, getSaveData, markSaved, setHasUnsavedChanges,
    addChildTask,
  }
}
