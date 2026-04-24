import os
import io
import struct
from PIL import Image

def get_sw_preview(file_path: str) -> bytes:
    """
    Forensically extracts the embedded preview image from a SolidWorks file (.sldprt, .sldasm, .slddrw).
    SolidWorks files are OLE containers and usually embed a PNG or BMP in a 'Preview' stream.
    This function performs a signature-based search as a robust fallback.
    Returns PNG/JPG bytes.
    """
    if not os.path.exists(file_path):
        return None
        
    try:
        # SolidWorks previews are typically in OLE compound files.
        # We search for image signatures but also for stream names like "Preview"
        with open(file_path, 'rb') as f:
            file_size = os.path.getsize(file_path)
            
            # AGGRESSIVE UPGRADE: For older SW files (2013-2016), the preview can be anywhere.
            # We will scan the target file thoroughly.
            if file_size < 150 * 1024 * 1024:
                data = f.read()
            else:
                # For massive assemblies, we check the first and last 40MB
                f.seek(0)
                head = f.read(40 * 1024 * 1024)
                f.seek(max(0, file_size - 40 * 1024 * 1024))
                tail = f.read()
                data = head + b"..." + tail
                
        # 1. Search for "P r e v i e w" stream name in UTF-16
        # P\x00r\x00e\x00v\x00i\x00e\x00w\x00
        preview_utf16 = b'P\x00r\x00e\x00v\x00i\x00e\x00w\x00'
        
        # 2. Signatures to look for
        sigs = [
            (b'\x89PNG\r\n\x1a\n', "PNG"),
            (b'\xff\xd8\xff', "JPG"),
            (b'BM', "BMP"),
            (b'II\x2a\x00', "TIFF"),
            (b'MM\x00\x2a', "TIFF")
        ]

        # Prioritize search near "Preview" string if found
        search_start = 0
        p_idx = data.find(preview_utf16)
        if p_idx != -1:
            # Look around this area first
            search_start = max(0, p_idx - 1000)

        for sig, name in sigs:
            # We'll try from search_start first, then from the beginning
            indices = []
            curr = search_start
            while len(indices) < 5:
                idx = data.find(sig, curr)
                if idx == -1: break
                indices.append(idx)
                curr = idx + 1
            
            # If not found near "Preview", search from beginning
            if not indices:
                curr = 0
                while len(indices) < 10:
                    idx = data.find(sig, curr)
                    if idx == -1: break
                    indices.append(idx)
                    curr = idx + 1
            
            for idx in indices:
                try:
                    # Special check for BMP
                    if name == "BMP":
                        if idx + 14 >= len(data): continue
                        header_size = struct.unpack('<I', data[idx+14:idx+18])[0]
                        if header_size not in [12, 40, 56, 64, 108, 124]:
                            continue
                    
                    # Try to open the image. 
                    # If it fails with "broken stream", it might be because there are some 
                    # extra bytes or it's an OLE-wrapped PNG.
                    # We'll try up to 32 bytes offset to find the real start if PIL is touchy.
                    for offset in range(0, 32):
                        try:
                            img_data = data[idx+offset:]
                            img = Image.open(io.BytesIO(img_data))
                            
                            if img.width > 64 and img.height > 64:
                                img = img.convert("RGBA")
                                if img.width < 512:
                                    scale = 512 / img.width
                                    img = img.resize((512, int(img.height * scale)), Image.Resampling.LANCZOS)
                                
                                buf = io.BytesIO()
                                img.save(buf, format="PNG")
                                return buf.getvalue()
                        except:
                            continue
                except:
                    pass
        
        return None
    except Exception as e:
        print(f"SolidWorks Forensic extraction failed for {file_path}: {e}")
        return None

        return None
    except Exception as e:
        print(f"SolidWorks Forensic extraction failed for {file_path}: {e}")
        return None

if __name__ == "__main__":
    # Test stub
    pass
