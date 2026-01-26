/**
 * PDF Export Module
 *
 * Converts rendered page elements to PDF using html2canvas and jsPDF.
 * Captures the exact visual appearance of the Page View.
 */

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { PageTemplate } from '@shared/types/templates'
import type { Project } from '@shared/types/project'
import { convertToPixels } from '../pagination/unitConversions'

export interface PdfExportOptions {
  /** The ProseMirror editor element containing all content */
  editorElement: HTMLElement
  /** Page template with dimensions */
  template: PageTemplate
  project: Project
  quality?: 'draft' | 'standard' | 'high'
  onProgress?: (current: number, total: number) => void
}

/**
 * Export pages to PDF format
 *
 * tiptap-pagination-plus creates visual pagination using:
 * - .rm-page-break containers with floated .page (empty positioning div) and .breaker (footer+gap+header)
 * - The actual content flows in the ProseMirror editor, positioned by marginTop on .page elements
 *
 * Strategy: Capture the entire editor, then slice it into pages using breaker positions.
 * Each page region is: from the end of the previous breaker (or top) to the start of the next breaker's gap.
 */
export async function exportToPdf(options: PdfExportOptions): Promise<Blob> {
  const {
    editorElement,
    template,
    project,
    quality = 'standard',
    onProgress
  } = options

  // Page dimensions in pixels and mm
  const pageWidthPx = convertToPixels(template.page.width)
  const pageHeightPx = convertToPixels(template.page.height)
  const pageWidthMm = pxToMm(pageWidthPx)
  const pageHeightMm = pxToMm(pageHeightPx)

  // Quality settings (scale factor for html2canvas)
  const scaleFactors = {
    draft: 1,
    standard: 2,
    high: 3
  }
  const scale = scaleFactors[quality]

  // Find all pagination gaps (they mark the visual separation between pages)
  const paginationGaps = Array.from(editorElement.querySelectorAll('.rm-pagination-gap')) as HTMLElement[]
  const totalPages = Math.max(1, paginationGaps.length + 1)

  console.log('PDF Export: Starting capture', {
    totalPages,
    pageWidthPx,
    pageHeightPx,
    quality,
    scale,
    editorScrollHeight: editorElement.scrollHeight,
    gapsFound: paginationGaps.length
  })

  if (onProgress) onProgress(0, totalPages + 1)

  // Build color map from ORIGINAL elements before cloning
  const originalElements = Array.from(editorElement.querySelectorAll('*'))
  const colorMap = new Map<number, string>()
  const bgColorMap = new Map<number, string>()

  originalElements.forEach((el, index) => {
    const computed = getComputedStyle(el)
    colorMap.set(index, computed.color)
    bgColorMap.set(index, computed.backgroundColor)
  })

  // Capture the entire editor as one canvas
  const fullCanvas = await html2canvas(editorElement, {
    scale,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: editorElement.scrollWidth,
    height: editorElement.scrollHeight,
    windowWidth: editorElement.scrollWidth,
    windowHeight: editorElement.scrollHeight,
    onclone: (_clonedDoc, clonedElement) => {
      // Force white background
      clonedElement.style.backgroundColor = '#ffffff'

      // Apply resolved colors from original elements
      const clonedElements = Array.from(clonedElement.querySelectorAll('*'))
      clonedElements.forEach((el, index) => {
        const htmlEl = el as HTMLElement
        const resolvedColor = colorMap.get(index)
        const resolvedBgColor = bgColorMap.get(index)

        if (resolvedColor) {
          htmlEl.style.color = resolvedColor
        }
        if (resolvedBgColor && resolvedBgColor !== 'rgba(0, 0, 0, 0)') {
          htmlEl.style.backgroundColor = resolvedBgColor
        }

        htmlEl.style.contentVisibility = 'visible'
        htmlEl.style.visibility = 'visible'
      })

      // Make the gaps white so they blend when we slice
      const gaps = Array.from(clonedElement.querySelectorAll('.rm-pagination-gap'))
      for (const gap of gaps) {
        const gapEl = gap as HTMLElement
        gapEl.style.backgroundColor = '#ffffff'
        gapEl.style.borderColor = '#ffffff'
      }
    }
  })

  console.log('PDF Export: Full canvas captured', {
    canvasWidth: fullCanvas.width,
    canvasHeight: fullCanvas.height
  })

  if (onProgress) onProgress(1, totalPages + 1)

  // Get editor's position for coordinate calculations
  const editorRect = editorElement.getBoundingClientRect()

  // Calculate page regions based on gap positions
  // We want: content before gap 1, content between gap 1 and gap 2, etc.
  const pageRegions: { startY: number; endY: number }[] = []

  for (let i = 0; i < totalPages; i++) {
    let startY: number
    let endY: number

    if (i === 0) {
      // First page starts at the top
      startY = 0
    } else {
      // Subsequent pages start after the previous gap
      const prevGap = paginationGaps[i - 1]
      const prevGapRect = prevGap.getBoundingClientRect()
      // Start after the gap (which includes the header of this page)
      const breaker = prevGap.closest('.breaker') as HTMLElement
      if (breaker) {
        const breakerRect = breaker.getBoundingClientRect()
        startY = breakerRect.bottom - editorRect.top + editorElement.scrollTop
      } else {
        startY = prevGapRect.bottom - editorRect.top + editorElement.scrollTop
      }
    }

    if (i < paginationGaps.length) {
      // Page ends at the top of the gap (which is the bottom of content + footer)
      const gap = paginationGaps[i]
      const gapRect = gap.getBoundingClientRect()
      // Find the footer that's before this gap
      const breaker = gap.closest('.breaker') as HTMLElement
      if (breaker) {
        const breakerRect = breaker.getBoundingClientRect()
        endY = breakerRect.top - editorRect.top + editorElement.scrollTop
      } else {
        endY = gapRect.top - editorRect.top + editorElement.scrollTop
      }
    } else {
      // Last page goes to the end of the editor
      endY = editorElement.scrollHeight
    }

    pageRegions.push({ startY, endY })
  }

  console.log('PDF Export: Page regions calculated', pageRegions)

  // Create PDF document
  const pdf = new jsPDF({
    orientation: pageWidthMm > pageHeightMm ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [pageWidthMm, pageHeightMm]
  })

  // Set PDF metadata
  pdf.setProperties({
    title: project.meta.name,
    author: project.meta.author,
    creator: 'Palimpseste',
    subject: `Manuscrit: ${project.meta.name}`
  })

  // Extract each page region from the full canvas
  for (let i = 0; i < totalPages; i++) {
    if (onProgress) onProgress(i + 2, totalPages + 1)

    const region = pageRegions[i]
    const regionHeight = Math.max(1, region.endY - region.startY)

    console.log(`PDF Export: Extracting page ${i + 1}/${totalPages}`, {
      startY: region.startY,
      endY: region.endY,
      height: regionHeight
    })

    // Add new page (except for first)
    if (i > 0) {
      pdf.addPage([pageWidthMm, pageHeightMm])
    }

    // Create a canvas for this page
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = pageWidthPx * scale
    pageCanvas.height = pageHeightPx * scale
    const ctx = pageCanvas.getContext('2d')

    if (ctx) {
      // Fill with white background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)

      // Calculate source coordinates (scaled)
      const srcY = region.startY * scale
      const srcHeight = regionHeight * scale
      const srcWidth = fullCanvas.width

      // Draw the region from the full canvas
      // We want to maintain the page width ratio
      const editorWidthPx = editorElement.scrollWidth
      const widthScale = pageWidthPx / editorWidthPx

      // Destination dimensions - scale to fit page width
      const destWidth = pageCanvas.width
      const destHeight = (srcHeight / scale) * widthScale * scale

      // Center vertically if content is smaller than page
      const destY = 0 // Align to top

      ctx.drawImage(
        fullCanvas,
        0, srcY,                    // Source x, y
        srcWidth, srcHeight,        // Source width, height
        0, destY,                   // Dest x, y
        destWidth, destHeight       // Dest width, height
      )

      // Add to PDF
      const imgData = pageCanvas.toDataURL('image/jpeg', 0.92)
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidthMm, pageHeightMm)
    }
  }

  console.log('PDF Export: Complete')
  return pdf.output('blob')
}

