/**
 * Global TypeScript interfaces for the KMTI Workstation v3.
 * These safely type the data flowing from the FastAPI backend.
 */

export interface IPurchasedPart {
  id: number
  projectId: number
  isFolder: boolean
  category: string
  partsType: string
  fileName: string
  fileType: string
  filePath: string
  size: number
  lastModified: number
  partGeomName?: string
  boundX?: number
  boundY?: number
  boundZ?: number
}

export interface IProject {
  id: number
  name: string
  rootPath: string
  category?: string
  totalFiles: number
  cadFiles: number
  isScanning?: boolean
}

export interface ITreeNode {
  name: string
  isDir: boolean
  path: string
}

export interface ICharacterMapping {
  id: number
  englishChar: string
  japaneseChar: string
}

export interface IHeatTreatment {
  id?: number
  category?: string
  englishChar: string
  japaneseChar: string
}

export interface IDesigner {
  id?: number
  category?: string
  englishName: string
  email: string
  japaneseName: string
}

export interface IAppSettings {
  dbSource: string
  dbName: string
  dbUsername: string
  dbPass: string
  localPath: string
  actPath: string
  autoDel: boolean
}

export interface IApiResponse<T> {
  data: T
  error?: string
  status: number
}

export interface IQuotation {
  id: number
  quotationNo: string
  clientName: string
  designerName: string
  workstation?: string // Hostname ID
  date: string
  modifiedAt: string
  isActive: boolean
  hasPassword?: boolean,
  password?: string, // Plain-text for Admin recovery
  displayName?: string
}

export interface IQuotationHistory {
  id: number
  label: string
  description?: string
  author: string
  timestamp: string
}

// ── Quotation Internal Structure ──────────────────────────────────────────────

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

export interface FooterOverrides {
  overhead?: number
  adjustment?: number
}

export interface TaskOverrides {
  total?: number
  unitPage?: number
}

export interface ManualOverrides {
  tasks: Record<number, TaskOverrides>
  footer: FooterOverrides
}

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
