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
    if (type === '3D' || type === '3D/2D' || !type) return baseRates.timeChargeRate3D
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
 * A main task (assembly) only counts the number of its sub-tasks (sub-assembly/parts) unless overridden.
 */
export function getUnitPageCount(
  taskId: number,
  allTasks: Task[],
  manualOverrides: ManualOverrides
): number {
  const override = (manualOverrides?.tasks || {})[taskId]
  if (override?.unitPage !== undefined) return override.unitPage

  const task = allTasks.find(t => t.id === taskId)
  const isMain = task ? (task.parentId === null || task.isMainTask || task.level === 0) : true
  const subTaskCount = allTasks.filter(t => t.parentId === taskId).length

  return isMain ? subTaskCount : (1 + subTaskCount)
}

/**
 * Automatically calculates KEMCO Rank and Unit Price based on time (minutes), level, and type.
 */
export function getKemcoRankAndPrice(time: number, level: number, type: string): { rank: string, price: number } {
  const isPart = level === 2
  const is3D = type === '3D' || type === '3D/2D' || !type // fallback to 3D if not specified

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

export interface Customer {
  id: string
  name: string
  prefix: string
  clientName: string
  contact: string
  address: string
  phone: string
}

export const CUSTOMERS_CONFIG: Customer[] = [
  { id: 'KUSAKABE', name: 'Kusakabe (KEMCO)', prefix: 'KM-',    clientName: 'Kusakabe Electric and Machinery Co.,Ltd.', contact: 'Mr. Seiichi Fujiyama',           address: '11-2,2Chome Murotani Nishiku Kobe, Japan (651-2241)', phone: 'TEL  078-992-9145 / FAX 078-992-9149' },
  { id: 'NIKKO',    name: 'Nikko',            prefix: 'KMN-',   clientName: 'NEXT ENGINEERING Co., Ltd.',               contact: 'MR. Masahiko Hasegawa',              address: '7-7, Hashimoto-machi, Nagasaki City, Nagasaki, 852-8114, Japan', phone: 'TEL: +81-95-801-9012 / FAX: +81-95-801-9013' },
  { id: 'JFE',      name: 'JFE',              prefix: 'KMJFE-', clientName: 'NEXT ENGINEERING Co., Ltd.',               contact: 'MR. Masahiko Hasegawa',              address: '7-7, Hashimoto-machi, Nagasaki City, Nagasaki, 852-8114, Japan', phone: 'TEL: +81-95-801-9012 / FAX: +81-95-801-9013' },
  { id: 'AGCC',     name: 'AGCC',             prefix: 'KMAG-',  clientName: 'AGCC',                                     contact: 'Mr. Nabuchi',                        address: 'Japan',                                                         phone: '' },
  { id: 'TEX_WAKAYAMA', name: 'Tex Wakayama', prefix: 'KMTE-', clientName: 'NEXT ENGINEERING Co., Ltd.',               contact: 'MR. Masahiko Hasegawa',              address: '7-7, Hashimoto-machi, Nagasaki City, Nagasaki, 852-8114, Japan', phone: 'TEL: +81-95-801-9012 / FAX: +81-95-801-9013' },
  { id: 'TEX_HANSHIN', name: 'Tex Hanshin',   prefix: 'KMTE-', clientName: 'NEXT ENGINEERING Co., Ltd.',               contact: 'MR. Masahiko Hasegawa',              address: '7-7, Hashimoto-machi, Nagasaki City, Nagasaki, 852-8114, Japan', phone: 'TEL: +81-95-801-9012 / FAX: +81-95-801-9013' },
  { id: 'OKINAKA',  name: 'Okinaka',          prefix: 'KMOK-', clientName: 'NEXT ENGINEERING Co., Ltd.',               contact: 'MR. Masahiko Hasegawa',              address: '7-7, Hashimoto-machi, Nagasaki City, Nagasaki, 852-8114, Japan', phone: 'TEL: +81-95-801-9012 / FAX: +81-95-801-9013' },
  { id: 'AMANO',    name: 'Amano',            prefix: 'KMAC-', clientName: 'NEXT ENGINEERING Co., Ltd.',               contact: 'MR. Masahiko Hasegawa',              address: '7-7, Hashimoto-machi, Nagasaki City, Nagasaki, 852-8114, Japan', phone: 'TEL: +81-95-801-9012 / FAX: +81-95-801-9013' },
]

export function generateQuotationNumber(date: string, prefix = 'KMTE-', sequential = '001'): string {
  const dateObj = new Date(date + 'T00:00:00')
  const year = dateObj.getFullYear()
  const yy = year.toString().slice(-2)
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0')
  const day = dateObj.getDate().toString().padStart(2, '0')
  
  if (prefix === 'KM-') {
    return `KM-${year}-${month}${day}-${sequential}`
  }
  return `${prefix}${yy}${month}${day}-${sequential}`
}
