import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  CartesianGrid
} from 'recharts'

interface BillingChartProps {
  chartData: any[]
  timeframe: 'week' | 'month' | 'year'
  setTimeframe: (t: 'week' | 'month' | 'year') => void
  revenueSum: number
  invoicesCount: number
  trendPercent: number
  timeframeLabel: string
  showPositive: boolean
  setShowPositive: (val: boolean) => void
  showGhost: boolean
  setShowGhost: (val: boolean) => void
  statusStats: Record<string, { count: number; total: number }>
  currentEndMonth: string
  formatCurrency: (val?: number) => string
}

export default function BillingChart({
  chartData,
  timeframe,
  setTimeframe,
  revenueSum,
  invoicesCount,
  trendPercent,
  timeframeLabel,
  showPositive,
  setShowPositive,
  showGhost,
  setShowGhost,
  statusStats,
  currentEndMonth,
  formatCurrency
}: BillingChartProps) {

  // Positive revenue = completed + approved amounts
  const positiveTotal =
    (statusStats['Billing Completion']?.total || 0) +
    (statusStats['Approved']?.total || 0) +
    (statusStats['Partial Billing']?.total || 0)

  // Ghost revenue = uncertain / risky amounts
  const ghostTotal =
    (statusStats['For Approval']?.total || 0) +
    (statusStats['CANCELLED']?.total || 0)

  const createDotRenderer = (color: string, key: string) => (props: any) => {
    const { cx, cy, index } = props
    const isLast = index === chartData.length - 1
    if (isLast) {
      return (
        <g key={`last-dot-${key}`}>
          <circle cx={cx} cy={cy} r={4} fill="#fff" stroke={color} strokeWidth={2.5} />
          <rect x={cx + 8} y={cy - 9} width={32} height={18} rx={9} fill="var(--bg-secondary)" stroke={color} strokeWidth={1.5} />
          <text x={cx + 24} y={cy + 3} textAnchor="middle" fontSize={8} fontWeight="700" fill={color}>
            {currentEndMonth}
          </text>
        </g>
      )
    }
    const shouldRenderDot = timeframe === 'week' ? true : timeframe === 'year' ? true : index % 4 === 0
    if (shouldRenderDot) {
      return (
        <circle key={`dot-${index}-${key}`} cx={cx} cy={cy} r={3} fill="#fff" stroke={color} strokeWidth={1.5} />
      )
    }
    return null
  }

  return (
    <div className="crypto-chart-panel">
      <div className="crypto-chart-header">
        <div className="crypto-metrics-group">
          <div className="crypto-metric">
            <span className="crypto-metric-value">{invoicesCount}</span>
            <span className="crypto-metric-label">INVOICES</span>
          </div>
          <div className="crypto-metric">
            <span className="crypto-metric-value">{formatCurrency(revenueSum)}</span>
            <span className="crypto-metric-label">
              REVENUE 
              <span className={`crypto-trend-badge ${trendPercent >= 0 ? 'up' : 'down'}`}>
                {trendPercent >= 0 ? '↑' : '↓'} {Math.abs(trendPercent).toFixed(0)}% {timeframeLabel}
              </span>
            </span>
          </div>
        </div>
        <div className="crypto-timeframe-toggles">
          <button className={timeframe === 'year' ? 'active' : ''} onClick={() => setTimeframe('year')}>YEAR</button>
          <button className={timeframe === 'month' ? 'active' : ''} onClick={() => setTimeframe('month')}>MONTH</button>
          <button className={timeframe === 'week' ? 'active' : ''} onClick={() => setTimeframe('week')}>WEEK</button>
        </div>
      </div>

      <div className="crypto-chart-container" style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 15, right: 48, left: 8, bottom: 5 }}>
            <defs>
              {/* Positive: green upward fill */}
              <linearGradient id="positiveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.18}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
              </linearGradient>
              {/* Ghost: red very subtle fill */}
              <linearGradient id="ghostGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.06}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0}/>
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" opacity={0.15} />
            <XAxis
              dataKey="name"
              stroke="var(--text-muted)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              stroke="var(--text-muted)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={58}
              tickFormatter={(val: number) => {
                if (val >= 1_000_000) return `¥${(val / 1_000_000).toFixed(1)}M`
                if (val >= 1_000) return `¥${(val / 1_000).toFixed(0)}K`
                return `¥${val}`
              }}
            />
            <ChartTooltip
              contentStyle={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border)',
                borderRadius: 10,
                fontSize: 12,
                color: 'var(--text-primary)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
              }}
              labelFormatter={(label, items) => {
                if (items && items[0]) return items[0].payload.displayDate || label
                return label
              }}
              formatter={(value: any, name: any) => {
                const labels: Record<string, string> = {
                  positive: '↑ Confirmed Revenue',
                  ghost:    '↓ Uncertain Revenue',
                  revenue:  'Total Revenue'
                }
                return [`¥${Number(value).toLocaleString()}`, labels[name] || name]
              }}
            />

            {/* Ghost line — dashed red, behind positive */}
            {showGhost && (
              <Area
                type="monotone"
                dataKey="ghost"
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="6 3"
                strokeOpacity={0.5}
                fillOpacity={1}
                fill="url(#ghostGradient)"
                dot={createDotRenderer('#ef4444', 'ghost')}
                activeDot={{ r: 5, stroke: '#ef4444', strokeWidth: 2, fill: '#fff' }}
              />
            )}

            {/* Positive line — solid green, on top */}
            {showPositive && (
              <Area
                type="monotone"
                dataKey="positive"
                stroke="#10b981"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#positiveGradient)"
                dot={createDotRenderer('#10b981', 'positive')}
                activeDot={{ r: 5, stroke: '#10b981', strokeWidth: 2, fill: '#fff' }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend Toggles */}
      <div className="crypto-chart-legend">
        <button
          className={`legend-item positive-line ${showPositive ? 'active' : ''}`}
          onClick={() => setShowPositive(!showPositive)}
        >
          <span className="legend-dot positive-line"></span>
          <span className="legend-text">
            ↑ Confirmed Revenue — {formatCurrency(positiveTotal)}
          </span>
        </button>
        <button
          className={`legend-item ghost-line ${showGhost ? 'active' : ''}`}
          onClick={() => setShowGhost(!showGhost)}
        >
          <span className="legend-dot ghost-line"></span>
          <span className="legend-text">
            ↓ Uncertain Revenue — {formatCurrency(ghostTotal)}
          </span>
        </button>
      </div>
    </div>
  )
}
