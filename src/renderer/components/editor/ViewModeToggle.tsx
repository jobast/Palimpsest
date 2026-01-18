import { FileText, BookOpen } from 'lucide-react'
import { useEditorStore } from '@/stores/editorStore'
import { usePaginationStore } from '@/stores/paginationStore'
import { cn } from '@/lib/utils'

/**
 * Toggle between Text View (editing) and Page View (preview)
 */
export function ViewModeToggle() {
  const { viewMode, setViewMode } = useEditorStore()
  const { currentPage, totalPages, isCalculating } = usePaginationStore()

  return (
    <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
      {/* View mode buttons */}
      <div className="flex gap-1 bg-background/90 backdrop-blur-sm rounded-lg p-1 shadow-md border border-border">
        <button
          onClick={() => setViewMode('text')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors',
            viewMode === 'text'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          )}
          title="Mode édition - texte continu"
        >
          <FileText size={14} />
          <span>Texte</span>
        </button>
        <button
          onClick={() => setViewMode('page')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors',
            viewMode === 'page'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          )}
          title="Mode aperçu - pages distinctes"
        >
          <BookOpen size={14} />
          <span>Pages</span>
        </button>
      </div>

      {/* Page indicator (visible in page mode) */}
      {viewMode === 'page' && (
        <div className="bg-background/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-md border border-border text-sm">
          {isCalculating ? (
            <span className="text-muted-foreground">Calcul...</span>
          ) : (
            <span>
              Page <strong>{currentPage}</strong> / {totalPages}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
