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
  pages: HTMLElement[]
  template: PageTemplate
  project: Project
  quality?: 'draft' | 'standard' | 'high'
  onProgress?: (current: number, total: number) => void
}

/**
 * Export pages to PDF format
 */
export async function exportToPdf(options: PdfExportOptions): Promise<Blob> {
  const {
    pages,
    template,
    project,
    quality = 'standard',
    onProgress
  } = options

  // Page dimensions in mm
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

  // Render each page
  for (let i = 0; i < pages.length; i++) {
    if (onProgress) {
      onProgress(i + 1, pages.length)
    }

    // Add new page (except for first)
    if (i > 0) {
      pdf.addPage([pageWidthMm, pageHeightMm])
    }

    try {
      // Render page element to canvas
      const canvas = await html2canvas(pages[i], {
        scale,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        // Ensure we capture the exact dimensions
        width: pageWidthPx,
        height: pageHeightPx
      })

      // Add canvas image to PDF
      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidthMm, pageHeightMm)
    } catch (error) {
      console.error(`Failed to render page ${i + 1}:`, error)
      // Continue with other pages
    }
  }

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
