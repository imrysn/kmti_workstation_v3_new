export interface KMTIElectronAPI {
  openFolder: (folderPath: string) => Promise<void>;
  openFile: (filePath: string) => Promise<void>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  isWindowMaximized: () => Promise<boolean>;
  onWindowMaximized: (cb: (isMax: boolean) => void) => void;
  closeWindow: () => Promise<void>;
  selectFolder: () => Promise<string | null>;
  getFileIcon: (filePath: string, isFolder: boolean) => Promise<string | null>;
  loginSuccess: () => Promise<void>;
  logoutReset: () => Promise<void>;
  captureScreenshot: () => Promise<string | null>;
  getWorkstationInfo: () => Promise<{
    computerName: string;
    platform: string;
    release: string;
    arch: string;
    username: string;
  }>;

  // --- Auto Updater ---
  checkForUpdate: () => Promise<any>;
  downloadUpdate: () => Promise<any>;
  installAndRestart: () => void;
  onUpdateAvailable: (cb: (info: any) => void) => void;
  onUpdateNotAvailable: (cb: (info: any) => void) => void;
  onUpdateDownloaded: (cb: (info: any) => void) => void;
  onUpdateProgress: (cb: (progress: any) => void) => void;
  onUpdateError: (cb: (msg: string) => void) => void;
  removeUpdateListeners: () => void;
  removeWindowMaximizedListener: () => void;

  // --- Stopwatch ---
  getStopwatchRecords: () => Promise<{ success: boolean; data: any[]; error?: string }>;
  saveStopwatchRecords: (records: any[]) => Promise<{ success: boolean; error?: string }>;
  openStopwatchFolder: () => Promise<void>;

  // --- System / File Operations ---
  print: (options?: any) => Promise<{ success: boolean; error?: string }>;
  printToPDF: (options?: any) => Promise<{ success: boolean; data: Uint8Array; error?: string }>;
  showSaveDialog: (options?: any) => Promise<{ canceled: boolean; filePath?: string }>;
  writeFile: (filePath: string, data: any) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: KMTIElectronAPI;
  }
  const __APP_VERSION__: string;
}
