import { useMemo } from 'react'
import { useModal } from '../components/ModalContext'
import { useBillingState, IActiveCell } from './billing/useBillingState'
import { useBillingData } from './billing/useBillingData'
import { useBillingComputations, IStatusStats, IStatusStat } from './billing/useBillingComputations'
import { useBillingChart, useClientSalesData, IBillingChartPoint, IClientSalesPoint } from './billing/useBillingChart'
import {
  getPartialBillingPercentage,
  normalizeClientName,
  formatDateToSlash,
  formatDateTimeToSlash,
  formatCurrency,
  getCompletedAmount,
  getForBillingAmount,
  getForecastAmount
} from '../utils/billingUtils'
import { useCallback, useEffect } from 'react'

export type { IBillingChartPoint, IClientSalesPoint, IStatusStats, IStatusStat, IActiveCell }
export {
  getPartialBillingPercentage,
  normalizeClientName,
  formatDateToSlash,
  formatDateTimeToSlash,
  formatCurrency,
  getCompletedAmount,
  getForBillingAmount,
  getForecastAmount
}

export function useBillingMonitoring() {
  const { notify } = useModal()
  
  // 1. UI State & Filters
  const state = useBillingState()

  // 2. Data Fetching & CRUD
  const data = useBillingData(notify, state.resetFilters)

  // 3. Derived State Computations
  const refDate = useMemo(() => {
    if (data.quotations.length === 0) return new Date()
    const dates = data.quotations.map(q => q.date ? new Date(q.date).getTime() : 0)
    const maxTime = Math.max(...dates)
    return maxTime > 0 ? new Date(maxTime) : new Date()
  }, [data.quotations])

  const uniqueYears = useMemo<number[]>(() => {
    const years = new Set<number>()
    data.quotations.forEach(q => {
      if (q.date) {
        const y = new Date(q.date).getFullYear()
        if (!isNaN(y)) years.add(y)
      }
    })
    if (years.size === 0) {
      years.add(new Date().getFullYear())
    }
    return Array.from(years).sort((a, b) => b - a)
  }, [data.quotations])

  const activeYear = state.selectedYear ?? uniqueYears[0] ?? new Date().getFullYear()

  const currentEndMonth = useMemo(() => {
    return refDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  }, [refDate])

  const computations = useBillingComputations(data.quotations, state, refDate, activeYear)

  // 4. Chart Derivations
  const chart = useBillingChart(
    data.quotations,
    state.timeframe,
    refDate,
    activeYear,
    state.startMonth,
    state.endMonth
  )

  const clientSalesData = useClientSalesData(
    data.quotations,
    activeYear,
    state.startMonth,
    state.endMonth
  )

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
    state.setClientColors(prev => {
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
  }, [clientSalesData, state.setClientColors])

  const updateClientColor = useCallback((clientName: string, color: string) => {
    state.setClientColors(prev => ({
      ...prev,
      [clientName]: color
    }))
  }, [state.setClientColors])

  // Combine and export everything just like the original God-Hook did
  return {
    // API & Data
    quotations: data.quotations,
    setQuotations: data.setQuotations,
    designers: data.designers,
    loading: data.loading,
    globalSettings: data.globalSettings,
    loadData: data.loadData,
    handleSingleFieldSave: data.handleSingleFieldSave,
    handleAddNewRow: data.handleAddNewRow,
    handleDeleteRows: data.handleDeleteRows,
    saveGlobalSettings: data.saveGlobalSettings,
    uniqueInchargeValues: computations.uniqueInchargeValues,

    // State & Filters
    search: state.search,
    setSearch: state.setSearch,
    selectedDesigner: state.selectedDesigner,
    setSelectedDesigner: state.setSelectedDesigner,
    selectedQStatus: state.selectedQStatus,
    setSelectedQStatus: state.setSelectedQStatus,
    selectedPStatus: state.selectedPStatus,
    setSelectedPStatus: state.setSelectedPStatus,
    selectedBillTo: state.selectedBillTo,
    setSelectedBillTo: state.setSelectedBillTo,
    selectedMonth: state.selectedMonth,
    setSelectedMonth: state.setSelectedMonth,
    selectedBillingStatus: state.selectedBillingStatus,
    setSelectedBillingStatus: state.setSelectedBillingStatus,
    currentPage: state.currentPage,
    setCurrentPage: state.setCurrentPage,
    itemsPerPage: state.itemsPerPage,
    setItemsPerPage: state.setItemsPerPage,
    activeCell: state.activeCell,
    setActiveCell: state.setActiveCell,
    editForm: state.editForm,
    setEditForm: state.setEditForm,
    timeframe: state.timeframe,
    setTimeframe: state.setTimeframe,
    showCompleted: state.showCompleted,
    setShowCompleted: state.setShowCompleted,
    showApprovedActive: state.showApprovedActive,
    setShowApprovedActive: state.setShowApprovedActive,
    showPending: state.showPending,
    setShowPending: state.setShowPending,
    showCancelled: state.showCancelled,
    setShowCancelled: state.setShowCancelled,
    chartView: state.chartView,
    setChartView: state.setChartView,
    clientColors: state.clientColors,
    setClientColors: state.setClientColors,
    selectedYear: state.selectedYear,
    setSelectedYear: state.setSelectedYear,
    startMonth: state.startMonth,
    setStartMonth: state.setStartMonth,
    endMonth: state.endMonth,
    setEndMonth: state.setEndMonth,
    sortColumn: state.sortColumn,
    setSortColumn: state.setSortColumn,
    sortDirection: state.sortDirection,
    setSortDirection: state.setSortDirection,
    selectedAgingBucket: state.selectedAgingBucket,
    setSelectedAgingBucket: state.setSelectedAgingBucket,
    handleSort: state.handleSort,
    resetFilters: state.resetFilters,

    // Computations & Charts
    filteredQuotations: computations.filteredQuotations,
    paginatedQuotations: computations.paginatedQuotations,
    totalItems: computations.totalItems,
    totalPages: computations.totalPages,
    statusStats: computations.statusStats,
    refDate,
    uniqueYears,
    activeYear,
    currentEndMonth,
    chartData: chart.chartData,
    clientChartData: chart.clientChartData,
    clientSalesData,
    updateClientColor,
    invoicesCount: chart.invoicesCount,
    revenueSum: chart.revenueSum,
    trendPercent: chart.trendPercent,
    timeframeLabel: chart.timeframeLabel,

    // Expose helpers (some components might be using them directly from the hook return)
    formatDateToSlash,
    formatDateTimeToSlash,
    formatCurrency,
    getCompletedAmount,
    getForBillingAmount,
    getForecastAmount
  }
}
