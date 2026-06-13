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
}

/**
 * Capture a paginated editor element into one JPEG data URL per page,
 * each at the template's page pixel geometry. WYSIWYG: slices on the real
 * tiptap-pagination-plus gaps, exactly as shown on screen.
 */
export async function capturePageImages(
  editorElement: HTMLElement,
  template: PageTemplate,
  quality: 'draft' | 'standard' | 'high' = 'standard'
): Promise<string[]> {
  const pageWidthPx = convertToPixels(template.page.width)
  const pageHeightPx = convertToPixels(template.page.height)
  const scaleFactors = { draft: 1, standard: 2, high: 3 }
  const scale = scaleFactors[quality]

  const paginationGaps = Array.from(editorElement.querySelectorAll('.rm-pagination-gap')) as HTMLElement[]
  const totalPages = Math.max(1, paginationGaps.length + 1)

  // Resolve colors from the originals before cloning (html2canvas can't read CSS vars).
  const originalElements = Array.from(editorElement.querySelectorAll('*'))
  const colorMap = new Map<number, string>()
  const bgColorMap = new Map<number, string>()
  originalElements.forEach((el, index) => {
    const computed = getComputedStyle(el)
    colorMap.set(index, computed.color)
    bgColorMap.set(index, computed.backgroundColor)
  })

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
      clonedElement.style.backgroundColor = '#ffffff'
      const clonedElements = Array.from(clonedElement.querySelectorAll('*'))
      clonedElements.forEach((el, index) => {
        const htmlEl = el as HTMLElement
        const resolvedColor = colorMap.get(index)
        const resolvedBgColor = bgColorMap.get(index)
        if (resolvedColor) htmlEl.style.color = resolvedColor
        if (resolvedBgColor && resolvedBgColor !== 'rgba(0, 0, 0, 0)') {
          htmlEl.style.backgroundColor = resolvedBgColor
        }
        htmlEl.style.contentVisibility = 'visible'
        htmlEl.style.visibility = 'visible'
      })
      const gaps = Array.from(clonedElement.querySelectorAll('.rm-pagination-gap'))
      for (const gap of gaps) {
        const gapEl = gap as HTMLElement
        gapEl.style.backgroundColor = '#ffffff'
        gapEl.style.borderColor = '#ffffff'
      }
    }
  })

  const editorRect = editorElement.getBoundingClientRect()
  const pageRegions: { startY: number; endY: number }[] = []
  for (let i = 0; i < totalPages; i++) {
    let startY: number
    let endY: number
    if (i === 0) {
      startY = 0
    } else {
      const prevGap = paginationGaps[i - 1]
      const breaker = prevGap.closest('.breaker') as HTMLElement | null
      if (breaker) {
        const breakerRect = breaker.getBoundingClientRect()
        startY = breakerRect.bottom - editorRect.top + editorElement.scrollTop
      } else {
        const prevGapRect = prevGap.getBoundingClientRect()
        startY = prevGapRect.bottom - editorRect.top + editorElement.scrollTop
      }
    }
    if (i < paginationGaps.length) {
      const gap = paginationGaps[i]
      const breaker = gap.closest('.breaker') as HTMLElement | null
      if (breaker) {
        const breakerRect = breaker.getBoundingClientRect()
        endY = breakerRect.top - editorRect.top + editorElement.scrollTop
      } else {
        const gapRect = gap.getBoundingClientRect()
        endY = gapRect.top - editorRect.top + editorElement.scrollTop
      }
    } else {
      endY = editorElement.scrollHeight
    }
    pageRegions.push({ startY, endY })
  }

  const images: string[] = []
  for (let i = 0; i < totalPages; i++) {
    const region = pageRegions[i]
    const regionHeight = Math.max(1, region.endY - region.startY)
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = pageWidthPx * scale
    pageCanvas.height = pageHeightPx * scale
    const ctx = pageCanvas.getContext('2d')
    if (!ctx) continue
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
    const srcY = region.startY * scale
    const srcHeight = regionHeight * scale
    const srcWidth = fullCanvas.width
    const editorWidthPx = editorElement.scrollWidth
    const widthScale = pageWidthPx / editorWidthPx
    const destWidth = pageCanvas.width
    const destHeight = (srcHeight / scale) * widthScale * scale
    ctx.drawImage(fullCanvas, 0, srcY, srcWidth, srcHeight, 0, 0, destWidth, destHeight)
    images.push(pageCanvas.toDataURL('image/jpeg', 0.92))
  }
  return images
}

/**
 * Assemble one JPEG-per-page (across all chapters, in order) into a single PDF
 * at the template's page size.
 */
export function assembleBookPdf(pages: string[], template: PageTemplate, project: Project): Blob {
  const pageWidthMm = pxToMm(convertToPixels(template.page.width))
  const pageHeightMm = pxToMm(convertToPixels(template.page.height))
  const pdf = new jsPDF({
    orientation: pageWidthMm > pageHeightMm ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [pageWidthMm, pageHeightMm]
  })
  pdf.setProperties({
    title: project.meta.name,
    author: project.meta.author,
    creator: 'Palimpseste',
    subject: `Manuscrit: ${project.meta.name}`
  })
  pages.forEach((img, i) => {
    if (i > 0) pdf.addPage([pageWidthMm, pageHeightMm])
    pdf.addImage(img, 'JPEG', 0, 0, pageWidthMm, pageHeightMm)
  })
  return pdf.output('blob')
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
  const { editorElement, template, project, quality = 'standard' } = options
  const pages = await capturePageImages(editorElement, template, quality)
  return assembleBookPdf(pages, template, project)
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
