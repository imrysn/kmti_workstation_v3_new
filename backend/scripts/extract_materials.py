import pandas as pd
import json
import sys

file_path = 'data/KMTI Raw Material Calculator.xlsx'

try:
    xl = pd.ExcelFile(file_path)
    df2 = xl.parse('Sheet2')

    # Column 6 is materials (index 5 if 0-indexed, wait, from previous dump:
    # 0: col0, 1: col1, 2: col2, 3: col3, 4: col4, 5: col5, 6: col6
    # Let's just find the columns containing 'S35C' and '7.85'
    
    materials = {}
    shapes = set()

    for idx, row in df2.iterrows():
        try:
            # Clean string conversions
            row_str = [str(x).strip() if pd.notna(x) else "" for x in row]
            
            # Find Material name and density based on common patterns
            # Materials are usually S35C, SS400, STKM, etc. Densities are usually 7.84, 7.85, 2.7, etc.
            
            mat_name = None
            mat_dens = None
            
            for i, val in enumerate(row_str):
                if val.upper() in ['S35C', 'S45C', 'SS400', 'STKM', 'STKR', 'S35C-D', 'S55C-D', 'SS400-D', 'S45C-D', 'SUS304', 'ALUMINUM', 'BRASS', 'COPPER']:
                    mat_name = val.upper()
                # Check if it's a density value
                try:
                    num = float(val)
                    if 2.0 <= num <= 9.0: # Densities g/cm3 for metal/alum are in this range
                        mat_dens = num
                except ValueError:
                    pass
            
            if mat_name and mat_dens:
                if mat_name not in materials:
                    materials[mat_name] = mat_dens
                    
            # Extract common shape types (Japanese names in col 1)
            if row_str[1]:
                shapes.add(row_str[1])
                
        except Exception:
            pass

    output = {
        "materials": materials,
        "standard_shapes": list(shapes)
    }

    with open('parsed_materials.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
        
    print(f"Successfully extracted {len(materials)} unique materials and their densities.")
    print("Materials:", materials)
    print(f"Extracted {len(shapes)} shape categories.")
    print("Shapes:", list(shapes)[:20]) # print first 20

except Exception as e:
    print(f"Error parsing Excel: {e}")
    sys.exit(1)
