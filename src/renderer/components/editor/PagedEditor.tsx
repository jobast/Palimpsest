import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { EditorContent } from '@tiptap/react'
import { useEditorStore } from '@/stores/editorStore'
import { usePaginationStore } from '@/stores/paginationStore'
import { getPageDimensions } from '@/lib/pagination'
import { ChevronUp, ChevronDown } from 'lucide-react'

/**
 * PagedEditor Component
 *
 * A fully editable paginated editor with fixed-size pages.
 *
 * Architecture:
 * - Page frames rendered for each page (visual containers with headers/footers)
 * - Single EditorContent positioned to flow through page frames
 * - PageBreakDecorations add vertical space between pages
 * - Page frames are pointer-events: none so clicks reach the editor
 */
export function PagedEditor() {
  const { editor, currentTemplate } = useEditorStore()
  const { totalPages, currentPage, setCurrentPage } = usePaginationStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [showPageNav, setShowPageNav] = useState(false)

  // Get page dimensions from template
  const dims = useMemo(() => {
    return getPageDimensions(currentTemplate)
  }, [currentTemplate])

  const headerHeight = currentTemplate.header?.show ? 40 : 0
  const footerHeight = currentTemplate.footer?.show ? 40 : 0
  const pageGap = 40

  // Calculate total height needed for all pages
  const totalHeight = useMemo(() => {
    return totalPages * dims.height + (totalPages - 1) * pageGap
  }, [totalPages, dims.height, pageGap])

  // Calculate position of each page
  const getPageTop = useCallback((pageNum: number) => {
    return (pageNum - 1) * (dims.height + pageGap)
  }, [dims.height, pageGap])

  // Handle scroll to update current page indicator
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !editor) return

    const scrollTop = containerRef.current.scrollTop
    const pageHeight = dims.height + pageGap
    const page = Math.floor(scrollTop / pageHeight) + 1
    setCurrentPage(Math.min(Math.max(1, page), Math.max(1, totalPages)))
  }, [editor, dims.height, pageGap, totalPages, setCurrentPage])

  // Scroll to a specific page
  const scrollToPage = useCallback((pageNum: number) => {
    if (!containerRef.current) return
    containerRef.current.scrollTo({
      top: getPageTop(pageNum),
      behavior: 'smooth'
    })
    setShowPageNav(false)
  }, [getPageTop])

  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) scrollToPage(currentPage - 1)
  }, [currentPage, scrollToPage])

  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) scrollToPage(currentPage + 1)
  }, [currentPage, totalPages, scrollToPage])

  // Generate page numbers array
  const pageNumbers = useMemo(() =>
    Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1),
    [totalPages]
  )

  // Listen for scroll-to-page events
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
        className="flex-1 overflow-auto bg-muted"
        onScroll={handleScroll}
        style={{ paddingTop: 40, paddingBottom: 40 }}
      >
        {/* Pages container - holds all page frames and editor content */}
        <div
          className="relative mx-auto"
          style={{
            width: dims.width,
            height: totalHeight,
          }}
        >
          {/* Page frames - visual containers for each page */}
          {pageNumbers.map((pageNum) => (
            <div
              key={pageNum}
              className="absolute bg-paper pointer-events-none"
              style={{
                top: getPageTop(pageNum),
                left: 0,
                width: dims.width,
                height: dims.height,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.1)',
                borderRadius: 3,
              }}
            >
              {/* Page header */}
              {currentTemplate.header?.show && (
                <div
                  className="absolute top-0 left-0 right-0 flex items-end text-muted-foreground"
                  style={{
                    height: dims.marginTop + headerHeight,
                    padding: `${dims.marginTop / 2}px ${dims.marginRight}px 8px ${dims.marginLeft}px`,
                    fontFamily: currentTemplate.typography.fontFamily,
                    fontSize: currentTemplate.header?.fontSize || '10pt',
                    justifyContent: pageNum % 2 === 0 ? 'flex-start' : 'flex-end',
                    borderBottom: '1px solid hsl(var(--border) / 0.2)',
                  }}
                >
                  <span>
                    {currentTemplate.header?.content
                      ?.replace('{page}', String(pageNum))
                      .replace('{total}', String(totalPages)) || ''}
                  </span>
                </div>
              )}

              {/* Page footer */}
              {currentTemplate.footer?.show && (
                <div
                  className="absolute bottom-0 left-0 right-0 flex items-center justify-center text-muted-foreground"
                  style={{
                    height: dims.marginBottom + footerHeight,
                    padding: `8px ${dims.marginRight}px ${dims.marginBottom / 2}px ${dims.marginLeft}px`,
                    fontFamily: currentTemplate.typography.fontFamily,
                    fontSize: currentTemplate.footer?.fontSize || '10pt',
                    borderTop: '1px solid hsl(var(--border) / 0.2)',
                  }}
                >
                  {currentTemplate.footer.showPageNumber && <span>{pageNum}</span>}
                </div>
              )}
            </div>
          ))}

          {/* Editor content - positioned to flow through page content areas */}
          <div
            className="absolute manuscript-content"
            style={{
              top: dims.marginTop + headerHeight,
              left: dims.marginLeft,
              width: dims.width - dims.marginLeft - dims.marginRight,
              fontFamily: currentTemplate.typography.fontFamily,
              fontSize: currentTemplate.typography.fontSize,
              lineHeight: currentTemplate.typography.lineHeight,
              color: 'hsl(var(--paper-foreground))',
              '--first-line-indent': currentTemplate.typography.firstLineIndent,
            } as React.CSSProperties}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* Floating page navigator */}
      {totalPages > 0 && (
        <div className="absolute bottom-4 right-4 flex items-center gap-1 z-10">
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
                  {pageNumbers.map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => scrollToPage(pageNum)}
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors ${
                        pageNum === currentPage ? 'bg-accent text-primary font-medium' : ''
                      }`}
                    >
                      Page {pageNum}
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
