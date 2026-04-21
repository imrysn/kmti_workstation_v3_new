import { useCallback } from 'react'
import { useModal } from '../../components/ModalContext'

type NotificationType = 'success' | 'error' | 'info' | 'warning'

interface FileOperationsOptions {
  hasUnsavedChanges: boolean
  getSaveData: () => object
  /** Returns the current quotation number — used to build a meaningful filename */
  getQuotationNo: () => string
  loadData: (data: any, fileName: string) => void
  resetToNew: () => void
  markSaved: (path: string) => void
  notify?: (message: string, type?: NotificationType) => void
  /** The currently tracked destination for the document (full path) */
  currentFilePath: string | null
}

export function useFileOperations({
  hasUnsavedChanges,
  getSaveData,
  getQuotationNo,
  loadData,
  resetToNew,
  markSaved,
  notify,
  currentFilePath,
}: FileOperationsOptions) {
  const modal = useModal()

  const showMessage = useCallback((msg: string, type: NotificationType = 'info') => {
    if (notify) notify(msg, type)
    else modal.notify(msg, type)
  }, [notify, modal])

  // New Invoice
  const newInvoice = useCallback(() => {
    if (hasUnsavedChanges) {
      modal.confirm(
        'You have unsaved changes. Are you sure you want to create a new invoice?',
        resetToNew,
        undefined,
        'danger',
        'Discard Changes?'
      )
    } else {
      resetToNew()
    }
  }, [hasUnsavedChanges, resetToNew, modal])

  // Save Invoice
  const saveInvoice = useCallback(async (isAutoSave = false) => {
    try {
      const data = getSaveData()
      const jsonString = JSON.stringify(data, null, 2)
      const quotNo = getQuotationNo().replace(/[^a-zA-Z0-9_\-]/g, '_') || 'Draft'
      const dateStamp = new Date().toISOString().split('T')[0]
      const defaultFileName = `KMTI_Quotation_${quotNo}_${dateStamp}.json`

      const electronAPI = (window as any).electronAPI
      if (electronAPI?.writeFile) {
        let targetPath = currentFilePath

        // If no file path exists, we must ask the user for one (unless it's an auto-save)
        if (!targetPath) {
          if (isAutoSave) return null // Don't interrupt user with dialogs during auto-save
          
          if (electronAPI.showSaveDialog) {
            const { filePath, canceled } = await electronAPI.showSaveDialog({
              defaultPath: defaultFileName,
              filters: [{ name: 'KMTI Quotation', extensions: ['json'] }],
            })
            if (canceled || !filePath) return null
            targetPath = filePath
          }
        }

        if (targetPath) {
          await electronAPI.writeFile(targetPath, jsonString)
          markSaved(targetPath)
          if (!isAutoSave) showMessage('Quotation saved!', 'success')
          return targetPath
        }
        return null
      }

      // Fallback: browser download (only for manual save)
      if (isAutoSave) return null
      
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = defaultFileName
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 100)
      
      markSaved(defaultFileName)
      return defaultFileName
    } catch (error: any) {
      console.error('Save failed:', error)
      if (!isAutoSave) showMessage(`Error saving file: ${error.message}`, 'error')
      return null
    }
  }, [getSaveData, getQuotationNo, markSaved, showMessage, currentFilePath])

  // Load Invoice
  const performLoad = useCallback(async () => {
    try {
      const electronAPI = (window as any).electronAPI
      const defaultNASPath = '\\\\KMTI-NAS\\Shared\\data\\template'

      // 1. Electron: use native open dialog with NAS default path
      if (electronAPI?.showOpenDialog && electronAPI?.readFile) {
        const { filePath, canceled } = await electronAPI.showOpenDialog({
          title: 'Browse Quotation Templetes on NAS',
          defaultPath: defaultNASPath,
          filters: [{ name: 'KMTI Quotations', extensions: ['json'] }],
          properties: ['openFile']
        })
        
        if (canceled || !filePath) return

        const contents = await electronAPI.readFile(filePath)
        if (!contents) throw new Error('File is empty or could not be read')
        
        const data = JSON.parse(contents)
        const fileName = filePath.split(/[\\/]/).pop() || 'Quotation'
        
        loadData(data, fileName)
        markSaved(filePath)
        showMessage(`Loaded: ${fileName}`, 'success')
        return
      }

      // 2. Modern File System Access API (Fallback for web/debug)
      if ('showOpenFilePicker' in window && window.isSecureContext) {
        try {
          const [fileHandle] = await (window as any).showOpenFilePicker({
            types: [{ description: 'KMTI Quotation files', accept: { 'application/json': ['.json'] } }],
          })
          const file = await fileHandle.getFile()
          const contents = await file.text()
          if (!contents || contents.trim().length < 2) throw new Error('File appears to be empty')
          const data = JSON.parse(contents)
          if (!data || typeof data !== 'object') throw new Error('Invalid quotation file format')
          loadData(data, fileHandle.name)
          showMessage(`Loaded: ${fileHandle.name}`, 'success')
          setTimeout(() => { window.focus(); document.body.focus() }, 150)
          return
        } catch (fsError: any) {
          if (fsError.name === 'AbortError') return
          throw fsError
        }
      }

      // Fallback: <input type="file">
      const fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.accept = '.json'
      fileInput.style.display = 'none'

      const loadFile = (): Promise<{ data: any; fileName: string }> =>
        new Promise((resolve, reject) => {
          fileInput.onchange = async (event: Event) => {
            const file = (event.target as HTMLInputElement).files?.[0]
            if (!file) { reject(new Error('No file selected')); return }
            try {
              const text = await readFileWithTimeout(file, 15000)
              if (!text || text.trim().length < 2) throw new Error('File is empty or could not be read')
              const data = JSON.parse(text)
              resolve({ data, fileName: file.name })
            } catch (err) { reject(err) }
          }
          fileInput.onerror = () => reject(new Error('Failed to access file.'))
        })

      document.body.appendChild(fileInput)
      fileInput.click()
      try {
        const { data, fileName } = await loadFile()
        loadData(data, fileName)
        showMessage(`Loaded: ${fileName}`, 'success')
        setTimeout(() => { window.focus(); document.body.focus() }, 150)
      } finally {
        document.body.removeChild(fileInput)
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message.includes('No file selected')) return
      console.error('Load failed:', error)
      showMessage(`Loading failed: ${error.message}`, 'error')
    }
  }, [loadData, showMessage])

  const loadInvoice = useCallback(() => {
    if (hasUnsavedChanges) {
      modal.confirm(
        'You have unsaved changes. Are you sure you want to load another invoice?',
        performLoad,
        undefined,
        'danger',
        'Discard Changes?'
      )
    } else {
      performLoad()
    }
  }, [hasUnsavedChanges, performLoad, modal])

  return { newInvoice, saveInvoice, loadInvoice }
}

// Helper
async function readFileWithTimeout(file: File, timeout = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const timer = setTimeout(() => {
      reader.abort()
      reject(new Error(`File reading timeout after ${timeout / 1000}s`))
    }, timeout)

    reader.onload = (e) => {
      clearTimeout(timer)
      const result = e.target?.result as string
      if (!result) { reject(new Error('File content is empty')); return }
      resolve(result)
    }
    reader.onerror = () => { clearTimeout(timer); reject(new Error('Failed to read file')) }
    reader.onabort = () => { clearTimeout(timer); reject(new Error('File reading was cancelled')) }
    reader.readAsText(file)
  })
}
