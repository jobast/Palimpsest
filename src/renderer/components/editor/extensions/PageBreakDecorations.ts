import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { usePaginationStore } from '@/stores/paginationStore'
import { useEditorStore } from '@/stores/editorStore'
import { getPageDimensions } from '@/lib/pagination'

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
            // Read current state from stores
            const { pageBreakPositions, pages } = usePaginationStore.getState()
            const { currentTemplate } = useEditorStore.getState()

            if (!pageBreakPositions || pageBreakPositions.length === 0) {
              return DecorationSet.empty
            }

            // Get dimensions from current template
            const dims = getPageDimensions(currentTemplate)
            const headerHeight = currentTemplate.header?.show ? 40 : 0
            const footerHeight = currentTemplate.footer?.show ? 40 : 0
            const pageGap = 40

            const decorations: Decoration[] = []
            const doc = state.doc

            // Space between page content areas:
            // - Bottom margin + footer of current page
            // - Gap between pages
            // - Top margin + header of next page
            const interPageSpace =
              dims.marginBottom + footerHeight +
              pageGap +
              dims.marginTop + headerHeight

            pageBreakPositions.forEach((pos, index) => {
              // Ensure position is valid and within document bounds
              if (pos <= 0 || pos >= doc.content.size) return

              // Calculate remaining whitespace on the ending page
              const endingPage = pages[index]
              const pageContentHeight = endingPage?.contentHeight || 0
              const maxContentHeight = dims.contentHeight
              const remainingSpace = Math.max(0, maxContentHeight - pageContentHeight)

              // Total vertical space to add
              const totalSpace = remainingSpace + interPageSpace

              const widget = Decoration.widget(pos, () => {
                const spacer = document.createElement('div')
                spacer.className = 'page-break-spacer'
                spacer.setAttribute('contenteditable', 'false')
                spacer.style.cssText = `
                  height: ${totalSpace}px;
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
