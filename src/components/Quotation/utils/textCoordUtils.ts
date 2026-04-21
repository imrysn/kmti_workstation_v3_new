/**
 * textCoordUtils.ts
 * ─────────────────────────────────────────────────────────────────
 * Utilities for calculating the pixel coordinates of text ranges
 * inside HTML input and textarea elements.
 */

export interface TextRangeRect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Calculates the bounding box of a character range relative to the input element.
 */
export function getTextRangeRects(
  input: HTMLInputElement | HTMLTextAreaElement,
  start: number,
  end: number
): TextRangeRect[] {
  const selection = { start, end }
  if (selection.start === selection.end) return []

  // Create or reuse hidden mirror element
  let mirror = document.getElementById('collab-mirror-div') as HTMLDivElement
  if (!mirror) {
    mirror = document.createElement('div')
    mirror.id = 'collab-mirror-div'
    mirror.style.position = 'absolute'
    mirror.style.visibility = 'hidden'
    mirror.style.pointerEvents = 'none'
    mirror.style.whiteSpace = 'pre-wrap'
    mirror.style.wordWrap = 'break-word'
    mirror.style.top = '-9999px'
    mirror.style.left = '-9999px'
    document.body.appendChild(mirror)
  }

  // Clone computed styles
  const style = window.getComputedStyle(input)
  const properties = [
    'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
    'line-height', 'text-transform', 'letter-spacing', 'word-spacing',
    'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
    'border-style', 'border-width', 'box-sizing', 'width', 'text-indent',
    'text-align', 'vertical-align', 'display'
  ]

  properties.forEach(prop => {
    mirror.style.setProperty(prop, style.getPropertyValue(prop))
  })

  // Ensure mirror is block-level for width/alignment to work
  mirror.style.display = 'block'

  const val = input.value
  const before = val.substring(0, start)
  const selected = val.substring(start, end)
  const after = val.substring(end)

  // Clear mirror
  mirror.textContent = ''

  // Build segments
  const spanBefore = document.createElement('span')
  spanBefore.textContent = before
  mirror.appendChild(spanBefore)

  const spanSelected = document.createElement('span')
  // For cursors (empty selection), we use a zero-width space to get the height/position
  spanSelected.textContent = selected || '\u200B' 
  spanSelected.id = 'collab-target-selection'
  mirror.appendChild(spanSelected)

  const spanAfter = document.createElement('span')
  spanAfter.textContent = after
  mirror.appendChild(spanAfter)

  // Force layout
  const selectionRect = spanSelected.getBoundingClientRect()
  const mirrorRect = mirror.getBoundingClientRect()

  // Calculate relative to mirror start
  const scrollLeft = input.scrollLeft
  const scrollTop = input.scrollTop

  return [{
    left: selectionRect.left - mirrorRect.left - scrollLeft,
    top: selectionRect.top - mirrorRect.top - scrollTop,
    width: selected ? selectionRect.width : 2, // 2px wide for cursors
    height: selectionRect.height
  }]
}
