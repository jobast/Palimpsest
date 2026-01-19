/**
 * Page Break Calculator
 *
 * Calculates page breaks by measuring actual rendered DOM content.
 * This is more accurate than mathematical estimation because it accounts for:
 * - Actual font metrics and rendering
 * - Line wrapping behavior
 * - CSS styling effects
 * - Inline formatting (bold, italic, etc.)
 */

import type { Editor } from '@tiptap/react'
import type { PageTemplate } from '@shared/types/templates'
import type { PageInfo } from '@/stores/paginationStore'
import type { EffectiveTypography } from '@/stores/editorStore'
import { convertToPixels, parseFontSize, parseLineHeight } from './unitConversions'
import { HEADER_HEIGHT, FOOTER_HEIGHT } from './constants'

export interface PageBreakResult {
  pages: PageInfo[]
  pageBreakPositions: number[]
}

export interface CalculationContext {
  template: PageTemplate
  editor: Editor
  measurementContainer: HTMLElement
  effectiveTypography?: EffectiveTypography // User typography overrides
}

/**
 * Default dimensions for digital formats (simulating an e-reader)
 * Based on a typical 6" e-reader at 96 DPI
 */
const DIGITAL_FORMAT_DEFAULTS = {
  width: 400,   // ~4.2 inches - typical e-reader width
  height: 600,  // ~6.25 inches - typical e-reader height
  margin: 24    // comfortable reading margin
}

/**
 * Calculate page dimensions from template
 */
export function getPageDimensions(template: PageTemplate) {
  let width = convertToPixels(template.page.width)
  let height = convertToPixels(template.page.height)
  let marginTop = convertToPixels(template.page.marginTop)
  let marginBottom = convertToPixels(template.page.marginBottom)
  let marginLeft = convertToPixels(template.page.marginLeft)
  let marginRight = convertToPixels(template.page.marginRight)

  // Handle digital formats (100%, auto) with sensible defaults
  const isDigitalFormat = width === 0 || height === 0 ||
    template.page.width === '100%' || template.page.height === 'auto'

  if (isDigitalFormat) {
    width = DIGITAL_FORMAT_DEFAULTS.width
    height = DIGITAL_FORMAT_DEFAULTS.height
    // Use reasonable margins if they were also relative
    if (marginTop === 0) marginTop = DIGITAL_FORMAT_DEFAULTS.margin
    if (marginBottom === 0) marginBottom = DIGITAL_FORMAT_DEFAULTS.margin
    if (marginLeft === 0) marginLeft = DIGITAL_FORMAT_DEFAULTS.margin
    if (marginRight === 0) marginRight = DIGITAL_FORMAT_DEFAULTS.margin
  }

  // Header/footer heights
  const headerHeight = template.header?.show ? HEADER_HEIGHT : 0
  const footerHeight = template.footer?.show ? FOOTER_HEIGHT : 0

  // Available content area
  const contentWidth = width - marginLeft - marginRight
  const contentHeight = height - marginTop - marginBottom - headerHeight - footerHeight

  return {
    width,
    height,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    headerHeight,
    footerHeight,
    contentWidth,
    contentHeight,
    isDigitalFormat
  }
}

/**
 * Measure the height of an element including its margins
 * getBoundingClientRect() does NOT include margins, so we need to compute them separately
 */
function measureNodeHeight(element: HTMLElement): number {
  const rect = element.getBoundingClientRect()
  const computed = window.getComputedStyle(element)
  const marginTop = parseFloat(computed.marginTop) || 0
  const marginBottom = parseFloat(computed.marginBottom) || 0
  return rect.height + marginTop + marginBottom
}

/**
 * Main pagination calculation function
 *
 * Algorithm:
 * 1. Set up measurement container with exact page styling
 * 2. Iterate through document blocks
 * 3. Clone and measure each block's rendered height
 * 4. When cumulative height exceeds page, create page break
 * 5. Return array of page info with positions
 */
