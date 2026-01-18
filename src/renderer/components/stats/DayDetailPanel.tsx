import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/stats/calculations'
import type { DailyStats } from '@shared/types/project'

interface DayDetailPanelProps {
  date: string // YYYY-MM-DD
  stats: DailyStats | null
  dailyGoal: number
  onClose: () => void
  className?: string
}

const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
]

/**
 * DayDetailPanel Component
 *
 * Displays detailed statistics for a selected day from the calendar.
 * Shows inline below the calendar with expansion animation.
 */
export function DayDetailPanel({
  date,
  stats,
  dailyGoal,
  onClose,
  className
}: DayDetailPanelProps) {
  // Format date to French
  const [year, month, day] = date.split('-').map(Number)
  const formattedDate = `${day} ${MONTH_NAMES[month - 1]} ${year}`

  // Calculate progress
  const current = stats?.netWords ?? 0
  const percentage = dailyGoal > 0 ? Math.min(100, (Math.max(0, current) / dailyGoal) * 100) : 0
  const goalReached = stats?.goalReached ?? false

  return (
    <div
      className={cn(
        'mt-3 p-3 rounded-lg border border-border bg-card/50 animate-in fade-in slide-in-from-top-2 duration-150',
        className
      )}
    >
      {/* Header with date and close button */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">{formattedDate}</span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Fermer"
        >
          <X size={14} />
        </button>
      </div>

      {!stats ? (
        <p className="text-sm text-muted-foreground">Aucune écriture ce jour</p>
      ) : (
        <>
          {/* Net words - prominent */}
          <div className="mb-3">
            <div className="text-2xl font-semibold">
              {stats.netWords >= 0 ? '+' : ''}{stats.netWords.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground ml-1">mots nets</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              +{stats.totalWordsAdded.toLocaleString()} / -{stats.totalWordsDeleted.toLocaleString()}
            </div>
          </div>

          {/* Time and sessions */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
            {stats.totalMinutes > 0 && (
              <span>{formatDuration(stats.totalMinutes)}</span>
            )}
            <span>
              {stats.sessionCount} session{stats.sessionCount > 1 ? 's' : ''}
            </span>
          </div>

          {/* Goal progress bar */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Objectif du jour</span>
              <span className={goalReached ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                {Math.round(percentage)}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  goalReached
                    ? 'bg-green-500'
                    : percentage > 0
                    ? 'bg-amber-500'
                    : 'bg-muted-foreground/30'
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
              <span>{Math.max(0, current).toLocaleString()} / {dailyGoal.toLocaleString()} mots</span>
              {goalReached && (
                <span className="text-green-600 dark:text-green-400 font-medium">Objectif atteint</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
