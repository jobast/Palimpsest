import { useRef, useCallback, useState, useEffect, useMemo } from 'react'
import { EditorContent } from '@tiptap/react'
import { useEditorStore } from '@/stores/editorStore'
import { usePaginationStore } from '@/stores/paginationStore'
import { useUIStore } from '@/stores/uiStore'
import { ChevronUp, ChevronDown, ZoomIn, ZoomOut } from 'lucide-react'
import { PAGE_GAP } from '@/lib/pagination/constants'

// Number of pages to keep rendered before/after visible area
const BUFFER_PAGES = 2

// Approximate page height in pixels (for content-visibility intrinsic size)
// This should match the CSS for .rm-page-break height
const APPROX_PAGE_HEIGHT = 1123

/**
 * PagedEditor Component
 *
 * A paginated editor using tiptap-pagination-plus for automatic page breaks.
 * The extension handles all pagination logic, headers, footers, and page frames.
 *
 * This component provides:
 * - Scrollable container for the editor
 * - Zoom controls
 * - Page navigation
 * - Virtualized rendering for large documents (100,000+ words)
 */
export function PagedEditor() {
  const { editor, getEffectiveTypography } = useEditorStore()
  const effectiveTypography = getEffectiveTypography()
  const { currentPage, totalPages, setPages, setCurrentPage, setTotalPages } = usePaginationStore()
  const { zoomLevel, setZoomLevel, zoomIn, zoomOut, resetZoom } = useUIStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [showPageNav, setShowPageNav] = useState(false)

  // Track programmatic scrolling to prevent handleScroll from overwriting page number
  const isScrollingProgrammatically = useRef(false)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Virtualization: track which pages are in the visible range
  const [visibleRange, setVisibleRange] = useState({ start: 1, end: 3 })

  // Zoom scale factor
  const scale = zoomLevel / 100

  // Calculate page count from editor extension storage
  useEffect(() => {
    if (!editor) return

    const updatePageCount = () => {
      // tiptap-pagination-plus creates a .rm-page-break element for EACH page
      // So total pages = number of .rm-page-break elements
      requestAnimationFrame(() => {
        const editorElement = editor.view.dom as HTMLElement
        const pageBreaks = editorElement.querySelectorAll('.rm-page-break')
        const count = Math.max(1, pageBreaks.length)
        setTotalPages(count)

        // Sync page info for other components
        const pages = Array.from({ length: count }, (_, i) => ({
          pageNumber: i + 1,
          startPos: 0,
          endPos: 0,
          contentHeight: 0
        }))
        setPages(pages, [])
      })
    }

    // Update on content changes
    editor.on('update', updatePageCount)

    // Initial calculation - delay to let tiptap-pagination-plus render
    const initialTimer = setTimeout(updatePageCount, 100)

    return () => {
      editor.off('update', updatePageCount)
      clearTimeout(initialTimer)
    }
  }, [editor, setPages, setTotalPages])

  // Virtualization: IntersectionObserver to track visible pages
  useEffect(() => {
    if (!editor || totalPages <= 1) return

    const editorElement = editor.view.dom as HTMLElement
    const pageBreaks = editorElement.querySelectorAll('.rm-page-break')

    if (pageBreaks.length === 0) return

    // Track which pages are currently intersecting
    const visiblePages = new Set<number>()

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const pageNum = parseInt(entry.target.getAttribute('data-page') || '1', 10)

          if (entry.isIntersecting) {
            visiblePages.add(pageNum)
          } else {
            visiblePages.delete(pageNum)
          }
        })

        if (visiblePages.size > 0) {
          const minVisible = Math.min(...visiblePages)
          const maxVisible = Math.max(...visiblePages)

          setVisibleRange({
            start: Math.max(1, minVisible - BUFFER_PAGES),
            end: Math.min(totalPages, maxVisible + BUFFER_PAGES)
          })
        }
      },
      {
        root: containerRef.current,
        rootMargin: '200px 0px', // Start loading pages before they enter viewport
        threshold: 0.01 // Trigger when even 1% is visible
      }
    )

    // Add data-page attributes and observe each page break
    pageBreaks.forEach((el, i) => {
      el.setAttribute('data-page', String(i + 1))
      observer.observe(el)
    })

    return () => observer.disconnect()
  }, [editor, totalPages])

  // Virtualization: Generate CSS to hide off-screen pages
  const virtualizationStyle = useMemo(() => {
    // Only apply virtualization for documents with more than 10 pages
    if (totalPages <= 10) return null

    // Generate CSS rules to hide pages outside the visible range
    // Using content-visibility: hidden for performance
    const rules: string[] = []

    // Hide pages before visible range
    if (visibleRange.start > 1) {
      rules.push(`
        .rm-page-break:nth-child(-n+${visibleRange.start - 1}) {
          content-visibility: hidden;
          contain-intrinsic-size: 0 ${APPROX_PAGE_HEIGHT}px;
        }
      `)
    }

    // Hide pages after visible range
    if (visibleRange.end < totalPages) {
      rules.push(`
        .rm-page-break:nth-child(n+${visibleRange.end + 1}) {
          content-visibility: hidden;
          contain-intrinsic-size: 0 ${APPROX_PAGE_HEIGHT}px;
        }
      `)
    }

    return rules.length > 0 ? rules.join('\n') : null
  }, [visibleRange, totalPages])

  // Handle scroll to update current page indicator
  // Uses getBoundingClientRect for visual coordinates (works correctly with CSS transform)
  const handleScroll = useCallback(() => {
    // Skip updates during programmatic scrolling to prevent race conditions
    if (isScrollingProgrammatically.current) return
    if (!containerRef.current || !editor) return

    const editorElement = editor.view.dom as HTMLElement
    const pageBreaks = Array.from(editorElement.querySelectorAll('.rm-page-break'))

    if (pageBreaks.length === 0) {
      if (currentPage !== 1) setCurrentPage(1)
      return
    }

    const containerRect = containerRef.current.getBoundingClientRect()
    // The visual threshold line: top of container + padding + small margin for better detection
    const detectionMargin = 20 // Small margin to trigger page change slightly earlier
    const viewportTop = containerRect.top + PAGE_GAP + detectionMargin

    // Find which page we're viewing based on breaker positions
    let detectedPage = 1

    for (let i = 0; i < pageBreaks.length; i++) {
      const breaker = pageBreaks[i].querySelector('.breaker') as HTMLElement
      if (breaker) {
        const breakerRect = breaker.getBoundingClientRect()
        // If breaker bottom is above the viewport threshold, we've passed into the next page
        if (breakerRect.bottom < viewportTop) {
          detectedPage = i + 2 // breaker[0] → page 2, breaker[1] → page 3, etc.
        } else {
          break
        }
      }
    }

    const newPage = Math.min(detectedPage, totalPages)
    if (newPage !== currentPage) {
      setCurrentPage(newPage)
    }
  }, [editor, totalPages, currentPage, setCurrentPage])

  // Scroll to a specific page
  // Uses getBoundingClientRect for visual coordinates and computes scroll delta
  const scrollToPage = useCallback((pageNum: number) => {
    // Update current page IMMEDIATELY (don't wait for scroll to complete)
    setCurrentPage(pageNum)
    setShowPageNav(false)

    if (!containerRef.current || !editor) return

    // Prevent handleScroll from overwriting page number during animation
    isScrollingProgrammatically.current = true
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    // Re-enable after smooth scroll completes (approximate duration)
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingProgrammatically.current = false
    }, 500)

    // Page 1 = scroll to top
    if (pageNum === 1) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const editorElement = editor.view.dom as HTMLElement
    // .rm-page-break contains .page (marker) and .breaker (gap)
    // The actual page content starts AFTER the breaker
    const pageBreaks = Array.from(editorElement.querySelectorAll('.rm-page-break'))
    const breakIndex = pageNum - 2 // Page 2 → break[0], Page 3 → break[1]

    if (breakIndex >= 0 && breakIndex < pageBreaks.length) {
      const breaker = pageBreaks[breakIndex].querySelector('.breaker') as HTMLElement

      if (breaker) {
        const containerRect = containerRef.current.getBoundingClientRect()
        const breakerRect = breaker.getBoundingClientRect()

        // Current visual position of breaker bottom relative to container top
        const currentVisualPosition = breakerRect.bottom - containerRect.top
        // Target: we want breaker bottom at the padding line with slight adjustment for centering
        const scrollOffset = -15 // Negative = scroll slightly lower (page more centered)
        const targetVisualPosition = PAGE_GAP - scrollOffset
        // Scroll delta needed to move breaker to target position
        const scrollDelta = currentVisualPosition - targetVisualPosition
        // New absolute scroll position
        const targetScrollTop = containerRef.current.scrollTop + scrollDelta

        containerRef.current.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth'
        })
      }
    }
  }, [editor, setCurrentPage])

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

  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  if (!editor) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Chargement...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Virtualization CSS - dynamically hides off-screen pages */}
      {virtualizationStyle && (
        <style dangerouslySetInnerHTML={{ __html: virtualizationStyle }} />
      )}

      {/* Scrollable container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted"
        onScroll={handleScroll}
        style={{ paddingTop: PAGE_GAP, paddingBottom: PAGE_GAP }}
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

      {/* Bottom left controls: Zoom */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 z-10">
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
