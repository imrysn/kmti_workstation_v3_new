import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import type { Task, BaseRates, ManualOverrides, Signatures, ClientInfo, QuotationDetails, BillingDetails } from '../../../hooks/quotation'
import { calculateTaskTotal, calculateOverhead, getUnitPageCount } from '../../../utils/quotation'

export interface ExcelExportData {
  mode: 'quotation' | 'billing'
  quotNo: string
  clientInfo: ClientInfo
  quotationDetails: QuotationDetails
  billingDetails: BillingDetails
  tasks: Task[]
  baseRates: BaseRates
  manualOverrides: ManualOverrides
  signatures: Signatures
}

// ─────────────────────────────────────────────────────────────────────────────
// exportToExcel
// ─────────────────────────────────────────────────────────────────────────────
export async function exportToExcel(data: ExcelExportData) {
  const {
    mode, quotNo, clientInfo, quotationDetails, billingDetails,
    tasks, baseRates, manualOverrides, signatures,
  } = data

  // ── 1. Compute totals ─────────────────────────────────────────────────────
  const mainTasks = tasks.filter(t => t.isMainTask)
  const taskTotals = mainTasks.map(t => calculateTaskTotal(t, tasks, baseRates, manualOverrides).total)
  const subtotal = taskTotals.reduce((s, t) => s + t, 0)
  const footer = manualOverrides?.footer || {}
  const overheadTotal = footer.overhead !== undefined
    ? footer.overhead
    : calculateOverhead(subtotal, baseRates.overheadPercentage)
  const showAdmin = baseRates.overheadPercentage > 0
  const grandTotal = subtotal + overheadTotal + (footer.adjustment || 0)
  const metaDate = quotationDetails.date || new Date().toISOString().slice(0, 10)

  // ── 2. Fetch template from backend ────────────────────────────────────────
  const templateKey = mode === 'billing' ? 'billing' : 'quotation'
  const templateRes = await fetch(`http://localhost:8000/api/quotations/templates/${templateKey}`)
  if (!templateRes.ok) throw new Error(`Failed to load ${templateKey} template: ${templateRes.status}`)
  const templateBuffer = await templateRes.arrayBuffer()

  // ── 3. Load workbook ──────────────────────────────────────────────────────
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(templateBuffer)
  const sheet = workbook.worksheets[0]

  // ── 4. Logo injection ─────────────────────────────────────────────────────
  // The template already contains the correct high-res logo, so we no longer
  // manually inject a duplicate logo here.

  // ── 5. Fill sheet ─────────────────────────────────────────────────────────
  if (mode === 'quotation') {
    _fillQuotation(sheet, {
      quotNo, clientInfo, quotationDetails, mainTasks, taskTotals,
      overheadTotal, grandTotal, showAdmin, metaDate, signatures, manualOverrides, tasks,
    })
  } else {
    _fillBilling(sheet, {
      quotNo, clientInfo, billingDetails, mainTasks, taskTotals,
      overheadTotal, grandTotal, showAdmin, metaDate, signatures, manualOverrides, tasks,
    })
  }

  // ── 6. Save ───────────────────────────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const docType = mode === 'billing' ? 'Billing' : 'Quotation'
  saveAs(blob, `${docType}_${quotNo}_${metaDate}.xlsx`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Row insertion helper
// ─────────────────────────────────────────────────────────────────────────────
// Inserts `count` blank rows at `afterRow` (1-based), shifting everything below
// down. Copies cell styles from `styleSourceRow` so new rows match the template.
// Only row values are cleared on the source style row — borders/fills remain.
function _insertRows(sheet: ExcelJS.Worksheet, afterRow: number, count: number, styleSourceRow: number) {
  if (count <= 0) return
  sheet.spliceRows(afterRow + 1, 0, ...Array.from({ length: count }, () => []))
  // Copy style from the template's last pre-styled task row to each new row
  const srcRow = sheet.getRow(styleSourceRow)
  for (let i = 1; i <= count; i++) {
    const destRow = sheet.getRow(afterRow + i)
    srcRow.eachCell({ includeEmpty: true }, (srcCell, colNumber) => {
      const destCell = destRow.getCell(colNumber)
      // Copy borders and alignment; do not copy value
      destCell.style = { ...srcCell.style }
      destCell.value = null
    })
    destRow.height = srcRow.height
    destRow.commit()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUOTATION FILLER
// ─────────────────────────────────────────────────────────────────────────────
//
// Template layout (10 pre-styled task rows: 18–27):
//   A12–A15   client info
//   F12–F14   document meta (quotation no, ref no, date)
//   A18–G27   task rows (10 default)
//   B{admin}  Administrative Overhead  (dynamic — follows last task row)
//   D{nf}     NOTHING FOLLOW           (dynamic)
//   G28+delta Grand total              (G28 in 10-row template; shifts with insertions)
//   A39–A47   signatures
//   A50       footer
//
function _fillQuotation(sheet: ExcelJS.Worksheet, d: {
  quotNo: string
  clientInfo: ClientInfo
  quotationDetails: QuotationDetails
  mainTasks: Task[]
  taskTotals: number[]
  overheadTotal: number
  grandTotal: number
  showAdmin: boolean
  metaDate: string
  signatures: Signatures
  manualOverrides: ManualOverrides
  tasks: Task[]
}) {
  const {
    quotNo, clientInfo, quotationDetails, mainTasks, taskTotals,
    overheadTotal, grandTotal, showAdmin, metaDate, signatures, manualOverrides, tasks,
  } = d

  // ── Column header override: ensure UNIT/(PAGE) label is set correctly ──────
  sheet.getCell('E17').value = 'UNIT\n(PAGE)'
  sheet.getCell('E17').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  sheet.getCell('E17').font = { name: 'Arial', size: 10, bold: true }

  // ── Client info ───────────────────────────────────────────────────────────
  sheet.getCell('A12').value = clientInfo.company
  sheet.getCell('A12').font = { name: 'Arial', size: 10, bold: true }
  sheet.getCell('A13').value = clientInfo.contact
  sheet.getCell('A13').font = { name: 'Arial', size: 10, bold: true, underline: true }
  sheet.getCell('A14').value = clientInfo.address
  sheet.getCell('A14').font = { name: 'Arial', size: 10 }
  sheet.getCell('A15').value = `TEL: ${clientInfo.phone || ''}`
  sheet.getCell('A15').font = { name: 'Arial', size: 10 }

  // ── Document meta ─────────────────────────────────────────────────────────
  ;['E12', 'E13', 'E14'].forEach(cell => {
    sheet.getCell(cell).font = { name: 'Arial', size: 10, bold: true }
  })
  sheet.getCell('F12').value = quotNo
  sheet.getCell('F12').font = { name: 'Arial', size: 10 }
  sheet.getCell('F13').value = quotationDetails.referenceNo || ''
  sheet.getCell('F13').font = { name: 'ＭＳ Ｐゴシック', size: 10 }
  sheet.getCell('F14').value = metaDate
  sheet.getCell('F14').font = { name: 'Arial', size: 10 }

  // ── Task table ────────────────────────────────────────────────────────────
  const TABLE_START = 18
  const TEMPLATE_TASK_ROWS = 10
  const TABLE_END = TABLE_START + TEMPLATE_TASK_ROWS - 1  // 27

  // Clear all pre-styled data rows
  for (let r = TABLE_START; r <= TABLE_END; r++) {
    sheet.getRow(r).eachCell({ includeEmpty: true }, cell => { cell.value = null })
  }

  // Insert extra rows when task count exceeds template capacity
  const extraRows = Math.max(0, mainTasks.length - TEMPLATE_TASK_ROWS)
  if (extraRows > 0) {
    _insertRows(sheet, TABLE_END, extraRows, TABLE_END)
  }

  // Write task rows
  mainTasks.forEach((task, idx) => {
    const r = TABLE_START + idx
    const unitPage = getUnitPageCount(task.id, tasks, manualOverrides)
    sheet.getCell(`A${r}`).value = idx + 1
    sheet.getCell(`A${r}`).font = { name: 'Arial', size: 10 }
    sheet.getCell(`B${r}`).value = task.referenceNumber || ''
    sheet.getCell(`B${r}`).alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getCell(`B${r}`).font = { name: 'ＭＳ Ｐゴシック', size: 10 }
    sheet.getCell(`D${r}`).value = task.description || ''
    sheet.getCell(`D${r}`).font = { name: 'ＭＳ Ｐゴシック', size: 10 }
    sheet.getCell(`E${r}`).value = unitPage
    sheet.getCell(`E${r}`).alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getCell(`E${r}`).font = { name: 'Arial', size: 10 }
    sheet.getCell(`F${r}`).value = task.type || '3D'
    sheet.getCell(`F${r}`).alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getCell(`F${r}`).font = { name: 'Arial', size: 10 }
    sheet.getCell(`G${r}`).value = taskTotals[idx]
    sheet.getCell(`G${r}`).numFmt = '"¥"#,##0'
    sheet.getCell(`G${r}`).alignment = { horizontal: 'right', vertical: 'middle' }
    sheet.getCell(`G${r}`).font = { name: 'Arial', size: 10 }
  })

  // Dynamic row positions after potential insertion
  let currentRow = TABLE_START + mainTasks.length

  // ── Administrative Overhead ───────────────────────────────────────────────
  if (showAdmin && overheadTotal !== 0) {
    sheet.getCell(`B${currentRow}`).value = 'Administrative Overhead'
    sheet.getCell(`B${currentRow}`).alignment = { horizontal: 'left', vertical: 'middle' }
    sheet.getCell(`B${currentRow}`).font = { name: 'Arial', size: 10 }
    sheet.getCell(`G${currentRow}`).value = overheadTotal
    sheet.getCell(`G${currentRow}`).numFmt = '"¥"#,##0'
    sheet.getCell(`G${currentRow}`).alignment = { horizontal: 'right', vertical: 'middle' }
    sheet.getCell(`G${currentRow}`).font = { name: 'Arial', size: 10 }
    currentRow++
  }

  // ── Nothing Follow ────────────────────────────────────────────────────────
  sheet.getCell(`D${currentRow}`).value = '\u2026\u2026NOTHING FOLLOW \u2026\u2026'
  sheet.getCell(`D${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell(`D${currentRow}`).font = { name: 'Arial', size: 11, bold: true }
  currentRow++

  // ── Grand total ───────────────────────────────────────────────────────────
  // In the 10-row template the total row is at 28 (= TABLE_END + 1 row admin/nf + 1).
  // After insertion it shifts to currentRow + 1 (the template has one blank spacer
  // row between "NOTHING FOLLOW" and the total border row).
  const totalRow = TABLE_END + extraRows + (showAdmin ? 1 : 0) + 2  // +2: nf row + spacer
  sheet.getCell(`G${totalRow}`).value = grandTotal
  sheet.getCell(`G${totalRow}`).numFmt = '"¥"#,##0'
  sheet.getCell(`G${totalRow}`).alignment = { horizontal: 'center', vertical: 'middle' }

  // ── Signatures (shift by extraRows) ──────────────────────────────────────
  const s = extraRows  // signature row offset
  sheet.getCell(`A${39 + s}`).value = signatures.quotation.preparedBy.name
  sheet.getCell(`A${39 + s}`).alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell(`A${39 + s}`).font = { name: 'Arial', size: 10, bold: true }
  sheet.getCell(`A${40 + s}`).value = signatures.quotation.preparedBy.title || ''
  sheet.getCell(`A${40 + s}`).alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell(`A${40 + s}`).font = { name: 'Arial', size: 10, italic: true }

  sheet.getCell(`A${46 + s}`).value = signatures.quotation.approvedBy.name
  sheet.getCell(`A${46 + s}`).alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell(`A${46 + s}`).font = { name: 'Arial', size: 10, bold: true }
  sheet.getCell(`A${47 + s}`).value = signatures.quotation.approvedBy.title || ''
  sheet.getCell(`A${47 + s}`).alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell(`A${47 + s}`).font = { name: 'Arial', size: 10, italic: true }

  sheet.getCell(`E${46 + s}`).value = signatures.quotation.receivedBy.label || '(Signature Over Printed Name)'
  sheet.getCell(`E${46 + s}`).alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell(`E${46 + s}`).font = { name: 'Arial', size: 10, bold: true }

  // Un-bold TIN in header
  ;['D5', 'E5', 'F5'].forEach(cell => {
    sheet.getCell(cell).font = { name: 'Arial', size: 10, bold: false }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// BILLING FILLER
// ─────────────────────────────────────────────────────────────────────────────
//
// Template layout (10 pre-styled task rows: 16–25):
//   A10–A13   client info
//   F9–F12    document meta (date, invoice no, quotation no, job order no)
//   A16–G25   task rows (10 default)
//   B{admin}  Administrative Overhead  (dynamic)
//   D{nf}     NOTHING FOLLOW           (dynamic)
//   G26+delta Grand total              (G26 in 10-row template; shifts with insertions)
//   A33–E41   signatures
//   A43–D50   bank details
//
function _fillBilling(sheet: ExcelJS.Worksheet, d: {
  quotNo: string
  clientInfo: ClientInfo
  billingDetails: BillingDetails
  mainTasks: Task[]
  taskTotals: number[]
  overheadTotal: number
  grandTotal: number
  showAdmin: boolean
  metaDate: string
  signatures: Signatures
  manualOverrides: ManualOverrides
  tasks: Task[]
}) {
  const {
    quotNo, clientInfo, billingDetails, mainTasks, taskTotals,
    overheadTotal, grandTotal, showAdmin, metaDate, signatures, manualOverrides, tasks,
  } = d

  // ── Document meta ─────────────────────────────────────────────────────────
  ;(['E9', 'E10', 'E11', 'E12'] as const).forEach(cell => {
    sheet.getCell(cell).font = { name: 'Arial', size: 10, bold: true }
  })
  sheet.getCell('F9').value = metaDate
  sheet.getCell('F9').font = { name: 'Arial', size: 10 }
  sheet.getCell('F10').value = billingDetails.invoiceNo || ''
  sheet.getCell('F10').font = { name: 'Arial', size: 10 }
  sheet.getCell('F11').value = quotNo
  sheet.getCell('F11').font = { name: 'Arial', size: 10 }
  sheet.getCell('F12').value = billingDetails.jobOrderNo || ''
  sheet.getCell('F12').font = { name: 'Arial', size: 10 }

  // Un-bold TIN line
  ;['D5', 'E5', 'F5'].forEach(cell => {
    sheet.getCell(cell).font = { name: 'Arial', size: 10, bold: false }
  })

  // ── Column header override: ensure UNIT/(PAGE) label is set correctly ──────
  sheet.getCell('E15').value = 'UNIT\n(PAGE)'
  sheet.getCell('E15').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  sheet.getCell('E15').font = { name: 'Arial', size: 10, bold: true }

  // ── Client info ───────────────────────────────────────────────────────────
  sheet.getCell('A10').value = clientInfo.company
  sheet.getCell('A10').font = { name: 'Arial', size: 10, bold: true }
  sheet.getCell('A11').value = clientInfo.contact
  sheet.getCell('A11').font = { name: 'Arial', size: 10, bold: true, underline: true }
  sheet.getCell('A12').value = clientInfo.address
  sheet.getCell('A12').font = { name: 'Arial', size: 10 }
  sheet.getCell('A13').value = `TEL: ${clientInfo.phone || ''}`
  sheet.getCell('A13').font = { name: 'Arial', size: 10 }

  // ── Task table ────────────────────────────────────────────────────────────
  const TABLE_START = 16
  const TEMPLATE_TASK_ROWS = 10
  const TABLE_END = TABLE_START + TEMPLATE_TASK_ROWS - 1  // 25

  // Clear all pre-styled data rows
  for (let r = TABLE_START; r <= TABLE_END; r++) {
    sheet.getRow(r).eachCell({ includeEmpty: true }, cell => { cell.value = null })
  }

  // Insert extra rows when task count exceeds template capacity
  const extraRows = Math.max(0, mainTasks.length - TEMPLATE_TASK_ROWS)
  if (extraRows > 0) {
    _insertRows(sheet, TABLE_END, extraRows, TABLE_END)
  }

  // Write task rows
  mainTasks.forEach((task: Task, idx: number) => {
    const r = TABLE_START + idx
    const unitPage = getUnitPageCount(task.id, tasks, manualOverrides)
    sheet.getCell(`A${r}`).value = idx + 1
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getCell(`A${r}`).font = { name: 'Arial', size: 10 }
    sheet.getCell(`B${r}`).value = task.referenceNumber || ''
    sheet.getCell(`B${r}`).alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getCell(`B${r}`).font = { name: 'ＭＳ Ｐゴシック', size: 10 }
    sheet.getCell(`D${r}`).value = task.description || ''
    sheet.getCell(`D${r}`).font = { name: 'ＭＳ Ｐゴシック', size: 10 }
    sheet.getCell(`E${r}`).value = unitPage
    sheet.getCell(`E${r}`).alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getCell(`E${r}`).font = { name: 'Arial', size: 10 }
    sheet.getCell(`F${r}`).value = task.type || '3D'
    sheet.getCell(`F${r}`).alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getCell(`F${r}`).font = { name: 'Arial', size: 10 }
    sheet.getCell(`G${r}`).value = taskTotals[idx]
    sheet.getCell(`G${r}`).numFmt = '"¥"#,##0'
    sheet.getCell(`G${r}`).font = { name: 'Arial', size: 10 }
  })

  let currentRow = TABLE_START + mainTasks.length

  // ── Administrative Overhead ───────────────────────────────────────────────
  if (showAdmin && overheadTotal !== 0) {
    sheet.getCell(`B${currentRow}`).value = 'Administrative Overhead'
    sheet.getCell(`B${currentRow}`).alignment = { horizontal: 'left', vertical: 'middle' }
    sheet.getCell(`B${currentRow}`).font = { name: 'Arial', size: 10 }
    sheet.getCell(`G${currentRow}`).value = overheadTotal
    sheet.getCell(`G${currentRow}`).numFmt = '"¥"#,##0'
    sheet.getCell(`G${currentRow}`).font = { name: 'Arial', size: 10 }
    currentRow++
  }

  // ── Nothing Follow ────────────────────────────────────────────────────────
  sheet.getCell(`D${currentRow}`).value = '\u2026\u2026NOTHING FOLLOW \u2026\u2026'
  sheet.getCell(`D${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell(`D${currentRow}`).font = { name: 'Arial', size: 11, bold: true }
  currentRow++

  // ── Grand total ───────────────────────────────────────────────────────────
  const totalRow = TABLE_END + extraRows + (showAdmin ? 1 : 0) + 2  // +2: nf row + spacer
  sheet.getCell(`G${totalRow}`).value = grandTotal
  sheet.getCell(`G${totalRow}`).numFmt = '"¥"#,##0'
  sheet.getCell(`G${totalRow}`).alignment = { horizontal: 'center', vertical: 'middle' }

  // ── Signatures (shift by extraRows) ──────────────────────────────────────
  const s = extraRows

  // Prepared by: A33 name, A34 title (merge guard)
  sheet.getCell(`A${33 + s}`).value = signatures.billing.preparedBy.name
  sheet.getCell(`A${33 + s}`).alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell(`A${33 + s}`).font = { name: 'Arial', size: 10, bold: true }
  _safeMerge(sheet, `A${34 + s}:C${34 + s}`)
  sheet.getCell(`A${34 + s}`).value = signatures.billing.preparedBy.title || 'Accounting Staff'
  sheet.getCell(`A${34 + s}`).alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell(`A${34 + s}`).font = { name: 'Arial', size: 10, italic: true }

  // Approved by: E33 name, E34 title
  sheet.getCell(`E${33 + s}`).value = signatures.billing.approvedBy.name
  sheet.getCell(`E${33 + s}`).alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell(`E${33 + s}`).font = { name: 'Arial', size: 10, bold: true }
  _safeMerge(sheet, `E${34 + s}:G${34 + s}`)
  sheet.getCell(`E${34 + s}`).value = signatures.billing.approvedBy.title || 'Engineering Manager'
  sheet.getCell(`E${34 + s}`).alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell(`E${34 + s}`).font = { name: 'Arial', size: 10, italic: true }

  // Final approver: E40 name, E41 title
  sheet.getCell(`E${40 + s}`).value = signatures.billing.finalApprover.name
  sheet.getCell(`E${40 + s}`).alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell(`E${40 + s}`).font = { name: 'Arial', size: 10, bold: true }
  _safeMerge(sheet, `E${41 + s}:G${41 + s}`)
  sheet.getCell(`E${41 + s}`).value = signatures.billing.finalApprover.title || 'President'
  sheet.getCell(`E${41 + s}`).alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell(`E${41 + s}`).font = { name: 'Arial', size: 10, italic: true }

  // ── Bank details (shift by extraRows) ────────────────────────────────────
  const b = extraRows
  if (billingDetails.bankName) sheet.getCell(`D${44 + b}`).value = billingDetails.bankName
  if (billingDetails.accountName) sheet.getCell(`D${45 + b}`).value = billingDetails.accountName
  if (billingDetails.accountNumber) sheet.getCell(`D${46 + b}`).value = billingDetails.accountNumber

  if (billingDetails.bankAddress) {
    const addressStr = billingDetails.bankAddress
    // Split at the second comma (or "LANGKAAN" keyword) for the two-line address format
    const splitIdx = addressStr.toUpperCase().indexOf('LANGKAAN')
    if (splitIdx > 0) {
      sheet.getCell(`D${47 + b}`).value = addressStr.substring(0, splitIdx).trim()
      sheet.getCell(`D${48 + b}`).value = addressStr.substring(splitIdx).trim()
    } else {
      // Fallback: split at last comma before the midpoint
      const mid = Math.floor(addressStr.length / 2)
      const commaIdx = addressStr.lastIndexOf(',', mid + 20)
      if (commaIdx > 0) {
        sheet.getCell(`D${47 + b}`).value = addressStr.substring(0, commaIdx + 1).trim()
        sheet.getCell(`D${48 + b}`).value = addressStr.substring(commaIdx + 1).trim()
      } else {
        sheet.getCell(`D${47 + b}`).value = addressStr
        sheet.getCell(`D${48 + b}`).value = null
      }
    }
  }

  if (billingDetails.swiftCode) sheet.getCell(`D${49 + b}`).value = billingDetails.swiftCode
  if (billingDetails.branchCode) sheet.getCell(`D${50 + b}`).value = billingDetails.branchCode
}

// ─────────────────────────────────────────────────────────────────────────────
// safeMerge: merges cells only if not already merged (prevents ExcelJS throw)
// ─────────────────────────────────────────────────────────────────────────────
function _safeMerge(sheet: ExcelJS.Worksheet, range: string) {
  try {
    sheet.mergeCells(range)
  } catch {
    // Already merged — no-op
  }
}
