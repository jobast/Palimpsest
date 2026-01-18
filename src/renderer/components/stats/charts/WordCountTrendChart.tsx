import { useMemo } from 'react'
import {
  ComposedChart,
  Bar,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { getLastNDaysStats } from '@/lib/stats/aggregations'
import type { DailyStats } from '@shared/types/project'
import { cn } from '@/lib/utils'

interface WordCountTrendChartProps {
  dailyStats: DailyStats[]
  dailyGoal: number
  period: '7d' | '30d' | '90d'
  height?: number
  className?: string
}

const PERIOD_DAYS = {
  '7d': 7,
  '30d': 30,
  '90d': 90
}

/**
 * WordCountTrendChart Component
 *
 * Bar chart showing daily word counts with goal reference line.
 * Bars are color-coded by goal achievement.
 */
export function WordCountTrendChart({
  dailyStats,
  dailyGoal,
  period,
  height = 120,
  className
}: WordCountTrendChartProps) {
  const data = useMemo(() => {
    const days = PERIOD_DAYS[period]
    return getLastNDaysStats(dailyStats, days)
  }, [dailyStats, period])

  // Format date for axis
  const formatDate = (dateStr: string) => {
    const [, month, day] = dateStr.split('-')
    return `${day}/${month}`
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null

    const data = payload[0].payload
    const [year, month, day] = data.date.split('-')
    const formattedDate = `${day}/${month}/${year}`

    return (
      <div className="bg-popover border border-border rounded-md px-2 py-1.5 shadow-md">
        <p className="text-xs text-muted-foreground">{formattedDate}</p>
        <p className="text-sm font-medium">
          {data.netWords >= 0 ? '+' : ''}{data.netWords.toLocaleString()} mots
        </p>
        {data.goalReached && (
          <p className="text-[10px] text-green-600 dark:text-green-400">Objectif atteint</p>
        )}
      </div>
    )
  }

  // Calculate tick interval based on period
  const tickInterval = period === '7d' ? 0 : period === '30d' ? 4 : 14

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
        >
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            interval={tickInterval}
          />
          <YAxis hide domain={[0, 'auto']} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={dailyGoal}
            stroke="hsl(var(--green-500, 142 71% 45%))"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
          <Bar
            dataKey="netWords"
            radius={[2, 2, 0, 0]}
            maxBarSize={period === '7d' ? 24 : period === '30d' ? 8 : 4}
          >
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={
                  !entry.hasData
                    ? 'hsl(var(--muted))'
                    : entry.goalReached
                    ? 'hsl(142, 71%, 45%)'
                    : entry.netWords > 0
                    ? 'hsl(var(--primary))'
                    : 'hsl(var(--muted-foreground) / 0.3)'
                }
              />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
