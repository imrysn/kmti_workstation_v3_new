import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

// Helper: medium border side
const M: Partial<ExcelJS.Border> = { style: 'medium' }
const T: Partial<ExcelJS.Border> = { style: 'thin' }

function applyBorder(
  cell: ExcelJS.Cell,
  top?: Partial<ExcelJS.Border>,
  bottom?: Partial<ExcelJS.Border>,
  left?: Partial<ExcelJS.Border>,
  right?: Partial<ExcelJS.Border>
) {
  cell.border = {
    ...(top    && { top }),
    ...(bottom && { bottom }),
    ...(left   && { left }),
    ...(right  && { right }),
  }
}

/**
 * High-Fidelity Excel Export for KMTI Quotations
 * Layout source: Quotation_KMTE-260423-12345_2026-04-27.xlsx
 */
export async function exportToExcel(quotationData: any) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Quotation', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0, right: 0, top: 0, bottom: 0, header: 0, footer: 0 }, printArea: 'A1:G50' },
    views: [{ showGridLines: true }],
  })

  // ─── 1. Column Widths (A–G) — exact from reference file ───────────────────
  sheet.columns = [
    { width: 6 },       // A
    { width: 7.125 },   // B
    { width: 18.25 },   // C
    { width: 40.375 },  // D
    { width: 17 },      // E
    { width: 9.25 },    // F
    { width: 22.625 },  // G
  ]

  // ─── 2. Row Heights — exact from reference file ────────────────────────────
  const rowHeights: Record<number, number> = {
    1: 21.75, 2: 15.75, 3: 13.5, 4: 13.5, 5: 18,
    6: 26.25, 7: 35.1, 8: 17.25, 9: 18, 10: 21,
    11: 16.5, 12: 17.25, 13: 17.25, 14: 14.25,
    15: 36.75, 16: 24.95, 26: 28.5, 27: 20.1,
    28: 13.5, 29: 15,
    33: 14.25, 36: 14.25, 37: 14.25, 38: 14.25,
    39: 14.25, 40: 14.25, 41: 14.25, 42: 14.25,
    43: 15, 44: 14.25, 45: 14.25, 46: 14.25, 48: 14.25,
  }
  Object.entries(rowHeights).forEach(([r, h]) => {
    sheet.getRow(Number(r)).height = h
  })
  // Table data rows 17–25 all get 20.1
  for (let r = 17; r <= 25; r++) sheet.getRow(r).height = 20.1

  // ─── 3. Logo (OneCellAnchor, 1.6" × 1.6" ≈ 120px at 96dpi) ───────────────
  try {
    const logoUrl = './src/assets/kmti_logo.png'
    const response = await fetch(logoUrl)
    const arrayBuffer = await response.arrayBuffer()
    const logo = workbook.addImage({ buffer: arrayBuffer, extension: 'png' })
    // 120px ≈ 1.6" at 96dpi — matches reference file anchor at tl col=0, row=0
    sheet.addImage(logo, { tl: { col: 0, row: 0 }, ext: { width: 120, height: 120 } })
  } catch (_) {}

  // ─── 4. Header Title (font: Anita Semi-square, size 20, bold) ─────────────
  sheet.mergeCells('C1:D2')
  const title1 = sheet.getCell('C1')
  title1.value = 'KUSAKABE & MAENO'
  title1.font = { name: 'Anita Semi-square', size: 20, bold: true }
  title1.alignment = { horizontal: 'center', vertical: 'middle' }

  sheet.mergeCells('C3:D4')
  const title2 = sheet.getCell('C3')
  title2.value = 'TECH., INC.'
  title2.font = { name: 'Anita Semi-square', size: 20, bold: true }
  title2.alignment = { horizontal: 'center', vertical: 'top' }

  // ─── 5. "Quotation" document title ────────────────────────────────────────
  sheet.mergeCells('C6:D6')
  const docTitle = sheet.getCell('C6')
  docTitle.value = 'Quotation'
  docTitle.font = { name: 'Arial', size: 20, bold: true }
  docTitle.alignment = { horizontal: 'center', vertical: 'middle' }

  // ─── 6. Company Info (rows 1–4: E:G, row 5: F:G) ─────────────────────────
  // Rows 1–4 use E:G merge; row 5 (TEL) uses F:G merge (E5 is blank)
  const companyRows: Array<{ merge: string; cell: string; value: string; size: number; bold?: boolean }> = [
    { merge: 'E1:G1', cell: 'E1', value: 'KUSAKABE & MAENO TECH., INC.',               size: 11, bold: true },
    { merge: 'E2:G2', cell: 'E2', value: 'Unit 2-B Building B, Vital Industrial Properties Inc.', size: 11 },
    { merge: 'E3:G3', cell: 'E3', value: 'First Cavite Industrial Estates, P-CIB PEZA Zone',      size: 11 },
    { merge: 'E4:G4', cell: 'E4', value: 'Dasmarinas City, Cavite Philippines',                    size: 11 },
  ]
  companyRows.forEach(({ merge, cell, value, size, bold }) => {
    sheet.mergeCells(merge)
    const c = sheet.getCell(cell)
    c.value = value
    c.font = { name: 'Arial', size, bold: bold ?? false }
    c.alignment = { horizontal: 'right' }
  })
  // TEL row: F5:G5 (E5 intentionally blank)
  sheet.mergeCells('F5:G5')
  const telCell = sheet.getCell('F5')
  telCell.value = 'TEL: +63-46-414-4009'
  telCell.font = { name: 'Arial', size: 11 }
  telCell.alignment = { horizontal: 'right' }

  // ─── 7. Client Info (rows 9–13) ───────────────────────────────────────────
  sheet.mergeCells('A9:C9')
  const quotTo = sheet.getCell('A9')
  quotTo.value = 'Quotation to:'
  quotTo.font = { name: 'Arial', size: 10, bold: true }

  sheet.mergeCells('A10:C10')
  const clientName = sheet.getCell('A10')
  clientName.value = quotationData.clientName || ''
  clientName.font = { name: 'Arial', size: 11, bold: true }

  sheet.mergeCells('A11:C11')
  const clientContact = sheet.getCell('A11')
  clientContact.value = quotationData.clientContact || ''
  clientContact.font = { name: 'Arial', size: 11, bold: true }

  sheet.mergeCells('A12:D12')
  const clientAddr = sheet.getCell('A12')
  clientAddr.value = quotationData.clientAddress || ''
  clientAddr.font = { name: 'Arial', size: 10 }
  clientAddr.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }

  sheet.mergeCells('A13:D13')
  const clientTel = sheet.getCell('A13')
  clientTel.value = `TEL: ${quotationData.clientTel || ''} FAX: ${quotationData.clientFax || ''}`
  clientTel.font = { name: 'Arial', size: 10 }
  clientTel.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }

  // ─── 8. Document Details (E10:G12) ────────────────────────────────────────
  // Labels in E; values in F:G merged
  const metaDate = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const metaRows = [
    { row: 10, label: 'Quotation NO.:',  value: quotationData.quotNo   || '', bold: true },
    { row: 11, label: 'REFERENCE NO.:', value: quotationData.clientRef || '', bold: false },
    { row: 12, label: 'DATE:',          value: quotationData.date      || metaDate, bold: false },
  ]
  metaRows.forEach(({ row, label, value, bold }) => {
    const labelCell = sheet.getCell(`E${row}`)
    labelCell.value = label
    labelCell.font = { name: 'Arial', size: 10 }
    labelCell.alignment = { horizontal: 'left' }

    sheet.mergeCells(`F${row}:G${row}`)
    const valCell = sheet.getCell(`F${row}`)
    valCell.value = value
    valCell.font = { name: 'Arial', size: 10, bold }
    valCell.alignment = { horizontal: 'left' }
    valCell.border = { bottom: T }
  })

  // ─── 9. Table Header (row 15) ─────────────────────────────────────────────
  // Columns: A=NO. | B:C=REFERENCE NO. | D=DESCRIPTION | E=UNIT | F=TYPE | G=PRICE
  // B15:C15 merged for "REFERENCE NO."; D15 standalone for "DESCRIPTION"
  sheet.mergeCells('B15:C15')

  sheet.getRow(15).height = 36.75

  const hdrFont = { name: 'Arial', size: 11, bold: true }
  const hdrAlign: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' }

  const hdrDefs: Array<{ col: number; value: string }> = [
    { col: 1, value: 'NO.' },
    { col: 2, value: 'REFERENCE NO.' },  // B15 (B15:C15 merged)
    { col: 4, value: 'DESCRIPTION' },    // D15
    { col: 5, value: 'UNIT' },
    { col: 6, value: 'TYPE' },
    { col: 7, value: 'PRICE' },
  ]
  hdrDefs.forEach(({ col, value }) => {
    const cell = sheet.getCell(15, col)
    cell.value = value
    cell.font = hdrFont
    cell.alignment = hdrAlign
  })

  // Header border: medium on top/bottom, medium on left(A)/right(G), thin between
  applyBorder(sheet.getCell(15, 1), M, M, M, T)  // A15
  applyBorder(sheet.getCell(15, 2), M, M, undefined, T)  // B15 (merged B:C)
  applyBorder(sheet.getCell(15, 4), M, M, T, T)  // D15
  applyBorder(sheet.getCell(15, 5), M, M, T, T)  // E15
  applyBorder(sheet.getCell(15, 6), M, M, T)      // F15
  applyBorder(sheet.getCell(15, 7), M, M, T, M)  // G15

  // ─── 10. Table Data Rows ──────────────────────────────────────────────────
  // Layout per row: A=no | B:C=refNo | D=description | E=qty | F=type | G=price
  // Fixed structure:
  //   Rows 16 to (16+tasks.length-1): task data
  //   Next row after tasks: Admin Overhead (B:C merged, no number in A)
  //   Row after that: NOTHING FOLLOW (D cell)
  //   Remaining rows up to row 25: empty bordered rows
  //   Row 26: Total

  const tasks = quotationData.tasks || []
  const TABLE_START = 16
  const TABLE_END = 25      // last data row before total

  // Row border helper for table body rows
  function applyTableRowBorders(r: number) {
    applyBorder(sheet.getCell(r, 1), T, T, M, T)  // A
    applyBorder(sheet.getCell(r, 2), T, T, undefined, T)  // B (merged B:C)
    applyBorder(sheet.getCell(r, 4), T, T, T, T)  // D
    applyBorder(sheet.getCell(r, 5), T, T, T, T)  // E
    applyBorder(sheet.getCell(r, 6), T, T, T)      // F
    applyBorder(sheet.getCell(r, 7), T, T, T, M)  // G
  }

  let currentRow = TABLE_START

  // Task rows
  tasks.forEach((task: any, idx: number) => {
    if (currentRow > TABLE_END - 2) return // guard: leave room for Overhead + NothingFollow
    sheet.mergeCells(`B${currentRow}:C${currentRow}`)

    sheet.getCell(`A${currentRow}`).value = idx + 1
    sheet.getCell(`A${currentRow}`).font = { name: 'Arial', size: 11 }
    sheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }

    sheet.getCell(`B${currentRow}`).value = task.refNo || ''
    sheet.getCell(`B${currentRow}`).font = { name: 'Arial', size: 11 }
    sheet.getCell(`B${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }

    sheet.getCell(`D${currentRow}`).value = task.description || ''
    sheet.getCell(`D${currentRow}`).font = { name: 'Arial', size: 11 }
    sheet.getCell(`D${currentRow}`).alignment = { horizontal: 'left', vertical: 'middle' }

    sheet.getCell(`E${currentRow}`).value = task.qty ?? 1
    sheet.getCell(`E${currentRow}`).font = { name: 'Arial', size: 11 }
    sheet.getCell(`E${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }

    sheet.getCell(`F${currentRow}`).value = task.type || ''
    sheet.getCell(`F${currentRow}`).font = { name: 'Arial', size: 11 }
    sheet.getCell(`F${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' }

    sheet.getCell(`G${currentRow}`).value = task.total ?? 0
    sheet.getCell(`G${currentRow}`).font = { name: 'Arial', size: 11 }
    sheet.getCell(`G${currentRow}`).numFmt = '"¥"#,##0'
    sheet.getCell(`G${currentRow}`).alignment = { horizontal: 'right', vertical: 'middle' }

    applyTableRowBorders(currentRow)
    currentRow++
  })

  // Admin Overhead row (A blank, B:C merged with label, rest empty but bordered)
  const overheadRow = currentRow
  sheet.mergeCells(`B${overheadRow}:C${overheadRow}`)
  sheet.getCell(`B${overheadRow}`).value = 'Administrative Overhead'
  sheet.getCell(`B${overheadRow}`).font = { name: 'Arial', size: 11 }
  sheet.getCell(`B${overheadRow}`).alignment = { horizontal: 'center' }
  applyTableRowBorders(overheadRow)
  currentRow++

  // NOTHING FOLLOW row (D cell, rest bordered)
  const nfRow = currentRow
  sheet.mergeCells(`B${nfRow}:C${nfRow}`)
  sheet.getCell(`D${nfRow}`).value = '\u2026\u2026NOTHING FOLLOW \u2026\u2026'
  sheet.getCell(`D${nfRow}`).font = { name: 'Arial', size: 11, bold: true }
  sheet.getCell(`D${nfRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  applyTableRowBorders(nfRow)
  currentRow++

  // Pad empty rows up to TABLE_END
  while (currentRow <= TABLE_END) {
    sheet.mergeCells(`B${currentRow}:C${currentRow}`)
    applyTableRowBorders(currentRow)
    currentRow++
  }

  // ─── 11. Total Row (row 26) ───────────────────────────────────────────────
  sheet.mergeCells('A26:F26')
  const totalLabel = sheet.getCell('A26')
  totalLabel.value = 'Total Amount'
  totalLabel.font = { name: 'Arial', size: 11, bold: true }
  totalLabel.alignment = { horizontal: 'center', vertical: 'middle' }
  applyBorder(totalLabel, M, M, M, T)

  const totalVal = sheet.getCell('G26')
  totalVal.value = quotationData.grandTotal ?? 0
  totalVal.font = { name: 'Arial', size: 11, bold: true }
  totalVal.numFmt = '"¥"#,##0'
  totalVal.alignment = { horizontal: 'center', vertical: 'middle' }
  applyBorder(totalVal, M, M, T, M)

  // ─── 12. Terms / Visual Notes (rows 28–29) ────────────────────────────────
  sheet.getCell('A28').value = 'Upon receipt of this quotation sheet, kindly send us one copy with your signature.'
  sheet.getCell('A28').font = { name: 'Arial', size: 10 }
  sheet.getCell('A29').value = 'The price will be changed without prior notice due to frequent changes of conversion rate.'
  sheet.getCell('A29').font = { name: 'Arial', size: 10 }

  // ─── 13. Signatures ───────────────────────────────────────────────────────
  // Prepared by (rows 33–38)
  sheet.getCell('A33').value = 'Prepared by:'
  sheet.getCell('A33').font = { name: 'Arial', size: 11 }

  // Signature line A36:C36 — thick bottom border
  const TK: Partial<ExcelJS.Border> = { style: 'medium' }
  sheet.mergeCells('A36:C36')
  ;['A36', 'B36', 'C36'].forEach(addr => {
    sheet.getCell(addr).border = { bottom: TK }
  })

  sheet.mergeCells('A37:C37')
  sheet.getCell('A37').value = quotationData.preparedBy || 'MR. MICHAEL PEÑANO'
  sheet.getCell('A37').font = { name: 'Arial', size: 10, bold: true }
  sheet.getCell('A37').alignment = { horizontal: 'center' }

  sheet.mergeCells('A38:C38')
  sheet.getCell('A38').value = 'Engineering Manager'
  sheet.getCell('A38').font = { name: 'Arial', size: 9 }
  sheet.getCell('A38').alignment = { horizontal: 'center' }

  // Approved by (rows 40–45)
  sheet.getCell('A40').value = 'Approved by:'
  sheet.getCell('A40').font = { name: 'Arial', size: 11 }

  sheet.mergeCells('A43:C43')
  ;['A43', 'B43', 'C43'].forEach(addr => {
    sheet.getCell(addr).border = { bottom: TK }
  })

  sheet.mergeCells('A44:C44')
  sheet.getCell('A44').value = 'MR. YUICHIRO MAENO'
  sheet.getCell('A44').font = { name: 'Arial', size: 10, bold: true }
  sheet.getCell('A44').alignment = { horizontal: 'center' }

  sheet.mergeCells('A45:C45')
  sheet.getCell('A45').value = 'President'
  sheet.getCell('A45').font = { name: 'Arial', size: 9 }
  sheet.getCell('A45').alignment = { horizontal: 'center' }

  // Received by (rows 40–44, cols E–F)
  sheet.getCell('E40').value = 'Received by:'
  sheet.getCell('E40').font = { name: 'Arial', size: 11 }

  sheet.mergeCells('E43:F43')
  ;['E43', 'F43'].forEach(addr => {
    sheet.getCell(addr).border = { bottom: TK }
  })

  sheet.mergeCells('E44:F44')
  sheet.getCell('E44').value = '(Signature Over Printed Name)'
  sheet.getCell('E44').font = { name: 'Arial', size: 10, bold: true }
  sheet.getCell('E44').alignment = { horizontal: 'center' }

  // ─── 14. Footer (row 48) ──────────────────────────────────────────────────
  sheet.getCell('A48').value = 'cc: admin/acctg/Engineering'
  sheet.getCell('A48').font = { name: 'Arial', size: 8 }

  sheet.getCell('F48').value = 'Admin Quotation Template v3.0-2026'
  sheet.getCell('F48').font = { name: 'Arial', size: 8 }

  // ─── 15. Save ─────────────────────────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, `Quotation_${quotationData.quotNo || 'Draft'}_${metaDate}.xlsx`)
}
