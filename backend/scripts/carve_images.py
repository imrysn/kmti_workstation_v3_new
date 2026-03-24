import os
from PIL import Image
import io

sample_file = r'd:\RAYSAN\KMTI Data Management\Systems\KMTIPURCHASEPARTS\KMTIPURCHASEPARTS\bin\Debug\DesktopSPF-4040a.icd'
output_dir = r'd:\RAYSAN\KMTI Data Management\Systems\kmti_workstation_v3_new\backend\scripts\carved'
os.makedirs(output_dir, exist_ok=True)

if os.path.exists(sample_file):
    try:
        with open(sample_file, 'rb') as f:
            data = f.read()
            
        offsets = [532, 512, 1024, 2048] # Common header sizes
        
        for offset in offsets:
            if offset < len(data):
                chunk = data[offset : offset + 200000] # 200KB chunk
                
                # Try to open as image directly
                try:
                    img = Image.open(io.BytesIO(chunk))
                    out_path = os.path.join(output_dir, f"carved_{offset}.png")
                    img.save(out_path)
                    print(f"SUCCESS: Decoded image at offset {offset} -> {out_path}")
                except Exception:
                    pass
                
                # Try searching for image headers in this chunk
                for sig, ext in [(b'BM', 'bmp'), (b'\x89PNG', 'png'), (b'\xff\xd8\xff', 'jpg'), (b'\x01\x00\x00\x00', 'emf')]:
                    idx = chunk.find(sig)
                    if idx != -1:
                        print(f"Found {ext} signature at relative offset {idx} (absolute {offset + idx})")
                        
    except Exception as e:
        print(f"Error: {e}")
