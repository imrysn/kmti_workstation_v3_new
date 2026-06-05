import ExcelJS from 'exceljs'
import type { Task } from '../../../hooks/quotation'

/**
 * Parses the 'Details' worksheet of an uploaded Excel file to extract tasks.
 * Appends new unique IDs and maps parent-child hierarchy to prevent room conflicts.
 */
export async function importFromExcel(file: File, layoutVariant: 'special' | 'kemco'): Promise<Task[]> {
  const workbook = new ExcelJS.Workbook()
  const arrayBuffer = await file.arrayBuffer()
  await workbook.xlsx.load(arrayBuffer)

  // Find sheet containing 'details' in name (case insensitive)
  const sheet = workbook.getWorksheet('Details') || workbook.worksheets.find(w => w.name.toLowerCase().includes('detail'))
  if (!sheet) {
    throw new Error("Could not find the 'Details' sheet in the uploaded Excel file.")
  }

  // Auto-detect layout variant from column headers
  const headerRow = sheet.getRow(1)
  const col2Val = String(headerRow.getCell(2).value || '').trim().toLowerCase()
  const col3Val = String(headerRow.getCell(3).value || '').trim().toLowerCase()

  let detectedVariant: 'special' | 'kemco' = 'special'
  if (col3Val.includes('machine') || col2Val.includes('construction')) {
    detectedVariant = 'kemco'
  }

  if (detectedVariant !== layoutVariant) {
    throw new Error(
      `Layout Mismatch: The uploaded Excel file is formatted for the ${detectedVariant.toUpperCase()} layout, ` +
      `but this active workspace is using the ${layoutVariant.toUpperCase()} layout. ` +
      `Please upload an Excel file that matches your workspace configuration.`
    )
  }

  const tasks: Task[] = []
  const isKemco = layoutVariant === 'kemco'

  let lastLevel0TaskId: number | null = null
  let lastLevel1TaskId: number | null = null

  const startRow = isKemco ? 3 : 2
  const maxRows = sheet.rowCount

  for (let r = startRow; r <= maxRows; r++) {
    const row = sheet.getRow(r)
    
    // Check if the row is empty
    let isRowEmpty = true
    for (let c = 1; c <= (isKemco ? 14 : 12); c++) {
      const val = row.getCell(c).value
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        isRowEmpty = false
        break
      }
    }
    if (isRowEmpty) {
      continue
    }

    // Stop if we hit overhead, grand total, leasing, or signature sections
    let isTableEnd = false
    for (let c = 1; c <= (isKemco ? 14 : 12); c++) {
      const valStr = String(row.getCell(c).value || '').toLowerCase()
      if (
        valStr.includes('leasing fee') || 
        valStr.includes('total amount') || 
        valStr.includes('overhead') || 
        valStr.includes('nothing follow')
      ) {
        isTableEnd = true
        break
      }
    }
    if (isTableEnd) {
      break
    }

    const descCellVal = row.getCell(isKemco ? 6 : 3).value
    const descStr = descCellVal ? String(descCellVal) : ''
    const uniqueId = Date.now() + Math.floor(Math.random() * 10000) + r

    if (isKemco) {
      // KEMCO Layout Columns:
      // A (1): No.
      // B (2): Construction No.
      // C (3): Machine Code
      // D (4): Unit Code
      // E (5): DWG No.
      // F (6): Description (indented by spaces)
      // G (7): Start Date
      // H (8): End Date
      // I (9): Time
      // J (10): Rank of Drawing
      // K (11): Type
      // L (12): Unit Price
      // M (13): Engineer
      // N (14): Amount

      // Determine level by cell occupancy (or fall back to leading spaces of description string)
      let level = 2
      const hasUnitCode = !!row.getCell(4).value
      const hasConstNo = !!row.getCell(2).value
      const hasMachineCode = !!row.getCell(3).value

      if (hasConstNo || hasMachineCode) {
        level = 0
      } else if (hasUnitCode) {
        level = 1
      } else if (descStr) {
        const leadingSpaces = descStr.length - descStr.trimStart().length
        if (leadingSpaces >= 8) {
          level = 2
        } else if (leadingSpaces >= 4) {
          level = 1
        } else {
          level = 0
        }
      }

      let parentId: number | null = null
      if (level === 0) {
        lastLevel0TaskId = uniqueId
        lastLevel1TaskId = null
      } else if (level === 1) {
        parentId = lastLevel0TaskId
        lastLevel1TaskId = uniqueId
      } else if (level === 2) {
        parentId = lastLevel1TaskId
      }

      const cleanDesc = descStr.trim()

      const task: Task = {
        id: uniqueId,
        referenceNumber: String(row.getCell(2).value || ''),
        machineCode: String(row.getCell(3).value || ''),
        unitCode: String(row.getCell(4).value || ''),
        dwgNo: String(row.getCell(5).value || ''),
        description: cleanDesc,
        startDate: row.getCell(7).value ? new Date(String(row.getCell(7).value)).toISOString().split('T')[0] : '',
        endDate: row.getCell(8).value ? new Date(String(row.getCell(8).value)).toISOString().split('T')[0] : '',
        time: Number(row.getCell(9).value) || 0,
        drawingRank: String(row.getCell(10).value || ''),
        type: String(row.getCell(11).value || '3D'),
        unitPrice: Number(row.getCell(12).value) || 0,
        engineer: String(row.getCell(13).value || ''),
        amount: Number(row.getCell(14).value) || 0,
        isMainTask: level === 0,
        parentId,
        level,
        hours: 0,
        minutes: 0,
        overtimeHours: 0,
        softwareUnits: 0,
        unitType: 'JD',
      }
      tasks.push(task)
    } else {
      // Special Layout Columns:
      // A (1): No.
      // B (2): Reference No.
      // C (3): Description
      // D (4): Hours
      // E (5): Minutes
      // F (6): Time Charge (Amt)
      // G (7): OT Hrs
      // H (8): Overtime (Amt)
      // I (9): Software Units
      // J (10): Type
      // K (11): Engineer
      // L (12): Amount

      // Determine isMainTask by checking cell style/boldness
      const descCell = row.getCell(3)
      const isBold = !!(descCell.font?.bold)
      
      // Secondary check: main tasks in our export have a specific light pink fill: FFFF99CC
      const isMainTask = isBold || (descCell.fill as any)?.fgColor?.argb === 'FFFF99CC'

      let parentId: number | null = null
      let level = 0
      if (isMainTask) {
        lastLevel0TaskId = uniqueId
      } else {
        parentId = lastLevel0TaskId
        level = 1
      }

      const task: Task = {
        id: uniqueId,
        referenceNumber: String(row.getCell(2).value || ''),
        description: descStr,
        hours: Number(row.getCell(4).value) || 0,
        minutes: Number(row.getCell(5).value) || 0,
        overtimeHours: Number(row.getCell(7).value) || 0,
        softwareUnits: Number(row.getCell(9).value) || 0,
        type: String(row.getCell(10).value || '3D'),
        engineer: String(row.getCell(11).value || ''),
        amount: Number(row.getCell(12).value) || 0,
        isMainTask,
        parentId,
        level,
        unitType: 'JD',
      }
      tasks.push(task)
    }
  }

  return tasks
}
