import os
import io
from PIL import Image

def scan_for_embedded_images(file_path):
    try:
        if not os.path.exists(file_path): return None
        
        with open(file_path, 'rb') as f:
            data = f.read()
            
        print(f"Scanning {file_path} ({len(data)} bytes)...")
        
        # 1. Search for PNG
        png_magic = b'\x89PNG\r\n\x1a\n'
        png_idx = data.find(png_magic)
        if png_idx != -1:
            print(f"Found PNG at offset {png_idx}")
            # Try to load it
            try:
                img = Image.open(io.BytesIO(data[png_idx:]))
                return img
            except: pass

        # 2. Search for JPG
        jpg_magic = b'\xff\xd8\xff'
        jpg_idx = data.find(jpg_magic)
        if jpg_idx != -1:
            print(f"Found JPG at offset {jpg_idx}")
            try:
                img = Image.open(io.BytesIO(data[jpg_idx:]))
                return img
            except: pass

        # 3. Search for BMP (BM)
        bmp_magic = b'BM'
        # BMPs are trickier, but let's try finding all 'BM' and checking headers
        offset = 0
        while True:
            bmp_idx = data.find(bmp_magic, offset)
            if bmp_idx == -1: break
            try:
                img = Image.open(io.BytesIO(data[bmp_idx:]))
                print(f"Found valid BMP at offset {bmp_idx}")
                return img
            except:
                offset = bmp_idx + 2
                
        return None
    except Exception as e:
        print(f"Scanner Error: {e}")
        return None

if __name__ == "__main__":
    import sys
    # Real network paths from DB
    files = [
        r"//KMTI-NAS/Database/PROJECTS/KMTI PJ/Fire Extinguisher & Entrance Flatform/Final data/DWG/Frame-1.dwg",
        r"//KMTI-NAS/Database/PROJECTS/KMTI PJ/Fire Extinguisher & Entrance Flatform/Final data/FE_STND_2.icd",
        r"//KMTI-NAS/Database/PROJECTS/KMTI PJ/GARBAGE STORAGE/GARBAGE_STORAGE_FINAL.icd"
    ]
    
    for f in files:
        if not os.path.exists(f):
            print(f"Skipping {f} (Path not accessible)")
            continue
        img = scan_for_embedded_images(f)
        if img:
            out = os.path.basename(f) + "_extracted.png"
            img.save(out)
            print(f"Saved extracted image to {out}")
        else:
            print(f"No image found in {f}")
