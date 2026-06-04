import { useState, useEffect, useMemo, useCallback } from 'react'
import { quotationApi, designersApi, settingsApi } from '../services/api'
import { useModal } from '../components/ModalContext'
import type { IQuotation } from '../types'

const getPartialBillingPercentage = (detail?: string | null): number => {
  if (!detail) return 50
  const match = detail.match(/(\d+)\s*%/)
  if (match) {
    const percent = parseInt(match[1])
    if (percent > 0 && percent < 100) return percent
  }
  return 50
}

export const normalizeClientName = (name: string | null | undefined): string => {
  if (!name) return 'Unknown Client'
  const trimmed = name.trim()
  if (!trimmed) return 'Unknown Client'
  
  const lower = trimmed.toLowerCase()
  if (lower.includes('nextengineering') || lower.includes('next engineering')) {
    return 'NEXT ENGINEERING Co., Ltd.'
  }
  if (lower.includes('maeno giken')) {
    return 'MAENO GIKEN INC.'
  }
  if (lower.includes('kusakabe')) {
    return 'Kusakabe Electric and Machinery Co., Ltd.'
  }
  if (lower.includes('agc ceramics') || lower === 'agcc') {
    return 'AGC Ceramics Co., Ltd.'
  }
  return trimmed
}

export interface IBillingChartPoint {
  name: string
  completed: number
  approvedActive: number
  pending: number
  cancelled: number
  displayDate: string
}

export interface IClientSalesPoint {
  name: string
  sales: number
}

export interface IStatusStat {
  count: number
  total: number
}

export type IStatusStats = Record<string, IStatusStat>

export interface IActiveCell {
  id: number
  field: string
}