/**
 * Alternative: Export using DOM serialization (text-based, smaller file size)
 * This creates a simpler PDF without exact visual rendering
 */
export async function exportToPdfSimple(options: {
  content: string
  template: PageTemplate
  project: Project
}): Promise<Blob> {
  const { template, project } = options

  const pageWidthMm = pxToMm(convertToPixels(template.page.width))
  const pageHeightMm = pxToMm(convertToPixels(template.page.height))
  const marginTop = pxToMm(convertToPixels(template.page.marginTop))
  const marginLeft = pxToMm(convertToPixels(template.page.marginLeft))

  const pdf = new jsPDF({
    orientation: pageWidthMm > pageHeightMm ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [pageWidthMm, pageHeightMm]
  })

  pdf.setProperties({
    title: project.meta.name,
    author: project.meta.author,
    creator: 'Palimpseste'
  })

  // Set font
  pdf.setFont('times', 'normal')
  pdf.setFontSize(12)

  // Add text with automatic page breaks
  const contentWidth = pageWidthMm - (marginLeft * 2)
  pdf.text(options.content, marginLeft, marginTop, {
    maxWidth: contentWidth,
    align: 'justify'
  })

  return pdf.output('blob')
}

/**
 * Download PDF file
 */
export async function downloadPdf(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Convert pixels to millimeters (at 96 DPI)
 */
function pxToMm(px: number): number {
  return px * 0.264583
}
