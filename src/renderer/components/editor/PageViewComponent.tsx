import { useEffect, useRef, useCallback, useState } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { usePaginationStore } from '@/stores/paginationStore'
import { PageRenderer } from './PageRenderer'
import { getPageDimensions, PAGE_GAP } from '@/lib/pagination'
import { ChevronUp, ChevronDown } from 'lucide-react'

/**
 * Page View Component
 * Displays the document as distinct pages with gaps between them
 * Read-only preview mode for visualizing the final layout
 */
export function PageViewComponent() {
  const { editor, currentTemplate } = useEditorStore()
  const { pages, totalPages, currentPage, setCurrentPage } = usePaginationStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [showPageSelector, setShowPageSelector] = useState(false)

  // Get page dimensions from template
  const dims = getPageDimensions(currentTemplate)

  // Handle scroll to update current page indicator
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return

    const scrollTop = containerRef.current.scrollTop
    const pageWithGap = dims.height + PAGE_GAP

    // Calculate which page is most visible
    const page = Math.floor((scrollTop + dims.height / 2) / pageWithGap) + 1
    setCurrentPage(Math.min(Math.max(1, page), totalPages))
  }, [dims.height, totalPages, setCurrentPage])

  // Scroll to a specific page
  const scrollToPage = useCallback((pageNum: number) => {
    if (!containerRef.current) return
    const pageWithGap = dims.height + PAGE_GAP
    containerRef.current.scrollTo({
      top: (pageNum - 1) * pageWithGap,
      behavior: 'smooth'
    })
    setShowPageSelector(false)
  }, [dims.height])

  // Navigate to previous/next page
  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) scrollToPage(currentPage - 1)
  }, [currentPage, scrollToPage])

  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) scrollToPage(currentPage + 1)
  }, [currentPage, totalPages, scrollToPage])

  // Listen for scroll-to-page events (from page indicator clicks, etc.)
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
      {/* Scrollable pages container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/30 py-8"
        onScroll={handleScroll}
      >
        {/* Pages container with gap */}
        <div
          className="flex flex-col items-center"
          style={{ gap: `${PAGE_GAP}px` }}
        >
          {pages.map((pageInfo) => (
            <PageRenderer
              key={pageInfo.pageNumber}
              pageInfo={pageInfo}
              totalPages={totalPages}
              template={currentTemplate}
              editor={editor}
              dims={dims}
            />
          ))}
        </div>
      </div>

      {/* Floating page indicator */}
      {totalPages > 0 && (
        <div className="absolute bottom-4 right-4 flex items-center gap-1">
          {/* Previous page button */}
          <button
            onClick={goToPreviousPage}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-lg bg-card border border-border shadow-md hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Page précédente"
          >
            <ChevronUp size={16} />
          </button>

          {/* Page indicator with dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPageSelector(!showPageSelector)}
              className="px-3 py-1.5 rounded-lg bg-card border border-border shadow-md hover:bg-accent transition-colors text-sm font-medium min-w-[100px]"
            >
              Page {currentPage} sur {totalPages}
            </button>

            {/* Page selector dropdown */}
            {showPageSelector && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowPageSelector(false)}
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

          {/* Next page button */}
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
