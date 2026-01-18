import { PenLine, Eraser } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ManuscriptMode } from '@shared/types/project'

interface ManuscriptModeToggleProps {
  mode: ManuscriptMode
  onChange: (mode: ManuscriptMode) => void
  className?: string
}

/**
 * ManuscriptModeToggle Component
 *
 * Toggle between "drafting" and "editing" modes.
 *
 * - Drafting: Net words matter (words added - words deleted)
 * - Editing: Total changes matter (words added + words deleted)
 */
export function ManuscriptModeToggle({
  mode,
  onChange,
  className
}: ManuscriptModeToggleProps) {
  return (
    <div className={cn('', className)}>
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        Mode du manuscrit
      </div>

      <div className="flex rounded-lg border border-border overflow-hidden">
        <button
          onClick={() => onChange('drafting')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm transition-colors',
            mode === 'drafting'
              ? 'bg-primary text-primary-foreground'
              : 'bg-card hover:bg-accent text-muted-foreground hover:text-foreground'
          )}
        >
          <PenLine size={14} />
          <span>Rédaction</span>
        </button>

        <button
          onClick={() => onChange('editing')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm transition-colors border-l border-border',
            mode === 'editing'
              ? 'bg-primary text-primary-foreground'
              : 'bg-card hover:bg-accent text-muted-foreground hover:text-foreground'
          )}
        >
          <Eraser size={14} />
          <span>Révision</span>
        </button>
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        {mode === 'drafting' ? (
          <>En rédaction, seuls les mots nets comptent (ajouts - suppressions).</>
        ) : (
          <>En révision, tous les changements comptent (ajouts + suppressions).</>
        )}
      </p>
    </div>
  )
}

interface CompactModeIndicatorProps {
  mode: ManuscriptMode
  className?: string
}

/**
 * CompactModeIndicator Component
 *
 * A small badge showing the current mode.
 */
export function CompactModeIndicator({ mode, className }: CompactModeIndicatorProps) {
  return (
    <div className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
      mode === 'drafting'
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      className
    )}>
      {mode === 'drafting' ? (
        <>
          <PenLine size={10} />
          <span>Rédaction</span>
        </>
      ) : (
        <>
          <Eraser size={10} />
          <span>Révision</span>
        </>
      )}
    </div>
  )
}
