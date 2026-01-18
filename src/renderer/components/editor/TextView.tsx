import { EditorContent } from '@tiptap/react'
import { useEditorStore } from '@/stores/editorStore'
import { usePaginationStore } from '@/stores/paginationStore'
import { getPageDimensions } from '@/lib/pagination'

/**
 * Text View Component
 * Standard flowing TipTap editor for writing
 * This is the main editing mode where users write their content
 */
export function TextView() {
  const { editor, currentTemplate } = useEditorStore()
  const { totalPages } = usePaginationStore()

  if (!editor) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Chargement...</p>
      </div>
    )
  }

  const dims = getPageDimensions(currentTemplate)

  return (
    <div className="flex-1 overflow-auto bg-muted/30 py-8">
      <div className="flex justify-center">
        {/* Single page-styled container for continuous editing */}
        <div
          className="bg-paper shadow-lg"
          style={{
            width: `${dims.width}px`,
            minHeight: `${dims.height}px`,
            padding: `${dims.marginTop}px ${dims.marginRight}px ${dims.marginBottom}px ${dims.marginLeft}px`,
            fontFamily: currentTemplate.typography.fontFamily,
            fontSize: currentTemplate.typography.fontSize,
            lineHeight: currentTemplate.typography.lineHeight,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)',
            borderRadius: '2px',
            '--first-line-indent': currentTemplate.typography.firstLineIndent
          } as React.CSSProperties}
        >
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Page indicator (estimated from pagination store) */}
      <div className="fixed bottom-4 right-4 text-xs text-muted-foreground bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md border border-border">
        ~{totalPages} {totalPages === 1 ? 'page' : 'pages'}
      </div>
    </div>
  )
}
