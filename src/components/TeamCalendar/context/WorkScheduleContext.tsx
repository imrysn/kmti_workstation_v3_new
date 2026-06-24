import React, { createContext, useContext } from 'react'
import { useWorkSchedule } from '../../../hooks/useWorkSchedule'

type WorkScheduleContextType = ReturnType<typeof useWorkSchedule>

const WorkScheduleContext = createContext<WorkScheduleContextType | null>(null)

export function WorkScheduleProvider({ children }: { children: React.ReactNode }) {
  const value = useWorkSchedule()
  return (
    <WorkScheduleContext.Provider value={value}>
      {children}
    </WorkScheduleContext.Provider>
  )
}

export function useWorkScheduleContext() {
  const context = useContext(WorkScheduleContext)
  if (!context) {
    throw new Error('useWorkScheduleContext must be used within a WorkScheduleProvider')
  }
  return context
}

export function formatPercentDisplay(val: string): string {
  if (!val || val === '-') return '-'
  const num = parseFloat(val)
  if (!isNaN(num) && num >= 0 && num <= 1) {
    return `${Math.round(num * 100)}%`
  }
  return val
}

export function formatPercentInput(val: string): string {
  if (!val || val.trim() === '-') return '-'
  const cleanVal = val.replace('%', '').trim()
  const num = parseFloat(cleanVal)
  if (!isNaN(num)) {
    return (num / 100).toFixed(2).replace(/\.?0+$/, '')
  }
  return val
}

