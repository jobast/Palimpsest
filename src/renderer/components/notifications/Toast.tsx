import { useEffect, useState, useRef } from 'react'
import { X, Trophy, Target, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'daily_goal' | 'project_goal' | 'streak_milestone' | 'info' | 'success' | 'error'

interface ToastProps {
  type: ToastType
  message: string
  onClose: () => void
  duration?: number
  index?: number
}

const ICONS = {
  daily_goal: Target,
  project_goal: Trophy,
  streak_milestone: Flame,
  info: Target,
  success: Target,
  error: X
}

const STYLES = {
  daily_goal: {
    bg: 'bg-green-100 dark:bg-green-900/40',
    border: 'border-green-300 dark:border-green-800',
    icon: 'text-green-600 dark:text-green-400',
    text: 'text-green-800 dark:text-green-200'
  },
  project_goal: {
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    border: 'border-amber-300 dark:border-amber-800',
    icon: 'text-amber-600 dark:text-amber-400',
    text: 'text-amber-800 dark:text-amber-200'
  },
  streak_milestone: {
    bg: 'bg-orange-100 dark:bg-orange-900/40',
    border: 'border-orange-300 dark:border-orange-800',
    icon: 'text-orange-600 dark:text-orange-400',
    text: 'text-orange-800 dark:text-orange-200'
  },
  info: {
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    border: 'border-blue-300 dark:border-blue-800',
    icon: 'text-blue-600 dark:text-blue-400',
    text: 'text-blue-800 dark:text-blue-200'
  },
  success: {
    bg: 'bg-green-100 dark:bg-green-900/40',
    border: 'border-green-300 dark:border-green-800',
    icon: 'text-green-600 dark:text-green-400',
    text: 'text-green-800 dark:text-green-200'
  },
  error: {
    bg: 'bg-red-100 dark:bg-red-900/40',
    border: 'border-red-300 dark:border-red-800',
    icon: 'text-red-600 dark:text-red-400',
    text: 'text-red-800 dark:text-red-200'
  }
}

/**
 * Toast Component
 *
 * Individual toast notification with animation.
 */
export function Toast({
  type,
  message,
  onClose,
  duration = 5000,
  index = 0
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const Icon = ICONS[type]
  const styles = STYLES[type]

  useEffect(() => {
    // Animate in
    const showTimer = setTimeout(() => setIsVisible(true), 50)

    // Auto dismiss
    const dismissTimer = setTimeout(() => {
      handleClose()
    }, duration)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(dismissTimer)
      // Clean up close animation timer on unmount
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
      }
    }
  }, [duration])

  const handleClose = () => {
    setIsLeaving(true)
    closeTimerRef.current = setTimeout(onClose, 300)
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg transition-all duration-300 max-w-sm',
        styles.bg,
        styles.border,
        isVisible && !isLeaving
          ? 'opacity-100 translate-x-0'
          : 'opacity-0 translate-x-8'
      )}
      style={{ marginTop: index > 0 ? '8px' : 0 }}
    >
      <Icon size={20} className={styles.icon} />

      <div className="flex-1">
        <p className={cn('text-sm font-medium', styles.text)}>
          {message}
        </p>
      </div>

      <button
        onClick={handleClose}
        className={cn(
          'p-1 rounded hover:bg-black/10 transition-colors',
          styles.text
        )}
      >
        <X size={14} />
      </button>
    </div>
  )
}
