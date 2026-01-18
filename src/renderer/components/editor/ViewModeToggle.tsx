import { FileText, BookOpen } from 'lucide-react'
import { useEditorStore } from '@/stores/editorStore'
import { cn } from '@/lib/utils'

/**
 * Toggle between Text View (editing) and Page View (preview)
 * Positioned at bottom-left, next to zoom controls
 */
export function ViewModeToggle() {
  const { viewMode, setViewMode } = useEditorStore()

  return (
    <div className="flex gap-0.5 bg-card rounded-lg p-0.5 border border-border shadow-md">
      <button
        onClick={() => setViewMode('text')}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm transition-colors',
          viewMode === 'text'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        )}
        title="Mode texte continu"
      >
        <FileText size={14} />
      </button>
      <button
        onClick={() => setViewMode('page')}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm transition-colors',
          viewMode === 'page'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        )}
        title="Mode pages"
      >
        <BookOpen size={14} />
      </button>
    </div>
  )
}
