import type { PageTemplate } from '@shared/types/templates'

interface PageFooterProps {
  pageNumber: number
  totalPages?: number  // Reserved for future use (e.g., "Page X of Y")
  template: PageTemplate
}

/**
 * Page footer component
 * Displays page number if enabled in template
 */
export function PageFooter({
  pageNumber,
  template
}: PageFooterProps) {
  // Don't render if footer is disabled
  if (!template.footer?.show) {
    return null
  }

  return (
    <div
      className="page-footer shrink-0"
      style={{
        fontSize: template.footer?.fontSize || '10pt',
        fontFamily: template.typography.fontFamily,
        textAlign: 'center',
        color: 'hsl(var(--muted-foreground))',
        paddingTop: '0.75em',
        borderTop: '1px solid hsl(var(--border) / 0.5)',
        marginTop: 'auto',
        minHeight: '1.5em'
      }}
    >
      {template.footer?.showPageNumber && (
        <span>{pageNumber}</span>
      )}
    </div>
  )
}
