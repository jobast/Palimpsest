import { useMemo } from 'react'
import type { Editor } from '@tiptap/react'
import { DOMSerializer } from '@tiptap/pm/model'
import type { PageTemplate } from '@shared/types/templates'
import type { PageInfo } from '@/stores/paginationStore'
import { PageHeader } from './PageHeader'
import { PageFooter } from './PageFooter'

interface PageRendererProps {
  pageInfo: PageInfo
  totalPages: number
  template: PageTemplate
  editor: Editor
  dims: {
    width: number
    height: number
    marginTop: number
    marginBottom: number
    marginLeft: number
    marginRight: number
    headerHeight: number
    footerHeight: number
  }
}

/**
 * Renders a single page with header, content, and footer
 */
export function PageRenderer({
  pageInfo,
  totalPages,
  template,
  editor,
  dims
}: PageRendererProps) {
  // Extract and render content for this specific page
  const { pageContent, chapterTitle } = useMemo(() => {
    const { startPos, endPos } = pageInfo
    const doc = editor.state.doc

    // Handle empty or invalid positions
    if (startPos >= doc.content.size || endPos <= startPos) {
      return { pageContent: '', chapterTitle: '' }
    }

    // Clamp positions to valid range
    const safeStart = Math.max(0, startPos)
    const safeEnd = Math.min(doc.content.size, endPos)

    try {
      // Create a slice of the document for this page
      const slice = doc.slice(safeStart, safeEnd)

      // Serialize the slice to HTML
      const serializer = DOMSerializer.fromSchema(editor.schema)
      const fragment = slice.content
      const container = document.createElement('div')
      container.appendChild(serializer.serializeFragment(fragment))

      // Find chapter title within this page's content
      let foundChapterTitle = ''
      doc.nodesBetween(safeStart, safeEnd, (node) => {
        if (node.type.name === 'chapterTitle' && !foundChapterTitle) {
          foundChapterTitle = node.textContent
        }
      })

      return {
        pageContent: container.innerHTML,
        chapterTitle: foundChapterTitle
      }
    } catch {
      return { pageContent: '', chapterTitle: '' }
    }
  }, [editor, pageInfo])

  return (
    <div
      className="page-container bg-paper relative flex flex-col"
      style={{
        width: `${dims.width}px`,
        height: `${dims.height}px`,
        padding: `${dims.marginTop}px ${dims.marginRight}px ${dims.marginBottom}px ${dims.marginLeft}px`,
        fontFamily: template.typography.fontFamily,
        fontSize: template.typography.fontSize,
        lineHeight: template.typography.lineHeight,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)',
        borderRadius: '2px',
        '--first-line-indent': template.typography.firstLineIndent
      } as React.CSSProperties}
    >
      {/* Header */}
      <PageHeader
        pageNumber={pageInfo.pageNumber}
        totalPages={totalPages}
        template={template}
        chapterTitle={chapterTitle}
      />

      {/* Content */}
      <div
        className="page-content flex-1 overflow-hidden manuscript-content"
        style={{
          color: 'hsl(var(--paper-foreground))'
        }}
        dangerouslySetInnerHTML={{ __html: pageContent }}
      />

      {/* Footer */}
      <PageFooter
        pageNumber={pageInfo.pageNumber}
        totalPages={totalPages}
        template={template}
      />
    </div>
  )
}
