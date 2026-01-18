import { Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GoalProgressProps {
  label: string
  current: number
  target: number
  showNumbers?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'success' | 'warning'
  className?: string
  onClick?: () => void
}

/**
 * GoalProgress Component
 *
 * Displays a progress bar with optional label and numbers.
 * Animates smoothly when progress changes.
 */
export function GoalProgress({
  label,
  current,
  target,
  showNumbers = true,
  size = 'md',
  variant = 'default',
  className,
  onClick
}: GoalProgressProps) {
  const percentage = target > 0 ? Math.min(100, (current / target) * 100) : 0
  const isComplete = percentage >= 100

  // Determine variant based on completion
  const effectiveVariant = isComplete ? 'success' : variant

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3'
  }

  const variantClasses = {
    default: 'bg-primary',
    success: 'bg-green-500',
    warning: 'bg-amber-500'
  }

  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      className={cn(
        'w-full text-left',
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
        className
      )}
      onClick={onClick}
    >
      {/* Header with label and numbers */}
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          {label}
          {onClick && (
            <Settings2 size={12} className="opacity-40 hover:opacity-100 transition-opacity" />
          )}
        </span>
        {showNumbers && (
          <span className="text-sm">
            <span className={cn(isComplete && 'text-green-600 font-medium')}>
              {current.toLocaleString()}
            </span>
            <span className="text-muted-foreground"> / {target.toLocaleString()}</span>
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className={cn('bg-muted rounded-full overflow-hidden', sizeClasses[size])}>
        <div
          className={cn(
            'h-full transition-all duration-500 ease-out rounded-full',
            variantClasses[effectiveVariant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Percentage indicator for large size */}
      {size === 'lg' && (
        <div className="flex justify-end mt-1">
          <span className={cn(
            'text-xs',
            isComplete ? 'text-green-600 font-medium' : 'text-muted-foreground'
          )}>
            {Math.round(percentage)}%
          </span>
        </div>
      )}
    </Component>
  )
}

interface CompactGoalProgressProps {
  current: number
  target: number
  className?: string
}

/**
 * CompactGoalProgress Component
 *
 * A minimal progress indicator for use in tight spaces like the toolbar.
 */
export function CompactGoalProgress({ current, target, className }: CompactGoalProgressProps) {
  const percentage = target > 0 ? Math.min(100, (current / target) * 100) : 0
  const isComplete = percentage >= 100

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-300 rounded-full',
            isComplete ? 'bg-green-500' : 'bg-primary'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={cn(
        'text-xs tabular-nums',
        isComplete ? 'text-green-600' : 'text-muted-foreground'
      )}>
        {Math.round(percentage)}%
      </span>
    </div>
  )
}
