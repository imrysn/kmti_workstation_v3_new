import openpyxl
import json

print("Extracting Sheet2 rows as list...")
try:
    wb = openpyxl.load_workbook(r'd:\RAYSAN\KMTI Data Management\Systems\kmti_workstation_v3_new\backend\data\KMTI Raw Material Calculator.xlsx', read_only=True, data_only=True)
    sheet = wb['Sheet2']
    
    data = []
    
    for i, row in enumerate(sheet.iter_rows(values_only=True)):
        # Convert row tuple to a list of str/num, dropping trailing Nones
        clean_row = []
        last_non_empty = -1
        for j, cell in enumerate(row):
            if cell is not None:
                last_non_empty = j
                
        if last_non_empty == -1:
            continue
            
        clean_row = [str(cell) if cell is not None else "" for cell in row[:last_non_empty+1]]
        data.append(clean_row)
        
    out_path = r'd:\RAYSAN\KMTI Data Management\Systems\kmti_workstation_v3_new\src\data\raw_materials_full.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(data[:10], f, ensure_ascii=False, indent=2)
        
    # Also save the whole file as json
    out_path_all = r'd:\RAYSAN\KMTI Data Management\Systems\kmti_workstation_v3_new\src\data\raw_materials_all.json'
    with open(out_path_all, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
        
    print(f"Extracted {len(data)} rows.")
    
except Exception as e:
    print("Error:", e)
