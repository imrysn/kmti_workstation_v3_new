import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import type { IQuotation } from '../types'

const parseDate = (dateStr?: string | null) => {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return d
}

export const exportBillingToExcel = async (quotations: IQuotation[]) => {
  try {
    const workbook = new ExcelJS.Workbook()

    // Group quotations by year
    const quotationsByYear: Record<string, IQuotation[]> = {}

    quotations.forEach(q => {
      let year = 'Unknown Year'
      if (q.date) {
        const d = new Date(q.date)
        if (!isNaN(d.getTime())) {
          year = d.getFullYear().toString()
        }
      }
      if (!quotationsByYear[year]) {
        quotationsByYear[year] = []
      }
      quotationsByYear[year].push(q)
    })

    const sortedYears = Object.keys(quotationsByYear).sort((a, b) => b.localeCompare(a))

    if (sortedYears.length === 0) {
      workbook.addWorksheet('General Quotation List')
    }

    sortedYears.forEach(year => {
      const yearQuotations = quotationsByYear[year]
      const sheet = workbook.addWorksheet(year)

      // Set default zoom
      sheet.views = [{ zoomScale: 80 }]

      // Define columns based on UI Table
      sheet.columns = [
        { header: '#', key: 'index', width: 5 },
        { header: 'Project\nIncharge', key: 'designerName', width: 25 },
        { header: 'Customer\nIncharge', key: 'customerIncharge', width: 25 },
        { header: 'Customer', key: 'clientName', width: 25 },
        { header: 'Quotation\nNumber', key: 'quotationNo', width: 22 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Amount', key: 'amount', width: 18 },
        { header: 'Quotation\nStatus', key: 'quotationStatus', width: 22 },
        { header: 'Project\nStatus', key: 'projectStatus', width: 20 },
        { header: 'Submitted To\nAdmin', key: 'submittedToAdminAt', width: 20 },
        { header: 'Bill To', key: 'billTo', width: 25 },
        { header: 'Date Paid', key: 'datePaid', width: 18 },
        { header: 'Update By', key: 'updatedBy', width: 15 },
        { header: 'Update Date', key: 'lastUpdatedAt', width: 15 },
        { header: 'Update Detail', key: 'updateDetail', width: 20 },
      ]

      // Style Header Row
      const headerRow = sheet.getRow(1)
      headerRow.height = 35 // Increase height for multiline headers
      for (let i = 1; i <= 15; i++) {
        const cell = headerRow.getCell(i)
        cell.font = { bold: true, color: { argb: 'FF000000' } } // Black text
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFFFF' } // White background
        }
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      }

      // Add Data
      yearQuotations.forEach((q, idx) => {
        const row = sheet.addRow({
          index: idx + 1,
          designerName: q.designerName || '-',
          customerIncharge: q.customerIncharge || '-',
          clientName: q.clientName || '-',
          quotationNo: q.quotationNo || '-',
          date: parseDate(q.date),
          amount: q.grandTotal ? q.grandTotal : 0,
          quotationStatus: q.quotationStatus || 'For Approval',
          projectStatus: q.projectStatus || 'On Going',
          submittedToAdminAt: parseDate(q.submittedToAdminAt),
          billTo: q.billTo || '-',
          datePaid: parseDate(q.datePaid),
          updatedBy: q.updatedBy || '-',
          lastUpdatedAt: parseDate(q.lastUpdatedAt),
          updateDetail: q.updateDetail || '-',
        })

        // Format Amount Column to currency string or number
        row.getCell('amount').numFmt = '"¥"#,##0;[Red]"¥"-#,##0'
        row.getCell('amount').alignment = { horizontal: 'right' }

        // Format Date Columns
        const dateCells = ['date', 'submittedToAdminAt', 'datePaid', 'lastUpdatedAt']
        dateCells.forEach(key => {
          const cell = row.getCell(key)
          cell.numFmt = 'yyyy/mm/dd'
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
          // Add date validation to prompt date picker in supported Excel versions
          cell.dataValidation = {
            type: 'date',
            allowBlank: true,
            operator: 'greaterThan',
            showErrorMessage: true,
            errorTitle: 'Invalid Date',
            error: 'Please enter a valid date.',
            formulae: [new Date(2000, 0, 1)]
          }
        })

        // Format Alignment
        row.alignment = { vertical: 'middle', horizontal: 'center' }
        row.getCell('amount').alignment = { horizontal: 'right', vertical: 'middle' }
        row.height = 25

        // Row styling based on status
        let rowTextColor = 'FF000000' // Default black
        let rowBgColor: string | null = null

        if (q.quotationStatus === 'CANCELLED') {
          rowTextColor = 'FFDC2626' // Red text
        } else if (q.quotationStatus === 'Approved') {
          rowBgColor = 'FF86EFAC' // Darker green background
        }

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if (colNumber <= 15) {
            cell.font = { color: { argb: rowTextColor } }
            if (rowBgColor) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: rowBgColor }
              }
            }
          }
        })

        // Apply Status Colors for Quotation Status
        const qStatusCell = row.getCell('quotationStatus')
        qStatusCell.alignment = { horizontal: 'center', vertical: 'middle' }

        // Add Dropdown Validation
        qStatusCell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"For Approval,Approved,Partial Billing,Billing Completion,CANCELLED"']
        }

        const qStatus = q.quotationStatus || 'For Approval'

        let qBg = 'FFFFFFFF'
        let qColor = 'FF000000'

        if (qStatus === 'For Approval') { qBg = 'FFFDF0D5'; qColor = 'FFD97706' }
        else if (qStatus === 'Approved') { qBg = 'FF86EFAC'; qColor = 'FF16A34A' }
        else if (qStatus === 'Partial Billing') { qBg = 'FFDBEAFE'; qColor = 'FF2563EB' }
        else if (qStatus === 'Billing Completion') { qBg = 'FFF3E8FF'; qColor = 'FF9333EA' }
        else if (qStatus === 'CANCELLED') { qBg = 'FFFEE2E2'; qColor = 'FFDC2626' }

        qStatusCell.font = { color: { argb: qColor }, bold: true }
        qStatusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: qBg } }

        // Apply Status Colors for Project Status
        const pStatusCell = row.getCell('projectStatus')
        pStatusCell.alignment = { horizontal: 'center', vertical: 'middle' }

        // Add Dropdown Validation
        pStatusCell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"On Going,Finished,CANCELLED"']
        }

        const pStatus = q.projectStatus || 'On Going'

        let pBg = 'FFFFFFFF'
        let pColor = 'FF000000'

        if (pStatus === 'On Going') { pBg = 'FFCFFAFE'; pColor = 'FF0891B2' }
        else if (pStatus === 'Finished') { pBg = 'FF86EFAC'; pColor = 'FF059669' }
        else if (pStatus === 'CANCELLED') { pBg = 'FFFEE2E2'; pColor = 'FFDC2626' }

        pStatusCell.font = { color: { argb: pColor }, bold: true }
        pStatusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pBg } }
      })

      // Add borders to all cells
      sheet.eachRow((row) => {
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if (colNumber <= 15) {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FF000000' } },
              left: { style: 'thin', color: { argb: 'FF000000' } },
              bottom: { style: 'thin', color: { argb: 'FF000000' } },
              right: { style: 'thin', color: { argb: 'FF000000' } }
            }
          }
        })
      })

    })

    // Export File
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const safeDate = new Date().toISOString().split('T')[0].replace(/-/g, '')
    saveAs(blob, `General_Quotation_List_${safeDate}.xlsx`)
  } catch (error: any) {
    console.error("Excel Export Error:", error)
    alert("Failed to export Excel: " + error.message)
  }
}
