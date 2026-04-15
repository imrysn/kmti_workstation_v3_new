import type { Task, BaseRates } from '../hooks/quotation/useInvoiceState'

export interface CalculatedSubtotals {
  basicLabor: number
  overtime: number
  software: number
  total: number
}

/**
 * Calculates the subtotals for a task, including its sub-tasks if it's a main task.
 * Note: Administrative Overhead is NOT included here. It should be calculated
 * at the grand total level.
 */
export function calculateTaskTotal(
  task: Task,
  allTasks: Task[],
  baseRates: BaseRates,
  manualOverrides: any = {}
): CalculatedSubtotals {
  const getRate = (type: string) => {
    if (type === '2D') return baseRates.timeChargeRate2D
    if (type === '3D' || !type) return baseRates.timeChargeRate3D
    return baseRates.timeChargeRateOthers || 0
  }

  // Find sub-tasks if this is a main task
  const subTasks = task.isMainTask 
    ? allTasks.filter(t => t.parentId === task.id)
    : []

  // Aggregate hours, overtime, and software units
  let totalHours = (task.hours || 0) + (task.minutes || 0) / 60
  let totalOvertimeHours = task.overtimeHours || 0
  let totalSoftwareUnits = task.softwareUnits || 0

  subTasks.forEach(sub => {
    totalHours += (sub.hours || 0) + (sub.minutes || 0) / 60
    totalOvertimeHours += sub.overtimeHours || 0
    totalSoftwareUnits += sub.softwareUnits || 0
  })

  // Calculate base values
  let basicLabor = totalHours * getRate(task.type)
  let overtime = totalOvertimeHours * baseRates.overtimeRate
  let software = totalSoftwareUnits * baseRates.softwareRate

  // Apply manual overrides if any
  const override = manualOverrides[task.id]
  if (override) {
    if (override.basicLabor !== undefined) basicLabor = override.basicLabor
    if (override.overtime !== undefined) overtime = override.overtime
    if (override.software !== undefined) software = override.software
    
    // If there's an explicit total override, use it for the final total
    if (override.total !== undefined) {
      return {
        basicLabor: Number(basicLabor.toFixed(2)),
        overtime: Number(overtime.toFixed(2)),
        software: Number(software.toFixed(2)),
        total: Number(override.total.toFixed(2))
      }
    }
  }

  const subtotal = basicLabor + overtime + software

  return {
    basicLabor: Number(basicLabor.toFixed(2)),
    overtime: Number(overtime.toFixed(2)),
    software: Number(software.toFixed(2)),
    total: Number(subtotal.toFixed(2))
  }
}

/**
 * Calculates the administrative overhead based on a subtotal.
 */
export function calculateOverhead(subtotal: number, overheadPercentage: number): number {
  return subtotal * (overheadPercentage / 100)
}

/**
 * Parses a date string into a local Date object, avoiding UTC/timezone issues.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date()
  return new Date(dateStr + 'T00:00:00')
}
