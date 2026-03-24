import os
import struct

sample_file = r'd:\RAYSAN\KMTI Data Management\Systems\KMTIPURCHASEPARTS\KMTIPURCHASEPARTS\bin\Debug\DesktopSPF-4040a.icd'
output_emf = r'd:\RAYSAN\KMTI Data Management\Systems\kmti_workstation_v3_new\backend\scripts\extracted_thumb.emf'

if os.path.exists(sample_file):
    try:
        with open(sample_file, 'rb') as f:
            data = f.read()
            
        emf_start = data.find(b'\x01\x00\x00\x00')
        if emf_start != -1:
            print(f"EMF found at {emf_start}")
            # Check for EMF signature at offset 40 from emf_start
            # signature is ' EMF' (0x464D4520)
            sig = data[emf_start + 40 : emf_start + 44]
            print(f"Signature at offset 40: {sig.hex()} ({sig})")
            
            if sig == b' EMF':
                # Total file size is often at offset 48 (nBytes)
                n_bytes = struct.unpack('<I', data[emf_start + 48 : emf_start + 52])[0]
                print(f"EMF declared size: {n_bytes} bytes")
                
                emf_data = data[emf_start : emf_start + n_bytes]
                with open(output_emf, 'wb') as f_out:
                    f_out.write(emf_data)
                print(f"Extracted EMF to {output_emf}")
            else:
                print("Not a standard EMF metafile at this offset.")
        else:
            print("EMF header not found.")
            
    except Exception as e:
        print(f"Error: {e}")
