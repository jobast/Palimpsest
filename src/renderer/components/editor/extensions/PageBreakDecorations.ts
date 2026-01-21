import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { usePaginationStore } from '@/stores/paginationStore'

export interface PageBreakDecorationsOptions {
  enabled: boolean
}

const pageBreakPluginKey = new PluginKey('pageBreakDecorations')

/**
 * PageBreakDecorations Extension
 *
 * Adds vertical space at page break positions so content flows correctly
 * through the page frames rendered by PagedEditor.
 *
 * The page frames (with headers/footers) are rendered as overlays.
 * This extension adds the vertical space needed for content to align
 * with the content areas of each page frame.
 *
 * Spacer heights are pre-calculated in pageBreakCalculator.ts to ensure
 * correct alignment even with oversized nodes that span multiple pages.
 */
export const PageBreakDecorations = Extension.create<PageBreakDecorationsOptions>({
  name: 'pageBreakDecorations',

  addOptions() {
    return {
      enabled: true
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pageBreakPluginKey,

        props: {
          decorations(state) {
            // Read current state from store
            const { pageBreaks, isCalculating } = usePaginationStore.getState()

            // Don't render decorations while recalculating (prevents glitches during template changes)
            if (isCalculating) {
              return DecorationSet.empty
            }

            if (!pageBreaks || pageBreaks.length === 0) {
              return DecorationSet.empty
            }

            const decorations: Decoration[] = []
            const doc = state.doc

            pageBreaks.forEach((pageBreak, index) => {
              const { position, spacerHeight } = pageBreak

              // Ensure position is valid and within document bounds
              if (position <= 0 || position >= doc.content.size) return

              const widget = Decoration.widget(position, () => {
                const spacer = document.createElement('div')
                spacer.className = 'page-break-spacer'
                spacer.setAttribute('contenteditable', 'false')
                spacer.style.cssText = `
                  height: ${spacerHeight}px;
                  width: 100%;
                  user-select: none;
                  pointer-events: none;
                `
                return spacer
              }, {
                side: 0,
                key: `page-break-${index}`
              })

              decorations.push(widget)
            })

            return DecorationSet.create(doc, decorations)
          }
        }
      })
    ]
  }
})
