import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer
} from 'recharts'
import { getCumulativeProgress } from '@/lib/stats/aggregations'
import type { DailyStats } from '@shared/types/project'
import { cn } from '@/lib/utils'

interface CumulativeProgressChartProps {
  dailyStats: DailyStats[]
  projectGoal: number
  height?: number
  className?: string
}

/**
 * CumulativeProgressChart Component
 *
 * Area chart showing cumulative word count progress toward project goal.
 * Includes a reference line for the project target.
 */
export function CumulativeProgressChart({
  dailyStats,
  projectGoal,
  height = 120,
  className
}: CumulativeProgressChartProps) {
  const data = useMemo(() => {
    return getCumulativeProgress(dailyStats)
  }, [dailyStats])

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
    const percentage = projectGoal > 0 ? Math.round((data.cumulative / projectGoal) * 100) : 0

    return (
      <div className="bg-popover border border-border rounded-md px-2 py-1.5 shadow-md">
        <p className="text-xs text-muted-foreground">{formattedDate}</p>
        <p className="text-sm font-medium">
          {data.cumulative.toLocaleString()} mots
        </p>
        <p className="text-[10px] text-muted-foreground">
          {percentage}% de l'objectif
        </p>
      </div>
    )
  }

  // Calculate tick interval based on data length
  const tickInterval = data.length <= 7 ? 0 : data.length <= 30 ? 4 : Math.floor(data.length / 6)

  // Max for Y axis - either project goal or max cumulative, whichever is higher
  const maxCumulative = data.length > 0 ? data[data.length - 1].cumulative : 0
  const yMax = Math.max(projectGoal, maxCumulative * 1.1)

  if (data.length === 0) {
    return (
      <div
        className={cn('flex items-center justify-center text-xs text-muted-foreground', className)}
        style={{ height }}
      >
        Pas de données
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
        >
          <defs>
            <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            interval={tickInterval}
          />
          <YAxis
            hide
            domain={[0, yMax]}
          />
          <Tooltip content={<CustomTooltip />} />
          {projectGoal > 0 && (
            <ReferenceLine
              y={projectGoal}
              stroke="hsl(142, 71%, 45%)"
              strokeDasharray="3 3"
              strokeWidth={1}
              label={{
                value: 'Objectif',
                position: 'right',
                fontSize: 9,
                fill: 'hsl(var(--muted-foreground))'
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#cumulativeGradient)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
