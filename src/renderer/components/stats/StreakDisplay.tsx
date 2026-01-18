import { Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StreakInfo } from '@shared/types/project'

interface StreakDisplayProps {
  streak: StreakInfo
  showLongest?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * StreakDisplay Component
 *
 * Shows the current writing streak with a flame icon.
 * Can optionally show the longest streak achieved.
 */
export function StreakDisplay({
  streak,
  showLongest = false,
  size = 'md',
  className
}: StreakDisplayProps) {
  const { current, longest } = streak
  const hasStreak = current > 0

  const sizeClasses = {
    sm: {
      container: 'gap-1',
      icon: 14,
      number: 'text-lg font-bold',
      label: 'text-xs'
    },
    md: {
      container: 'gap-1.5',
      icon: 18,
      number: 'text-2xl font-bold',
      label: 'text-sm'
    },
    lg: {
      container: 'gap-2',
      icon: 24,
      number: 'text-3xl font-bold',
      label: 'text-base'
    }
  }

  const styles = sizeClasses[size]

  return (
    <div className={cn('', className)}>
      <div className={cn('flex items-baseline', styles.container)}>
        <Flame
          size={styles.icon}
          className={cn(
            hasStreak ? 'text-orange-500' : 'text-muted-foreground/50',
            hasStreak && current >= 7 && 'text-orange-600',
            hasStreak && current >= 30 && 'text-red-500'
          )}
          fill={hasStreak ? 'currentColor' : 'none'}
        />
        <span className={cn(
          styles.number,
          hasStreak ? 'text-foreground' : 'text-muted-foreground'
        )}>
          {current}
        </span>
        <span className={cn('text-muted-foreground', styles.label)}>
          {current === 1 ? 'jour' : 'jours'}
        </span>
      </div>

      {showLongest && longest > current && (
        <div className="text-xs text-muted-foreground mt-1">
          Record : {longest} jours
        </div>
      )}
    </div>
  )
}

interface CompactStreakProps {
  streak: number
  className?: string
}

/**
 * CompactStreak Component
 *
 * A minimal streak display for use in tight spaces.
 */
export function CompactStreak({ streak, className }: CompactStreakProps) {
  const hasStreak = streak > 0

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Flame
        size={12}
        className={cn(
          hasStreak ? 'text-orange-500' : 'text-muted-foreground/50'
        )}
        fill={hasStreak ? 'currentColor' : 'none'}
      />
      <span className={cn(
        'text-xs font-medium tabular-nums',
        hasStreak ? 'text-foreground' : 'text-muted-foreground'
      )}>
        {streak}
      </span>
    </div>
  )
}
