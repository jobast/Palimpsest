import { useMemo } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import type { PageTemplate } from '@shared/types/templates'

interface PageHeaderProps {
  pageNumber: number
  totalPages: number
  template: PageTemplate
  chapterTitle?: string
}

/**
 * Page header component
 * Renders the header content with token replacement
 * Supports: {title}, {author}, {chapter}, {page}, {total}
 */
export function PageHeader({
  pageNumber,
  totalPages,
  template,
  chapterTitle
}: PageHeaderProps) {
  const { project } = useProjectStore()

  // Parse header content with placeholder replacement
  // Note: useMemo must be called before any early returns (React hooks rule)
  const headerContent = useMemo(() => {
    if (!template.header?.show) return ''

    let content = template.header?.content || ''

    // Replace tokens
    content = content.replace(/\{title\}/g, project?.meta.name || '')
    content = content.replace(/\{author\}/g, project?.meta.author || '')
    content = content.replace(/\{chapter\}/g, chapterTitle || '')
    content = content.replace(/\{page\}/g, String(pageNumber))
    content = content.replace(/\{total\}/g, String(totalPages))

    return content
  }, [template.header?.show, template.header?.content, project, chapterTitle, pageNumber, totalPages])

  // Alternate header alignment for book convention (odd/even pages)
  const isEvenPage = pageNumber % 2 === 0

  // Don't render if header is disabled
  if (!template.header?.show) {
    return null
  }

  return (
    <div
      className="page-header shrink-0"
      style={{
        fontSize: template.header?.fontSize || '10pt',
        fontFamily: template.typography.fontFamily,
        textAlign: isEvenPage ? 'left' : 'right',
        color: 'hsl(var(--muted-foreground))',
        paddingBottom: '0.75em',
        borderBottom: '1px solid hsl(var(--border) / 0.5)',
        marginBottom: '1em',
        minHeight: '1.5em'
      }}
    >
      {headerContent}
    </div>
  )
}
