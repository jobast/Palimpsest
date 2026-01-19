/**
 * Shared Pagination Constants
 *
 * Centralized constants for pagination calculations to ensure consistency
 * across all pagination-related components and calculations.
 */

/**
 * Gap between pages in pixels (visual spacing)
 */
export const PAGE_GAP = 40

/**
 * Default header height in pixels when header is shown
 */
export const HEADER_HEIGHT = 40

/**
 * Default footer height in pixels when footer is shown
 */
export const FOOTER_HEIGHT = 40

/**
 * All pagination constants as an object for convenience
 */
export const PAGINATION_CONSTANTS = {
  PAGE_GAP,
  HEADER_HEIGHT,
  FOOTER_HEIGHT,
} as const
