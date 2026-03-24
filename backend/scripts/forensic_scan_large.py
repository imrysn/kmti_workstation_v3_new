import os
import struct

target_file = r'//KMTI-NAS/Database/PROJECTS/KMTI PJ/Fire Extinguisher & Entrance Flatform/Final data/entrance_rev8.icd'

def forensic_scan(path):
    print(f"Scanning {path}...")
    if not os.path.exists(path):
        print("File not found.")
        return
        
    try:
        with open(path, 'rb') as f:
            data = f.read(5 * 1024 * 1024) # Read up to 5MB
            
        sigs = {
            'BMP': b'BM',
            'PNG': b'\x89PNG',
            'JPG': b'\xff\xd8\xff',
            'EMF': b'\x01\x00\x00\x00',
            'WMF': b'\xd7\xcd\xc6\x9a',
            'ZLIB': b'\x78\x9c',
            'ZLIB_ALT': b'\x78\x01'
        }
        
        for name, sig in sigs.items():
            idx = data.find(sig)
            if idx != -1:
                print(f"Found {name} at offset {idx}")
                # For EMF, check signature at 40
                if name == 'EMF' and idx + 44 <= len(data):
                    emf_sig = data[idx+40:idx+44]
                    print(f"  EMF Sig at +40: {emf_sig.hex()} ({emf_sig})")
            
    except Exception as e:
        print(f"Error: {e}")

forensic_scan(target_file)
