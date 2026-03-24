import os
import re

def find_image_headers(file_path):
    headers = {
        'PNG': b'\x89PNG\r\n\x1a\n',
        'BMP': b'BM',
        'JPEG': b'\xff\xd8\xff',
        'WMF': b'\xd7\xcd\xc6\x9a',
        'EMF': b'\x01\x00\x00\x00\x58\x00\x00\x00',
    }
    
    results = []
    try:
        with open(file_path, 'rb') as f:
            data = f.read()
            for name, sig in headers.items():
                offsets = [m.start() for m in re.finditer(re.escape(sig), data)]
                if offsets:
                    results.append((name, offsets))
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        
    return results

if __name__ == "__main__":
    test_file = r"d:\RAYSAN\KMTI Data Management\Systems\KMTIPURCHASEPARTS\KMTIPURCHASEPARTS\bin\Debug\DesktopSPF-4040a.icd"
    found = find_image_headers(test_file)
    if found:
        print("Found potential image headers:")
        for name, offsets in found:
            print(f"  {name}: {len(offsets)} occurred at {offsets[:5]}...")
    else:
        print("No standard image headers found in .icd file.")
