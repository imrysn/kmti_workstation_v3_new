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
  snippet?: string
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

export interface IMaterial {
  id?: number
  englishName: string
  japaneseName: string
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
  date?: string | null
  modifiedAt: string
  isActive: boolean
  hasPassword?: boolean,
  password?: string, // Plain-text for Admin recovery
  displayName?: string
  // Billing & Monitoring fields
  grandTotal?: number
  customerIncharge?: string
  quotationStatus?: string
  projectStatus?: string
  submittedToAdminAt?: string | null
  billTo?: string | null
  datePaid?: string | null
  updatedBy?: string | null
  lastUpdatedAt?: string | null
  updateDetail?: string | null
  customClientName?: string
  billingStatus?: string | null
  data?: any
}

export interface IQuotationHistory {
  id: number
  label: string
  description?: string
  author: string
  timestamp: string
}

export interface ICustomPage {
  id: number
  title: string
}

export interface ICustomMapping {
  id?: number
  englishName: string
  japaneseName: string
}
