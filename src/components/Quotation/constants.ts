/**
 * Quotation Print Layout Constants
 * Standard A4 dimensions and layout thresholds for consistent rendering.
 *
 * PAGINATION MODEL
 * ────────────────
 * Each page holds up to TASKS_PER_PAGE main tasks.  The engine in
 * PrintPreviewModal splits the task list into chunks of this size and
 * renders one PrintPage per chunk.  There is no longer a hard 2-page cap.
 *
 * Compression (tighter row height / margins) kicks in automatically when
 * a single page holds more than COMPRESSION_THRESHOLD tasks, giving a
 * little extra breathing room before spilling onto the next page.
 */

export const LAYOUT = {
  // A4 Dimensions
  A4_WIDTH_MM: 210,
  A4_HEIGHT_MM: 297,

  // A4 Dimensions in PX at 96 DPI (Standard Browser Zoom)
  A4_W_PX: 794,
  A4_H_PX: 1123,

  // Margins
  STANDARD_MARGIN_MM: 10,
  COMPRESSED_MARGIN_MM: 5,

  // How many main tasks fit comfortably on a single A4 page.
  // We use separate limits to ensure footers/signatures always fit.
  TASKS_PER_PAGE_QUOTATION: 14,
  TASKS_PER_PAGE_BILLING_STANDARD: 18, // For non-final pages (no footers)
  TASKS_PER_PAGE_BILLING_FINAL: 14,    // For the final page (with signatures/bank details)

  // Switch to 5mm margin when a page carries >= this many tasks.
  COMPRESSION_THRESHOLD: 14,

  // Minimum empty rows shown below the task list on the final page,
  // so the "NOTHING FOLLOW" row and grand total don't float awkwardly.
  MIN_EMPTY_ROWS: 3,

  // Colors (Sync with CSS)
  COLOR_DIM_TEXT: '#888',
  COLOR_BORDER_THIN: '#000',
} as const
