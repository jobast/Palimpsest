import { useRef, useCallback, useState, useEffect } from 'react'
import { EditorContent } from '@tiptap/react'
import { useEditorStore } from '@/stores/editorStore'
import { usePaginationStore } from '@/stores/paginationStore'
import { useUIStore } from '@/stores/uiStore'
import { ChevronUp, ChevronDown, ZoomIn, ZoomOut } from 'lucide-react'
import { ViewModeToggle } from './ViewModeToggle'

/**
 * PagedEditor Component
 *
 * A paginated editor using hugs7/tiptap-extension-pagination for automatic page breaks.
 * The extension handles all pagination logic, headers, footers, and page frames.
 *
 * This component provides:
 * - Scrollable container for the editor
 * - Zoom controls
 * - Page navigation
 */
export function PagedEditor() {
  const { editor, getEffectiveTypography } = useEditorStore()
  const effectiveTypography = getEffectiveTypography()
  const { setPages, setCurrentPage: setStorePage } = usePaginationStore()
  const { zoomLevel, setZoomLevel, zoomIn, zoomOut, resetZoom } = useUIStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showPageNav, setShowPageNav] = useState(false)

  // Zoom scale factor
  const scale = zoomLevel / 100

  // Calculate page count from editor extension storage
  useEffect(() => {
    if (!editor) return

    const updatePageCount = () => {
      // hugs7/tiptap-extension-pagination uses PageNode with data-page attribute
      const editorElement = editor.view.dom as HTMLElement
      const pageNodes = editorElement.querySelectorAll('[data-page="true"]')
      const count = Math.max(1, pageNodes.length)
      setTotalPages(count)

      // Sync with pagination store for other components
      const pages = Array.from({ length: count }, (_, i) => ({
        pageNumber: i + 1,
        startPos: 0,
        endPos: 0,
        contentHeight: 0
      }))
      setPages(pages, [])
    }

    // Update on content changes
    editor.on('update', updatePageCount)

    // Initial calculation - delay slightly to allow DOM to render
    setTimeout(updatePageCount, 100)

    return () => {
      editor.off('update', updatePageCount)
    }
  }, [editor, setPages])

  // Handle scroll to update current page indicator
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !editor) return

    // Find page nodes and determine which page we're viewing
    const editorElement = editor.view.dom as HTMLElement
    const pageNodes = editorElement.querySelectorAll('[data-page="true"]')
    const containerScroll = containerRef.current.scrollTop
    const containerRect = containerRef.current.getBoundingClientRect()

    let page = 1
    pageNodes.forEach((pageEl, index) => {
      const pageRect = pageEl.getBoundingClientRect()
      const pageTop = pageRect.top - containerRect.top + containerScroll
      // Consider we're on this page if its top is near or above the viewport center
      if (containerScroll >= pageTop - containerRect.height / 2) {
        page = index + 1
      }
    })

    const newPage = Math.min(Math.max(1, page), Math.max(1, totalPages))
    setCurrentPage(newPage)
    setStorePage(newPage) // Sync with store
  }, [editor, totalPages, setStorePage])

  // Scroll to a specific page
  const scrollToPage = useCallback((pageNum: number) => {
    if (!containerRef.current || !editor) return

    const editorElement = editor.view.dom as HTMLElement
    const pageNodes = editorElement.querySelectorAll('[data-page="true"]')

    const targetPage = pageNodes[pageNum - 1] // 0-indexed array
    if (targetPage) {
      const pageRect = targetPage.getBoundingClientRect()
      const containerRect = containerRef.current.getBoundingClientRect()
      const scrollTop = containerRef.current.scrollTop + (pageRect.top - containerRect.top) - 40
      containerRef.current.scrollTo({ top: scrollTop, behavior: 'smooth' })
    } else if (pageNum === 1) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setShowPageNav(false)
  }, [editor])

  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) scrollToPage(currentPage - 1)
  }, [currentPage, scrollToPage])

  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) scrollToPage(currentPage + 1)
  }, [currentPage, totalPages, scrollToPage])

  // Generate page numbers array
  const pageNumbers = Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1)

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
        {/* Zoom wrapper - centers and scales the editor */}
        <div
          className="flex justify-center"
          style={{
            width: '100%',
            minHeight: '100%',
          }}
        >
          {/* Editor container with zoom transform */}
          <div
            className="manuscript-content pagination-plus-container"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              fontFamily: effectiveTypography.fontFamily,
              fontSize: effectiveTypography.fontSize,
              lineHeight: effectiveTypography.lineHeight,
              '--first-line-indent': effectiveTypography.firstLineIndent,
            } as React.CSSProperties}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* Floating page navigator and zoom controls */}
      {totalPages > 0 && (
        <div className="absolute bottom-4 right-4 flex items-center gap-1 z-10">
          <button
            onClick={goToPreviousPage}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-lg bg-card border border-border shadow-md hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Page pr\u00e9c\u00e9dente"
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

      {/* Bottom left controls: View mode toggle + Zoom */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 z-10">
        {/* View mode toggle */}
        <ViewModeToggle />

        {/* Zoom controls */}
        <button
          onClick={zoomOut}
          disabled={zoomLevel <= 50}
          className="p-1.5 rounded-lg bg-card border border-border shadow-md hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Zoom arri\u00e8re"
        >
          <ZoomOut size={16} />
        </button>

        <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-card border border-border shadow-md">
          <input
            type="range"
            min={50}
            max={200}
            step={10}
            value={zoomLevel}
            onChange={(e) => setZoomLevel(Number(e.target.value))}
            className="w-24 h-1.5 accent-primary cursor-pointer"
            title={`Zoom: ${zoomLevel}%`}
          />
          <button
            onClick={resetZoom}
            className="text-xs font-medium text-muted-foreground hover:text-foreground min-w-[40px] text-center"
            title="R\u00e9initialiser le zoom"
          >
            {zoomLevel}%
          </button>
        </div>

        <button
          onClick={zoomIn}
          disabled={zoomLevel >= 200}
          className="p-1.5 rounded-lg bg-card border border-border shadow-md hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Zoom avant"
        >
          <ZoomIn size={16} />
        </button>
      </div>
    </div>
  )
}
