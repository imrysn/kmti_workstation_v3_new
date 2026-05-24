/**
 * quotation.ts  ECentralized Type Definitions
 * ─────────────────────────────────────────────────────────────────
 * Single source of truth for all Quotation feature interfaces.
 * Import from this file instead of from individual hooks or components.
 *
 * Usage:
 *   import type { Task, BaseRates, Signatures } from '../../types/quotation'
 */

// ── Task & Computation ──────────────────────────────────────────────────────

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
  engineer?: string
  /** Workstation name of whoever claimed this row  Esource of truth for locking */
  engineerWorkstation?: string
  lastEditorName?: string
  lastEditorColor?: string
  // KEMCO-specific fields
  machineCode?: string
  unitCode?: string
  startDate?: string
  endDate?: string
  time?: number
  percentage?: number
  amount?: number
  /** 0: Assembly, 1: Sub-Assembly / Unit, 2: Part */
  level?: number
  dwgNo?: string
  drawingRank?: string
  unitPrice?: number
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

export interface TaskSubtotals {
  taskId: number
  basicLabor: number
  overtime: number
  software: number
  total: number
}

// ── Company & Client ────────────────────────────────────────────────────────

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

// ── Document Details ────────────────────────────────────────────────────────

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
  quotationStatus?: string
  projectStatus?: string
  submittedToAdminAt?: string | null
  updateDetail?: string | null
  projectInCharge?: string
  billTo?: string
}

// ── Signatures ──────────────────────────────────────────────────────────────

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
    checkedBy: SignaturePerson
    approvedBy: SignaturePerson
    receivedBy: ReceivedBy
  }
  billing: {
    preparedBy: SignaturePerson
    approvedBy: SignaturePerson
    finalApprover: SignaturePerson
  }
}

// ── Overrides ───────────────────────────────────────────────────────────────

export interface FooterOverrides {
  overhead?: number
  adjustment?: number
  showAdmin?: boolean
}

export interface TaskOverrides {
  total?: number
  unitPage?: number
  referenceNumber?: string
  machineCode?: string
  unitCode?: string
  description?: string
  percentage?: number
  type?: string
  drawingRank?: string
  unitPrice?: number
}

export interface ManualOverrides {
  tasks: Record<number, TaskOverrides>
  footer: FooterOverrides
}

// ── Collaboration ───────────────────────────────────────────────────────────

export interface ChatMsg {
  id: string
  sid: string
  name: string
  color: string
  message: string
  time: string
  isEdited?: boolean
  isDeleted?: boolean
  readBy?: string[]
}

// ── Layout ──────────────────────────────────────────────────────────────────

export type LayoutVariant = 'special' | 'kemco'
