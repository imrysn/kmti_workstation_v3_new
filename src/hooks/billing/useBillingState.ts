import { useState, useMemo, useEffect } from 'react'

export interface IActiveCell {
  id: number
  field: string
}

export function useBillingState() {
  // Load state from sessionStorage if exists
  const savedState = useMemo(() => {
    try {
      const data = sessionStorage.getItem('kmti:billing-monitoring-state')
      return data ? JSON.parse(data) : {}
    } catch {
      return {}
    }
  }, [])

  // Filters State
  const [search, setSearch] = useState(savedState.search ?? '')
  const [selectedDesigner, setSelectedDesigner] = useState(savedState.selectedDesigner ?? '')
  const [selectedQStatus, setSelectedQStatus] = useState(savedState.selectedQStatus ?? '')
  const [selectedPStatus, setSelectedPStatus] = useState<string>(savedState.selectedPStatus ?? '')
  const [selectedBillTo, setSelectedBillTo] = useState<string>(savedState.selectedBillTo ?? '')
  const [selectedMonth, setSelectedMonth] = useState<string>(savedState.selectedMonth ?? '')
  const [selectedBillingStatus, setSelectedBillingStatus] = useState<string>(savedState.selectedBillingStatus ?? '')

  // Pagination State
  const [currentPage, setCurrentPage] = useState(savedState.currentPage ?? 1)
  const [itemsPerPage, setItemsPerPage] = useState(savedState.itemsPerPage ?? 50)

  // Per-Cell Editing State
  const [activeCell, setActiveCell] = useState<IActiveCell | null>(null)
  const [editForm, setEditForm] = useState<any>({})

  // UI / Chart States
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>(savedState.timeframe ?? 'year')
  const [showCompleted, setShowCompleted] = useState(savedState.showCompleted ?? true)
  const [showApprovedActive, setShowApprovedActive] = useState(savedState.showApprovedActive ?? true)
  const [showPending, setShowPending] = useState(savedState.showPending ?? true)
  const [showCancelled, setShowCancelled] = useState(savedState.showCancelled ?? true)
  const [chartView, setChartView] = useState<'total-sales' | 'client-sales'>(savedState.chartView ?? 'total-sales')
  const [clientColors, setClientColors] = useState<Record<string, string>>({})
  const [selectedYear, setSelectedYear] = useState<number | null>(savedState.selectedYear ?? null)
  const [startMonth, setStartMonth] = useState<number>(savedState.startMonth ?? 0)
  const [endMonth, setEndMonth] = useState<number>(savedState.endMonth ?? 11)
  const [sortColumn, setSortColumn] = useState<string | null>(savedState.sortColumn ?? 'date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(savedState.sortDirection ?? 'asc')
  const [selectedAgingBucket, setSelectedAgingBucket] = useState<string | null>(savedState.selectedAgingBucket ?? null)

  // Sync state to sessionStorage
  useEffect(() => {
    try {
      const stateToSave = {
        search,
        selectedDesigner,
        selectedQStatus,
        selectedPStatus,
        selectedBillTo,
        selectedMonth,
        selectedBillingStatus,
        currentPage,
        itemsPerPage,
        timeframe,
        showCompleted,
        showApprovedActive,
        showPending,
        showCancelled,
        chartView,
        selectedYear,
        startMonth,
        endMonth,
        sortColumn,
        sortDirection,
        selectedAgingBucket
      }
      sessionStorage.setItem('kmti:billing-monitoring-state', JSON.stringify(stateToSave))
    } catch (e) {
      console.warn('Failed to save billing monitoring state:', e)
    }
  }, [
    search, selectedDesigner, selectedQStatus, selectedPStatus, selectedBillTo, selectedMonth, selectedBillingStatus,
    currentPage, itemsPerPage, timeframe, showCompleted, showApprovedActive, showPending, showCancelled,
    chartView, selectedYear, startMonth, endMonth, sortColumn, sortDirection, selectedAgingBucket
  ])

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

  useEffect(() => {
    setCurrentPage(1)
  }, [search, selectedDesigner, selectedQStatus, selectedPStatus, selectedBillTo, selectedMonth, selectedBillingStatus, selectedAgingBucket])

  const resetFilters = () => {
    setSearch('')
    setSelectedDesigner('')
    setSelectedQStatus('')
    setSelectedPStatus('')
    setSelectedBillTo('')
    setSelectedMonth('')
    setSelectedBillingStatus('')
    setSelectedAgingBucket(null)
  }

  return {
    search, setSearch,
    selectedDesigner, setSelectedDesigner,
    selectedQStatus, setSelectedQStatus,
    selectedPStatus, setSelectedPStatus,
    selectedBillTo, setSelectedBillTo,
    selectedMonth, setSelectedMonth,
    selectedBillingStatus, setSelectedBillingStatus,
    currentPage, setCurrentPage,
    itemsPerPage, setItemsPerPage,
    activeCell, setActiveCell,
    editForm, setEditForm,
    timeframe, setTimeframe,
    showCompleted, setShowCompleted,
    showApprovedActive, setShowApprovedActive,
    showPending, setShowPending,
    showCancelled, setShowCancelled,
    chartView, setChartView,
    clientColors, setClientColors,
    selectedYear, setSelectedYear,
    startMonth, setStartMonth,
    endMonth, setEndMonth,
    sortColumn, setSortColumn,
    sortDirection, setSortDirection,
    selectedAgingBucket, setSelectedAgingBucket,
    handleSort,
    resetFilters
  }
}
