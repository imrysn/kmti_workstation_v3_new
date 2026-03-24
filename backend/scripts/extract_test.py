import os
import re

def extract_embedded_png(file_path, output_prefix):
    try:
        with open(file_path, 'rb') as f:
            data = f.read()
            
        # PNG signature: \x89PNG\r\n\x1a\n
        png_sig = b'\x89PNG\r\n\x1a\n'
        # JPEG signature: \xff\xd8\xff
        jpg_sig = b'\xff\xd8\xff'
        
        matches = list(re.finditer(re.escape(png_sig), data))
        if not matches:
             matches = list(re.finditer(re.escape(jpg_sig), data))
             if not matches:
                return "No PNG or JPEG signatures found."
        
        for i, match in enumerate(matches):
            start = match.start()
            # For PNG, we need to find the IEND chunk: \x00\x00\x00\x00IEND\xaeB`\x82
            if data[start:start+8] == png_sig:
                iend = data.find(b'IEND', start)
                if iend != -1:
                    end = iend + 8 # IEND + CRC
                    png_data = data[start:end]
                    with open(f"{output_prefix}_{i}.png", 'wb') as out:
                        out.write(png_data)
                    return f"Extracted PNG at {start} to {output_prefix}_{i}.png"
            else:
                # For JPEG, find EOI: \xff\xd9
                eoi = data.find(b'\xff\xd9', start)
                if eoi != -1:
                    end = eoi + 2
                    jpg_data = data[start:end]
                    with open(f"{output_prefix}_{i}.jpg", 'wb') as out:
                        out.write(jpg_data)
                    return f"Extracted JPEG at {start} to {output_prefix}_{i}.jpg"
        
        return "Found signature but couldn't find end marker."
    except Exception as e:
        return f"Error: {str(e)}"

if __name__ == "__main__":
    test_file = r"d:\RAYSAN\KMTI Data Management\Systems\KMTIPURCHASEPARTS\KMTIPURCHASEPARTS\bin\Debug\DesktopSPF-4040a.icd"
    result = extract_embedded_png(test_file, "extracted")
    print(result)
