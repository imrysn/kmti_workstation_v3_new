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
  manualOverrides: ManualOverrides
): CalculatedSubtotals {
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