export function useBillingMonitoring() {
  const [quotations, setQuotations] = useState<IQuotation[]>([])
  const [designers, setDesigners] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [globalSettings, setGlobalSettings] = useState<any>(null)

  // Filters State
  const [search, setSearch] = useState('')
  const [selectedDesigner, setSelectedDesigner] = useState('')
  const [selectedQStatus, setSelectedQStatus] = useState('')
  const [selectedPStatus, setSelectedPStatus] = useState<string>('')
  const [selectedBillTo, setSelectedBillTo] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [selectedBillingStatus, setSelectedBillingStatus] = useState<string>('')

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)

  // Per-Cell Editing State
  const [activeCell, setActiveCell] = useState<IActiveCell | null>(null)
  const [editForm, setEditForm] = useState<Partial<IQuotation>>({})

  // UI / Chart States
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>('month')
  const [showCompleted, setShowCompleted] = useState(true)
  const [showApprovedActive, setShowApprovedActive] = useState(true)
  const [showPending, setShowPending] = useState(true)
  const [showCancelled, setShowCancelled] = useState(true)
  const [chartView, setChartView] = useState<'total-sales' | 'client-sales'>('total-sales')
  const [clientColors, setClientColors] = useState<Record<string, string>>({})
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [startMonth, setStartMonth] = useState<number>(0)
  const [endMonth, setEndMonth] = useState<number>(11)
  const [sortColumn, setSortColumn] = useState<string | null>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === 'desc') {
        setSortColumn(null)
      } else {
        setSortDirection('desc')
      }
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  useEffect(() => {
    if (chartView === 'client-sales') {
      setTimeframe('year')
    }
  }, [chartView])

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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, selectedDesigner, selectedQStatus, selectedPStatus, selectedBillTo, selectedMonth, selectedBillingStatus])

  // Filter Logic
  const filteredQuotations = useMemo(() => {
    let result = quotations.filter(q => {
      const matchesSearch = !search || 
        (q.quotationNo && q.quotationNo.toLowerCase().includes(search.toLowerCase())) ||
        (q.clientName && q.clientName.toLowerCase().includes(search.toLowerCase())) ||
        (q.customerIncharge && q.customerIncharge.toLowerCase().includes(search.toLowerCase())) ||
        (q.designerName && q.designerName.toLowerCase().includes(search.toLowerCase()))

      const matchesDesigner = !selectedDesigner || q.designerName === selectedDesigner
      const matchesQStatus = !selectedQStatus || q.quotationStatus === selectedQStatus
      const matchesPStatus = !selectedPStatus || q.projectStatus === selectedPStatus
      const matchesBillTo = !selectedBillTo || normalizeClientName(q.billTo) === selectedBillTo
      const matchesMonth = !selectedMonth || (q.date && new Date(q.date).getMonth().toString() === selectedMonth)
      const matchesBillingStatus = !selectedBillingStatus || (q.billingStatus || '') === selectedBillingStatus

      return matchesSearch && matchesDesigner && matchesQStatus && matchesPStatus && matchesBillTo && matchesMonth && matchesBillingStatus
    })

    if (sortColumn) {
      result = [...result].sort((a, b) => {
        let valA: any = a[sortColumn as keyof IQuotation]
        let valB: any = b[sortColumn as keyof IQuotation]

        if (sortColumn === 'billTo') {
          valA = a.billTo || ''
          valB = b.billTo || ''
        } else {
          if (valA === null || valA === undefined) valA = ''
          if (valB === null || valB === undefined) valB = ''
        }

        if (sortColumn === 'grandTotal') {
          valA = Number(valA) || 0
          valB = Number(valB) || 0
        } else if (sortColumn === 'date' || sortColumn === 'datePaid' || sortColumn === 'submittedToAdminAt' || sortColumn === 'lastUpdatedAt') {
          valA = valA ? new Date(valA).getTime() : 0
          valB = valB ? new Date(valB).getTime() : 0
        } else {
          valA = String(valA).toLowerCase()
          valB = String(valB).toLowerCase()
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }

    return result
  }, [quotations, search, selectedDesigner, selectedQStatus, selectedPStatus, selectedBillTo, selectedMonth, selectedBillingStatus, sortColumn, sortDirection])

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

  const uniqueYears = useMemo<number[]>(() => {
    const years = new Set<number>()
    quotations.forEach(q => {
      if (q.date) {
        const y = new Date(q.date).getFullYear()
        if (!isNaN(y)) years.add(y)
      }
    })
    if (years.size === 0) {
      years.add(new Date().getFullYear())
    }
    return Array.from(years).sort((a, b) => b - a)
  }, [quotations])

  const activeYear = selectedYear ?? uniqueYears[0] ?? new Date().getFullYear()

  // Timeframe / Chart aggregate computations
  const { chartData, clientChartData, invoicesCount, revenueSum, trendPercent, timeframeLabel } = useMemo(() => {
    let endDate = new Date(refDate)
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
      // Use the activeYear and startMonth to define a specific calendar month
      startDate = new Date(activeYear, startMonth, 1, 0, 0, 0, 0)
      endDate = new Date(activeYear, startMonth + 1, 0, 23, 59, 59, 999)
      
      prevStartDate = new Date(activeYear - 1, startMonth, 1, 0, 0, 0, 0)
      prevEndDate = new Date(activeYear - 1, startMonth + 1, 0, 23, 59, 59, 999)
      
      formatTick = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      // Number of days in that specific month
      pointsCount = endDate.getDate()
      timeframeLabel = 'MOM'
    } else {
      startDate = new Date(activeYear, startMonth, 1, 0, 0, 0, 0)
      endDate = new Date(activeYear, endMonth + 1, 0, 23, 59, 59, 999)
      
      prevStartDate = new Date(activeYear - 1, startMonth, 1, 0, 0, 0, 0)
      prevEndDate = new Date(activeYear - 1, endMonth + 1, 0, 23, 59, 59, 999)
      
      formatTick = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' })
      
      pointsCount = Math.max(1, endMonth - startMonth + 1)
      timeframeLabel = 'YOY'
    }

    const currentQuotations = quotations.filter(q => {
      if (!q.date) return false
      const t = new Date(q.date).getTime()
      return t >= startDate.getTime() && t <= endDate.getTime()
    })

    const prevQuotations = quotations.filter(q => {
      if (!q.date) return false
      const t = new Date(q.date).getTime()
      return t >= prevStartDate.getTime() && t <= prevEndDate.getTime()
    })

    const positiveStatuses = ['Billing Completion', 'Approved', 'Partial Billing']
    const isCompleted = (q: IQuotation) => q.quotationStatus === 'Billing Completion' || q.billingStatus === 'BILLED'
    const isApproved = (q: IQuotation) => q.quotationStatus === 'Approved' && q.billingStatus !== 'BILLED'

    const currentRevenue = currentQuotations
      .filter(q => positiveStatuses.includes(q.quotationStatus || '') || q.billingStatus === 'BILLED')
      .reduce((sum, q) => sum + (q.grandTotal || 0), 0)
    const prevRevenue = prevQuotations
      .filter(q => positiveStatuses.includes(q.quotationStatus || '') || q.billingStatus === 'BILLED')
      .reduce((sum, q) => sum + (q.grandTotal || 0), 0)

    let trend = 0
    if (prevRevenue > 0) {
      trend = ((currentRevenue - prevRevenue) / prevRevenue) * 100
    } else if (currentRevenue > 0) {
      trend = 100
    }

    const points: IBillingChartPoint[] = []
    const clientChartPoints: any[] = []
    
    const uniqueClients = Array.from(
      new Set(
        quotations
          .filter(q => positiveStatuses.includes(q.quotationStatus || '') || q.billingStatus === 'BILLED')
          .map(q => normalizeClientName(q.billTo))
      )
    )
    
    if (timeframe === 'week' || timeframe === 'month') {
      let tempDate = new Date(startDate)
      
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
        
        let dayCompleted = 0
        let dayApprovedActive = 0

        dayQuots.forEach(q => {
          const status = q.quotationStatus || 'For Approval'
          const amt = q.grandTotal || 0
          if (isCompleted(q)) {
            dayCompleted += amt
          } else if (isApproved(q)) {
            dayApprovedActive += amt
          } else if (status === 'Partial Billing') {
            const pct = getPartialBillingPercentage(q.updateDetail)
            const completedAmt = amt * (pct / 100)
            const activeAmt = amt * ((100 - pct) / 100)
            dayCompleted += completedAmt
            dayApprovedActive += activeAmt
          }
        })

        const dayPending = dayQuots
          .filter(q => q.quotationStatus === 'For Approval' || !q.quotationStatus)
          .reduce((sum, q) => sum + (q.grandTotal || 0), 0)

        const dayCancelled = dayQuots
          .filter(q => q.quotationStatus === 'CANCELLED')
          .reduce((sum, q) => sum + (q.grandTotal || 0), 0)
        
        points.push({
          name: formatTick(tempDate),
          completed: dayCompleted,
          approvedActive: dayApprovedActive,
          pending: dayPending,
          cancelled: dayCancelled,
          displayDate: tempDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        })

        // Client stacked absolute sales per day
        const dayClientSales: Record<string, number> = {}
        uniqueClients.forEach(c => {
          dayClientSales[c] = 0
        })
        dayQuots.forEach(q => {
          const status = q.quotationStatus || 'For Approval'
          const billingStatus = q.billingStatus || ''
          const amt = q.grandTotal || 0
          const client = normalizeClientName(q.billTo)
          
          if (status === 'Billing Completion' || billingStatus === 'BILLED') {
            dayClientSales[client] = (dayClientSales[client] || 0) + amt
          } else if (status === 'Partial Billing') {
            const pct = getPartialBillingPercentage(q.updateDetail)
            const completedAmt = amt * (pct / 100)
            dayClientSales[client] = (dayClientSales[client] || 0) + completedAmt
          }
        })

        clientChartPoints.push({
          name: formatTick(tempDate),
          displayDate: tempDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          ...dayClientSales
        })
        
        tempDate.setDate(tempDate.getDate() + 1)
      }
    } else {
      let tempDate = new Date(startDate)
      
      for (let i = 0; i < pointsCount; i++) {
        const mStart = new Date(tempDate.getFullYear(), tempDate.getMonth(), 1, 0, 0, 0, 0)
        const mEnd = new Date(tempDate.getFullYear(), tempDate.getMonth() + 1, 0, 23, 59, 59, 999)
        
        const mQuots = currentQuotations.filter(q => {
          if (!q.date) return false
          const t = new Date(q.date).getTime()
          return t >= mStart.getTime() && t <= mEnd.getTime()
        })
        
        let mCompleted = 0
        let mApprovedActive = 0

        mQuots.forEach(q => {
          const status = q.quotationStatus || 'For Approval'
          const amt = q.grandTotal || 0
          if (isCompleted(q)) {
            mCompleted += amt
          } else if (isApproved(q)) {
            mApprovedActive += amt
          } else if (status === 'Partial Billing') {
            const pct = getPartialBillingPercentage(q.updateDetail)
            const completedAmt = amt * (pct / 100)
            const activeAmt = amt * ((100 - pct) / 100)
            mCompleted += completedAmt
            mApprovedActive += activeAmt
          }
        })

        const mPending = mQuots
          .filter(q => q.quotationStatus === 'For Approval' || !q.quotationStatus)
          .reduce((sum, q) => sum + (q.grandTotal || 0), 0)

        const mCancelled = mQuots
          .filter(q => q.quotationStatus === 'CANCELLED')
          .reduce((sum, q) => sum + (q.grandTotal || 0), 0)
        
        points.push({
          name: formatTick(tempDate),
          completed: mCompleted,
          approvedActive: mApprovedActive,
          pending: mPending,
          cancelled: mCancelled,
          displayDate: tempDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        })

        // Client stacked absolute sales per month
        const mClientSales: Record<string, number> = {}
        uniqueClients.forEach(c => {
          mClientSales[c] = 0
        })
        mQuots.forEach(q => {
          const status = q.quotationStatus || 'For Approval'
          const billingStatus = q.billingStatus || ''
          const amt = q.grandTotal || 0
          const client = normalizeClientName(q.billTo)
          
          if (status === 'Billing Completion' || billingStatus === 'BILLED') {
            mClientSales[client] = (mClientSales[client] || 0) + amt
          } else if (status === 'Partial Billing') {
            const pct = getPartialBillingPercentage(q.updateDetail)
            const completedAmt = amt * (pct / 100)
            mClientSales[client] = (mClientSales[client] || 0) + completedAmt
          }
        })

        clientChartPoints.push({
          name: formatTick(tempDate),
          displayDate: tempDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          ...mClientSales
        })
        
        tempDate.setMonth(tempDate.getMonth() + 1)
      }
    }

    return {
      chartData: points,
      clientChartData: clientChartPoints,
      invoicesCount: currentQuotations.length,
      revenueSum: currentRevenue,
      trendPercent: trend,
      timeframeLabel
    }
  }, [quotations, timeframe, refDate, formatDateToSlash, activeYear, startMonth, endMonth])

  // End month text label
  const currentEndMonth = useMemo(() => {
    return refDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  }, [refDate])

  // Single Field Save Handler
  const handleSingleFieldSave = async (id: number, updates: Partial<IQuotation>) => {
    const finalUpdates = { ...updates }
    if (updates.quotationStatus === 'CANCELLED') {
      finalUpdates.projectStatus = 'CANCELLED'
      finalUpdates.updateDetail = 'CANCELLED'
    }

    // Save previous state for potential rollback
    const previousQuotations = [...quotations]

    // Optimistically update local state immediately
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
        // Background list reload to keep in sync with actual database values (e.g. lastUpdatedAt, specific triggers)
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

  const resetFilters = () => {
    setSearch('')
    setSelectedDesigner('')
    setSelectedQStatus('')
    setSelectedPStatus('')
    setSelectedBillTo('')
    setSelectedMonth('')
    setSelectedBillingStatus('')
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


  const uniqueInchargeValues = useMemo(() => {
    return Array.from(
      new Set(quotations.map(q => q.designerName).filter(Boolean))
    ).sort((a, b) => a!.toLowerCase().localeCompare(b!.toLowerCase())) as string[]
  }, [quotations])

  const statusStats = useMemo(() => {
    const stats: IStatusStats = {
      'Billing Completion': { count: 0, total: 0 },
      'Partial Billing': { count: 0, total: 0 },
      'Approved': { count: 0, total: 0 },
      'For Approval': { count: 0, total: 0 },
      'DRAFT': { count: 0, total: 0 },
      'CANCELLED': { count: 0, total: 0 }
    }

    // Determine timeframe boundaries to calculate stats dynamically
    let endDate = new Date(refDate)
    endDate.setHours(23, 59, 59, 999)
    let startDate = new Date(refDate)

    if (timeframe === 'week') {
      startDate.setDate(refDate.getDate() - 6)
      startDate.setHours(0, 0, 0, 0)
    } else if (timeframe === 'month') {
      startDate = new Date(activeYear, startMonth, 1, 0, 0, 0, 0)
      endDate = new Date(activeYear, startMonth + 1, 0, 23, 59, 59, 999)
    } else {
      startDate = new Date(activeYear, startMonth, 1, 0, 0, 0, 0)
      endDate = new Date(activeYear, endMonth + 1, 0, 23, 59, 59, 999)
    }

    quotations.forEach(q => {
      if (!q.date) return
      const t = new Date(q.date).getTime()
      if (t < startDate.getTime() || t > endDate.getTime()) return

      const status = q.quotationStatus || 'For Approval'
      const billingStatus = q.billingStatus || ''
      const amt = q.grandTotal || 0
      
      // Completed Sales represents Billing Completion OR billing status BILLED
      if (status === 'Billing Completion' || billingStatus === 'BILLED') {
        stats['Billing Completion'].count++
        stats['Billing Completion'].total += amt
      } else if (status === 'Partial Billing') {
        stats['Partial Billing'].count++
        const pct = getPartialBillingPercentage(q.updateDetail)
        const completedAmt = amt * (pct / 100)
        const activeAmt = amt * ((100 - pct) / 100)
        
        stats['Billing Completion'].total += completedAmt
        stats['Partial Billing'].total += activeAmt
      } else {
        if (stats[status]) {
          stats[status].count++
          stats[status].total += amt
        }
      }
    })

    return stats
  }, [quotations, timeframe, refDate, activeYear, startMonth, endMonth])

  const clientSalesData = useMemo<IClientSalesPoint[]>(() => {
    const clientsMap: Record<string, number> = {}
    const positiveStatuses = ['Billing Completion', 'Approved', 'Partial Billing']
    
    const yearStart = new Date(activeYear, startMonth, 1, 0, 0, 0, 0)
    const yearEnd   = new Date(activeYear, endMonth + 1, 0, 23, 59, 59, 999)

    quotations.forEach(q => {
      if (!q.date) return
      const t = new Date(q.date).getTime()
      if (t < yearStart.getTime() || t > yearEnd.getTime()) return
      const client = normalizeClientName(q.billTo)
      const status = q.quotationStatus || 'For Approval'
      const billingStatus = q.billingStatus || ''
      const amt = q.grandTotal || 0
      
      if (status === 'Billing Completion' || billingStatus === 'BILLED') {
        clientsMap[client] = (clientsMap[client] || 0) + amt
      } else if (status === 'Partial Billing') {
        const pct = getPartialBillingPercentage(q.updateDetail)
        const completedAmt = amt * (pct / 100)
        clientsMap[client] = (clientsMap[client] || 0) + completedAmt
      }
    })
    
    return Object.entries(clientsMap)
      .map(([name, sales]) => ({ name, sales }))
      .sort((a, b) => b.sales - a.sales)
  }, [quotations, activeYear, startMonth, endMonth])

  useEffect(() => {
    if (clientSalesData.length === 0) return
    const presetColors = [
      '#3b82f6', // Premium Blue
      '#10b981', // Active Green
      '#8b5cf6', // Indigo
      '#f59e0b', // Amber/Orange
      '#ec4899', // Pink
      '#06b6d4', // Cyan
      '#eab308', // Yellow
      '#f43f5e', // Rose
      '#14b8a6', // Teal
      '#a855f7'  // Purple
    ]
    setClientColors(prev => {
      let updated = false
      const nextColors = { ...prev }
      clientSalesData.forEach((pt, i) => {
        if (!nextColors[pt.name]) {
          nextColors[pt.name] = presetColors[i % presetColors.length]
          updated = true
        }
      })
      return updated ? nextColors : prev
    })
  }, [clientSalesData])

  const updateClientColor = useCallback((clientName: string, color: string) => {
    setClientColors(prev => ({
      ...prev,
      [clientName]: color
    }))
  }, [])


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
    selectedMonth,
    setSelectedMonth,
    selectedBillingStatus,
    setSelectedBillingStatus,
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
    showCompleted,
    setShowCompleted,
    showApprovedActive,
    setShowApprovedActive,
    showPending,
    setShowPending,
    showCancelled,
    setShowCancelled,
    chartView,
    setChartView,
    clientColors,
    clientSalesData,
    clientChartData,
    updateClientColor,
    uniqueYears,
    activeYear,
    setSelectedYear,
    startMonth,
    setStartMonth,
    endMonth,
    setEndMonth,
    sortColumn,
    sortDirection,
    handleSort,
    filteredQuotations,
    totalItems,
    totalPages,
    paginatedQuotations,
    uniqueInchargeValues,
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
    resetFilters,
    globalSettings,
    saveGlobalSettings
  }
}
