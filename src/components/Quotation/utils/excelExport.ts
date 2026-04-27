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
// QUOTATION FILLER
// ─────────────────────────────────────────────────────────────────────────────
//
// Verified layout from analyze_templates.js output:
//
//  HEADER
//    D1          Company name (static — in template)
//    D3          "Quotation" title (static)
//    G5–G9       Company address block (static)
//
//  CLIENT INFO
//    A11         "Quotation to:" label (static)
//    A12         client company
//    A13         client contact name
//    A14         client address   (merged A14:D14)
//    A15         client phone     (merged A15:D15)
//
//  DOCUMENT META (right side, merged pairs F:G)
//    E12 label / F12  Quotation NO.    ← write F12 (F:G merged)
//    E13 label / F13  Reference NO.   ← write F13 (no merge shown — but E13 is label)
//    E14 label / F14  Date            ← write F14 (F:G merged)
//
//  TASK TABLE  (10 pre-styled rows: 18–27)
//    A  = row index (NO.)
//    B  = reference number  (B:C merged per row)
//    D  = description
//    E  = unit / page count
//    F  = type
//    G  = price (¥)
//
//  OVERHEAD / FOOTER
//    B25 / G25   Administrative Overhead row  (B:C merged)
//    D26         "NOTHING FOLLOW" text
//    G28         Grand total
//
//  TERMS (static — in template)
//    A30, A31
//
//  SIGNATURES
//    A35         "Prepared by:" label
//    A39         prepared-by name    (merged A39:C39)
//    A40         prepared-by title   (merged A40:C40)
//    A42         "Approved by:" label
//    E42         "Received by:" label
//    A46         approved-by name    (merged A46:C46)
//    A47         approved-by title   (merged A47:C47)
//    E46         received-by label   (merged E46:F46)
//
//  FOOTER
//    A50         cc line (static)
//    F50         template version (static)
//
// ─────────────────────────────────────────────────────────────────────────────
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

  // ── Client info ───────────────────────────────────────────────────────────
  sheet.getCell('A12').value = clientInfo.company
  sheet.getCell('A12').font = { name: 'Arial', size: 10, bold: true, underline: false }
  sheet.getCell('A13').value = clientInfo.contact
  sheet.getCell('A13').font = { name: 'Arial', size: 10, bold: true, underline: true }
  sheet.getCell('A14').value = clientInfo.address
  sheet.getCell('A14').font = { name: 'Arial', size: 10 }
  sheet.getCell('A15').value = `TEL: ${clientInfo.phone || ''}`
  sheet.getCell('A15').font = { name: 'Arial', size: 10 }

    // ── Document meta ─────────────────────────────────────────────────────────
    // Bold the labels
    ;['E12', 'E13', 'E14'].forEach(cell => {
      const c = sheet.getCell(cell)
      c.font = { name: 'Arial', size: 10, bold: true }
    })

  // F12:G12 merged → write to F12
  sheet.getCell('F12').value = quotNo
  sheet.getCell('F12').font = { name: 'Arial', size: 10 }
  // E13 is label "REFERENCE NO." — value goes in F13 (no merge, but G13 appears blank)
  sheet.getCell('F13').value = quotationDetails.referenceNo || ''
  sheet.getCell('F13').font = { name: 'ＭＳ Ｐゴシック', size: 10 }
  // F14:G14 merged → write to F14
  sheet.getCell('F14').value = metaDate
  sheet.getCell('F14').font = { name: 'Arial', size: 10 }

  // ── Task table rows 18–27 (10 rows) ──────────────────────────────────────
  const TABLE_START = 18
  const TABLE_END = 27  // inclusive — 10 pre-styled rows
  const MAX_TASKS = 10

  // Clear all 10 data rows first (preserve border/fill styling, clear values only)
  for (let r = TABLE_START; r <= TABLE_END; r++) {
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
      sheet.getCell(`${col}${r}`).value = null
    })
  }
  // Clear overhead / nothing-follow / total placeholder values
  sheet.getCell('B25').value = null
  sheet.getCell('C25').value = null
  sheet.getCell('G25').value = null
  sheet.getCell('D26').value = null
  sheet.getCell('G28').value = null

  // Write task rows
  const tasksToShow = mainTasks.slice(0, MAX_TASKS)
  let currentRow = TABLE_START

  tasksToShow.forEach((task, idx) => {
    const unitPage = getUnitPageCount(task.id, tasks, manualOverrides)
    sheet.getCell(`A${currentRow}`).value = idx + 1
    sheet.getCell(`A${currentRow}`).font = { name: 'Arial', size: 10 }
    sheet.getCell(`B${currentRow}`).value = task.referenceNumber || ''
    sheet.getCell(`B${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getCell(`B${currentRow}`).font = { name: 'ＭＳ Ｐゴシック', size: 10 }
    sheet.getCell(`D${currentRow}`).value = task.description || ''
    sheet.getCell(`D${currentRow}`).font = { name: 'ＭＳ Ｐゴシック', size: 10 }
    sheet.getCell(`E${currentRow}`).value = unitPage
    sheet.getCell(`E${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getCell(`E${currentRow}`).font = { name: 'Arial', size: 10 }
    sheet.getCell(`F${currentRow}`).value = task.type || '3D'
    sheet.getCell(`F${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getCell(`F${currentRow}`).font = { name: 'Arial', size: 10 }
    sheet.getCell(`G${currentRow}`).value = taskTotals[idx]
    sheet.getCell(`G${currentRow}`).numFmt = '"¥"#,##0'
    sheet.getCell(`G${currentRow}`).alignment = { horizontal: 'right', vertical: 'middle' }
    sheet.getCell(`G${currentRow}`).font = { name: 'Arial', size: 10 }
    currentRow++
  })

  // ── Administrative Overhead ───────────────────────────────────────────────
  if (showAdmin && overheadTotal !== 0) {
    const adminRow = currentRow
    sheet.getCell(`B${adminRow}`).value = 'Administrative Overhead'
    sheet.getCell(`B${adminRow}`).alignment = { horizontal: 'left', vertical: 'middle' }
    sheet.getCell(`B${adminRow}`).font = { name: 'Arial', size: 10 }
    sheet.getCell(`G${adminRow}`).value = overheadTotal
    sheet.getCell(`G${adminRow}`).numFmt = '"¥"#,##0'
    sheet.getCell(`G${adminRow}`).alignment = { horizontal: 'right', vertical: 'middle' }
    sheet.getCell(`G${adminRow}`).font = { name: 'Arial', size: 10 }
    currentRow++
  }

  // ── Nothing Follow ────────────────────────────────────────────────────────
  const nfRow = currentRow
  sheet.getCell(`D${nfRow}`).value = '\u2026\u2026NOTHING FOLLOW \u2026\u2026'
  sheet.getCell(`D${nfRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell(`D${nfRow}`).font = { name: 'Arial', size: 11, bold: true }
  currentRow++

  // ── Grand total (G28) ─────────────────────────────────────────────────────
  sheet.getCell('G28').value = grandTotal
  sheet.getCell('G28').numFmt = '"¥"#,##0'
  sheet.getCell('G28').alignment = { horizontal: 'center', vertical: 'middle' }

  // ── Signatures ────────────────────────────────────────────────────────────
  // "Prepared by:" label is static in template at A35 — don't overwrite
  // Name at A39 (merged A39:C39), title at A40 (merged A40:C40)
  sheet.getCell('A39').value = signatures.quotation.preparedBy.name
  sheet.getCell('A39').alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell('A39').font = { name: 'Arial', size: 10, bold: true }
  sheet.getCell('A40').value = signatures.quotation.preparedBy.title || ''
  sheet.getCell('A40').alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell('A40').font = { name: 'Arial', size: 10, italic: true }

  // "Approved by:" at A42, "Received by:" at E42 — static in template
  // Approved name at A46 (merged A46:C46), title at A47 (merged A47:C47)
  sheet.getCell('A46').value = signatures.quotation.approvedBy.name
  sheet.getCell('A46').alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell('A46').font = { name: 'Arial', size: 10, bold: true }
  sheet.getCell('A47').value = signatures.quotation.approvedBy.title || ''
  sheet.getCell('A47').alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell('A47').font = { name: 'Arial', size: 10, italic: true }

  // Received by label at E46 (merged E46:F46)
  sheet.getCell('E46').value = signatures.quotation.receivedBy.label || '(Signature Over Printed Name)'
  sheet.getCell('E46').alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell('E46').font = { name: 'Arial', size: 10, bold: true }

  // Un-bold TIN in header (usually D5 for Quotation as well)
  ;['D5', 'E5', 'F5'].forEach(cell => {
    sheet.getCell(cell).font = { name: 'Arial', size: 10, bold: false }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// BILLING FILLER
// ─────────────────────────────────────────────────────────────────────────────
//
// Verified layout from analyze_templates.js output:
//
//  HEADER
//    D1          Company name (static)
//    D3–F3       Address line 1 (merged, static)
//    D4–F4       Address line 2 (merged, static)
//    D5–F5       VAT TIN (merged, static)
//    D7–F7       "BILLING STATEMENT" (merged, static)
//
//  DOCUMENT META (right side)
//    E9  label / F9   Date           (F9:G9 merged) ← write F9
//    E10 label / F10  Invoice No.    (F10:G10 merged) — NO: F10 merged with A10? 
//                     Actually: A10:C10 merged (client), F10 separate ← write F10
//    E11 label / F11  Quotation No.  (F11:G11 merged) ← write F11
//    E12 label / F12  Job Order No.  (F12:G12 merged — but A12:D12 is client addr)
//                     ← write F12
//    (No separate F10 merge listed — E10 is label, value cell is unlisted = F10)
//
//  CLIENT INFO (left side, merged A:C per row)
//    A10   client company     (merged A10:C10... actually merged with what?)
//    A11   client contact     (merged A11:...)
//    A12   client address     (merged A12:D12)
//    A13   client phone       (merged A13:D13)
//
//  TASK TABLE (10 pre-styled rows: 16–25)
//    A15 header row
//    A  = NO.
//    B  = reference number  (B:C merged per row)
//    D  = description
//    E  = unit / page count
//    F  = type
//    G  = price (¥)
//
//  OVERHEAD / FOOTER
//    B23 / G23   Administrative Overhead  (B:C merged)
//    D24         "NOTHING FOLLOW"
//    G26         Grand total
//
//  SIGNATURES
//    A29         "Prepared by:" label
//    E29         "Approved by:" label
//    A33         prepared-by name    (merged A33:C33)
//    E33         approved-by name    (merged E33:G33)
//    E40         final approver name (merged E40:G40)
//
//  BANK DETAILS
//    A43         "BANK DETAILS (Yen)" header (merged A43:C43)
//    B44 label / D44   Bank name
//    B45 label / D45   Account name
//    B46 label / D46   Account number
//    B47 label / D47   Bank address    (D47:G47 merged)
//    D48               Bank address line 2 (continuation)
//    B49 label / D49   Swift code
//    B50 label / D50   Branch code
//
// ─────────────────────────────────────────────────────────────────────────────
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
    ; (['E9', 'E10', 'E11', 'E12'] as const).forEach(cell => {
      const c = sheet.getCell(cell)
      c.font = { name: 'Arial', size: 10, bold: true }
    })

  sheet.getCell('F9').value = metaDate
  sheet.getCell('F9').font = { name: 'Arial', size: 10 }
  sheet.getCell('F10').value = billingDetails.invoiceNo || ''
  sheet.getCell('F10').font = { name: 'Arial', size: 10 }
  sheet.getCell('F11').value = quotNo
  sheet.getCell('F11').font = { name: 'Arial', size: 10 }
  sheet.getCell('F12').value = billingDetails.jobOrderNo || ''
  sheet.getCell('F12').font = { name: 'Arial', size: 10 }

  // Un-bold TIN line (D5)
  ;['D5', 'E5', 'F5'].forEach(cell => {
    sheet.getCell(cell).font = { name: 'Arial', size: 10, bold: false }
  })

  // ── Client info ───────────────────────────────────────────────────────────
  sheet.getCell('A10').value = clientInfo.company
  sheet.getCell(`A10`).font = { name: 'Arial', size: 10, bold: true, underline: false }
  sheet.getCell('A11').value = clientInfo.contact
  sheet.getCell(`A11`).font = { name: 'Arial', size: 10, bold: true, underline: true }
  sheet.getCell('A12').value = clientInfo.address
  sheet.getCell(`A12`).font = { name: 'Arial', size: 10 }
  sheet.getCell('A13').value = `TEL: ${clientInfo.phone || ''}`
  sheet.getCell(`A13`).font = { name: 'Arial', size: 10 }

  // ── Task table rows 16–25 (10 rows) ──────────────────────────────────────
  const TABLE_START = 16
  const TABLE_END = 25
  const MAX_TASKS = 10

  for (let r = TABLE_START; r <= TABLE_END; r++) {
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
      sheet.getCell(`${col}${r}`).value = null
    })
  }
  sheet.getCell('B23').value = null
  sheet.getCell('C23').value = null
  sheet.getCell('G23').value = null
  sheet.getCell('D24').value = null
  sheet.getCell('G26').value = null

  const tasksToShow = mainTasks.slice(0, MAX_TASKS)
  let currentRow = TABLE_START

  tasksToShow.forEach((task: Task, idx: number) => {
    sheet.getCell(`A${currentRow}`).font = { name: 'Arial', size: 10 }
    const unitPage = getUnitPageCount(task.id, tasks, manualOverrides)
    sheet.getCell(`A${currentRow}`).value = idx + 1
    sheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getCell(`B${currentRow}`).value = task.referenceNumber || ''
    sheet.getCell(`B${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getCell(`B${currentRow}`).font = { name: 'ＭＳ Ｐゴシック', size: 10 }
    sheet.getCell(`D${currentRow}`).value = task.description || ''
    sheet.getCell(`D${currentRow}`).font = { name: 'ＭＳ Ｐゴシック', size: 10 }
    sheet.getCell(`E${currentRow}`).value = unitPage
    sheet.getCell(`E${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getCell(`E${currentRow}`).font = { name: 'Arial', size: 10 }
    sheet.getCell(`F${currentRow}`).value = task.type || '3D'
    sheet.getCell(`F${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getCell(`F${currentRow}`).font = { name: 'Arial', size: 10 }
    sheet.getCell(`G${currentRow}`).value = taskTotals[idx]
    sheet.getCell(`G${currentRow}`).numFmt = '"¥"#,##0'
    sheet.getCell(`G${currentRow}`).font = { name: 'Arial', size: 10 }
    currentRow++
  })

  // ── Administrative Overhead ───────────────────────────────────────────────
  if (showAdmin && overheadTotal !== 0) {
    const adminRow = currentRow
    sheet.getCell(`B${adminRow}`).value = 'Administrative Overhead'
    sheet.getCell(`B${adminRow}`).alignment = { horizontal: 'left', vertical: 'middle' }
    sheet.getCell(`B${adminRow}`).font = { name: 'Arial', size: 10 }
    sheet.getCell(`G${adminRow}`).value = overheadTotal
    sheet.getCell(`G${adminRow}`).numFmt = '"¥"#,##0'
    sheet.getCell(`G${adminRow}`).font = { name: 'Arial', size: 10 }
    currentRow++
  }

  // ── Nothing Follow ────────────────────────────────────────────────────────
  const nfRow = currentRow
  sheet.getCell(`D${nfRow}`).value = '\u2026\u2026NOTHING FOLLOW \u2026\u2026'
  sheet.getCell(`D${nfRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell(`D${nfRow}`).font = { name: 'Arial', size: 11, bold: true }
  currentRow++

  // ── Grand total ───────────────────────────────────────────────────────────
  sheet.getCell('G26').value = grandTotal
  sheet.getCell('G26').numFmt = '"¥"#,##0'
  sheet.getCell('G26').alignment = { horizontal: 'center', vertical: 'middle' }

  // ── Signatures ────────────────────────────────────────────────────────────
  // Prepared by: name at A33 (merged A33:C33), title at A34
  sheet.getCell('A33').value = signatures.billing.preparedBy.name
  sheet.getCell('A33').alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell('A33').font = { name: 'Arial', size: 10, bold: true }

  sheet.mergeCells('A34:C34')
  const prepTitleCell = sheet.getCell('A34')
  prepTitleCell.value = signatures.billing.preparedBy.title || 'Accounting Staff'
  prepTitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  prepTitleCell.font = { name: 'Arial', size: 10, italic: true }

  // Approved by: name at E33 (merged E33:G33), title at E34
  sheet.getCell('E33').value = signatures.billing.approvedBy.name
  sheet.getCell('E33').alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell('E33').font = { name: 'Arial', size: 10, bold: true }

  sheet.mergeCells('E34:G34')
  const appTitleCell = sheet.getCell('E34')
  appTitleCell.value = signatures.billing.approvedBy.title || 'Engineering Manager'
  appTitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  appTitleCell.font = { name: 'Arial', size: 10, italic: true }

  // Final approver: name at E40 (merged E40:G40), title at E41
  sheet.getCell('E40').value = signatures.billing.finalApprover.name
  sheet.getCell('E40').alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell('E40').font = { name: 'Arial', size: 10, bold: true }

  sheet.mergeCells('E41:G41')
  const finalTitleCell = sheet.getCell('E41')
  finalTitleCell.value = signatures.billing.finalApprover.title || 'President'
  finalTitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  finalTitleCell.font = { name: 'Arial', size: 10, italic: true }

  // ── Bank details ──────────────────────────────────────────────────────────
  // Labels B44–B50 are static in the template.
  // Values go in column D (D44, D45, D46, D47/D48 for address, D49, D50).
  if (billingDetails.bankName) sheet.getCell('D44').value = billingDetails.bankName
  if (billingDetails.accountName) sheet.getCell('D45').value = billingDetails.accountName
  if (billingDetails.accountNumber) sheet.getCell('D46').value = billingDetails.accountNumber

  // Bank address: template has D47:G47 merged + D48 as overflow line.
  if (billingDetails.bankAddress) {
    const addressStr = billingDetails.bankAddress;
    const splitIndex = addressStr.toUpperCase().indexOf('LANGKAAN');

    if (splitIndex > 0) {
      sheet.getCell('D47').value = addressStr.substring(0, splitIndex).trim();
      sheet.getCell('D48').value = addressStr.substring(splitIndex).trim();
    } else {
      sheet.getCell('D47').value = addressStr;
      sheet.getCell('D48').value = null;
    }
  }

  if (billingDetails.swiftCode) sheet.getCell('D49').value = billingDetails.swiftCode
  if (billingDetails.branchCode) sheet.getCell('D50').value = billingDetails.branchCode
}
