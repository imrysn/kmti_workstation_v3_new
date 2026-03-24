import os
import struct

target_file = r'\\KMTI-NAS\Database\PROJECTS\WINDSMILE\Windsmile\3D\New folder\A.icd'

def forensic_scan(path):
    print(f"Scanning {path}...")
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return
        
    try:
        with open(path, 'rb') as f:
            data = f.read(10 * 1024 * 1024) # Read up to 10MB
            
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
            offset = 0
            while True:
                idx = data.find(sig, offset)
                if idx == -1: break
                
                print(f"Found {name} at offset {idx}")
                # For EMF, check signature at 40
                if name == 'EMF' and idx + 44 <= len(data):
                    emf_sig = data[idx+40:idx+44]
                    print(f"  EMF Sig at +40: {emf_sig.hex()} ({emf_sig})")
                
                # For BMP, check if it's a likely header
                if name == 'BMP' and idx + 14 <= len(data):
                    try:
                        b_size = struct.unpack('<I', data[idx+2:idx+6])[0]
                        if 1000 < b_size < 5000000:
                            print(f"  BMP Declared Size: {b_size}")
                    except: pass

                offset = idx + len(sig)
            
    except Exception as e:
        print(f"Error: {e}")

forensic_scan(target_file)
