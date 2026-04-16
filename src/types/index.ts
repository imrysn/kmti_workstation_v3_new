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


