import { useMemo } from 'react'
import type { IQuotation } from '../../types'
import { normalizeClientName, getCompletedAmount, getForecastAmount, getForBillingAmount } from '../../utils/billingUtils'
export interface IStatusStat {
  count: number
  total: number
}

export type IStatusStats = Record<string, IStatusStat>

export function useBillingComputations(
  quotations: IQuotation[],
  state: any,
  refDate: Date,
  activeYear: number
) {
  const {
    search, selectedDesigner, selectedQStatus, selectedPStatus, selectedBillTo,
    selectedMonth, selectedBillingStatus, selectedAgingBucket,
    sortColumn, sortDirection, currentPage, itemsPerPage, timeframe, startMonth, endMonth
  } = state

  const filteredQuotations = useMemo(() => {
    let result = quotations
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(q => 
        q.quotationNo?.toLowerCase().includes(s) ||
        q.clientName?.toLowerCase().includes(s) ||
        q.customerIncharge?.toLowerCase().includes(s) ||
        q.designerName?.toLowerCase().includes(s)
      )
    }
    
    result = result.filter(q => {
      const matchesDesigner = !selectedDesigner || q.designerName === selectedDesigner
      const matchesQStatus = !selectedQStatus || q.quotationStatus === selectedQStatus
      const matchesPStatus = !selectedPStatus || q.projectStatus === selectedPStatus
      const matchesBillTo = !selectedBillTo || normalizeClientName(q.billTo) === selectedBillTo
      const matchesMonth = !selectedMonth || (q.date && new Date(q.date).getMonth().toString() === selectedMonth)
      const matchesBillingStatus = !selectedBillingStatus || (q.billingStatus || '') === selectedBillingStatus

      let matchesAging = true
      if (selectedAgingBucket) {
        const unpaidStatuses = ['Approved', 'Partial Billing', 'Billing Completion']
        const qStatus = q.quotationStatus || 'For Approval'
        const bStatus = q.billingStatus || ''
        const isUnpaid = (unpaidStatuses.includes(qStatus) || bStatus === 'BILLED' || bStatus === 'FOR BILLING') && !q.datePaid && bStatus !== 'PAID'
        
        if (isUnpaid) {
          const startStr = q.submittedToAdminAt || q.date || q.modifiedAt
          if (startStr) {
            const startDate = new Date(startStr)
            if (!isNaN(startDate.getTime())) {
              const diffTime = Math.max(0, Date.now() - startDate.getTime())
              const ageDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
              
              if (selectedAgingBucket === '0-30') {
                matchesAging = ageDays <= 30
              } else if (selectedAgingBucket === '31-60') {
                matchesAging = ageDays > 30 && ageDays <= 60
              } else if (selectedAgingBucket === '61-90') {
                matchesAging = ageDays > 60 && ageDays <= 90
              } else if (selectedAgingBucket === '90+') {
                matchesAging = ageDays > 90
              } else if (selectedAgingBucket === 'all') {
                matchesAging = ageDays > 30
              }
            } else {
              matchesAging = false
            }
          } else {
            matchesAging = false
          }
        } else {
          matchesAging = false
        }
      }

      return matchesDesigner && matchesQStatus && matchesPStatus && matchesBillTo && matchesMonth && matchesBillingStatus && matchesAging
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
  }, [
    quotations, search, selectedDesigner, selectedQStatus, selectedPStatus,
    selectedBillTo, selectedMonth, selectedBillingStatus, selectedAgingBucket,
    sortColumn, sortDirection
  ])

  const totalItems = filteredQuotations.length
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1
  const paginatedQuotations = useMemo(() => {
    return filteredQuotations.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    )
  }, [filteredQuotations, currentPage, itemsPerPage])

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
      
      if (billingStatus === 'PAID') {
        stats['Billing Completion'].count++
        stats['Billing Completion'].total += amt
      } else if (status === 'Partial Billing') {
        stats['Partial Billing'].count++
        stats['Billing Completion'].total += getCompletedAmount(q)
        stats['Approved'].total += getForecastAmount(q)
        if (billingStatus === 'FOR BILLING') {
          stats['For Approval'].count++
          stats['For Approval'].total += getForBillingAmount(q)
        }
      } else if (billingStatus === 'BILLED' || status === 'Approved' || status === 'Billing Completion') {
        stats['Approved'].count++
        stats['Approved'].total += amt
      } else if (billingStatus === 'FOR BILLING' || status === 'For Approval') {
        stats['For Approval'].count++
        stats['For Approval'].total += getForBillingAmount(q)
      } else if (billingStatus === 'CANCELLED' || billingStatus === 'REVISED' || status === 'CANCELLED') {
        stats['CANCELLED'].count++
        stats['CANCELLED'].total += amt
      } else {
        if (stats[status]) {
          stats[status].count++
          stats[status].total += amt
        }
      }
    })

    return stats
  }, [quotations, timeframe, refDate, activeYear, startMonth, endMonth])

  return {
    filteredQuotations,
    paginatedQuotations,
    totalItems,
    totalPages,
    uniqueInchargeValues,
    statusStats
  }
}
