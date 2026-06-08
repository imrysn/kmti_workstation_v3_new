import openpyxl
import json
import sys

print("Loading workbook efficiently...")
try:
    wb = openpyxl.load_workbook(r'd:\RAYSAN\KMTI Data Management\Systems\kmti_workstation_v3_new\backend\data\KMTI Raw Material Calculator.xlsx', read_only=True, data_only=True)
    sheet = wb['Sheet2']
    
    data = []
    
    for i, row in enumerate(sheet.iter_rows(values_only=True)):
        # Inspect top 3 rows:
        if i < 3:
            print(f"Row {i}: {row}")
            continue
            
        if not row[0] and not row[1]:
            continue
            
        mat = str(row[0]).strip() if row[0] is not None else ""
        desc = str(row[1]).strip() if row[1] is not None else ""
        
        # We need to know which column holds the weight. Let's assume weight is at row[4] for now based on Sheet1, but we'll print row 3 to check.
        try:
            weight = float(str(row[4]).replace(',', '')) if row[4] is not None else 0.0
            data.append({
                "material": mat,
                "dimension": desc,
                "weight": weight
            })
        except ValueError:
            pass
            
    out_path = r'd:\RAYSAN\KMTI Data Management\Systems\kmti_workstation_v3_new\src\data\raw_materials.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print(f"Extracted {len(data)} rows to {out_path}")
    
except Exception as e:
    print("Error:", e)
