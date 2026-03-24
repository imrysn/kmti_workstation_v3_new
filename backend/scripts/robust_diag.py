import os

sample_file = r'd:\RAYSAN\KMTI Data Management\Systems\KMTIPURCHASEPARTS\KMTIPURCHASEPARTS\bin\Debug\DesktopSPF-4040a.icd'
cache_file = r'd:\RAYSAN\KMTI Data Management\Systems\kmti_workstation_v3_new\backend\.preview_cache\shell_test_v4.png'

print(f"Sample file exists: {os.path.exists(sample_file)}")
print(f"Cache file exists: {os.path.exists(cache_file)}")

if os.path.exists(sample_file):
    try:
        with open(sample_file, 'rb') as f:
            data = f.read(1024 * 512) # Read first 512KB
            
        wmf_sig = b'\xd7\xcd\xc6\x9a'
        emf_sig = b'\x01\x00\x00\x00'
        png_sig = b'\x89PNG'
        jpg_sig = b'\xff\xd8\xff'
        bmp_sig = b'BM'
        
        print(f"WMF Index: {data.find(wmf_sig)}")
        print(f"EMF Index: {data.find(emf_sig)}")
        print(f"PNG Index: {data.find(png_sig)}")
        print(f"JPG Index: {data.find(jpg_sig)}")
        print(f"BMP Index: {data.find(bmp_sig)}")
        
    except Exception as e:
        print(f"Error reading sample: {e}")
