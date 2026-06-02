/**
 * focusUtils.ts
 * ─────────────────────────────────────────────────────────────────
 * Utility for "Enter → cell below" UX in the Computation Table.
 *
 * Behaviour mirrors Excel:
 *   - Enter moves focus DOWN to the same column in the next row.
 *   - If the cell below has no focusable input (e.g. a read-only
 *     calculated cell), it keeps searching downward until it finds one
 *     in that same column, or gives up.
 *   - Tab retains the default browser behaviour (next input in row).
 */

const FOCUSABLE = 'input:not([disabled]), select:not([disabled])'

/** Returns the index of the <td> that contains the given element. */
function getCellIndex(el: Element): number {
  const cell = el.closest('td')
  if (!cell) return -1
  const row = cell.parentElement
  if (!row) return -1
  return Array.from(row.children).indexOf(cell)
}

/**
 * Call this as onKeyDown on any table input.
 * On Enter: focus the first focusable element in the same <td> column
 * of the next <tr>, skipping rows that have nothing focusable there.
 */
export function focusNextInput(
  e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
) {
  if (e.key !== 'Enter') return
  e.preventDefault()

  const current = e.currentTarget
  const cellIndex = getCellIndex(current)
  if (cellIndex === -1) return

  const row = current.closest('tr')
  if (!row) return

  const tbody = row.closest('tbody')
  if (!tbody) return

  const rows = Array.from(tbody.querySelectorAll<HTMLTableRowElement>(':scope > tr'))
  const rowIndex = rows.indexOf(row as HTMLTableRowElement)

  // Walk downward looking for a row that has a focusable input in the same column
  for (let i = rowIndex + 1; i < rows.length; i++) {
    const cells = Array.from(rows[i].children)
    const targetCell = cells[cellIndex] as HTMLElement | undefined
    if (!targetCell) continue

    const input = targetCell.querySelector<HTMLElement>(FOCUSABLE)
    if (input) {
      input.focus()
      // Select text if it's a text input so the user can type immediately
      if (input instanceof HTMLInputElement && input.type === 'text') {
        input.select()
      }
      return
    }
  }
}
