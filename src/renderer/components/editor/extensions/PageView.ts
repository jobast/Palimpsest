import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface PageViewOptions {
  pageHeight: number // in pixels
  pageWidth: number
  marginTop: number
  marginBottom: number
  lineHeight: number
  fontSize: number
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageView: {
      setPageDimensions: (options: Partial<PageViewOptions>) => ReturnType
    }
  }
}

export const pageViewPluginKey = new PluginKey('pageView')

export const PageView = Extension.create<PageViewOptions>({
  name: 'pageView',

  addOptions() {
    return {
      pageHeight: 842, // A4 height in pixels at 96dpi
      pageWidth: 595,
      marginTop: 72,
      marginBottom: 72,
      lineHeight: 24,
      fontSize: 12
    }
  },

  addCommands() {
    return {
      setPageDimensions:
        (options) =>
        ({ editor }) => {
          const newOptions = { ...this.options, ...options }
          Object.assign(this.options, newOptions)
          editor.view.dispatch(editor.state.tr)
          return true
        }
    }
  },

  addProseMirrorPlugins() {
    const extension = this

    return [
      new Plugin({
        key: pageViewPluginKey,
        props: {
          decorations(state) {
            const { doc } = state
            const decorations: Decoration[] = []

            // Calculate content height and add page break decorations
            const contentHeight = extension.options.pageHeight -
              extension.options.marginTop -
              extension.options.marginBottom

            let currentHeight = 0
            let pageNumber = 1

            doc.descendants((node, pos) => {
              if (node.isBlock) {
                // Estimate node height based on content
                const nodeHeight = estimateNodeHeight(node, extension.options)

                if (currentHeight + nodeHeight > contentHeight && currentHeight > 0) {
                  // Add page break decoration
                  decorations.push(
                    Decoration.widget(pos, () => {
                      const pageBreak = document.createElement('div')
                      pageBreak.className = 'page-break'
                      pageBreak.setAttribute('data-page', String(pageNumber))
                      return pageBreak
                    }, { side: -1 })
                  )
                  pageNumber++
                  currentHeight = nodeHeight
                } else {
                  currentHeight += nodeHeight
                }
              }
              return true
            })

            return DecorationSet.create(doc, decorations)
          }
        }
      })
    ]
  }
})

function estimateNodeHeight(
  node: { textContent: string; type: { name: string } },
  options: PageViewOptions
): number {
  const { lineHeight, fontSize, pageWidth } = options
  const contentWidth = pageWidth - 144 // Approximate margins (left + right)

  // Base height for the node
  let height = lineHeight

  // Estimate based on text length
  if (node.textContent) {
    const charsPerLine = Math.floor(contentWidth / (fontSize * 0.6))
    const lines = Math.ceil(node.textContent.length / charsPerLine) || 1
    height = lines * lineHeight
  }

  // Add extra space for headings
  if (node.type.name === 'heading') {
    height += lineHeight
  }

  // Add paragraph spacing
  height += lineHeight * 0.5

  return height
}
