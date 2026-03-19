import pandas as pd
import json
import os

file_path = 'data/KMTI Raw Material Calculator.xlsx'

VALID_CATEGORIES = [
    '山形鋼', '溝形鋼', 'Ｉ形鋼', 'Ｈ形鋼', '平鋼', '丸鋼', '六角鋼', '鋼管',
    '四角鋼', '等辺山形鋼', '不等辺山形鋼', '不等辺不等厚山形鋼'
]

def extract_standard_tables():
    # Correct path to backend/data
    script_dir = os.path.dirname(__file__)
    data_path = os.path.join(script_dir, 'data', 'KMTI Raw Material Calculator.xlsx')
    
    xl = pd.ExcelFile(data_path)
    # Using index 1 for "Sheet 2"
    df = xl.parse(xl.sheet_names[1])
    
    print(f"Total rows in Sheet 2: {len(df)}")
    print(f"Columns: {df.columns.tolist()}")
    
    # Debug: Print unique values in col 2
    unique_cats = df.iloc[:, 2].unique()
    # Debug: Print unique values in col 1 (new category column)
    unique_cats = df.iloc[:, 1].unique()
    print(f"Unique values in column 1 (Category): {unique_cats[:50]}") # First 50 unique
    
    catalog = {}

    for i, row in df.iterrows():
        try:
            # Shifted Mapping based on audit:
            # iloc[0] -> Size (e.g. 200x90x8)
            # iloc[1] -> Category (e.g. 溝形鋼)
            # iloc[3] -> Unit Weight (kg/m)
            
            category = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ""
            if category not in VALID_CATEGORIES:
                continue

            # Normalize size string: 200×90×8 -> 200x90x8
            raw_size = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ""
            # Some sizes have / like 200x90x8/13.5. We take the part before / as a key too.
            size_str = raw_size.replace('×', 'x').replace(' ', '')
            
            # Weight is in column 3 (Unit Weight kg/m)
            kg_per_m = float(row.iloc[3])
            
            if not size_str or kg_per_m <= 0:
                continue
                
            if category not in catalog:
                catalog[category] = {}
            
            # Key 1: Full name (e.g. 200x90x8/13.5)
            catalog[category][size_str] = kg_per_m
            
            # Key 2: Base name (e.g. 200x90x8 if original was 200x90x8/13.5)
            if '/' in size_str:
                base_size = size_str.split('/')[0]
                if base_size not in catalog[category]:
                    catalog[category][base_size] = kg_per_m

        except:
            continue

    # Convert to sorted list structure
    final_catalog = []
    for cat_name, sizes in catalog.items():
        size_list = []
        for s_name, weight in sizes.items():
            size_list.append({"size": s_name, "weightPerMeter": weight})
        
        # Sort sizes
        size_list.sort(key=lambda x: x['size'])
        
        final_catalog.append({
            "name": cat_name,
            "sizes": size_list
        })
    
    final_catalog.sort(key=lambda x: x['name'])

    # Save to src/data/standard_shapes.json
    project_root = os.path.dirname(script_dir)
    output_path = os.path.join(project_root, 'src', 'data', 'standard_shapes.json')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(final_catalog, f, indent=2, ensure_ascii=False)
        
    print(f"Extracted {len(final_catalog)} valid categories with sizes.")
    print(f"Categories: {[c['name'] for c in final_catalog]}")
    print(f"Saved to {output_path}")

if __name__ == "__main__":
    extract_standard_tables()
