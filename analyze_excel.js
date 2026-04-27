const ExcelJS = require('exceljs');
const path = require('path');

async function analyze() {
  const workbook = new ExcelJS.Workbook();
  const filePath = path.resolve('d:/RAYSAN/KMTI Data Management/Systems/kmti_workstation_v3_new/backend/data/Quotation_KMTE-260423-12345_2026-04-27.xlsx');
  
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.getWorksheet(1);

  console.log('--- SHEET VIEW ---');
  console.log('ShowGridLines:', sheet.views[0]?.showGridLines);

  console.log('\n--- COLUMN WIDTHS ---');
  sheet.columns.forEach((col, i) => {
    console.log(`Col ${String.fromCharCode(65 + i)}: ${col.width}`);
  });

  console.log('\n--- MERGED CELLS ---');
  // @ts-ignore
  const merged = sheet._merges;
  Object.keys(merged).forEach(key => {
    console.log(`${key}`);
  });

  console.log('\n--- ROW HEIGHTS ---');
  sheet.eachRow((row, rowNumber) => {
    if (row.height) console.log(`Row ${rowNumber}: ${row.height}`);
  });

  console.log('\n--- CELL ANALYSIS (Selected) ---');
  const criticalCells = ['C1', 'C2', 'C4', 'A9', 'A10', 'A11', 'F9', 'H9', 'A15', 'C15', 'H15', 'A32', 'F32'];
  criticalCells.forEach(ref => {
    const cell = sheet.getCell(ref);
    console.log(`${ref}: "${cell.value}" | Font: ${JSON.stringify(cell.font)} | Align: ${JSON.stringify(cell.alignment)} | Fill: ${JSON.stringify(cell.fill)}`);
  });
}

analyze().catch(console.error);
