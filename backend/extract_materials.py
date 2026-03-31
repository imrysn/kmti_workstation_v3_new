import openpyxl
import json
import sys
import os

print("Loading workbook...")
try:
    wb = openpyxl.load_workbook(r'd:\RAYSAN\KMTI Data Management\Systems\kmti_workstation_v3_new\backend\data\KMTI Raw Material Calculator.xlsx', data_only=True)
    sheet = wb['RM Calculator']
    
    data = []
    
    # Skip header, iterate rows
    for i, row in enumerate(sheet.iter_rows(min_row=4, values_only=True)):
        if not row[0] and not row[1]:
            continue
        
        # row[0] Material, row[1] Description, row[4] Weight (kg)
        try:
            mat = str(row[0]).replace('\n', '').strip() if row[0] is not None else ""
            desc = str(row[1]).replace('\n', '').strip() if row[1] is not None else ""
            weight = float(row[4]) if row[4] is not None else 0.0
            
            data.append({
                "material": mat,
                "description": desc,
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
