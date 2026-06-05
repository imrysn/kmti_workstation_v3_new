import { useMemo, useState, Fragment } from 'react'
import type { IQuotation } from '../../types'
import type { Task } from '../../types/quotation'
import { calculateTaskTotal } from '../../utils/quotation'

interface EngineerLeaderboardProps {
  quotations: IQuotation[]
  formatCurrency: (val?: number) => string
  getCompletedAmount: (q: IQuotation) => number
  getForecastAmount: (q: IQuotation) => number
}

interface MemberStat {
  name: string
  completed: number
  active: number
  total: number
  count: number
  avg: number
  percentage: number // Contribution percentage of the team total
  isLeaderDirect?: boolean
}

interface LeaderStat {
  name: string
  completed: number
  active: number
  total: number
  count: number
  avg: number
  members: MemberStat[]
}

export default function EngineerLeaderboard({
  quotations,
  formatCurrency,
  getCompletedAmount,
  getForecastAmount
}: EngineerLeaderboardProps) {
  // Collapsed/Expanded state per Team Leader
  const [expandedLeaders, setExpandedLeaders] = useState<Record<string, boolean>>({})

  // Helper to normalize casing of names (Title Case)
  const normalizeName = (name: string): string => {
    const trimmed = name.trim()
    if (!trimmed) return ''
    return trimmed
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  const toggleLeader = (name: string) => {
    setExpandedLeaders(prev => ({
      ...prev,
      [name]: !prev[name]
    }))
  }

  // Compute leader and member stats
  const leaderStats = useMemo<LeaderStat[]>(() => {
    const stats: Record<string, {
      completed: number
      active: number
      invoiceIds: Set<number | string>
      members: Record<string, {
        completed: number
        active: number
        invoiceIds: Set<number | string>
      }>
      direct: {
        completed: number
        active: number
        invoiceIds: Set<number | string>
      }
    }> = {}

    quotations.forEach(q => {
      const leader = normalizeName(q.designerName || 'Unassigned')
      const completedTotal = getCompletedAmount(q)
      const forecastTotal = getForecastAmount(q)
      const grandTotal = q.grandTotal || 0

      // Skip empty quotations
      if (completedTotal === 0 && forecastTotal === 0) return

      const qId = q.id || q.quotationNo || Math.random()

      if (!stats[leader]) {
        stats[leader] = {
          completed: 0,
          active: 0,
          invoiceIds: new Set(),
          members: {},
          direct: {
            completed: 0,
            active: 0,
            invoiceIds: new Set()
          }
        }
      }

      // Add to overall Leader / Team total
      stats[leader].completed += completedTotal
      stats[leader].active += forecastTotal
      stats[leader].invoiceIds.add(qId)

      // Parse tasks
      const qData = q.data || {}
      const tasks = (qData.tasks || []) as Task[]
      const baseRates = qData.baseRates || {}
      const manualOverrides = qData.manualOverrides || {}
      const layoutVariant = qData.layoutVariant || 'special'

      const completedRatio = grandTotal > 0 ? completedTotal / grandTotal : 0
      const forecastRatio = grandTotal > 0 ? forecastTotal / grandTotal : 0

      if (layoutVariant === 'kemco') {
        // --- KEMCO Percentage-based Allocation ---
        const childrenMap: Record<number, number[]> = {}
        const taskMap = new Map<number, Task>()

        tasks.forEach(t => {
          taskMap.set(t.id, t)
          if (t.parentId !== null && t.parentId !== undefined) {
            if (!childrenMap[t.parentId]) childrenMap[t.parentId] = []
            childrenMap[t.parentId].push(t.id)
          }
        })

        // Helper to count tasks in subtree
        const getSubtreeCount = (tid: number): number => {
          let count = 1
          const children = childrenMap[tid] || []
          children.forEach(cid => {
            count += getSubtreeCount(cid)
          })
          return count
        }

        const assemblies = tasks.filter(t => t.level === 0)
        const totalWeight = assemblies.reduce((acc, t) => acc + getSubtreeCount(t.id), 0)

        // Resolve assembly percentage (overridden or dynamically calculated weight)
        const resolvedPercentages: Record<number, number> = {}
        assemblies.forEach(t => {
          const basePercent = totalWeight > 0 ? (getSubtreeCount(t.id) / totalWeight) * 100 : 0
          const override = (manualOverrides.tasks || {})[t.id]
          const percent = override?.percentage !== undefined ? override.percentage : basePercent
          resolvedPercentages[t.id] = percent
        })

        // Find engineer via inheritance chain
        const findAssignedEngineer = (task: Task): string | undefined => {
          let current: Task | undefined = task
          while (current) {
            if (current.engineer?.trim()) {
              return normalizeName(current.engineer)
            }
            if (current.parentId !== null && current.parentId !== undefined) {
              current = taskMap.get(current.parentId)
            } else {
              break
            }
          }
          return undefined
        }

        // Allocate each task's share of the grand total
        tasks.forEach(task => {
          // Find the top-level assembly for this task to know which percentage group it belongs to
          let topParent = task
          while (topParent.parentId !== null && topParent.parentId !== undefined) {
            const parent = taskMap.get(topParent.parentId)
            if (!parent) break
            topParent = parent
          }

          const assemblyPercent = resolvedPercentages[topParent.id] || 0
          const subtreeSize = getSubtreeCount(topParent.id)
          
          // Each task in the subtree gets an equal share of the assembly's percentage
          const taskPercent = subtreeSize > 0 ? assemblyPercent / subtreeSize : 0
          const taskValue = grandTotal * (taskPercent / 100)

          const engineer = findAssignedEngineer(task)

          if (engineer) {
            if (!stats[leader].members[engineer]) {
              stats[leader].members[engineer] = {
                completed: 0,
                active: 0,
                invoiceIds: new Set()
              }
            }
            stats[leader].members[engineer].completed += taskValue * completedRatio
            stats[leader].members[engineer].active += taskValue * forecastRatio
            stats[leader].members[engineer].invoiceIds.add(qId)
          } else {
            // Unassigned task value goes to leader remainder
            stats[leader].direct.completed += taskValue * completedRatio
            stats[leader].direct.active += taskValue * forecastRatio
            stats[leader].direct.invoiceIds.add(qId)
          }
        })
      } else {
        // --- Original Special Hours-based Allocation ---
        let totalAssignedTaskVal = 0

        tasks.forEach(task => {
          const isMain = task.isMainTask
          if (!isMain) return

          const engineer = task.engineer ? normalizeName(task.engineer) : undefined
          const taskTotal = calculateTaskTotal(task, tasks, baseRates, manualOverrides, layoutVariant).total

          if (engineer) {
            totalAssignedTaskVal += taskTotal
            
            if (!stats[leader].members[engineer]) {
              stats[leader].members[engineer] = {
                completed: 0,
                active: 0,
                invoiceIds: new Set()
              }
            }

            stats[leader].members[engineer].completed += taskTotal * completedRatio
            stats[leader].members[engineer].active += taskTotal * forecastRatio
            stats[leader].members[engineer].invoiceIds.add(qId)
          }
        })

        // Leader gets the remainder
        const leaderRemainder = Math.max(0, grandTotal - totalAssignedTaskVal)
        if (leaderRemainder > 0) {
          stats[leader].direct.completed += leaderRemainder * completedRatio
          stats[leader].direct.active += leaderRemainder * forecastRatio
          stats[leader].direct.invoiceIds.add(qId)
        }
      }
    })

    // Map stats to display format
    return Object.entries(stats)
      .map(([leaderName, data]) => {
        const leaderTotal = data.completed + data.active
        const leaderCount = data.invoiceIds.size

        // Build list of members
        const membersList: MemberStat[] = Object.entries(data.members).map(([memberName, mData]) => {
          const mTotal = mData.completed + mData.active
          const pct = leaderTotal > 0 ? (mTotal / leaderTotal) * 100 : 0
          return {
            name: memberName,
            completed: mData.completed,
            active: mData.active,
            total: mTotal,
            count: mData.invoiceIds.size,
            avg: mData.invoiceIds.size > 0 ? mTotal / mData.invoiceIds.size : 0,
            percentage: pct
          }
        })

        // Add leader's direct remainder row
        const directTotal = data.direct.completed + data.direct.active
        if (directTotal > 0 || membersList.length === 0) {
          const pct = leaderTotal > 0 ? (directTotal / leaderTotal) * 100 : 0
          membersList.push({
            name: `${leaderName} (Direct Remainder)`,
            completed: data.direct.completed,
            active: data.direct.active,
            total: directTotal,
            count: data.direct.invoiceIds.size,
            avg: data.direct.invoiceIds.size > 0 ? directTotal / data.direct.invoiceIds.size : 0,
            isLeaderDirect: true,
            percentage: pct
          })
        }

        membersList.sort((a, b) => b.total - a.total)

        return {
          name: leaderName,
          completed: data.completed,
          active: data.active,
          total: leaderTotal,
          count: leaderCount,
          avg: leaderCount > 0 ? leaderTotal / leaderCount : 0,
          members: membersList
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [quotations, getCompletedAmount, getForecastAmount])

  return (
    <div className="designers-panel">
      <div className="table-container">
        <table className="spreadsheet-table" style={{ minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>Team Leader / Engineer</th>
              <th style={{ textAlign: 'center' }}>Invoices Count</th>
              <th>Completed Sales</th>
              <th>Forecast / Approved</th>
              <th>Total Managed Sales</th>
              <th>Avg Invoice Value</th>
            </tr>
          </thead>
          <tbody>
            {leaderStats.map(stat => {
              const isExpanded = !!expandedLeaders[stat.name]
              const hasMembers = stat.members.length > 0

              return (
                <Fragment key={stat.name}>
                  {/* Team Leader Main Row */}
                  <tr 
                    className="leaderboard-leader-row"
                    style={{ 
                      cursor: hasMembers ? 'pointer' : 'default', 
                      fontWeight: '600'
                    }}
                    onClick={() => hasMembers && toggleLeader(stat.name)}
                  >
                    <td style={{ textAlign: 'center', padding: '10px 0' }}>
                      {hasMembers && (
                        <span style={{ 
                          display: 'inline-block', 
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.15s ease',
                          fontSize: '10px',
                          color: 'var(--text-muted)'
                        }}>
                          ▶
                        </span>
                      )}
                    </td>
                    <td style={{ paddingLeft: '8px' }}>
                      <span style={{ color: 'var(--text-primary)' }}>{stat.name}</span>
                      <span style={{ 
                        marginLeft: '8px', 
                        fontSize: '11px', 
                        fontWeight: 'normal',
                        color: 'var(--text-muted)',
                        backgroundColor: 'var(--border)',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        Team
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>{stat.count}</td>
                    <td className="cell-amount" style={{ color: '#10b981' }}>{formatCurrency(stat.completed)}</td>
                    <td className="cell-amount" style={{ color: '#3b82f6' }}>{formatCurrency(stat.active)}</td>
                    <td className="cell-amount" style={{ fontWeight: '700' }}>{formatCurrency(stat.total)}</td>
                    <td className="cell-amount">{formatCurrency(stat.avg)}</td>
                  </tr>

                  {/* Nested Team Members Rows */}
                  {isExpanded && stat.members.map(member => (
                    <tr 
                      key={`${stat.name}-${member.name}`} 
                      className="leaderboard-member-row"
                      style={{ 
                        fontSize: '13px'
                      }}
                    >
                      <td></td>
                      <td style={{ paddingLeft: '24px', color: 'var(--text-muted)' }}>
                        <span style={{ marginRight: '8px', opacity: 0.5, fontFamily: 'monospace' }}>└─</span>
                        <span style={{ 
                          color: member.isLeaderDirect ? 'var(--text-muted)' : 'var(--text-secondary)',
                          fontStyle: member.isLeaderDirect ? 'italic' : 'normal'
                        }}>
                          {member.name}
                        </span>
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          fontStyle: 'normal'
                        }}>
                          ({member.percentage.toFixed(0)}%)
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{member.count}</td>
                      <td className="cell-amount" style={{ color: '#059669', opacity: 0.85 }}>{formatCurrency(member.completed)}</td>
                      <td className="cell-amount" style={{ color: '#2563eb', opacity: 0.85 }}>{formatCurrency(member.active)}</td>
                      <td className="cell-amount" style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>{formatCurrency(member.total)}</td>
                      <td className="cell-amount" style={{ color: 'var(--text-muted)' }}>{formatCurrency(member.avg)}</td>
                    </tr>
                  ))}
                </Fragment>
              )
            })}
            {leaderStats.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  No engineer sales recorded for this timeframe.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
