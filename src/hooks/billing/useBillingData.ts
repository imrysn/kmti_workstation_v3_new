import { useState, useCallback, useEffect } from 'react'
import { quotationApi, designersApi, settingsApi } from '../../services/api'
import type { IQuotation } from '../../types'

export function useBillingData(notify: (msg: string, type: 'success' | 'error') => void, resetFilters: () => void) {
  const [quotations, setQuotations] = useState<IQuotation[]>([])
  const [designers, setDesigners] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [globalSettings, setGlobalSettings] = useState<any>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const qRes = await quotationApi.list({ limit: 1000 })
      setQuotations(qRes.data.quotations || [])

      const uniqueDesigners = new Set<string>()
      qRes.data.quotations.forEach((q: any) => {
        if (q.designerName) uniqueDesigners.add(q.designerName)
      })

      try {
        const dRes = await designersApi.list()
        dRes.data.forEach((d: any) => {
          if (d.englishName) uniqueDesigners.add(d.englishName)
        })
      } catch (err) {
        console.warn('Could not fetch designers table, falling back to quotation records only.', err)
      }

      setDesigners(Array.from(uniqueDesigners).sort())

      try {
        const sRes = await settingsApi.get()
        setGlobalSettings(sRes.data || {})
      } catch (err) {
        console.warn('Could not fetch global settings', err)
      }
    } catch (err) {
      console.error(err)
      notify('Failed to load quotations and billing monitoring records', 'error')
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSingleFieldSave = async (id: number, updates: Partial<IQuotation>) => {
    const finalUpdates = { ...updates }
    if (updates.quotationStatus === 'CANCELLED') {
      finalUpdates.projectStatus = 'CANCELLED'
      finalUpdates.updateDetail = 'CANCELLED'
    }

    const previousQuotations = [...quotations]

    setQuotations(prev =>
      prev.map(q => {
        if (q.id === id) {
          return {
            ...q,
            ...finalUpdates,
            lastUpdatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
          }
        }
        return q
      })
    )

    try {
      const res = await quotationApi.updateBilling(id, finalUpdates)
      if (res.data?.success) {
        notify('Saved successfully', 'success')
        quotationApi.list({ limit: 1000 }).then(qRes => {
          setQuotations(qRes.data.quotations || [])
        }).catch(err => {
          console.warn('Background quotation list reload failed', err)
        })
      } else {
        notify('Failed to save changes', 'error')
        setQuotations(previousQuotations)
      }
    } catch (err: any) {
      console.error(err)
      notify(err.response?.data?.detail || 'Error saving changes', 'error')
      setQuotations(previousQuotations)
    }
  }

  const handleAddNewRow = async (initialData: Partial<IQuotation>) => {
    try {
      setLoading(true)
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2)
      const seq = Math.floor(Math.random() * 900 + 100).toString()
      const quotNo = initialData.quotationNo || `KMTE-${today}-${seq}`
      
      const payload = {
        quot_no: quotNo,
        display_name: initialData.displayName || quotNo,
        client_name: initialData.clientName || '',
        designer_name: initialData.designerName || '',
        grand_total: initialData.grandTotal || 0,
        customer_incharge: initialData.customerIncharge || '',
        quotation_status: initialData.quotationStatus || 'DRAFT',
        project_status: initialData.projectStatus || 'On Going',
        billing_status: initialData.billingStatus || null,
        bill_to: initialData.billTo || '',
        update_detail: initialData.updateDetail || '',
        date: initialData.date || new Date().toISOString().split('T')[0]
      }
      
      const res = await quotationApi.create(payload)
      if (res.data?.success) {
        notify('New row created successfully', 'success')
        resetFilters()
        await loadData()
      } else {
        notify('Failed to create new row', 'error')
      }
    } catch (err: any) {
      console.error(err)
      notify(err.response?.data?.detail || 'Error creating new row', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRows = async (ids: number[]) => {
    if (ids.length === 0) return
    try {
      setLoading(true)
      let computerName = ''
      try {
        const info = await (window as any).electronAPI?.getWorkstationInfo?.()
        computerName = info?.computerName || ''
      } catch (e) {}
      
      for (const id of ids) {
        await quotationApi.delete(id, undefined, false, computerName || undefined)
      }
      notify(`Successfully deleted ${ids.length} item(s)`, 'success')
      await loadData()
    } catch (err: any) {
      console.error(err)
      notify(err.response?.data?.detail || 'Error deleting rows', 'error')
    } finally {
      setLoading(false)
    }
  }

  const saveGlobalSettings = async (updates: Record<string, any>) => {
    try {
      const currentRes = await settingsApi.get()
      const merged = { ...currentRes.data, ...updates }
      await settingsApi.save(merged)
      setGlobalSettings(merged)
      notify('Settings saved globally', 'success')
    } catch (err) {
      console.error(err)
      notify('Failed to save settings globally', 'error')
    }
  }

  return {
    quotations,
    setQuotations,
    designers,
    loading,
    globalSettings,
    handleSingleFieldSave,
    handleAddNewRow,
    handleDeleteRows,
    saveGlobalSettings,
    loadData
  }
}
