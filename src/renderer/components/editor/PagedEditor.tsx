import { useRef, useEffect, useCallback, useState } from 'react'
import { EditorContent } from '@tiptap/react'
import { useEditorStore } from '@/stores/editorStore'
import { usePaginationStore } from '@/stores/paginationStore'
import { getPageDimensions } from '@/lib/pagination'
import { PageHeader } from './PageHeader'
import { PageFooter } from './PageFooter'
import { ChevronUp, ChevronDown } from 'lucide-react'

/**
 * PagedEditor Component
 *
 * Editable paginated editor that shows content within page boundaries.
 * Combines the editing experience with page visualization.
 */
export function PagedEditor() {
  const { editor, currentTemplate } = useEditorStore()
  const { pages, totalPages, currentPage, setCurrentPage } = usePaginationStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [showPageNav, setShowPageNav] = useState(false)

  // Get page dimensions from template
  const dims = getPageDimensions(currentTemplate)

  // Handle scroll to update current page indicator
  const handleScroll = useCallback(() => {
    if (!containerRef.current || totalPages === 0) return

    const scrollTop = containerRef.current.scrollTop
    const pageWithGap = dims.height + 48

    const page = Math.floor((scrollTop + dims.height / 2) / pageWithGap) + 1
    setCurrentPage(Math.min(Math.max(1, page), totalPages))
  }, [dims.height, totalPages, setCurrentPage])

  // Scroll to a specific page
  const scrollToPage = useCallback((pageNum: number) => {
    if (!containerRef.current) return
    const pageWithGap = dims.height + 48
    containerRef.current.scrollTo({
      top: (pageNum - 1) * pageWithGap,
      behavior: 'smooth'
    })
    setShowPageNav(false)
  }, [dims.height])

  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) scrollToPage(currentPage - 1)
  }, [currentPage, scrollToPage])

  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) scrollToPage(currentPage + 1)
  }, [currentPage, totalPages, scrollToPage])

  // Listen for scroll-to-page events from sidebar
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ page: number }>
      scrollToPage(customEvent.detail.page)
    }

    window.addEventListener('palimpseste:scrollToPage', handler)
    return () => window.removeEventListener('palimpseste:scrollToPage', handler)
  }, [scrollToPage])

  if (!editor) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Chargement...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Scrollable container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/30 py-8"
        onScroll={handleScroll}
      >
        {/* Centered page container */}
        <div className="flex flex-col items-center" style={{ gap: '48px' }}>
          {/* Page with editor */}
          <div
            className="page-container bg-paper relative flex flex-col"
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
            {/* Header */}
            <PageHeader
              pageNumber={1}
              totalPages={totalPages}
              template={currentTemplate}
            />

            {/* Editable content area */}
            <div
              className="page-content flex-1 manuscript-content"
              style={{ color: 'hsl(var(--paper-foreground))' }}
            >
              <EditorContent editor={editor} />
            </div>

            {/* Footer */}
            <PageFooter
              pageNumber={1}
              totalPages={totalPages}
              template={currentTemplate}
            />
          </div>

          {/* Visual page break indicators */}
          {pages.slice(1).map((pageInfo) => (
            <div
              key={pageInfo.pageNumber}
              className="relative flex items-center justify-center"
              style={{ width: `${dims.width}px` }}
            >
              <div className="absolute inset-x-0 border-t-2 border-dashed border-primary/30" />
              <span className="relative bg-primary/10 text-primary px-4 py-1 rounded-full text-xs font-medium">
                Page {pageInfo.pageNumber}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Floating page navigator */}
      {totalPages > 0 && (
        <div className="absolute bottom-4 right-4 flex items-center gap-1">
          <button
            onClick={goToPreviousPage}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-lg bg-card border border-border shadow-md hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Page précédente"
          >
            <ChevronUp size={16} />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowPageNav(!showPageNav)}
              className="px-3 py-1.5 rounded-lg bg-card border border-border shadow-md hover:bg-accent transition-colors text-sm font-medium min-w-[100px]"
            >
              Page {currentPage} sur {totalPages}
            </button>

            {showPageNav && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowPageNav(false)}
                />
                <div className="absolute bottom-full mb-2 right-0 z-20 bg-card border border-border rounded-lg shadow-lg py-1 max-h-64 overflow-auto min-w-[120px]">
                  {pages.map((pageInfo) => (
                    <button
                      key={pageInfo.pageNumber}
                      onClick={() => scrollToPage(pageInfo.pageNumber)}
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors ${
                        pageInfo.pageNumber === currentPage ? 'bg-accent text-primary font-medium' : ''
                      }`}
                    >
                      Page {pageInfo.pageNumber}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={goToNextPage}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded-lg bg-card border border-border shadow-md hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Page suivante"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
