/**
 * Global TypeScript interfaces for the KMTI Workstation v3.
 * These safely type the data flowing from the FastAPI backend.
 */

export interface IPurchasedPart {
  id: number
  category: string
  partsType: string
  fileName: string
}

export interface ICharacterMapping {
  id: number
  englishChar: string
  japaneseChar: string
}

export interface IHeatTreatment {
  id: number
  category: string
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

// Electron IPC bridge types (injected by preload.js)
export interface ElectronAPI {
  openFolder: (path: string) => Promise<void>
  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
