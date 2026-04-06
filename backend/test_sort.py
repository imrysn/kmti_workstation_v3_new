import sqlite3
import os

db_path = r'd:\RAYSAN\KMTI Data Management\Systems\kmti_workstation_v3_new\backend\kmti.db'

if not os.path.exists(db_path):
    print("Database not found")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("--- TESTING DEFAULT SORT ---")
cursor.execute("SELECT eng_char FROM char_search ORDER BY eng_char ASC LIMIT 10")
for row in cursor.fetchall():
    print(row[0])

print("\n--- TESTING PRIORITY SORT (Current Logic) ---")
cursor.execute("SELECT eng_char FROM char_search ORDER BY (CASE WHEN eng_char GLOB '[A-Za-z]*' THEN 1 ELSE 0 END), eng_char ASC LIMIT 10")
for row in cursor.fetchall():
    print(row[0])

conn.close()
