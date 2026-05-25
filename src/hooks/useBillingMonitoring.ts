import { useState, useEffect, useMemo, useCallback } from 'react'
import { quotationApi, designersApi } from '../services/api'
import { useModal } from '../components/ModalContext'
import type { IQuotation } from '../types'

export function useBillingMonitoring() {
  const [quotations, setQuotations] = useState<IQuotation[]>([])
  const [designers, setDesigners] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Filters State
  const [search, setSearch] = useState('')
  const [selectedDesigner, setSelectedDesigner] = useState('')
  const [selectedQStatus, setSelectedQStatus] = useState('')
  const [selectedPStatus, setSelectedPStatus] = useState('')
  const [selectedBillTo, setSelectedBillTo] = useState('')

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)

  // Per-Cell Editing State
  const [activeCell, setActiveCell] = useState<{ id: number; field: string } | null>(null)
  const [editForm, setEditForm] = useState<Partial<IQuotation>>({})

  // UI / Chart States
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>('month')
  const [showPositive, setShowPositive] = useState(true)
  const [showGhost, setShowGhost] = useState(true)

  const { notify } = useModal()

  // Date formatters (always yyyy/mm/dd)
  const formatDateToSlash = useCallback((dateStr?: string | null) => {
    if (!dateStr) return '-'
    const base = dateStr.substring(0, 10).trim()
    return base.replace(/[- ]/g, '/')
  }, [])

  const formatDateTimeToSlash = useCallback((dateStr?: string | null) => {
    if (!dateStr) return '-'
    return dateStr.replace(/-/g, '/')
  }, [])

  // Currency Formatter
  const formatCurrency = useCallback((val?: number) => {
    if (val === undefined || val === null) return '¥0'
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0
    }).format(val)
  }, [])

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const qRes = await quotationApi.list({ limit: 1000 })
      setQuotations(qRes.data.quotations || [])

      const uniqueDesigners = new Set<string>()
      qRes.data.quotations.forEach(q => {
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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, selectedDesigner, selectedQStatus, selectedPStatus, selectedBillTo])

  // Filter Logic
  const filteredQuotations = useMemo(() => {
    return quotations.filter(q => {
      const matchesSearch = !search || 
        (q.quotationNo && q.quotationNo.toLowerCase().includes(search.toLowerCase())) ||
        (q.clientName && q.clientName.toLowerCase().includes(search.toLowerCase())) ||
        (q.customerIncharge && q.customerIncharge.toLowerCase().includes(search.toLowerCase())) ||
        (q.designerName && q.designerName.toLowerCase().includes(search.toLowerCase()))

      const matchesDesigner = !selectedDesigner || q.designerName === selectedDesigner
      const matchesQStatus = !selectedQStatus || q.quotationStatus === selectedQStatus
      const matchesPStatus = !selectedPStatus || q.projectStatus === selectedPStatus
      const matchesBillTo = !selectedBillTo || q.billTo === selectedBillTo

      return matchesSearch && matchesDesigner && matchesQStatus && matchesPStatus && matchesBillTo
    })
  }, [quotations, search, selectedDesigner, selectedQStatus, selectedPStatus, selectedBillTo])

  // Pagination Computations
  const totalItems = filteredQuotations.length
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1
  const paginatedQuotations = useMemo(() => {
    return filteredQuotations.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    )
  }, [filteredQuotations, currentPage, itemsPerPage])

  // Reference date (centers timeline around latest quotation data so charts are never blank)
  const refDate = useMemo(() => {
    if (quotations.length === 0) return new Date()
    const dates = quotations.map(q => q.date ? new Date(q.date).getTime() : 0)
    const maxTime = Math.max(...dates)
    return maxTime > 0 ? new Date(maxTime) : new Date()
  }, [quotations])

  // Timeframe / Chart aggregate computations
  const { chartData, invoicesCount, revenueSum, trendPercent, timeframeLabel } = useMemo(() => {
    const endDate = new Date(refDate)
    endDate.setHours(23, 59, 59, 999)
    
    let startDate = new Date(refDate)
    let prevStartDate = new Date(refDate)
    let prevEndDate = new Date(refDate)
    let formatTick: (d: Date) => string = () => ''
    let pointsCount = 0
    let timeframeLabel = 'MOM'

    if (timeframe === 'week') {
      startDate.setDate(refDate.getDate() - 6)
      startDate.setHours(0, 0, 0, 0)
      
      prevEndDate.setDate(startDate.getDate() - 1)
      prevEndDate.setHours(23, 59, 59, 999)
      prevStartDate.setDate(prevEndDate.getDate() - 6)
      prevStartDate.setHours(0, 0, 0, 0)
      
      formatTick = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      pointsCount = 7
      timeframeLabel = 'WOW'
    } else if (timeframe === 'month') {
      startDate.setDate(refDate.getDate() - 29)
      startDate.setHours(0, 0, 0, 0)
      
      prevEndDate.setDate(startDate.getDate() - 1)
      prevEndDate.setHours(23, 59, 59, 999)
      prevStartDate.setDate(prevEndDate.getDate() - 29)
      prevStartDate.setHours(0, 0, 0, 0)
      
      formatTick = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      pointsCount = 30
      timeframeLabel = 'MOM'
    } else {
      startDate.setMonth(refDate.getMonth() - 11)
      startDate.setDate(1)
      startDate.setHours(0, 0, 0, 0)
      
      prevEndDate.setDate(startDate.getDate() - 1)
      prevEndDate.setHours(23, 59, 59, 999)
      prevStartDate.setMonth(prevEndDate.getMonth() - 11)
      prevStartDate.setDate(1)
      prevStartDate.setHours(0, 0, 0, 0)
      
      formatTick = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' })
      pointsCount = 12
      timeframeLabel = 'YOY'
    }

    const currentQuotations = filteredQuotations.filter(q => {
      if (!q.date) return false
      const t = new Date(q.date).getTime()
      return t >= startDate.getTime() && t <= endDate.getTime()
    })

    const prevQuotations = filteredQuotations.filter(q => {
      if (!q.date) return false
      const t = new Date(q.date).getTime()
      return t >= prevStartDate.getTime() && t <= prevEndDate.getTime()
    })

    const currentRevenue = currentQuotations.reduce((sum, q) => sum + (q.grandTotal || 0), 0)
    const prevRevenue = prevQuotations.reduce((sum, q) => sum + (q.grandTotal || 0), 0)

    let trend = 0
    if (prevRevenue > 0) {
      trend = ((currentRevenue - prevRevenue) / prevRevenue) * 100
    } else if (currentRevenue > 0) {
      trend = 100
    }

    const points: any[] = []
    
    if (timeframe === 'week' || timeframe === 'month') {
      let tempDate = new Date(startDate)
      let runningSum = 0
      let runningSumPositive = 0
      let runningSumGhost = 0
      
      for (let i = 0; i < pointsCount; i++) {
        const dayStart = new Date(tempDate)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(tempDate)
        dayEnd.setHours(23, 59, 59, 999)
        
        const dayQuots = currentQuotations.filter(q => {
          if (!q.date) return false
          const t = new Date(q.date).getTime()
          return t >= dayStart.getTime() && t <= dayEnd.getTime()
        })
        
        const dayAmount = dayQuots.reduce((sum, q) => sum + (q.grandTotal || 0), 0)

        // Positive = Billing Completion + Approved + Partial Billing
        const dayPositive = dayQuots
          .filter(q => q.quotationStatus === 'Billing Completion' ||
                       q.quotationStatus === 'Approved' ||
                       q.quotationStatus === 'Partial Billing')
          .reduce((sum, q) => sum + (q.grandTotal || 0), 0)

        // Ghost = For Approval + CANCELLED (uncertain / risky revenue)
        const dayGhost = dayQuots
          .filter(q => q.quotationStatus === 'For Approval' ||
                       q.quotationStatus === 'CANCELLED')
          .reduce((sum, q) => sum + (q.grandTotal || 0), 0)
        
        runningSum += dayAmount
        runningSumPositive += dayPositive
        runningSumGhost += dayGhost
        
        points.push({
          name: formatTick(tempDate),
          revenue: runningSum,
          positive: runningSumPositive,
          ghost: runningSumGhost,
          displayDate: tempDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        })
        
        tempDate.setDate(tempDate.getDate() + 1)
      }
    } else {
      let tempDate = new Date(startDate)
      let runningSum = 0
      let runningSumPositive = 0
      let runningSumGhost = 0
      
      for (let i = 0; i < pointsCount; i++) {
        const mStart = new Date(tempDate.getFullYear(), tempDate.getMonth(), 1, 0, 0, 0, 0)
        const mEnd = new Date(tempDate.getFullYear(), tempDate.getMonth() + 1, 0, 23, 59, 59, 999)
        
        const mQuots = currentQuotations.filter(q => {
          if (!q.date) return false
          const t = new Date(q.date).getTime()
          return t >= mStart.getTime() && t <= mEnd.getTime()
        })
        
        const mAmount = mQuots.reduce((sum, q) => sum + (q.grandTotal || 0), 0)

        const mPositive = mQuots
          .filter(q => q.quotationStatus === 'Billing Completion' ||
                       q.quotationStatus === 'Approved' ||
                       q.quotationStatus === 'Partial Billing')
          .reduce((sum, q) => sum + (q.grandTotal || 0), 0)

        const mGhost = mQuots
          .filter(q => q.quotationStatus === 'For Approval' ||
                       q.quotationStatus === 'CANCELLED')
          .reduce((sum, q) => sum + (q.grandTotal || 0), 0)
        
        runningSum += mAmount
        runningSumPositive += mPositive
        runningSumGhost += mGhost
        
        points.push({
          name: formatTick(tempDate),
          revenue: runningSum,
          positive: runningSumPositive,
          ghost: runningSumGhost,
          displayDate: tempDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        })
        
        tempDate.setMonth(tempDate.getMonth() + 1)
      }
    }

    return {
      chartData: points,
      invoicesCount: currentQuotations.length,
      revenueSum: currentRevenue,
      trendPercent: trend,
      timeframeLabel
    }
  }, [filteredQuotations, timeframe, refDate, formatDateToSlash])

  // End month text label
  const currentEndMonth = useMemo(() => {
    return refDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  }, [refDate])

  // Single Field Save Handler
  const handleSingleFieldSave = async (id: number, updates: Partial<IQuotation>) => {
    try {
      const finalUpdates = { ...updates }
      if (updates.quotationStatus === 'CANCELLED') {
        finalUpdates.projectStatus = 'CANCELLED'
        finalUpdates.updateDetail = 'CANCELLED'
      }

      const res = await quotationApi.updateBilling(id, finalUpdates)
      if (res.data?.success) {
        notify('Saved successfully', 'success')
        // Reload list directly
        const qRes = await quotationApi.list({ limit: 1000 })
        setQuotations(qRes.data.quotations || [])
      } else {
        notify('Failed to save changes', 'error')
      }
    } catch (err: any) {
      console.error(err)
      notify(err.response?.data?.detail || 'Error saving changes', 'error')
    }
  }

  const resetFilters = () => {
    setSearch('')
    setSelectedDesigner('')
    setSelectedQStatus('')
    setSelectedPStatus('')
    setSelectedBillTo('')
  }

  const uniqueBillToValues = useMemo(() => {
    return Array.from(
      new Set(quotations.map(q => q.billTo).filter(Boolean))
    ).sort() as string[]
  }, [quotations])

  const statusStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {
      'Billing Completion': { count: 0, total: 0 },
      'Partial Billing': { count: 0, total: 0 },
      'Approved': { count: 0, total: 0 },
      'For Approval': { count: 0, total: 0 },
      'CANCELLED': { count: 0, total: 0 }
    }

    filteredQuotations.forEach(q => {
      const status = q.quotationStatus || 'For Approval'
      if (stats[status]) {
        stats[status].count++
        stats[status].total += (q.grandTotal || 0)
      }
    })

    return stats
  }, [filteredQuotations])

  return {
    quotations,
    designers,
    loading,
    search,
    setSearch,
    selectedDesigner,
    setSelectedDesigner,
    selectedQStatus,
    setSelectedQStatus,
    selectedPStatus,
    setSelectedPStatus,
    selectedBillTo,
    setSelectedBillTo,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    activeCell,
    setActiveCell,
    editForm,
    setEditForm,
    timeframe,
    setTimeframe,
    showPositive,
    setShowPositive,
    showGhost,
    setShowGhost,
    filteredQuotations,
    totalItems,
    totalPages,
    paginatedQuotations,
    uniqueBillToValues,
    statusStats,
    chartData,
    invoicesCount,
    revenueSum,
    trendPercent,
    timeframeLabel,
    currentEndMonth,
    formatDateToSlash,
    formatDateTimeToSlash,
    formatCurrency,
    loadData,
    handleSingleFieldSave,
    resetFilters
  }
}
