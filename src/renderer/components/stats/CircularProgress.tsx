import { Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CircularProgressProps {
  current: number
  target: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  label?: string
  showValue?: boolean
  onClick?: () => void
  className?: string
}

const SIZE_CONFIG = {
  sm: { diameter: 48, strokeWidth: 4, fontSize: 'text-[10px]', labelSize: 'text-[8px]' },
  md: { diameter: 64, strokeWidth: 5, fontSize: 'text-xs', labelSize: 'text-[9px]' },
  lg: { diameter: 80, strokeWidth: 6, fontSize: 'text-sm', labelSize: 'text-[10px]' },
  xl: { diameter: 120, strokeWidth: 8, fontSize: 'text-lg', labelSize: 'text-xs' }
}

/**
 * CircularProgress Component
 *
 * A circular progress indicator inspired by Storyist.
 * Shows progress as a ring that fills clockwise.
 */
export function CircularProgress({
  current,
  target,
  size = 'md',
  label,
  showValue = true,
  onClick,
  className
}: CircularProgressProps) {
  const config = SIZE_CONFIG[size]
  const { diameter, strokeWidth } = config

  const radius = (diameter - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const percentage = target > 0 ? Math.min(100, (current / target) * 100) : 0
  const strokeDashoffset = circumference - (percentage / 100) * circumference
  const isComplete = percentage >= 100

  // Colors based on progress
  const progressColor = isComplete
    ? 'stroke-green-500'
    : percentage >= 75
      ? 'stroke-primary'
      : percentage >= 50
        ? 'stroke-blue-500'
        : percentage >= 25
          ? 'stroke-amber-500'
          : 'stroke-primary/60'

  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      className={cn(
        'relative inline-flex items-center justify-center',
        onClick && 'cursor-pointer group',
        className
      )}
      onClick={onClick}
      title={onClick ? 'Cliquer pour modifier' : undefined}
    >
      <svg
        width={diameter}
        height={diameter}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />

        {/* Progress circle */}
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn(
            'transition-all duration-700 ease-out',
            progressColor
          )}
        />

        {/* Glow effect when complete */}
        {isComplete && (
          <circle
            cx={diameter / 2}
            cy={diameter / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth + 2}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={0}
            className="stroke-green-500/20 blur-[2px]"
          />
        )}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showValue && (
          <span className={cn(
            'font-bold tabular-nums',
            config.fontSize,
            isComplete ? 'text-green-600' : 'text-foreground'
          )}>
            {Math.round(percentage)}%
          </span>
        )}
        {label && (
          <span className={cn(
            'text-muted-foreground leading-tight',
            config.labelSize
          )}>
            {label}
          </span>
        )}
      </div>

      {/* Settings icon on hover */}
      {onClick && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 rounded-full">
          <Settings2 size={diameter / 3} className="text-muted-foreground" />
        </div>
      )}
    </Component>
  )
}

interface DualCircularProgressProps {
  dailyCurrent: number
  dailyTarget: number
  projectCurrent: number
  projectTarget: number
  onDailyClick?: () => void
  onProjectClick?: () => void
  className?: string
}

/**
 * DualCircularProgress Component
 *
 * Shows both daily and project progress side by side.
 */
export function DualCircularProgress({
  dailyCurrent,
  dailyTarget,
  projectCurrent,
  projectTarget,
  onDailyClick,
  onProjectClick,
  className
}: DualCircularProgressProps) {
  return (
    <div className={cn('flex items-center justify-center gap-4', className)}>
      <CircularProgress
        current={dailyCurrent}
        target={dailyTarget}
        size="lg"
        label="Jour"
        onClick={onDailyClick}
      />
      <CircularProgress
        current={projectCurrent}
        target={projectTarget}
        size="lg"
        label="Projet"
        onClick={onProjectClick}
      />
    </div>
  )
}

interface MiniCircularProgressProps {
  percentage: number
  size?: number
  className?: string
}

/**
 * MiniCircularProgress
 *
 * Tiny circular progress for compact displays (like toolbar).
 */
export function MiniCircularProgress({
  percentage,
  size = 16,
  className
}: MiniCircularProgressProps) {
  const strokeWidth = 2
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (Math.min(100, percentage) / 100) * circumference
  const isComplete = percentage >= 100

  return (
    <svg
      width={size}
      height={size}
      className={cn('transform -rotate-90', className)}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        className={cn(
          'transition-all duration-300',
          isComplete ? 'stroke-green-500' : 'stroke-primary'
        )}
      />
    </svg>
  )
}
