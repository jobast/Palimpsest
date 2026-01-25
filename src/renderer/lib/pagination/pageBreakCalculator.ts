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
import { HEADER_HEIGHT, FOOTER_HEIGHT, PAGE_GAP } from './constants'

export interface PageBreak {
  position: number
  spacerHeight: number  // Pre-calculated spacer height for this break
}

export interface PageBreakResult {
  pages: PageInfo[]
  pageBreaks: PageBreak[]
}

export interface CalculationContext {
  template: PageTemplate
  editor: Editor
  measurementContainer?: HTMLElement // Deprecated: no longer used for direct measurement
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
 * Measure a DOM node directly in the editor's layout
 * This is more accurate than cloning because the node is already rendered
 * with the correct width constraints and styling.
 *
 * getBoundingClientRect() does NOT include margins, so we compute them separately.
 */
function measureNodeInEditor(domNode: HTMLElement): number {
  const rect = domNode.getBoundingClientRect()
  const computed = window.getComputedStyle(domNode)
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
  const { template, editor, effectiveTypography } = ctx
  const dims = getPageDimensions(template)

  // Use effective typography if provided, otherwise fall back to template
  const typography = effectiveTypography || template.typography

  const pages: PageInfo[] = []
  const pageBreaks: PageBreak[] = []

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

  // Calculate inter-page space (used for spacer height calculation)
  const headerHeight = template.header?.show ? HEADER_HEIGHT : 0
  const footerHeight = template.footer?.show ? FOOTER_HEIGHT : 0
  const interPageSpace = dims.marginBottom + footerHeight + PAGE_GAP + dims.marginTop + headerHeight

  // NEW APPROACH: Measure nodes directly from the editor's DOM
  // This is more accurate than cloning because the nodes are already
  // rendered with correct width constraints and styling.
  //
  // The editor content width may differ from the target page width,
  // so we need to scale the measurements accordingly.
  const editorElement = editor.view.dom as HTMLElement
  const editorRect = editorElement.getBoundingClientRect()
  const editorContentWidth = editorRect.width

  // Calculate scale factor if editor width differs from target page width
  // This accounts for different zoom levels or responsive layouts
  const widthRatio = dims.contentWidth / editorContentWidth

  // Iterate through top-level blocks in the document
  doc.forEach((node, offset) => {
    // Get the DOM element for this node position
    const domNode = editor.view.nodeDOM(offset) as HTMLElement | null

    if (!domNode) {
      // If no DOM node, estimate height based on node type
      const estimatedHeight = estimateNodeHeight(node, template)
      processNodeHeight(estimatedHeight, offset, node.nodeSize)
      return
    }

    // Measure the node directly in the editor's DOM
    const rawHeight = measureNodeInEditor(domNode)

    // Scale the height if editor width differs from target width
    // When text reflows to a narrower width, it gets taller proportionally
    // When text reflows to a wider width, it gets shorter proportionally
    let nodeHeight = rawHeight
    if (widthRatio < 1) {
      // Target is narrower than editor - content will be taller
      // Use a heuristic: height scales inversely with width for text
      nodeHeight = rawHeight / widthRatio
    } else if (widthRatio > 1) {
      // Target is wider than editor - content will be shorter
      nodeHeight = rawHeight / widthRatio
    }

    // Process this node's height
    processNodeHeight(nodeHeight, offset, node.nodeSize)
  })

  // Helper function to process node height and create page breaks
  function processNodeHeight(nodeHeight: number, startOffset: number, nodeSize: number) {
    const endOffset = startOffset + nodeSize

    // CRITICAL: Handle nodes taller than page height
    // These nodes can't be split at the ProseMirror level, so we:
    // 1. Force a page break before the oversized node
    // 2. Create multiple page entries (for correct page frame rendering)
    // 3. Store actual height in the LAST page so spacer can compensate
    if (nodeHeight > dims.contentHeight) {

      // Force page break if we're not at the start of a page
      if (currentHeight > 0) {
        currentPage.endPos = startOffset
        currentPage.contentHeight = currentHeight
        pages.push({ ...currentPage })

        // Calculate spacer height: remaining space on current page + inter-page space
        const remainingOnPage = Math.max(0, dims.contentHeight - currentHeight)
        pageBreaks.push({
          position: startOffset,
          spacerHeight: remainingOnPage + interPageSpace
        })

        currentPage = {
          pageNumber: pages.length + 1,
          startPos: startOffset,
          endPos: 0,
          contentHeight: 0
        }
        currentHeight = 0
      }

      // Calculate how many visual pages this oversized node spans
      const pagesSpanned = Math.ceil(nodeHeight / dims.contentHeight)

      // Create page entries for intermediate pages (full height, no page break after)
      // These are "virtual" pages - they don't have decorations but create page frames
      for (let i = 0; i < pagesSpanned - 1; i++) {
        currentPage.endPos = endOffset
        currentPage.contentHeight = dims.contentHeight
        pages.push({ ...currentPage })

        currentPage = {
          pageNumber: pages.length + 1,
          startPos: startOffset, // Same start - it's the same oversized node
          endPos: 0,
          contentHeight: 0
        }
      }

      // The last page of the oversized node gets the remaining height
      const remainingHeight = nodeHeight - (pagesSpanned - 1) * dims.contentHeight
      currentHeight = remainingHeight
      currentPage.endPos = endOffset

      // CRITICAL: Add a compensating spacer AFTER the oversized node
      // The oversized node traverses (pagesSpanned - 1) inter-page areas without spacers,
      // so content after it would appear too high. We add a spacer to compensate.
      if (pagesSpanned > 1) {
        const compensatingSpace = (pagesSpanned - 1) * interPageSpace
        pageBreaks.push({
          position: endOffset,
          spacerHeight: compensatingSpace
        })
      }

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

      // Calculate spacer height: remaining space on current page + inter-page space
      const remainingOnPage = Math.max(0, dims.contentHeight - currentHeight)
      pageBreaks.push({
        position: startOffset,
        spacerHeight: remainingOnPage + interPageSpace
      })

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

  return { pages, pageBreaks }
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
