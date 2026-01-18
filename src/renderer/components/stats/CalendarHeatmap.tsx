import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DailyStats } from '@shared/types/project'
import { getCalendarGrid, formatDateString, getTodayDateString } from '@/lib/stats/calculations'

interface CalendarHeatmapProps {
  dailyStats: DailyStats[]
  selectedDate?: string | null
  onDateClick?: (date: string, stats: DailyStats | null) => void
  className?: string
}

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

/**
 * CalendarHeatmap Component
 *
 * Displays a monthly calendar with color-coded days based on writing activity:
 * - Green: Goal reached
 * - Light red: Wrote but goal not reached
 * - No color: No writing activity
 */
export function CalendarHeatmap({
  dailyStats,
  selectedDate,
  onDateClick,
  className
}: CalendarHeatmapProps) {
  const today = getTodayDateString()
  const [currentDate, setCurrentDate] = useState(() => new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Create a map for quick lookup
  const statsMap = useMemo(() => {
    const map = new Map<string, DailyStats>()
    for (const stats of dailyStats) {
      map.set(stats.date, stats)
    }
    return map
  }, [dailyStats])

  // Get calendar grid
  const weeks = useMemo(() => getCalendarGrid(year, month), [year, month])

  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const getDayColor = (dateStr: string): string => {
    const stats = statsMap.get(dateStr)

    if (!stats) {
      return '' // No writing
    }

    if (stats.goalReached) {
      return 'bg-green-500 text-white hover:bg-green-600'
    }

    // Wrote but didn't reach goal
    return 'bg-red-200 text-red-900 hover:bg-red-300 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60'
  }

  const isCurrentMonth = (dateStr: string): boolean => {
    const [dateYear, dateMonth] = dateStr.split('-').map(Number)
    return dateYear === year && dateMonth === month + 1
  }

  return (
    <div className={cn('', className)}>
      {/* Header with navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goToPreviousMonth}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={16} />
        </button>

        <button
          onClick={goToToday}
          className="text-sm font-medium hover:text-primary transition-colors"
        >
          {MONTH_NAMES[month]} {year}
        </button>

        <button
          onClick={goToNextMonth}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((day, i) => (
          <div
            key={i}
            className="text-center text-[10px] text-muted-foreground font-medium py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="space-y-1">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-1">
            {week.map((dateStr) => {
              const stats = statsMap.get(dateStr)
              const inCurrentMonth = isCurrentMonth(dateStr)
              const isToday = dateStr === today
              const isSelected = dateStr === selectedDate
              const dayColor = getDayColor(dateStr)

              return (
                <button
                  key={dateStr}
                  onClick={() => onDateClick?.(dateStr, stats ?? null)}
                  className={cn(
                    'aspect-square rounded text-[10px] font-medium transition-colors relative',
                    inCurrentMonth ? 'text-foreground' : 'text-muted-foreground/40',
                    dayColor || 'hover:bg-accent',
                    isToday && !dayColor && !isSelected && 'ring-1 ring-primary',
                    isToday && dayColor && !isSelected && 'ring-1 ring-offset-1 ring-foreground/50',
                    isSelected && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                  )}
                  title={getTooltip(dateStr, stats ?? null)}
                >
                  {parseInt(dateStr.split('-')[2], 10)}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span>Objectif atteint</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-200 dark:bg-red-900/40" />
          <span>Écrit</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-muted border border-border" />
          <span>Rien</span>
        </div>
      </div>
    </div>
  )
}

function getTooltip(dateStr: string, stats: DailyStats | null): string {
  const [year, month, day] = dateStr.split('-')
  const formattedDate = `${day}/${month}/${year}`

  if (!stats) {
    return `${formattedDate}\nAucune écriture`
  }

  const lines = [formattedDate]
  lines.push(`${stats.netWords >= 0 ? '+' : ''}${stats.netWords} mots nets`)

  if (stats.totalMinutes > 0) {
    const hours = Math.floor(stats.totalMinutes / 60)
    const mins = stats.totalMinutes % 60
    const timeStr = hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}min` : ''}` : `${mins}min`
    lines.push(timeStr)
  }

  if (stats.goalReached) {
    lines.push('Objectif atteint')
  }

  return lines.join('\n')
}

interface MiniCalendarProps {
  dailyStats: DailyStats[]
  className?: string
}

/**
 * MiniCalendar Component
 *
 * A compact version showing just the current week.
 */
export function MiniCalendar({ dailyStats, className }: MiniCalendarProps) {
  const today = new Date()
  const todayStr = getTodayDateString()

  // Get this week (Monday to Sunday)
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(today)
  monday.setDate(diff)

  const weekDates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    weekDates.push(formatDateString(d))
  }

  // Create stats map
  const statsMap = new Map<string, DailyStats>()
  for (const stats of dailyStats) {
    statsMap.set(stats.date, stats)
  }

  return (
    <div className={cn('flex gap-1', className)}>
      {weekDates.map((dateStr, i) => {
        const stats = statsMap.get(dateStr)
        const isToday = dateStr === todayStr
        const isFuture = dateStr > todayStr

        let bgColor = 'bg-muted'
        if (!isFuture && stats) {
          bgColor = stats.goalReached ? 'bg-green-500' : 'bg-red-300 dark:bg-red-900/50'
        }

        return (
          <div key={dateStr} className="flex flex-col items-center gap-0.5">
            <span className="text-[9px] text-muted-foreground">
              {WEEKDAY_LABELS[i]}
            </span>
            <div
              className={cn(
                'w-4 h-4 rounded-sm',
                bgColor,
                isToday && 'ring-1 ring-primary'
              )}
              title={getTooltip(dateStr, stats ?? null)}
            />
          </div>
        )
      })}
    </div>
  )
}
