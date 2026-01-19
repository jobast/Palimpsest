import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { EditorContent } from '@tiptap/react'
import { useEditorStore } from '@/stores/editorStore'
import { usePaginationStore } from '@/stores/paginationStore'
import { useUIStore } from '@/stores/uiStore'
import { getPageDimensions } from '@/lib/pagination'
import { ChevronUp, ChevronDown, Scissors, Copy, ClipboardPaste, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, Minus, MessageSquareQuote, ZoomIn, ZoomOut, Plus } from 'lucide-react'
import type { SpellCheckContext } from '@shared/types/electron'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  ContextMenuShortcut,
} from '@/components/ui/ContextMenu'
import { ViewModeToggle } from './ViewModeToggle'

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
  const { editor, currentTemplate, getEffectiveTypography } = useEditorStore()
  const effectiveTypography = getEffectiveTypography()
  const { totalPages, currentPage, setCurrentPage } = usePaginationStore()
  const { zoomLevel, setZoomLevel, zoomIn, zoomOut, resetZoom } = useUIStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [showPageNav, setShowPageNav] = useState(false)
  const [hasSelection, setHasSelection] = useState(false)
  const [spellCheck, setSpellCheck] = useState<SpellCheckContext | null>(null)

  // Zoom scale factor
  const scale = zoomLevel / 100

  // Listen for spell check context from main process
  useEffect(() => {
    if (window.electronAPI?.onSpellCheckContext) {
      window.electronAPI.onSpellCheckContext((data) => {
        setSpellCheck(data)
      })
    }

    return () => {
      if (window.electronAPI?.removeSpellCheckListener) {
        window.electronAPI.removeSpellCheckListener()
      }
    }
  }, [])

  // Track if editor has text selection
  useEffect(() => {
    if (!editor) return

    const updateSelection = () => {
      const { from, to } = editor.state.selection
      setHasSelection(from !== to)
    }

    editor.on('selectionUpdate', updateSelection)
    editor.on('transaction', updateSelection)

    return () => {
      editor.off('selectionUpdate', updateSelection)
      editor.off('transaction', updateSelection)
    }
  }, [editor])

  // Context menu actions
  const handleCut = useCallback(() => {
    if (!editor) return
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to)
    navigator.clipboard.writeText(text)
    editor.chain().focus().deleteSelection().run()
  }, [editor])

  const handleCopy = useCallback(() => {
    if (!editor) return
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to)
    navigator.clipboard.writeText(text)
  }, [editor])

  const handlePaste = useCallback(async () => {
    if (!editor) return
    const text = await navigator.clipboard.readText()
    editor.chain().focus().insertContent(text).run()
  }, [editor])

  const handleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run()
  }, [editor])

  const handleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run()
  }, [editor])

  const handleUnderline = useCallback(() => {
    editor?.chain().focus().toggleUnderline().run()
  }, [editor])

  const handleAlign = useCallback((align: 'left' | 'center' | 'right' | 'justify') => {
    editor?.chain().focus().setTextAlign(align).run()
  }, [editor])

  const handleInsertSceneBreak = useCallback(() => {
    editor?.chain().focus().insertContent('<p style="text-align: center">* * *</p>').run()
  }, [editor])

  const handleInsertDialogueDash = useCallback(() => {
    editor?.chain().focus().insertContent('— ').run()
  }, [editor])

  // Spell check handlers
  const handleReplaceWord = useCallback((suggestion: string) => {
    window.electronAPI?.replaceMisspelling(suggestion)
    setSpellCheck(null)
  }, [])

  const handleAddToDictionary = useCallback(() => {
    if (spellCheck?.misspelledWord) {
      window.electronAPI?.addToDictionary(spellCheck.misspelledWord)
    }
    setSpellCheck(null)
  }, [spellCheck])

  // Clear spell check when menu closes
  const handleMenuOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSpellCheck(null)
    }
  }, [])

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
        {/* Zoom wrapper - centers and scales the pages */}
        <div
          className="flex justify-center"
          style={{
            width: '100%',
            minHeight: totalHeight * scale + 80,
          }}
        >
          {/* Pages container - holds all page frames and editor content */}
          <div
            className="relative"
            style={{
              width: dims.width,
              height: totalHeight,
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
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
          <ContextMenu onOpenChange={handleMenuOpenChange}>
            <ContextMenuTrigger asChild>
              <div
                className="absolute manuscript-content"
                style={{
                  top: dims.marginTop + headerHeight,
                  left: dims.marginLeft,
                  width: dims.width - dims.marginLeft - dims.marginRight,
                  fontFamily: effectiveTypography.fontFamily,
                  fontSize: effectiveTypography.fontSize,
                  lineHeight: effectiveTypography.lineHeight,
                  color: 'hsl(var(--paper-foreground))',
                  '--first-line-indent': effectiveTypography.firstLineIndent,
                } as React.CSSProperties}
              >
                <EditorContent editor={editor} />
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-56">
              {/* Spell check suggestions */}
              {spellCheck && spellCheck.suggestions.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                    Orthographe : « {spellCheck.misspelledWord} »
                  </div>
                  {spellCheck.suggestions.slice(0, 5).map((suggestion) => (
                    <ContextMenuItem
                      key={suggestion}
                      onSelect={() => handleReplaceWord(suggestion)}
                      className="font-medium"
                    >
                      {suggestion}
                    </ContextMenuItem>
                  ))}
                  <ContextMenuItem onSelect={handleAddToDictionary}>
                    <Plus className="mr-2 h-4 w-4" />
                    Ajouter au dictionnaire
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                </>
              )}

              {/* Clipboard actions */}
              {hasSelection && (
                <>
                  <ContextMenuItem onSelect={handleCut}>
                    <Scissors className="mr-2 h-4 w-4" />
                    Couper
                    <ContextMenuShortcut>⌘X</ContextMenuShortcut>
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={handleCopy}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copier
                    <ContextMenuShortcut>⌘C</ContextMenuShortcut>
                  </ContextMenuItem>
                </>
              )}
              <ContextMenuItem onSelect={handlePaste}>
                <ClipboardPaste className="mr-2 h-4 w-4" />
                Coller
                <ContextMenuShortcut>⌘V</ContextMenuShortcut>
              </ContextMenuItem>

              {/* Formatting actions - only with selection */}
              {hasSelection && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem onSelect={handleBold}>
                    <Bold className="mr-2 h-4 w-4" />
                    Gras
                    <ContextMenuShortcut>⌘B</ContextMenuShortcut>
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={handleItalic}>
                    <Italic className="mr-2 h-4 w-4" />
                    Italique
                    <ContextMenuShortcut>⌘I</ContextMenuShortcut>
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={handleUnderline}>
                    <Underline className="mr-2 h-4 w-4" />
                    Souligne
                    <ContextMenuShortcut>⌘U</ContextMenuShortcut>
                  </ContextMenuItem>

                  <ContextMenuSeparator />
                  <ContextMenuSub>
                    <ContextMenuSubTrigger>
                      <AlignLeft className="mr-2 h-4 w-4" />
                      Alignement
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                      <ContextMenuItem onSelect={() => handleAlign('left')}>
                        <AlignLeft className="mr-2 h-4 w-4" />
                        Gauche
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={() => handleAlign('center')}>
                        <AlignCenter className="mr-2 h-4 w-4" />
                        Centre
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={() => handleAlign('right')}>
                        <AlignRight className="mr-2 h-4 w-4" />
                        Droite
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={() => handleAlign('justify')}>
                        <AlignJustify className="mr-2 h-4 w-4" />
                        Justifie
                      </ContextMenuItem>
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                </>
              )}

              {/* Insert actions */}
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={handleInsertSceneBreak}>
                <Minus className="mr-2 h-4 w-4" />
                Inserer saut de scene
              </ContextMenuItem>
              <ContextMenuItem onSelect={handleInsertDialogueDash}>
                <MessageSquareQuote className="mr-2 h-4 w-4" />
                Inserer tiret de dialogue
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
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

      {/* Bottom left controls: View mode toggle + Zoom */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 z-10">
        {/* View mode toggle */}
        <ViewModeToggle />

        {/* Zoom controls */}
        <button
          onClick={zoomOut}
          disabled={zoomLevel <= 50}
          className="p-1.5 rounded-lg bg-card border border-border shadow-md hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Zoom arrière"
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
            title="Réinitialiser le zoom"
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
