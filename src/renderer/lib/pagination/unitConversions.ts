/**
 * Unit conversion utilities for page dimensions
 * Supports: in (inches), cm, mm, pt (points), px (pixels), em
 */

// Standard DPI for screen (CSS pixels)
const SCREEN_DPI = 96

// Conversion factors to pixels
const UNIT_TO_PX: Record<string, number> = {
  'in': SCREEN_DPI,           // 1 inch = 96px
  'cm': SCREEN_DPI / 2.54,    // 1cm = ~37.795px
  'mm': SCREEN_DPI / 25.4,    // 1mm = ~3.7795px
  'pt': SCREEN_DPI / 72,      // 1pt = ~1.333px (72pt = 1inch)
  'px': 1,
  'em': 16                    // Assuming 16px base font size
}

/**
 * Convert a CSS dimension string to pixels
 * @param value - CSS dimension string (e.g., "6in", "2.5cm", "72pt")
 * @returns Number of pixels
 */
export function convertToPixels(value: string): number {
  // Handle special cases
  if (value === '100%' || value === 'auto' || !value) {
    return 0
  }

  // Parse numeric value and unit
  const match = value.match(/^([\d.]+)(in|cm|mm|pt|px|em)?$/)
  if (!match) {
    return parseFloat(value) || 0
  }

  const num = parseFloat(match[1])
  const unit = match[2] || 'px'

  return num * (UNIT_TO_PX[unit] || 1)
}

/**
 * Convert pixels to millimeters (for PDF export)
 * @param px - Pixels
 * @returns Millimeters
 */
export function pxToMm(px: number): number {
  return px / UNIT_TO_PX['mm']
}

/**
 * Convert pixels to inches
 * @param px - Pixels
 * @returns Inches
 */
export function pxToInches(px: number): number {
  return px / UNIT_TO_PX['in']
}

/**
 * Convert pixels to points (for DOCX export)
 * @param px - Pixels
 * @returns Points
 */
export function pxToPoints(px: number): number {
  return px / UNIT_TO_PX['pt']
}

/**
 * Parse font size string to pixels
 * @param value - Font size string (e.g., "12pt", "16px", "1em")
 * @returns Pixels
 */
export function parseFontSize(value: string): number {
  const match = value.match(/^([\d.]+)(pt|px|em)?$/)
  if (!match) return 16 // Default to 16px

  const num = parseFloat(match[1])
  const unit = match[2] || 'px'

  return num * (UNIT_TO_PX[unit] || 1)
}

/**
 * Parse line height - can be a number (multiplier) or a string with unit
 * @param value - Line height value (e.g., 1.5, "24px", "1.5em")
 * @param fontSize - Base font size in pixels for multiplier calculations
 * @returns Line height in pixels
 */
export function parseLineHeight(value: string | number, fontSize: number): number {
  if (typeof value === 'number') {
    return value * fontSize
  }

  // Try parsing as number first (unitless multiplier)
  const numericValue = parseFloat(value)
  if (!isNaN(numericValue) && !value.match(/[a-z]/i)) {
    return numericValue * fontSize
  }

  // Parse as dimension with unit
  return convertToPixels(value)
}

/**
 * Convert inches to twips (for DOCX library)
 * 1 twip = 1/1440 inch = 1/20 point
 * @param inches - Inches
 * @returns Twips
 */
export function inchesToTwip(inches: number): number {
  return Math.round(inches * 1440)
}

/**
 * Convert pixels to twips
 * @param px - Pixels
 * @returns Twips
 */
export function pxToTwip(px: number): number {
  return inchesToTwip(pxToInches(px))
}
