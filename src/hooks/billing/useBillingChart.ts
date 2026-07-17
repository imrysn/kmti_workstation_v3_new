import { useMemo } from 'react'
import type { IQuotation } from '../../types'
import {
  normalizeClientName,
  getCompletedAmount,
  getForBillingAmount,
  getForecastAmount
} from '../../utils/billingUtils'

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

export function useBillingChart(
  quotations: IQuotation[],
  timeframe: 'week' | 'month' | 'year',
  refDate: Date,
  activeYear: number,
  startMonth: number,
  endMonth: number
) {
  return useMemo(() => {
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
      startDate = new Date(activeYear, startMonth, 1, 0, 0, 0, 0)
      endDate = new Date(activeYear, startMonth + 1, 0, 23, 59, 59, 999)
      
      prevStartDate = new Date(activeYear - 1, startMonth, 1, 0, 0, 0, 0)
      prevEndDate = new Date(activeYear - 1, startMonth + 1, 0, 23, 59, 59, 999)
      
      formatTick = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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

    const currentRevenue = currentQuotations.reduce((sum, q) => sum + getCompletedAmount(q), 0)
    const prevRevenue = prevQuotations.reduce((sum, q) => sum + getCompletedAmount(q), 0)

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
          .filter(q => q.billingStatus === 'PAID' || q.billingStatus === 'BILLED' || ['Billing Completion', 'Approved', 'Partial Billing'].includes(q.quotationStatus || ''))
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
          dayCompleted += getCompletedAmount(q)
          dayApprovedActive += getForecastAmount(q)
        })

        const dayPending = dayQuots.reduce((sum, q) => sum + getForBillingAmount(q), 0)

        const dayCancelled = dayQuots
          .filter(q => q.billingStatus === 'CANCELLED' || q.billingStatus === 'REVISED' || q.quotationStatus === 'CANCELLED')
          .reduce((sum, q) => sum + (q.grandTotal || 0), 0)
        
        points.push({
          name: formatTick(tempDate),
          completed: dayCompleted,
          approvedActive: dayApprovedActive,
          pending: dayPending,
          cancelled: dayCancelled,
          displayDate: tempDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        })

        const dayClientSales: Record<string, number> = {}
        uniqueClients.forEach(c => {
          dayClientSales[c] = 0
        })
        dayQuots.forEach(q => {
          const client = normalizeClientName(q.billTo)
          if (getCompletedAmount(q) > 0) {
            dayClientSales[client] = (dayClientSales[client] || 0) + getCompletedAmount(q)
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
          mCompleted += getCompletedAmount(q)
          mApprovedActive += getForecastAmount(q)
        })

        const mPending = mQuots.reduce((sum, q) => sum + getForBillingAmount(q), 0)

        const mCancelled = mQuots
          .filter(q => q.billingStatus === 'CANCELLED' || q.billingStatus === 'REVISED' || q.quotationStatus === 'CANCELLED')
          .reduce((sum, q) => sum + (q.grandTotal || 0), 0)
        
        points.push({
          name: formatTick(tempDate),
          completed: mCompleted,
          approvedActive: mApprovedActive,
          pending: mPending,
          cancelled: mCancelled,
          displayDate: tempDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        })

        const mClientSales: Record<string, number> = {}
        uniqueClients.forEach(c => {
          mClientSales[c] = 0
        })
        mQuots.forEach(q => {
          const client = normalizeClientName(q.billTo)
          if (getCompletedAmount(q) > 0) {
            mClientSales[client] = (mClientSales[client] || 0) + getCompletedAmount(q)
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
  }, [quotations, timeframe, refDate, activeYear, startMonth, endMonth])
}

export function useClientSalesData(
  quotations: IQuotation[],
  activeYear: number,
  startMonth: number,
  endMonth: number
) {
  return useMemo<IClientSalesPoint[]>(() => {
    const clientsMap: Record<string, number> = {}
    
    const yearStart = new Date(activeYear, startMonth, 1, 0, 0, 0, 0)
    const yearEnd   = new Date(activeYear, endMonth + 1, 0, 23, 59, 59, 999)

    quotations.forEach(q => {
      if (!q.date) return
      const t = new Date(q.date).getTime()
      if (t < yearStart.getTime() || t > yearEnd.getTime()) return
      const client = normalizeClientName(q.billTo)
      
      clientsMap[client] = (clientsMap[client] || 0) + getCompletedAmount(q)
    })
    
    return Object.entries(clientsMap)
      .map(([name, sales]) => ({ name, sales }))
      .sort((a, b) => b.sales - a.sales)
  }, [quotations, activeYear, startMonth, endMonth])
}
