import sys
import os
sys.path.append(r'd:\RAYSAN\KMTI Data Management\Systems\kmti_workstation_v3_new\backend\scripts\diagnostics')
from bitmap_harvester import harvest_bitmaps

def search_metafiles(file_path):
    print(f"Searching for metafiles in {file_path}...")
    try:
        with open(file_path, 'rb') as f:
            data = f.read()
            
        # WMF: \xd7\xcd\xc6\x9a
        # EMF: \x01\x00\x00\x00 (Record type 1 is header)
        wmf_sig = b'\xd7\xcd\xc6\x9a'
        emf_sig = b'\x01\x00\x00\x00'
        
        found_wmf = data.find(wmf_sig)
        found_emf = data.find(emf_sig)
        
        print(f"WMF found at: {found_wmf}")
        print(f"EMF found at: {found_emf}")
        
        if found_wmf != -1:
            with open("found_wmf.wmf", "wb") as f_out:
                f_out.write(data[found_wmf:found_wmf+100000]) # just a chunk
        if found_emf != -1:
            with open("found_emf.emf", "wb") as f_out:
                f_out.write(data[found_emf:found_emf+100000]) # just a chunk
                
    except Exception as e:
        print(f"Error: {e}")

sample_file = r'd:\RAYSAN\KMTI Data Management\Systems\KMTIPURCHASEPARTS\KMTIPURCHASEPARTS\bin\Debug\DesktopSPF-4040a.icd'
search_metafiles(sample_file)
