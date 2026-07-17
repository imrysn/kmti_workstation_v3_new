import type { IQuotation } from '../types'

export const getPartialBillingPercentage = (detail?: string | null): number => {
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

export const formatDateToSlash = (dateStr?: string | null) => {
  if (!dateStr) return '-'
  const base = dateStr.substring(0, 10).trim()
  return base.replace(/[- ]/g, '/')
}

export const formatDateTimeToSlash = (dateStr?: string | null) => {
  if (!dateStr) return '-'
  return dateStr.replace(/-/g, '/')
}

export const formatCurrency = (val?: number) => {
  if (val === undefined || val === null) return '¥0'
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0
  }).format(val)
}

export const getCompletedAmount = (q: IQuotation) => {
  if (q.billingStatus === 'CANCELLED' || q.billingStatus === 'REVISED' || q.quotationStatus === 'CANCELLED') return 0
  if (q.quotationStatus === 'Partial Billing') {
    const pct = getPartialBillingPercentage(q.updateDetail)
    return (q.grandTotal || 0) * (pct / 100)
  }
  if (q.billingStatus === 'PAID') return q.grandTotal || 0
  return 0
}

export const getForBillingAmount = (q: IQuotation) => {
  if (q.quotationStatus === 'Partial Billing') return 0
  const status = q.quotationStatus || 'For Approval'
  const billingStatus = q.billingStatus || ''
  const amt = q.grandTotal || 0

  if (billingStatus === 'FOR BILLING' || status === 'For Approval') {
    return amt
  }
  return 0
}

export const getForecastAmount = (q: IQuotation) => {
  if (q.billingStatus === 'PAID') return 0
  const amt = q.grandTotal || 0
  if (q.quotationStatus === 'Partial Billing') {
    const pct = getPartialBillingPercentage(q.updateDetail)
    return amt * ((100 - pct) / 100)
  }
  const billingStatus = q.billingStatus || ''
  const status = q.quotationStatus || 'For Approval'
  if (billingStatus === 'BILLED' || status === 'Approved' || status === 'Billing Completion') {
    return amt
  }
  return 0
}
