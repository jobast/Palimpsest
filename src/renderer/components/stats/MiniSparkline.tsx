import { useMemo } from 'react'
import { AreaChart, Area, ResponsiveContainer, YAxis, Dot } from 'recharts'
import type { DailyStats } from '@shared/types/project'
import { getTodayDateString, formatDateString } from '@/lib/stats/calculations'
import { cn } from '@/lib/utils'

interface MiniSparklineProps {
  dailyStats: DailyStats[]
  days?: number
  height?: number
  className?: string
}

/**
 * MiniSparkline Component
 *
 * A compact sparkline chart showing writing trends over the last N days.
 * No axes, no tooltip - just a simple visual indicator.
 */
export function MiniSparkline({
  dailyStats,
  days = 7,
  height = 32,
  className
}: MiniSparklineProps) {
  const data = useMemo(() => {
    const today = new Date()
    const todayStr = getTodayDateString()

    // Create a map for quick lookup
    const statsMap = new Map<string, DailyStats>()
    for (const stats of dailyStats) {
      statsMap.set(stats.date, stats)
    }

    // Generate data for last N days
    const result: Array<{ date: string; value: number; isToday: boolean }> = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = formatDateString(d)
      const stats = statsMap.get(dateStr)

      result.push({
        date: dateStr,
        value: stats ? Math.max(0, stats.netWords) : 0,
        isToday: dateStr === todayStr
      })
    }

    return result
  }, [dailyStats, days])

  // Find max value for scaling
  const maxValue = Math.max(...data.map(d => d.value), 1)

  // Check if all days have data (for color variation)
  const hasActivity = data.some(d => d.value > 0)

  if (!hasActivity) {
    // Show placeholder when no data
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
          margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
        >
          <defs>
            <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={[0, maxValue]} hide />
          <Area
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            fill="url(#sparklineGradient)"
            dot={(props) => {
              // Only show dot for today
              const { payload, cx, cy } = props
              if (payload?.isToday && cy !== undefined) {
                return (
                  <Dot
                    cx={cx}
                    cy={cy}
                    r={3}
                    fill="hsl(var(--primary))"
                    stroke="hsl(var(--background))"
                    strokeWidth={1}
                  />
                )
              }
              return <g />
            }}
            activeDot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

interface SparklineWithLabelProps extends MiniSparklineProps {
  label?: string
  showTotal?: boolean
}

/**
 * SparklineWithLabel Component
 *
 * Sparkline with a label and optional total display.
 */
export function SparklineWithLabel({
  dailyStats,
  days = 7,
  height = 40,
  label = '7 derniers jours',
  showTotal = true,
  className
}: SparklineWithLabelProps) {
  const total = useMemo(() => {
    const today = new Date()

    let sum = 0
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = formatDateString(d)
      const stats = dailyStats.find(s => s.date === dateStr)
      if (stats) {
        sum += Math.max(0, stats.netWords)
      }
    }
    return sum
  }, [dailyStats, days])

  return (
    <div className={cn('', className)}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        {showTotal && (
          <span className="text-[10px] font-medium">
            {total > 0 ? `+${total.toLocaleString()}` : '0'} mots
          </span>
        )}
      </div>
      <MiniSparkline dailyStats={dailyStats} days={days} height={height} />
    </div>
  )
}
