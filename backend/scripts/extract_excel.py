import pandas as pd
import os

# Path
file_path = os.path.join(os.path.dirname(__file__), 'data', 'KMTI Raw Material Calculator.xlsx')

try:
    df = pd.read_excel(file_path, sheet_name=1)
    print("\n=== Sheet 2 (Header Audit) ===")
    print(df.iloc[:50, :10].fillna('').to_string())
except Exception as e:
    print(f"Error: {e}")
