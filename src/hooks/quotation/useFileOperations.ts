import { useCallback } from 'react'

type NotificationType = 'success' | 'error' | 'info' | 'warning'

interface FileOperationsOptions {
  hasUnsavedChanges: boolean
  getSaveData: () => object
  loadData: (data: any, fileName: string) => void
  resetToNew: () => void
  setCurrentFilePath: (path: string | null) => void
  setHasUnsavedChanges: (v: boolean) => void
  notify?: (message: string, type?: NotificationType) => void
}

export function useFileOperations({
  hasUnsavedChanges,
  getSaveData,
  loadData,
  resetToNew,
  setCurrentFilePath,
  setHasUnsavedChanges,
  notify,
}: FileOperationsOptions) {
  const showMessage = useCallback((msg: string, type: NotificationType = 'info') => {
    if (notify) notify(msg, type)
    else alert(msg)
  }, [notify])

  // ── New Invoice ──────────────────────────────────────────────────────────
  const newInvoice = useCallback(() => {
    if (
      hasUnsavedChanges &&
      !window.confirm('You have unsaved changes. Are you sure you want to create a new invoice?')
    ) return
    resetToNew()
  }, [hasUnsavedChanges, resetToNew])

  // ── Save Invoice ─────────────────────────────────────────────────────────
  const saveInvoice = useCallback(async () => {
    try {
      const data = getSaveData()
      const jsonString = JSON.stringify(data, null, 2)
      const fileName = `KMTI_Quotation_${new Date().toISOString().split('T')[0]}.json`

      // Electron: use native save dialog
      const electronAPI = (window as any).electronAPI
      if (electronAPI?.showSaveDialog && electronAPI?.writeFile) {
        const filePath: string | null = await electronAPI.showSaveDialog({
          defaultPath: fileName,
          filters: [{ name: 'KMTI Quotation', extensions: ['json'] }],
        })
        if (!filePath) return // user cancelled
        await electronAPI.writeFile(filePath, jsonString)
        setCurrentFilePath(filePath)
        setHasUnsavedChanges(false)
        showMessage('Quotation saved!', 'success')
        return
      }

      // Fallback: browser download
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 100)
      setHasUnsavedChanges(false)
    } catch (error: any) {
      console.error('Save failed:', error)
      showMessage(`Error saving file: ${error.message}`, 'error')
    }
  }, [getSaveData, setCurrentFilePath, setHasUnsavedChanges, showMessage])

  // ── Load Invoice ─────────────────────────────────────────────────────────
  const loadInvoice = useCallback(async () => {
    if (
      hasUnsavedChanges &&
      !window.confirm('You have unsaved changes. Are you sure you want to load another invoice?')
    ) return

    try {
      // Modern File System Access API
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
  }, [hasUnsavedChanges, loadData, showMessage])

  return { newInvoice, saveInvoice, loadInvoice }
}

// ── Helper ───────────────────────────────────────────────────────────────────
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
