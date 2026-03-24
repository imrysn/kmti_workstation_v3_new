import os
import io
import struct
from PIL import Image

def get_dwg_preview(file_path: str) -> bytes:
    """
    Forensically extracts the embedded preview image from a DWG file (AC1015+).
    Bypasses OS Shell handlers completely.
    Returns PNG bytes.
    """
    if not os.path.exists(file_path):
        return None
        
    try:
        with open(file_path, 'rb') as f:
            data = f.read(100 * 1024) # Preview is almost always in the first 100KB
            
        # AC1015 16-byte Sentinel
        sentinel = bytes.fromhex("1F256D07D43628289D57CA3F9D44102B")
        
        start_idx = data.find(sentinel)
        if start_idx == -1:
            return None
            
        # The payload starts after the 16-byte sentinel
        offset = start_idx + 16
        
        # 1. Section Size (4 bytes)
        sec_size = struct.unpack('<I', data[offset:offset+4])[0]
        offset += 4
        
        # 2. Number of thumbnails (1 byte)
        num_thumbs = data[offset]
        offset += 1
        
        best_thumb_data = None
        best_type = None
        
        # 3. Read thumbnail directory
        for _ in range(num_thumbs):
            if offset + 9 > len(data): break
            t_type = data[offset]
            t_start = struct.unpack('<I', data[offset+1:offset+5])[0]
            t_size = struct.unpack('<I', data[offset+5:offset+9])[0]
            
            # Absolute offset in file!
            if t_start + t_size <= len(data):
                # We prefer WMF (2) or PNG (3) over BMP (1) because BMP is often just a header here
                if best_type is None or t_type > best_type:
                    best_thumb_data = data[t_start : t_start + t_size]
                    best_type = t_type
                    
            offset += 9
            
        if best_thumb_data and (best_type in [1, 2, 3]): # BMP, WMF or PNG
            try:
                img = Image.open(io.BytesIO(best_thumb_data))
                
                # Upscale if too small for the new large UI
                min_target_size = 1024
                if img.width < min_target_size or img.height < min_target_size:
                    scale = min_target_size / max(img.width, img.height)
                    new_size = (int(img.width * scale), int(img.height * scale))
                    # Use Lanczos for best quality upscaling
                    img = img.resize(new_size, Image.Resampling.LANCZOS)
                
                # Convert to RGBA for standard web display
                img = img.convert("RGBA")
                
                buf = io.BytesIO()
                img.save(buf, format="PNG")
                return buf.getvalue()
            except Exception as e:
                print(f"PIL could not decode DWG payload: {e}")
                
        return None
    except Exception as e:
        print(f"DWG Forensic extraction failed: {e}")
        return None

if __name__ == "__main__":
    pass
