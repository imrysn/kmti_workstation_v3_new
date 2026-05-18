import type { Task, BaseRates, ManualOverrides } from '../hooks/quotation/useInvoiceState'

export interface CalculatedSubtotals {
  basicLabor: number
  overtime: number
  software: number
  total: number
}

/**
 * Calculates the subtotals for a task, including its sub-tasks if it's a main task.
 * Administrative Overhead is NOT included — it is calculated at the grand total level.
 */
export function calculateTaskTotal(
  task: Task,
  allTasks: Task[],
  baseRates: BaseRates,
  manualOverrides: ManualOverrides,
  layoutVariant: 'special' | 'kemco' = 'special'
): CalculatedSubtotals {
  // Check if this is KEMCO (level-based)
  const isKemco = layoutVariant === 'kemco'

  if (isKemco) {
    const children = allTasks.filter(t => t.parentId === task.id)
    
    // If it has children, sum their calculated totals
    if (children.length > 0) {
      const childrenTotal = children.reduce((sum, child) => {
        return sum + calculateTaskTotal(child, allTasks, baseRates, manualOverrides).total
      }, 0)

      return {
        basicLabor: 0,
        overtime: 0,
        software: 0,
        total: Number(childrenTotal.toFixed(2))
      }
    }

    // If no children, use the amount field or manual override
    const override = (manualOverrides?.tasks || {})[task.id]
    const amount = override?.total !== undefined ? override.total : (task.amount || 0)

    return {
      basicLabor: 0,
      overtime: 0,
      software: 0,
      total: Number(amount.toFixed(2))
    }
  }

  // Original Special Logic
  const getRate = (type: string) => {
    if (type === '2D') return baseRates.timeChargeRate2D
    if (type === '3D' || !type) return baseRates.timeChargeRate3D
    return baseRates.timeChargeRateOthers || 0
  }

  const subTasks = task.isMainTask
    ? allTasks.filter(t => t.parentId === task.id)
    : []

  let totalHours = (task.hours || 0) + (task.minutes || 0) / 60
  let totalOvertimeHours = task.overtimeHours || 0
  let totalSoftwareUnits = task.softwareUnits || 0

  subTasks.forEach(sub => {
    totalHours += (sub.hours || 0) + (sub.minutes || 0) / 60
    totalOvertimeHours += sub.overtimeHours || 0
    totalSoftwareUnits += sub.softwareUnits || 0
  })

  let basicLabor = totalHours * getRate(task.type)
  let overtime = totalOvertimeHours * baseRates.overtimeRate
  let software = totalSoftwareUnits * baseRates.softwareRate

  const override = (manualOverrides?.tasks || {})[task.id]
  if (override && override.total !== undefined) {
    return {
      basicLabor: Number(basicLabor.toFixed(2)),
      overtime: Number(overtime.toFixed(2)),
      software: Number(software.toFixed(2)),
      total: Number(override.total.toFixed(2)),
    }
  }

  const subtotal = basicLabor + overtime + software

  return {
    basicLabor: Number(basicLabor.toFixed(2)),
    overtime: Number(overtime.toFixed(2)),
    software: Number(software.toFixed(2)),
    total: Number(subtotal.toFixed(2)),
  }
}

/**
 * Calculates the administrative overhead based on a subtotal.
 */
export function calculateOverhead(subtotal: number, overheadPercentage: number): number {
  return subtotal * (overheadPercentage / 100)
}

/**
 * Returns the unit/page count for a task, respecting manual overrides.
 * A main task counts as 1 + number of its sub-tasks unless overridden.
 */
export function getUnitPageCount(
  taskId: number,
  allTasks: Task[],
  manualOverrides: ManualOverrides
): number {
  const override = (manualOverrides?.tasks || {})[taskId]
  if (override?.unitPage !== undefined) return override.unitPage
  const subTaskCount = allTasks.filter(t => t.parentId === taskId).length
  return 1 + subTaskCount
}

/**
 * Automatically calculates KEMCO Rank and Unit Price based on time (minutes), level, and type.
 */
export function getKemcoRankAndPrice(time: number, level: number, type: string): { rank: string, price: number } {
  const isPart = level === 2
  const is3D = type === '3D' || !type // fallback to 3D if not specified

  if (is3D) {
    if (isPart) {
      if (time >= 241) return { rank: 'AA', price: 4180 }
      if (time >= 121) return { rank: 'AB', price: 2090 }
      if (time >= 61) return { rank: 'A', price: 1290 }
      if (time >= 31) return { rank: 'B', price: 840 }
      if (time >= 16) return { rank: 'C', price: 460 }
      if (time >= 6) return { rank: 'D', price: 270 }
      if (time >= 1) return { rank: 'E', price: 160 }
      return { rank: '', price: 0 }
    } else {
      // 3D Assembly
      if (time >= 1441) return { rank: 'AA', price: 20110 }
      if (time >= 961) return { rank: 'A', price: 12330 }
      if (time >= 481) return { rank: 'B', price: 8350 }
      if (time >= 241) return { rank: 'C', price: 4180 }
      if (time >= 121) return { rank: 'D', price: 2090 }
      if (time >= 1) return { rank: 'E', price: 1290 }
      return { rank: '', price: 0 }
    }
  } else {
    // 2D
    if (isPart) {
      if (time >= 481) return { rank: 'AA', price: 8350 }
      if (time >= 241) return { rank: 'AB', price: 4180 }
      if (time >= 121) return { rank: 'AC', price: 2090 }
      if (time >= 61) return { rank: 'A', price: 1290 }
      if (time >= 31) return { rank: 'B', price: 840 }
      if (time >= 16) return { rank: 'C', price: 460 }
      if (time >= 6) return { rank: 'D', price: 270 }
      if (time >= 1) return { rank: 'E', price: 160 }
      return { rank: '', price: 0 }
    } else {
      // 2D Assembly
      if (time >= 1441) return { rank: 'AA', price: 20110 }
      if (time >= 961) return { rank: 'AB', price: 12330 }
      if (time >= 481) return { rank: 'AC', price: 8350 }
      if (time >= 241) return { rank: 'A', price: 4180 }
      if (time >= 121) return { rank: 'B', price: 2090 }
      if (time >= 61) return { rank: 'C', price: 1290 }
      if (time >= 31) return { rank: 'D', price: 840 }
      if (time >= 1) return { rank: 'E', price: 460 }
      return { rank: '', price: 0 }
    }
  }
}
