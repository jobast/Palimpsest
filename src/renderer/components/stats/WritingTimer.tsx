import { Timer, Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWritingTimer } from '@/hooks/useWritingTimer'

interface WritingTimerProps {
  showStatus?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * WritingTimer Component
 *
 * Displays the current session duration with status indicator.
 */
export function WritingTimer({
  showStatus = true,
  size = 'md',
  className
}: WritingTimerProps) {
  const { formattedTime, isActive, isWriting, isPaused } = useWritingTimer()

  const sizeClasses = {
    sm: {
      container: 'gap-1',
      icon: 12,
      time: 'text-xs',
      status: 'text-[10px]'
    },
    md: {
      container: 'gap-1.5',
      icon: 14,
      time: 'text-sm',
      status: 'text-xs'
    },
    lg: {
      container: 'gap-2',
      icon: 18,
      time: 'text-lg',
      status: 'text-sm'
    }
  }

  const styles = sizeClasses[size]

  if (!isActive) {
    return (
      <div className={cn('flex items-center text-muted-foreground', styles.container, className)}>
        <Timer size={styles.icon} className="opacity-50" />
        <span className={cn('tabular-nums', styles.time)}>00:00</span>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center', styles.container, className)}>
      {isPaused ? (
        <Pause
          size={styles.icon}
          className="text-amber-500"
        />
      ) : (
        <Timer
          size={styles.icon}
          className={cn(
            isWriting ? 'text-green-500' : 'text-primary'
          )}
        />
      )}

      <span className={cn(
        'tabular-nums font-medium',
        styles.time,
        isPaused && 'text-amber-600',
        isWriting && 'text-green-600'
      )}>
        {formattedTime}
      </span>

      {showStatus && (
        <span className={cn(
          'text-muted-foreground',
          styles.status,
          isPaused && 'text-amber-500',
          isWriting && 'text-green-500'
        )}>
          {isPaused ? 'En pause' : isWriting ? 'Actif' : ''}
        </span>
      )}
    </div>
  )
}

interface MiniTimerProps {
  className?: string
}

/**
 * MiniTimer Component
 *
 * A minimal timer display for the toolbar.
 */
export function MiniTimer({ className }: MiniTimerProps) {
  const { formattedTime, isActive, isPaused, isWriting } = useWritingTimer()

  if (!isActive) {
    return null
  }

  return (
    <div className={cn(
      'flex items-center gap-1 px-2 py-1 rounded text-xs',
      isPaused && 'bg-amber-100/50 dark:bg-amber-900/20',
      className
    )}>
      {isPaused ? (
        <Pause size={10} className="text-amber-500" />
      ) : isWriting ? (
        <Play size={10} className="text-green-500" />
      ) : (
        <Timer size={10} className="text-muted-foreground" />
      )}
      <span className={cn(
        'tabular-nums',
        isPaused ? 'text-amber-600' : isWriting ? 'text-green-600' : 'text-muted-foreground'
      )}>
        {formattedTime}
      </span>
    </div>
  )
}

interface SessionStatsProps {
  className?: string
}

/**
 * SessionStats Component
 *
 * Shows detailed statistics for the current writing session.
 */
export function SessionStats({ className }: SessionStatsProps) {
  const { formattedTime, isActive, isWriting, isPaused } = useWritingTimer()

  if (!isActive) {
    return (
      <div className={cn('text-center text-muted-foreground', className)}>
        <p className="text-sm">Aucune session en cours</p>
        <p className="text-xs mt-1">Commencez à écrire pour démarrer le chrono</p>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-center gap-2 mb-2">
        {isPaused ? (
          <Pause size={20} className="text-amber-500" />
        ) : (
          <Timer size={20} className={isWriting ? 'text-green-500' : 'text-primary'} />
        )}
        <span className={cn(
          'text-2xl font-bold tabular-nums',
          isPaused ? 'text-amber-600' : isWriting ? 'text-green-600' : 'text-foreground'
        )}>
          {formattedTime}
        </span>
      </div>

      <div className={cn(
        'text-center text-xs px-3 py-1 rounded-full',
        isPaused
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          : isWriting
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-muted text-muted-foreground'
      )}>
        {isPaused ? 'Session en pause' : isWriting ? 'En cours d\'écriture' : 'Session active'}
      </div>
    </div>
  )
}
