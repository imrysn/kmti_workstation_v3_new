/**
 * analyze_templates.js
 * Run from project root: node analyze_templates.js
 *
 * Dumps the real cell layout of both Excel templates so we can
 * write accurate cell addresses in excelExport.ts.
 */
const ExcelJS = require('exceljs')
const path = require('path')

const TEMPLATES = [
  { key: 'quotation', file: 'backend/data/Quotation Template.xlsx' },
  { key: 'billing',   file: 'backend/data/Billing Template.xlsx' },
]

async function analyzeTemplate(filePath, label) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(filePath)
  const sheet = wb.worksheets[0]

  console.log('\n' + '='.repeat(60))
  console.log(`  ${label}`)
  console.log('='.repeat(60))
  console.log('Sheet name:', sheet.name)
  console.log('Dimensions:', sheet.dimensions)

  // ── Column widths ──────────────────────────────────────────────
  console.log('\n── COLUMN WIDTHS ──')
  sheet.columns.forEach((col, i) => {
    if (col.width) console.log(`  Col ${String.fromCharCode(65 + i)}: ${col.width}`)
  })

  // ── Merged cells ───────────────────────────────────────────────
  console.log('\n── MERGED CELLS ──')
  const merges = sheet._merges || {}
  if (Object.keys(merges).length === 0) {
    console.log('  (none)')
  } else {
    Object.keys(merges).forEach(k => console.log(' ', k))
  }

  // ── Row heights ────────────────────────────────────────────────
  console.log('\n── ROW HEIGHTS (non-default) ──')
  sheet.eachRow((row, rn) => {
    if (row.height) console.log(`  Row ${rn}: ${row.height}pt`)
  })

  // ── All non-empty cells ────────────────────────────────────────
  console.log('\n── NON-EMPTY CELLS ──')
  sheet.eachRow((row, rn) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value
      if (v === null || v === undefined || v === '') return
      const font = cell.font ? `font:{sz:${cell.font.size},bold:${cell.font.bold}}` : ''
      const align = cell.alignment
        ? `align:{h:${cell.alignment.horizontal},v:${cell.alignment.vertical}}`
        : ''
      console.log(`  ${cell.address.padEnd(6)} | ${String(v).padEnd(40)} | ${font} ${align}`.trimEnd())
    })
  })

  // ── Images (logo anchors) ──────────────────────────────────────
  console.log('\n── IMAGES ──')
  const images = sheet.getImages ? sheet.getImages() : []
  if (images.length === 0) {
    console.log('  (none embedded)')
  } else {
    images.forEach((img, i) => {
      console.log(`  Image ${i} exists`);
    })
  }

  // ── Print area / page setup ────────────────────────────────────
  console.log('\n── PAGE SETUP ──')
  console.log('  pageSetup:', sheet.pageSetup || {})
  console.log('  printArea:', sheet.printArea || '(not set)')
}

;(async () => {
  for (const { key, file } of TEMPLATES) {
    const abs = path.resolve(file)
    try {
      await analyzeTemplate(abs, key.toUpperCase() + ' TEMPLATE — ' + file)
    } catch (err) {
      console.error(`\nFailed to read ${file}:`, err.message)
    }
  }
  console.log('\n\nDone. Paste this output in the chat.')
})()
