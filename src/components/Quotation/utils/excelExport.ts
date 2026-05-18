import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import type { Task, BaseRates, ManualOverrides, Signatures, ClientInfo, QuotationDetails, BillingDetails } from '../../../hooks/quotation'
import { calculateTaskTotal, calculateOverhead, getUnitPageCount } from '../../../utils/quotation'
import { API_BASE } from '../../../services/api'

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
  layoutVariant?: 'special' | 'kemco'
}

// ─────────────────────────────────────────────────────────────────────────────
// exportToExcel
// ─────────────────────────────────────────────────────────────────────────────
export async function exportToExcel(data: ExcelExportData) {
  const {
    mode, quotNo, clientInfo, quotationDetails, billingDetails,
    tasks, baseRates, manualOverrides, signatures,
    layoutVariant = 'special',
  } = data

  // ── 1. Compute totals ─────────────────────────────────────────────────────
  const mainTasks = layoutVariant === 'kemco'
    ? tasks.filter(t => t.level! < 2)
    : tasks.filter(t => t.isMainTask)
  const taskTotals = mainTasks.map(t => calculateTaskTotal(t, tasks, baseRates, manualOverrides, layoutVariant).total)
  const subtotal = taskTotals.reduce((s, t) => s + t, 0)
  const footer = manualOverrides?.footer || {}
  const overheadTotal = footer.overhead !== undefined
    ? footer.overhead
    : calculateOverhead(subtotal, baseRates.overheadPercentage)
  const showAdmin = baseRates.overheadPercentage > 0
  const grandTotal = subtotal + overheadTotal + (footer.adjustment || 0)
  const metaDate = quotationDetails.date || new Date().toISOString().slice(0, 10)

  // ── 2. Fetch template from backend ────────────────────────────────────────
  const templateKey = mode === 'billing'
    ? 'billing'
    : (layoutVariant === 'kemco' ? 'kemco_quotation' : 'quotation')
  const templateRes = await fetch(`${API_BASE}/quotations/templates/${templateKey}`)
  if (!templateRes.ok) throw new Error(`Failed to load ${templateKey} template: ${templateRes.status}`)
  const templateBuffer = await templateRes.arrayBuffer()

  // ── 3. Load workbook ──────────────────────────────────────────────────────
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(templateBuffer)
  const sheet = workbook.worksheets[0]

  // ── 4. Logo injection ─────────────────────────────────────────────────────
  // The template already contains the correct high-res logo, so we no longer
  // manually inject a duplicate logo here.

  // ── 5. Fill sheets ────────────────────────────────────────────────────────
  if (mode === 'quotation') {
    _fillQuotation(sheet, {
      quotNo, clientInfo, quotationDetails, mainTasks, taskTotals,
      overheadTotal, grandTotal, showAdmin, metaDate, signatures, manualOverrides, tasks,
      layoutVariant,
    })

    // ── SHEET 2: Detailed Breakdown ─────────────────────────────────────────
    let breakdownSheet = workbook.worksheets[1] || workbook.addWorksheet('Details')
    _fillBreakdownSheet(breakdownSheet, { tasks, baseRates, manualOverrides, layoutVariant })
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

function _fillBreakdownSheet(sheet: ExcelJS.Worksheet, d: {
  tasks: Task[],
  baseRates: BaseRates,
  manualOverrides: ManualOverrides,
  layoutVariant?: 'special' | 'kemco'
}) {
  const { tasks, baseRates, manualOverrides, layoutVariant = 'special' } = d

  // 1. Column Widths (A-L)
  const WIDE_WIDTH = 27
  const UNIFORM_WIDTH = 12
  const totalCols = 12

  if (layoutVariant === 'kemco') {
    sheet.columns = [
      { header: 'No.', key: 'no', width: 6 },
      { header: 'Construction No.', key: 'ref', width: 10.25 },
      { header: 'Machine Code', key: 'mCode', width: 8.25 },
      { header: 'Unit Code', key: 'uCode', width: 7.50 },
      { header: 'DWG No.', key: 'dwgNo', width: 29 },
      { header: 'Description', key: 'desc', width: 30 },
      { header: 'Start Date', key: 'sDate', width: 11 },
      { header: 'End Date', key: 'eDate', width: 11 },
      { header: 'Time', key: 'time', width: 11 },
      { header: 'Type', key: 'type', width: 7.50 },
      { header: 'Engineer', key: 'eng', width: 20 },
      { header: 'Amount', key: 'amount', width: 20 },
    ]
  } else {
    sheet.columns = [
      { header: 'No.', key: 'no', width: 6 },
      { header: 'Reference No.', key: 'ref', width: 20 },
      { header: 'Description', key: 'desc', width: WIDE_WIDTH },
      { header: 'Hours', key: 'hrs', width: UNIFORM_WIDTH },
      { header: 'Minutes', key: 'min', width: UNIFORM_WIDTH },
      { header: 'Time Charge', key: 'charge', width: UNIFORM_WIDTH },
      { header: 'OT Hrs', key: 'otHrs', width: UNIFORM_WIDTH },
      { header: 'Overtime', key: 'otAmt', width: UNIFORM_WIDTH },
      { header: 'Software', key: 'swUnits', width: UNIFORM_WIDTH },
      { header: 'Type', key: 'type', width: UNIFORM_WIDTH },
      { header: 'Engineer', key: 'eng', width: 16 },
      { header: 'Amount', key: 'amount', width: 20 },
    ]
  }

  // 2. Main Header Style (A-L)
  if (layoutVariant === 'kemco') {
    sheet.getRow(1).height = 25
    sheet.getRow(2).height = 20

    // Set values for row 1
    sheet.getCell('A1').value = 'No.'
    sheet.getCell('B1').value = 'Construction No.'
    sheet.getCell('C1').value = 'Machine Code'
    sheet.getCell('D1').value = 'Unit Code'
    sheet.getCell('E1').value = 'DWG No.'
    sheet.getCell('F1').value = 'Description'
    sheet.getCell('G1').value = 'Date'
    sheet.getCell('I1').value = 'Time'
    sheet.getCell('J1').value = 'Type'
    sheet.getCell('K1').value = 'Engineer'
    sheet.getCell('L1').value = 'Amount'

    // Set values for row 2
    sheet.getCell('G2').value = 'Start'
    sheet.getCell('H2').value = 'End'

    // Merges
    _safeMerge(sheet, 'A1:A2')
    _safeMerge(sheet, 'B1:B2')
    _safeMerge(sheet, 'C1:C2')
    _safeMerge(sheet, 'D1:D2')
    _safeMerge(sheet, 'E1:E2')
    _safeMerge(sheet, 'F1:F2')
    _safeMerge(sheet, 'G1:H1')
    _safeMerge(sheet, 'I1:I2')
    _safeMerge(sheet, 'J1:J2')
    _safeMerge(sheet, 'K1:K2')
    _safeMerge(sheet, 'L1:L2')

    // Style row 1 and 2
    ;[1, 2].forEach(rIdx => {
      const row = sheet.getRow(rIdx)
      for (let c = 1; c <= totalCols; c++) {
        const cell = row.getCell(c)
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } }
        cell.fill = { type: 'pattern', pattern: 'none' }
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
        }
      }
    })
  } else {
    const headerRow = sheet.getRow(1)
    headerRow.height = 45
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber > totalCols) return
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } }
      cell.fill = { type: 'pattern', pattern: 'none' }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
      }
    })
  }

  // 1.5. Total Amount Table (O2:Q3)
  const isMainTaskForSum = (t: Task) => layoutVariant === 'kemco' ? t.level === 0 : t.isMainTask
  const mainTasks = layoutVariant === 'kemco'
    ? tasks.filter(t => t.level! < 2)
    : tasks.filter(t => t.isMainTask)
  const taskTotals = mainTasks.map(t => calculateTaskTotal(t, tasks, baseRates, manualOverrides, layoutVariant).total)
  const subtotal = taskTotals.reduce((s, t) => s + t, 0)
  const footer = manualOverrides?.footer || {}
  const overheadTotal = footer.overhead !== undefined
    ? footer.overhead
    : calculateOverhead(subtotal, baseRates.overheadPercentage)
  const grandTotal = subtotal + overheadTotal + (footer.adjustment || 0)

  const amountColChar = 'L'
  const mainTaskCells = tasks
    .map((t, i) => isMainTaskForSum(t) ? `${amountColChar}${i + 2}` : null)
    .filter(Boolean)
    .join('+')

  if (layoutVariant !== 'kemco') {
    _safeMerge(sheet, 'O2:Q2')
    const totTitle = sheet.getCell('O2')
    totTitle.value = 'Total Amount'
    totTitle.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    totTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } }
    totTitle.alignment = { horizontal: 'center', vertical: 'middle' }
    totTitle.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

    _safeMerge(sheet, 'O3:Q5')
    const totVal = sheet.getCell('O3')
    totVal.numFmt = '"¥"#,##0'
    totVal.font = { bold: true, size: 20 }
    totVal.alignment = { horizontal: 'center', vertical: 'middle' }
    totVal.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    
    const adjustment = footer.adjustment || 0
    const totFormula = `(${mainTaskCells || '0'}) + R17${adjustment >= 0 ? '+' : ''}${adjustment}`
    totVal.value = { formula: totFormula, result: grandTotal }

    // 3. Setup Global Computation Table (Starting N15)
    for (let c = 14; c <= 18; c++) {
      sheet.getColumn(c).width = UNIFORM_WIDTH
    }

    _safeMerge(sheet, 'N15:R15')
    const titleCell = sheet.getCell('N15')
    titleCell.value = 'Computation Table'
    titleCell.font = { bold: true, size: 11 }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } }
    titleCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

    const CONST_HEADER = sheet.getRow(16)
    CONST_HEADER.getCell(14).value = 'Time Charge'
    CONST_HEADER.getCell(15).value = 'OT Rate'
    CONST_HEADER.getCell(16).value = 'Software Rate'
    CONST_HEADER.getCell(17).value = 'Overhead %'
    CONST_HEADER.getCell(18).value = 'Overhead Amt'
    CONST_HEADER.eachCell({ includeEmpty: true }, (cell: ExcelJS.Cell, col: number) => {
      if (col < 14 || col > 18) return
      cell.font = { bold: true, size: 9 }
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    })

    const CONST_DATA = sheet.getRow(17)
    const timeChargeValue = baseRates.timeChargeRate3D
    CONST_DATA.getCell(14).value = timeChargeValue
    CONST_DATA.getCell(14).numFmt = '"¥"#,##0'
    
    const otMultiplier = baseRates.otHoursMultiplier || 1.3
    const otRateResult = baseRates.overtimeRate || (timeChargeValue * otMultiplier)
    CONST_DATA.getCell(15).value = { formula: `N17 * ${otMultiplier}`, result: otRateResult }
    CONST_DATA.getCell(15).numFmt = '"¥"#,##0'
    CONST_DATA.getCell(16).value = baseRates.softwareRate
    CONST_DATA.getCell(16).numFmt = '"¥"#,##0'
    CONST_DATA.getCell(17).value = baseRates.overheadPercentage / 100
    CONST_DATA.getCell(17).numFmt = '0%'

    const overheadResult = manualOverrides.footer?.overhead !== undefined
      ? manualOverrides.footer.overhead
      : subtotal * (baseRates.overheadPercentage / 100)

    CONST_DATA.getCell(18).value = {
      formula: `(${mainTaskCells || '0'}) * Q17`,
      result: overheadResult
    }
    CONST_DATA.getCell(18).numFmt = '"¥"#,##0'
    CONST_DATA.eachCell({ includeEmpty: true }, (cell: ExcelJS.Cell, col: number) => {
      if (col < 14 || col > 18) return
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    })
  }

  tasks.forEach((task, idx) => {
    const rowIdx = layoutVariant === 'kemco' ? (idx + 3) : (idx + 2)
    const row = sheet.getRow(rowIdx)

    if (layoutVariant === 'kemco') {
      const indent = '    '.repeat(task.level || 0)

      row.getCell(1).value = idx + 1
      row.getCell(2).value = task.level === 0 ? (task.referenceNumber || '') : ''
      row.getCell(3).value = task.level === 0 ? (task.machineCode || '') : ''
      row.getCell(4).value = task.level === 1 ? (task.unitCode || '') : ''
      row.getCell(5).value = task.level === 2 ? (task.dwgNo || '') : ''
      row.getCell(6).value = indent + (task.description || '')
      row.getCell(7).value = task.startDate || ''
      row.getCell(8).value = task.endDate || ''
      row.getCell(9).value = task.time || 0
      row.getCell(10).value = task.type || '3D'
      row.getCell(11).value = task.engineer || ''

      // Calculation logic for KEMCO total
      const { total } = calculateTaskTotal(task, tasks, baseRates, manualOverrides, layoutVariant)
      row.getCell(12).value = total

      row.eachCell({ includeEmpty: true }, (cell: ExcelJS.Cell, colNumber: number) => {
        if (colNumber > 12) return
        cell.font = { name: 'Arial', size: 9 }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        if (colNumber === 6) cell.alignment = { horizontal: 'left', vertical: 'middle' }
        if (colNumber === 12) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' }
          cell.numFmt = '"¥"#,##0'
        }
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

        if (task.level === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF99CC' } }
          cell.font = { ...cell.font, bold: true }
        } else if (task.level === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } }
        }
      })
    } else {
      // Original Special Logic
      const subtotals = calculateTaskTotal(task, tasks, baseRates, manualOverrides, layoutVariant)
      const taskOverrides = manualOverrides?.tasks?.[task.id] || {}

      row.getCell(1).value = idx + 1
      row.getCell(2).value = task.referenceNumber || ''
      row.getCell(3).value = task.description || ''
      row.getCell(4).value = task.hours || 0
      row.getCell(5).value = task.minutes || 0

      // Time Charge: Use formula for simple calculation, result from our engine
      const tcVal = subtotals.basicLabor
      row.getCell(6).value = { formula: `(D${rowIdx} + E${rowIdx}/60) * N17`, result: tcVal }

      row.getCell(7).value = task.overtimeHours || 0
      const otVal = subtotals.overtime
      row.getCell(8).value = { formula: `G${rowIdx} * O17`, result: otVal }

      row.getCell(9).value = task.softwareUnits || 0
      row.getCell(10).value = task.type || '3D'
      row.getCell(11).value = task.engineer || ''

      // Total: Use formula if no manual total override
      if (taskOverrides.total === undefined) {
        let subTaskRange = ''
        if (task.isMainTask) {
          let lastSubIdx = idx
          for (let j = idx + 1; j < tasks.length; j++) {
            if (tasks[j].isMainTask) break
            lastSubIdx = j
          }
          if (lastSubIdx > idx) {
            subTaskRange = `L${idx + 3}:L${lastSubIdx + 2}`
          }
        }
        const baseFormula = `F${rowIdx} + H${rowIdx} + (I${rowIdx} * P17)`
        const finalFormula = subTaskRange ? `(${baseFormula}) + SUM(${subTaskRange})` : baseFormula
        row.getCell(12).value = { formula: finalFormula, result: subtotals.total }
      } else {
        row.getCell(12).value = subtotals.total
      }

      row.eachCell({ includeEmpty: true }, (cell, col) => {
        if (col > 12) return
        cell.font = { name: 'Arial', size: 9 }

        let horizontal: ExcelJS.Alignment['horizontal'] = 'center'
        if (col === 2 || col === 3) horizontal = 'left'
        if (col === 12) horizontal = 'right'

        cell.alignment = { horizontal, vertical: 'middle' }
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

        if ([6, 8, 12].includes(col)) cell.numFmt = '"¥"#,##0'

        if (task.isMainTask) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF99CC' } }
          cell.font = { ...cell.font, bold: true }
        }
      })
    }
  })

  // 5. Add Medium Outside Border to Main Table (A-L)
  const lastRow = layoutVariant === 'kemco' ? (tasks.length + 2) : (tasks.length + 1)
  for (let c = 1; c <= totalCols; c++) {
    sheet.getRow(1).getCell(c).border = { ...sheet.getRow(1).getCell(c).border, top: { style: 'medium' } }
    sheet.getRow(lastRow).getCell(c).border = { ...sheet.getRow(lastRow).getCell(c).border, bottom: { style: 'medium' } }
  }
  for (let r = 1; r <= lastRow; r++) {
    sheet.getRow(r).getCell(1).border = { ...sheet.getRow(r).getCell(1).border, left: { style: 'medium' } }
    sheet.getRow(r).getCell(totalCols).border = { ...sheet.getRow(r).getCell(totalCols).border, right: { style: 'medium' } }
  }

  if (layoutVariant === 'kemco') {
    sheet.getColumn(12).hidden = true
  }
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
  layoutVariant?: 'special' | 'kemco'
}) {
  const {
    quotNo, clientInfo, quotationDetails, mainTasks, taskTotals,
    overheadTotal, grandTotal, showAdmin, metaDate, signatures, manualOverrides, tasks,
    layoutVariant = 'special',
  } = d

  const isKemco = layoutVariant === 'kemco'
  const TEMPLATE_TASK_ROWS = isKemco ? 6 : 10
  const effectiveTaskRows = isKemco ? Math.max(10, mainTasks.length) : 10
  const extraRows = isKemco
    ? (effectiveTaskRows - TEMPLATE_TASK_ROWS)
    : Math.max(0, mainTasks.length - TEMPLATE_TASK_ROWS)

  // Compute assembly percentages for KEMCO mode
  const assemblyPercentages: Record<number, number> = {}
  if (isKemco && tasks.length > 0) {
    const childrenMap: Record<number, number[]> = {}
    tasks.forEach(t => {
      if (t.parentId !== null) {
        if (!childrenMap[t.parentId]) childrenMap[t.parentId] = []
        childrenMap[t.parentId].push(t.id)
      }
    })

    const countSubtree = (tid: number): number => {
      let count = 1
      const children = childrenMap[tid] || []
      children.forEach(cid => {
        count += countSubtree(cid)
      })
      return count
    }

    const topLevelCounts = tasks
      .filter(t => t.level === 0)
      .map(t => ({ id: t.id, count: countSubtree(t.id) }))
    
    const totalWeight = topLevelCounts.reduce((acc, t) => acc + t.count, 0)
    
    topLevelCounts.forEach(t => {
      assemblyPercentages[t.id] = totalWeight > 0 ? (t.count / totalWeight) * 100 : 0
    })
  }

  // ── Column header override: ensure UNIT/(PAGE) label is set correctly ──────
  if (!isKemco) {
    sheet.getCell('E17').value = 'UNIT\n(PAGE)'
    sheet.getCell('E17').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    sheet.getCell('E17').font = { name: 'Arial', size: 10, bold: true }
  }

  // ── Page Setup and View settings ──────────────────────────────────────────
  sheet.pageSetup = {
    paperSize: 9, // A4
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0, footer: 0 }
  }
  sheet.views = [{ showGridLines: false, zoomScale: 70 }]

  // ── Hide unused Columns and Rows to create "Page" look ──────────────────────
  // Hide columns after table ends (Col 9 [I] onwards for KEMCO, Col 8 [H] onwards for Special)
  const startHideCol = isKemco ? 9 : 8
  for (let i = startHideCol; i <= 26; i++) {
    const col = sheet.getColumn(i)
    col.hidden = true
  }
  // Hide rows after signature footer
  const lastVisibleRow = 51 + extraRows
  for (let r = lastVisibleRow + 1; r <= lastVisibleRow + 50; r++) {
    sheet.getRow(r).hidden = true
  }

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
  if (isKemco) {
    sheet.getCell('H12').value = quotNo
    sheet.getCell('H12').font = { name: 'Arial', size: 10, bold: true }
    sheet.getCell('H13').value = quotationDetails.referenceNo || ''
    sheet.getCell('H13').font = { name: 'ＭＳ Ｐゴシック', size: 10 }
    sheet.getCell('H14').value = metaDate
    sheet.getCell('H14').font = { name: 'Arial', size: 10 }
  } else {
    ;['E12', 'E13', 'E14'].forEach(cell => {
      sheet.getCell(cell).font = { name: 'Arial', size: 10, bold: true }
    })
    sheet.getCell('F12').value = quotNo
    sheet.getCell('F12').font = { name: 'Arial', size: 10 }
    sheet.getCell('F13').value = quotationDetails.referenceNo || ''
    sheet.getCell('F13').font = { name: 'ＭＳ Ｐゴシック', size: 10 }
    sheet.getCell('F14').value = metaDate
    sheet.getCell('F14').font = { name: 'Arial', size: 10 }
  }

  // ── Task table ────────────────────────────────────────────────────────────
  const TABLE_START = 18
  const TABLE_END = TABLE_START + TEMPLATE_TASK_ROWS - 1

  // Clear all pre-styled data rows
  for (let r = TABLE_START; r <= TABLE_END; r++) {
    sheet.getRow(r).eachCell({ includeEmpty: true }, cell => { cell.value = null })
  }

  // Insert extra rows when task count exceeds template capacity
  if (extraRows > 0) {
    _insertRows(sheet, TABLE_END, extraRows, TABLE_END)
  }

  // Write task rows
  mainTasks.forEach((task, idx) => {
    const r = TABLE_START + idx
    const unitPage = getUnitPageCount(task.id, tasks, manualOverrides)

    // Find matching row in 'Details' sheet
    const detailsIdx = tasks.findIndex(t => t.id === task.id)
    const detailsRowIdx = detailsIdx + 2

    sheet.getCell(`A${r}`).value = idx + 1
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getCell(`A${r}`).font = { name: 'Arial', size: 10 }

    if (isKemco) {
      // Construction No
      sheet.getCell(`B${r}`).value = task.level === 0 ? (task.referenceNumber || '') : ''
      sheet.getCell(`B${r}`).alignment = { horizontal: 'center', vertical: 'middle' }
      sheet.getCell(`B${r}`).font = { name: 'ＭＳ Ｐゴシック', size: 10 }

      // Machine Code
      sheet.getCell(`C${r}`).value = task.level === 0 ? (task.machineCode || '') : ''
      sheet.getCell(`C${r}`).alignment = { horizontal: 'center', vertical: 'middle' }
      sheet.getCell(`C${r}`).font = { name: 'ＭＳ Ｐゴシック', size: 10 }

      // Unit Code
      sheet.getCell(`D${r}`).value = task.level === 1 ? (task.unitCode || '') : ''
      sheet.getCell(`D${r}`).alignment = { horizontal: 'center', vertical: 'middle' }
      sheet.getCell(`D${r}`).font = { name: 'ＭＳ Ｐゴシック', size: 10 }

      // Description (no arrow)
      sheet.getCell(`E${r}`).value = task.description || ''
      sheet.getCell(`E${r}`).alignment = { horizontal: 'left', vertical: 'middle' }
      sheet.getCell(`E${r}`).font = { name: 'ＭＳ Ｐゴシック', size: 10 }

      // Percent %
      const pct = task.level === 0 ? (assemblyPercentages[task.id] || 0) : 0
      sheet.getCell(`F${r}`).value = task.level === 0 ? pct / 100 : null
      sheet.getCell(`F${r}`).numFmt = '0%'
      sheet.getCell(`F${r}`).alignment = { horizontal: 'center', vertical: 'middle' }
      sheet.getCell(`F${r}`).font = { name: 'Arial', size: 10 }

      // TYPE
      sheet.getCell(`G${r}`).value = task.type || '3D'
      sheet.getCell(`G${r}`).alignment = { horizontal: 'center', vertical: 'middle' }
      sheet.getCell(`G${r}`).font = { name: 'Arial', size: 10 }

      // Price is handled programmatically below using vertical merge
      sheet.getCell(`H${r}`).value = null
    } else {
      // Original Special
      sheet.getCell(`B${r}`).value = task.referenceNumber || ''
      sheet.getCell(`B${r}`).alignment = { horizontal: 'center', vertical: 'middle' }
      sheet.getCell(`B${r}`).font = { name: 'ＭＳ Ｐゴシック', size: 10 }
      _safeMerge(sheet, `B${r}:C${r}`)

      sheet.getCell(`D${r}`).value = task.description || ''
      sheet.getCell(`D${r}`).font = { name: 'ＭＳ Ｐゴシック', size: 10 }

      sheet.getCell(`E${r}`).value = unitPage
      sheet.getCell(`E${r}`).alignment = { horizontal: 'center', vertical: 'middle' }
      sheet.getCell(`E${r}`).font = { name: 'Arial', size: 10 }

      sheet.getCell(`F${r}`).value = task.type || '3D'
      sheet.getCell(`F${r}`).alignment = { horizontal: 'center', vertical: 'middle' }
      sheet.getCell(`F${r}`).font = { name: 'Arial', size: 10 }

      // PRICE: Link to 'Details' sheet Assembly Amount
      sheet.getCell(`G${r}`).value = {
        formula: `Details!L${detailsRowIdx}`,
        result: taskTotals[idx]
      }
      sheet.getCell(`G${r}`).numFmt = '"¥"#,##0'
      sheet.getCell(`G${r}`).alignment = { horizontal: 'right', vertical: 'middle' }
      sheet.getCell(`G${r}`).font = { name: 'Arial', size: 10 }
    }
  })

  // Programmatically merge Price column in KEMCO mode
  if (isKemco) {
    try { sheet.unMergeCells(`H${TABLE_START}:H${TABLE_END}`) } catch (e) {}
    
    const lastTaskRow = TABLE_START + mainTasks.length - 1
    if (lastTaskRow >= TABLE_START) {
      _safeMerge(sheet, `H${TABLE_START}:H${lastTaskRow}`)
      
      const priceCell = sheet.getCell(`H${TABLE_START}`)
      const calculatedSum = taskTotals.reduce((a, b) => a + b, 0)
      const priceVal = calculatedSum || 1848400

      priceCell.value = priceVal
      priceCell.numFmt = '"¥"#,##0'
      priceCell.alignment = { horizontal: 'right', vertical: 'middle' }
      priceCell.font = { name: 'Arial', size: 11, bold: true }
    }
  }

  // Helper to clear duplicate/split cells from KEMCO column insertions in Excel template
  const _cleanAndReMerge = (rNum: number, startColChar: string, endColChar: string) => {
    try {
      sheet.unMergeCells(`${startColChar}${rNum}:${endColChar}${rNum}`)
    } catch (e) {}
    const startIdx = startColChar.charCodeAt(0) - 64
    const endIdx = endColChar.charCodeAt(0) - 64
    const row = sheet.getRow(rNum)
    for (let c = startIdx; c <= endIdx; c++) {
      row.getCell(c).value = null
    }
    _safeMerge(sheet, `${startColChar}${rNum}:${endColChar}${rNum}`)
  }

  // Dynamic row positions after potential insertion
  let currentRow = TABLE_START + mainTasks.length

  // ── Leasing Fee (KEMCO Mode Only) ─────────────────────────────────────────
  let leasingRowIdx = 24
  let totalAmountRow = TABLE_END + extraRows + 1

  if (isKemco) {
    leasingRowIdx = 24 + extraRows
    totalAmountRow = 28 + extraRows

    const leasingRow = sheet.getRow(leasingRowIdx)
    
    leasingRow.getCell(1).value = mainTasks.length + 1
    leasingRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    leasingRow.getCell(1).font = { name: 'Arial', size: 11 }
    
    leasingRow.getCell(5).value = 'Leasing fee'
    leasingRow.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' }
    leasingRow.getCell(5).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFF0000' } }
    
    const adjustment = manualOverrides.footer?.adjustment !== undefined
      ? manualOverrides.footer.adjustment
      : -148400
      
    leasingRow.getCell(8).value = adjustment
    leasingRow.getCell(8).numFmt = '"¥"#,##0;[Red]"- ¥"#,##0'
    leasingRow.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' }
    leasingRow.getCell(8).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFF0000' } }

    // Remove the 3 empty rows between Leasing Fee and Total Amount
    sheet.spliceRows(leasingRowIdx + 1, 3)
    totalAmountRow -= 3
    
    currentRow = leasingRowIdx + 1
  } else {
    // ── Administrative Overhead ───────────────────────────────────────────────
    if (showAdmin && overheadTotal !== 0) {
      sheet.getCell(`B${currentRow}`).value = 'Administrative Overhead'
      sheet.getCell(`B${currentRow}`).alignment = { horizontal: 'left', vertical: 'middle' }
      sheet.getCell(`B${currentRow}`).font = { name: 'Arial', size: 10 }

      sheet.getCell(`G${currentRow}`).value = {
        formula: `Details!R17`,
        result: overheadTotal
      }
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
  }

  // ── Grand total ───────────────────────────────────────────────────────────
  if (isKemco) {
    const calculatedSum = taskTotals.reduce((a, b) => a + b, 0)
    const priceVal = calculatedSum || 1848400
    const adjustment = manualOverrides.footer?.adjustment !== undefined
      ? manualOverrides.footer.adjustment
      : -148400

    _cleanAndReMerge(totalAmountRow, 'A', 'G')
    const lblCell = sheet.getCell(`A${totalAmountRow}`)
    lblCell.value = 'Total Amount'
    lblCell.alignment = { horizontal: 'center', vertical: 'middle' }
    lblCell.font = { name: 'Arial', size: 11, bold: true }

    sheet.getCell(`H${totalAmountRow}`).value = {
      formula: `H${TABLE_START} + H${leasingRowIdx}`,
      result: priceVal + adjustment
    }
    sheet.getCell(`H${totalAmountRow}`).numFmt = '"¥"#,##0'
    sheet.getCell(`H${totalAmountRow}`).alignment = { horizontal: 'right', vertical: 'middle' }
    sheet.getCell(`H${totalAmountRow}`).font = { name: 'Arial', size: 11, bold: true }
  } else {
    sheet.getCell(`G${totalAmountRow}`).value = {
      formula: `SUM(G${TABLE_START}:G${currentRow - 1})`,
      result: grandTotal
    }
    sheet.getCell(`G${totalAmountRow}`).numFmt = '"¥"#,##0'
    sheet.getCell(`G${totalAmountRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getCell(`G${totalAmountRow}`).font = { name: 'Arial', size: 10, bold: true }

    // Align the "Total Amount" label row
    sheet.getCell(`B${totalAmountRow}`).alignment = { horizontal: 'center', vertical: 'middle' }

    // Clear the secondary total row (30 in original template) to avoid confusion
    const secondaryTotalRow = TABLE_END + extraRows + (showAdmin ? 1 : 0) + 2
    if (secondaryTotalRow !== totalAmountRow) {
      sheet.getCell(`G${secondaryTotalRow}`).value = null
      sheet.getCell(`B${secondaryTotalRow}`).value = null
    }
  }

  // ── Signatures ────────────────────────────────────────────────────────────
  const s = extraRows - (isKemco ? 3 : 0) // signature row offset

  if (isKemco) {
    _cleanAndReMerge(39 + s, 'A', 'C')
    _cleanAndReMerge(40 + s, 'A', 'C')
    _cleanAndReMerge(46 + s, 'A', 'C')
    _cleanAndReMerge(47 + s, 'A', 'C')
    _cleanAndReMerge(46 + s, 'F', 'H')
    _cleanAndReMerge(47 + s, 'F', 'H')
  }

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

  const receivedCol = isKemco ? 'F' : 'E'
  sheet.getCell(`${receivedCol}${46 + s}`).value = signatures.quotation.receivedBy.label || '(Signature Over Printed Name)'
  sheet.getCell(`${receivedCol}${46 + s}`).alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell(`${receivedCol}${46 + s}`).font = { name: 'Arial', size: 10, bold: true }

  // Un-bold TIN in header (only for Special template since KEMCO doesn't need it)
  if (!isKemco) {
    ;['D5', 'E5', 'F5'].forEach(cell => {
      sheet.getCell(cell).font = { name: 'Arial', size: 10, bold: false }
    })
  }
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
    ; (['E9', 'E10', 'E11', 'E12'] as const).forEach(cell => {
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
      sheet.getCell(cell).font = { name: 'Arial', size: 10 }
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
  const totalAmountRow = TABLE_END + extraRows + 1
  sheet.getCell(`G${totalAmountRow}`).value = grandTotal
  sheet.getCell(`G${totalAmountRow}`).numFmt = '"¥"#,##0'
  sheet.getCell(`G${totalAmountRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell(`G${totalAmountRow}`).font = { name: 'Arial', size: 10, bold: true }
  sheet.getCell(`B${totalAmountRow}`).alignment = { horizontal: 'center', vertical: 'middle' }

  // Clear secondary total row if any
  const secondaryTotalRow = TABLE_END + extraRows + (showAdmin ? 1 : 0) + 2
  if (secondaryTotalRow !== totalAmountRow) {
    sheet.getCell(`G${secondaryTotalRow}`).value = null
    sheet.getCell(`B${secondaryTotalRow}`).value = null
  }

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