export function calculatePageBreaks(ctx: CalculationContext): PageBreakResult {
  const { template, editor, measurementContainer, effectiveTypography } = ctx
  const dims = getPageDimensions(template)

  // Use effective typography if provided, otherwise fall back to template
  const typography = effectiveTypography || template.typography

  // Configure measurement container to match page content area
  // Add manuscript-content class so CSS rules from globals.css apply during measurement
  // Also add pagination-measure class to disable :first-child rules during measurement
  measurementContainer.className = 'manuscript-content pagination-measure'
  measurementContainer.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    visibility: hidden;
    width: ${dims.contentWidth}px;
    font-family: ${typography.fontFamily};
    font-size: ${typography.fontSize};
    line-height: ${typography.lineHeight};
    text-align: justify;
    hyphens: auto;
    --first-line-indent: ${typography.firstLineIndent};
  `
  // Add a dummy element so cloned nodes are never :first-child
  // This prevents :first-child CSS rules from applying during measurement
  measurementContainer.innerHTML = '<div style="display:none"></div>'

  const pages: PageInfo[] = []
  const pageBreakPositions: number[] = []

  let currentPage: PageInfo = {
    pageNumber: 1,
    startPos: 0,
    endPos: 0,
    contentHeight: 0
  }

  let currentHeight = 0
  const doc = editor.state.doc

  // Orphan/widow prevention threshold (minimum lines on a page)
  const fontSize = parseFontSize(typography.fontSize)
  const lineHeight = parseLineHeight(typography.lineHeight, fontSize)
  const minLinesThreshold = lineHeight * 2.5 // At least ~2-3 lines

  // Track if we're measuring the first node (for :first-child styling)
  let isFirstNode = true

  // Iterate through top-level blocks in the document
  doc.forEach((node, offset) => {
    // Get the DOM element for this node position
    const domNode = editor.view.nodeDOM(offset) as HTMLElement | null

    if (!domNode) {
      // If no DOM node, estimate height based on node type
      const estimatedHeight = estimateNodeHeight(node, template)
      processNodeHeight(estimatedHeight, offset, node.nodeSize)
      isFirstNode = false
      return
    }

    // Clone the DOM node for measurement
    const clone = domNode.cloneNode(true) as HTMLElement

    // Apply manuscript styling to the clone (use effective typography for indents)
    applyManuscriptStyles(clone, typography)

    // For the first node, we need to measure WITH :first-child styling
    // because it will render as first-child in the actual editor
    if (isFirstNode) {
      // Clear container completely so clone becomes :first-child
      measurementContainer.innerHTML = ''
    }

    // Add to measurement container
    measurementContainer.appendChild(clone)

    // Measure the actual rendered height including margins
    const nodeHeight = measureNodeHeight(clone)

    // Process this node's height
    processNodeHeight(nodeHeight, offset, node.nodeSize)

    // Clear measurement container for next iteration (keep dummy element for non-first nodes)
    measurementContainer.innerHTML = '<div style="display:none"></div>'
    isFirstNode = false
  })

  // Helper function to process node height and create page breaks
  function processNodeHeight(nodeHeight: number, startOffset: number, nodeSize: number) {
    const endOffset = startOffset + nodeSize

    // CRITICAL: Handle nodes taller than page height
    // These nodes can't be split, so we force a page break before them
    // and cap their height to prevent cascading misalignment
    if (nodeHeight > dims.contentHeight) {
      console.warn(`[Pagination] Node at offset ${startOffset} exceeds page height: ${Math.round(nodeHeight)}px > ${Math.round(dims.contentHeight)}px`)

      // Force page break if we're not at the start of a page
      if (currentHeight > 0) {
        currentPage.endPos = startOffset
        currentPage.contentHeight = currentHeight
        pages.push({ ...currentPage })
        pageBreakPositions.push(startOffset)

        currentPage = {
          pageNumber: pages.length + 1,
          startPos: startOffset,
          endPos: 0,
          contentHeight: 0
        }
        currentHeight = 0
      }

      // Cap the node height to page height to prevent cascading errors
      // The overflow will be visually clipped by PagedEditor's overflow:hidden
      currentHeight = dims.contentHeight
      currentPage.endPos = endOffset
      return
    }

    const remainingSpace = dims.contentHeight - currentHeight

    // Orphan prevention: If this paragraph is tall and we only have room for
    // a small portion (1-2 lines), move the entire paragraph to the next page
    const wouldCauseOrphan = nodeHeight > minLinesThreshold &&
                             remainingSpace > 0 &&
                             remainingSpace < minLinesThreshold &&
                             currentHeight > 0

    // Check if this node would overflow or cause an orphan
    if ((currentHeight + nodeHeight > dims.contentHeight || wouldCauseOrphan) && currentHeight > 0) {
      // Finalize current page
      currentPage.endPos = startOffset
      currentPage.contentHeight = currentHeight
      pages.push({ ...currentPage })
      pageBreakPositions.push(startOffset)

      // Start new page
      currentPage = {
        pageNumber: pages.length + 1,
        startPos: startOffset,
        endPos: 0,
        contentHeight: 0
      }
      currentHeight = nodeHeight
    } else {
      currentHeight += nodeHeight
    }

    // Update end position
    currentPage.endPos = endOffset
  }

  // Finalize last page
  currentPage.endPos = doc.content.size
  currentPage.contentHeight = currentHeight
  pages.push(currentPage)

  // Ensure at least one page exists
  if (pages.length === 0) {
    pages.push({
      pageNumber: 1,
      startPos: 0,
      endPos: doc.content.size,
      contentHeight: 0
    })
  }

  return { pages, pageBreakPositions }
}

/**
 * Apply manuscript-specific styles to a cloned element
 * Note: We no longer zero out margins - the measurement container has the
 * manuscript-content class and CSS rules apply naturally. We use margin-aware
 * height measurement to account for margins correctly.
 */
function applyManuscriptStyles(
  element: HTMLElement,
  typography: { firstLineIndent: string }
) {
  // Apply first-line indent to paragraphs
  const paragraphs = element.querySelectorAll('p')
  paragraphs.forEach((p) => {
    // Skip first paragraph after headings (no indent)
    const prev = p.previousElementSibling
    if (!prev || prev.tagName.match(/^H[1-6]$/)) {
      (p as HTMLElement).style.textIndent = '0'
    } else {
      (p as HTMLElement).style.textIndent = typography.firstLineIndent
    }
  })
}

/**
 * Fallback height estimation when DOM node is not available
 */
function estimateNodeHeight(
  node: { type: { name: string }; textContent: string; childCount: number },
  template: PageTemplate
): number {
  const fontSize = parseFontSize(template.typography.fontSize)
  const lineHeight = parseLineHeight(template.typography.lineHeight, fontSize)
  const dims = getPageDimensions(template)

  // Base height
  let height = lineHeight

  // Estimate based on text content
  if (node.textContent) {
    const charsPerLine = Math.floor(dims.contentWidth / (fontSize * 0.55))
    const lines = Math.max(1, Math.ceil(node.textContent.length / charsPerLine))
    height = lines * lineHeight
  }

  // Add extra space for headings
  if (node.type.name === 'heading' || node.type.name === 'chapterTitle') {
    height += lineHeight * 1.5
  }

  // Add paragraph spacing
  if (node.type.name === 'paragraph' || node.type.name === 'firstParagraph') {
    height += lineHeight * 0.25
  }

  // Scene breaks have fixed height
  if (node.type.name === 'sceneBreak') {
    height = lineHeight * 3
  }

  return height
}

/**
 * Debounce utility for pagination calculations
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }
}
