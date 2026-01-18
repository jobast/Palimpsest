import { useEffect, useRef, useCallback } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { usePaginationStore } from '@/stores/paginationStore'
import { calculatePageBreaks, debounce } from '@/lib/pagination'

/**
 * Hook for managing pagination calculations
 *
 * Creates a hidden measurement container and recalculates page breaks
 * when the editor content or template changes.
 */
export function usePagination() {
  const { editor, currentTemplate, getEffectiveTypography, userTypographyOverrides } = useEditorStore()
  const { setPages, setIsCalculating, reset } = usePaginationStore()
  const measurementRef = useRef<HTMLDivElement | null>(null)

  // Create measurement container on mount
  useEffect(() => {
    if (!measurementRef.current) {
      const container = document.createElement('div')
      container.id = 'pagination-measurement-container'
      container.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        visibility: hidden;
        pointer-events: none;
      `
      document.body.appendChild(container)
      measurementRef.current = container
    }

    return () => {
      if (measurementRef.current) {
        document.body.removeChild(measurementRef.current)
        measurementRef.current = null
      }
    }
  }, [])

  // Debounced recalculation function
  const recalculate = useCallback(
    debounce(() => {
      if (!editor || !measurementRef.current) {
        return
      }

      // Don't calculate if editor is empty
      if (editor.state.doc.content.size <= 2) {
        reset()
        return
      }

      setIsCalculating(true)

      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        try {
          const result = calculatePageBreaks({
            template: currentTemplate,
            editor,
            measurementContainer: measurementRef.current!,
            effectiveTypography: getEffectiveTypography()
          })

          setPages(result.pages)

          // Force editor to re-render decorations by dispatching a no-op transaction
          // This ensures PageBreakDecorations plugin updates with new positions
          if (editor.view) {
            const tr = editor.state.tr.setMeta('pagination', true)
            editor.view.dispatch(tr)
          }
        } catch (error) {
          console.error('Pagination calculation failed:', error)
          reset()
        } finally {
          setIsCalculating(false)
        }
      })
    }, 200), // 200ms debounce
    [editor, currentTemplate, getEffectiveTypography, setPages, setIsCalculating, reset]
  )

  // Recalculate on content change
  useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      recalculate()
    }

    editor.on('update', handleUpdate)

    // Initial calculation
    recalculate()

    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor, recalculate])

  // Recalculate on template or typography override change
  useEffect(() => {
    recalculate()
  }, [currentTemplate, userTypographyOverrides, recalculate])

  return {
    measurementRef,
    recalculate
  }
}
