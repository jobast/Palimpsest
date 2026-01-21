/**
 * Adapter to convert Palimpseste templates to hugs7/tiptap-extension-pagination configuration
 */

import type { PageTemplate } from '@shared/types/templates'

// Types from tiptap-extension-pagination
type PaperSize = 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A7' | 'A8' | 'A9' | 'A10' |
  'B0' | 'B1' | 'B2' | 'B3' | 'B4' | 'B5' | 'B6' | 'B7' | 'B8' | 'B9' | 'B10' |
  'Letter' | 'Legal' | 'Tabloid' | 'Ledger'

type PaperOrientation = 'portrait' | 'landscape'

interface MarginConfig {
  top: number    // mm
  right: number  // mm
  bottom: number // mm
  left: number   // mm
}

interface PaginationOptions {
  defaultPaperSize?: PaperSize
  defaultPaperColour?: string
  useDeviceThemeForPaperColour?: boolean
  defaultPaperOrientation?: PaperOrientation
  defaultMarginConfig?: MarginConfig
  defaultPageBorders?: {
    top: number
    right: number
    bottom: number
    left: number
  }
  pageAmendmentOptions?: {
    enableHeader: boolean
    enableFooter: boolean
  }
}

// Standard paper sizes in mm (width x height in portrait)
const PAPER_SIZES_MM: Record<PaperSize, { width: number; height: number }> = {
  'A0': { width: 841, height: 1189 },
  'A1': { width: 594, height: 841 },
  'A2': { width: 420, height: 594 },
  'A3': { width: 297, height: 420 },
  'A4': { width: 210, height: 297 },
  'A5': { width: 148, height: 210 },
  'A6': { width: 105, height: 148 },
  'A7': { width: 74, height: 105 },
  'A8': { width: 52, height: 74 },
  'A9': { width: 37, height: 52 },
  'A10': { width: 26, height: 37 },
  'B0': { width: 1000, height: 1414 },
  'B1': { width: 707, height: 1000 },
  'B2': { width: 500, height: 707 },
  'B3': { width: 353, height: 500 },
  'B4': { width: 250, height: 353 },
  'B5': { width: 176, height: 250 },
  'B6': { width: 125, height: 176 },
  'B7': { width: 88, height: 125 },
  'B8': { width: 62, height: 88 },
  'B9': { width: 44, height: 62 },
  'B10': { width: 31, height: 44 },
  'Letter': { width: 216, height: 279 },
  'Legal': { width: 216, height: 356 },
  'Tabloid': { width: 279, height: 432 },
  'Ledger': { width: 432, height: 279 },
}

/**
 * Convert a CSS dimension string to millimeters
 */
function convertToMm(value: string): number {
  if (value === '100%' || value === 'auto' || !value) {
    return 0
  }

  const match = value.match(/^([\d.]+)(in|cm|mm|pt|px|em)?$/)
  if (!match) {
    return parseFloat(value) || 0
  }

  const num = parseFloat(match[1])
  const unit = match[2] || 'mm'

  switch (unit) {
    case 'in': return num * 25.4
    case 'cm': return num * 10
    case 'mm': return num
    case 'pt': return num * 0.3528 // 1pt = 0.3528mm
    case 'px': return num * 0.2646 // at 96 DPI, 1px ≈ 0.2646mm
    case 'em': return num * 4.23   // assuming 16px base = ~4.23mm
    default: return num
  }
}

/**
 * Find the closest standard paper size for given dimensions
 */
function findClosestPaperSize(widthMm: number, heightMm: number): { size: PaperSize; orientation: PaperOrientation } {
  let closestSize: PaperSize = 'A4'
  let closestDistance = Infinity
  let orientation: PaperOrientation = 'portrait'

  for (const [sizeName, dims] of Object.entries(PAPER_SIZES_MM)) {
    // Check portrait orientation
    const distPortrait = Math.abs(widthMm - dims.width) + Math.abs(heightMm - dims.height)
    if (distPortrait < closestDistance) {
      closestDistance = distPortrait
      closestSize = sizeName as PaperSize
      orientation = 'portrait'
    }

    // Check landscape orientation
    const distLandscape = Math.abs(widthMm - dims.height) + Math.abs(heightMm - dims.width)
    if (distLandscape < closestDistance) {
      closestDistance = distLandscape
      closestSize = sizeName as PaperSize
      orientation = 'landscape'
    }
  }

  return { size: closestSize, orientation }
}

/**
 * Convert a PageTemplate to hugs7/tiptap-extension-pagination options
 */
export function templateToPaginationOptions(
  template: PageTemplate
): Partial<PaginationOptions> {
  // Convert dimensions to mm
  const widthMm = convertToMm(template.page.width)
  const heightMm = convertToMm(template.page.height)

  // Handle digital formats (no pagination)
  if (widthMm === 0 || heightMm === 0) {
    // Return minimal options for digital formats
    return {
      defaultPaperSize: 'A4',
      defaultPaperOrientation: 'portrait',
      defaultMarginConfig: {
        top: 25,
        right: 25,
        bottom: 25,
        left: 25,
      },
      pageAmendmentOptions: {
        enableHeader: false,
        enableFooter: false,
      },
    }
  }

  // Find closest paper size
  const { size, orientation } = findClosestPaperSize(widthMm, heightMm)

  // Convert margins to mm
  const marginTop = convertToMm(template.page.marginTop)
  const marginBottom = convertToMm(template.page.marginBottom)
  const marginLeft = convertToMm(template.page.marginLeft)
  const marginRight = convertToMm(template.page.marginRight)

  return {
    defaultPaperSize: size,
    defaultPaperColour: '#ffffff',
    defaultPaperOrientation: orientation,
    defaultMarginConfig: {
      top: marginTop || 25,
      right: marginRight || 25,
      bottom: marginBottom || 25,
      left: marginLeft || 25,
    },
    defaultPageBorders: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    pageAmendmentOptions: {
      enableHeader: template.header?.show ?? false,
      enableFooter: template.footer?.show ?? false,
    },
  }
}

/**
 * Get default pagination options
 */
export function getDefaultPaginationOptions(): Partial<PaginationOptions> {
  return {
    defaultPaperSize: 'A4',
    defaultPaperColour: '#ffffff',
    defaultPaperOrientation: 'portrait',
    defaultMarginConfig: {
      top: 25,
      right: 25,
      bottom: 25,
      left: 25,
    },
    defaultPageBorders: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    pageAmendmentOptions: {
      enableHeader: false,
      enableFooter: true,
    },
  }
}
