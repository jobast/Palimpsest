import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { getWeekdayAverages } from '@/lib/stats/aggregations'
import type { DailyStats } from '@shared/types/project'
import { cn } from '@/lib/utils'

interface ProductivityPatternChartProps {
  dailyStats: DailyStats[]
  height?: number
  className?: string
}

/**
 * ProductivityPatternChart Component
 *
 * Horizontal bar chart showing average words per day of the week.
 * Helps writers identify their most productive days.
 */
export function ProductivityPatternChart({
  dailyStats,
  height = 140,
  className
}: ProductivityPatternChartProps) {
  const data = useMemo(() => {
    return getWeekdayAverages(dailyStats)
  }, [dailyStats])

  // Find max for color intensity
  const maxAvg = Math.max(...data.map(d => d.avgWords), 1)

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null

    const data = payload[0].payload

    return (
      <div className="bg-popover border border-border rounded-md px-2 py-1.5 shadow-md">
        <p className="text-sm font-medium">
          {data.avgWords.toLocaleString()} mots/jour
        </p>
        <p className="text-[10px] text-muted-foreground">
          {data.count} jour{data.count > 1 ? 's' : ''} de données
        </p>
      </div>
    )
  }

  // Get color intensity based on value
  const getBarColor = (value: number): string => {
    if (value === 0) return 'hsl(var(--muted))'
    const intensity = value / maxAvg
    if (intensity > 0.8) return 'hsl(142, 71%, 45%)' // Green for high
    if (intensity > 0.5) return 'hsl(var(--primary))'
    return 'hsl(var(--primary) / 0.6)'
  }

  const hasData = data.some(d => d.avgWords > 0)

  if (!hasData) {
    return (
      <div
        className={cn('flex items-center justify-center text-xs text-muted-foreground', className)}
        style={{ height }}
      >
        Pas assez de données
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
        >
          <XAxis
            type="number"
            hide
            domain={[0, maxAvg * 1.1]}
          />
          <YAxis
            type="category"
            dataKey="day"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={30}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="avgWords"
            radius={[0, 4, 4, 0]}
            maxBarSize={16}
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={getBarColor(entry.avgWords)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
