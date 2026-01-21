/**
 * Adapter to convert Palimpseste templates to tiptap-pagination-plus configuration
 */

import type { PageTemplate } from '@shared/types/templates'
import type { PaginationPlusOptions } from 'tiptap-pagination-plus'
import { convertToPixels } from './unitConversions'

// Default header/footer heights in pixels
const HEADER_HEIGHT = 40
const FOOTER_HEIGHT = 40

/**
 * Convert a PageTemplate to PaginationPlus configuration options
 */
export function templateToPaginationOptions(
  template: PageTemplate
): Partial<PaginationPlusOptions> {
  // Convert dimensions to pixels
  let pageWidth = convertToPixels(template.page.width)
  let pageHeight = convertToPixels(template.page.height)
  const marginTop = convertToPixels(template.page.marginTop)
  const marginBottom = convertToPixels(template.page.marginBottom)
  const marginLeft = convertToPixels(template.page.marginLeft)
  const marginRight = convertToPixels(template.page.marginRight)

  // Handle digital formats with sensible defaults
  if (pageWidth === 0 || pageHeight === 0) {
    pageWidth = 400  // ~4.2 inches e-reader width
    pageHeight = 600 // ~6.25 inches e-reader height
  }

  // Build header content (if enabled)
  let headerLeft = ''
  let headerRight = ''
  if (template.header?.show) {
    // Template uses format like "{author} / {title} / {page}"
    // PaginationPlus uses {page} and {total}
    const content = template.header.content || ''
    // For now, put the content on one side based on typical conventions
    headerRight = content
      .replace('{author}', 'Auteur')
      .replace('{title}', 'Titre')
  }

  // Build footer content (if enabled)
  let footerLeft = ''
  let footerRight = ''
  if (template.footer?.show) {
    if (template.footer.showPageNumber) {
      footerRight = '{page}'
    }
  }

  return {
    pageWidth,
    pageHeight,
    pageGap: 40, // Visual gap between pages
    marginTop: marginTop + (template.header?.show ? HEADER_HEIGHT : 0),
    marginBottom: marginBottom + (template.footer?.show ? FOOTER_HEIGHT : 0),
    marginLeft,
    marginRight,
    contentMarginTop: template.header?.show ? 10 : 0,
    contentMarginBottom: template.footer?.show ? 10 : 0,
    headerLeft,
    headerRight,
    footerLeft,
    footerRight,
    pageBreakBackground: 'hsl(var(--muted))', // Match our theme
    pageGapBorderColor: 'transparent',
    pageGapBorderSize: 0,
  }
}

/**
 * Get default PaginationPlus options
 */
export function getDefaultPaginationOptions(): Partial<PaginationPlusOptions> {
  return {
    pageWidth: 794, // A4 width in pixels
    pageHeight: 1123, // A4 height in pixels
    pageGap: 40,
    marginTop: 94, // ~25mm
    marginBottom: 94,
    marginLeft: 94,
    marginRight: 94,
    contentMarginTop: 10,
    contentMarginBottom: 10,
    headerLeft: '',
    headerRight: '',
    footerLeft: '',
    footerRight: '{page}',
    pageBreakBackground: 'hsl(var(--muted))',
    pageGapBorderColor: 'transparent',
    pageGapBorderSize: 0,
  }
}
