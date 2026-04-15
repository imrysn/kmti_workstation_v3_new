/**
 * Quotation Print Layout Constants
 * Standard A4 dimensions and layout thresholds for consistent rendering.
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
  
  // Thresholds
  COMPRESSION_THRESHOLD: 14, // Switch to 5mm margin if tasks >= 14
  PAGINATION_THRESHOLD_OVERHEAD: 15, // Threshold when overhead is present
  PAGINATION_THRESHOLD_NO_OVERHEAD: 16, // Threshold when no overhead
  
  // Table Limits
  MAX_FIRST_PAGE_TASKS: 15,
  MIN_EMPTY_ROWS: 10,
  
  // Colors (Sync with CSS)
  COLOR_DIM_TEXT: '#888',
  COLOR_BORDER_THIN: '#000',
};
