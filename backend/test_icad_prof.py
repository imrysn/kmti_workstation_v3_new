import os
import ctypes
from ctypes import wintypes
import pythoncom
from win32com.shell import shell, shellcon
from PIL import Image
import win32gui

# ---------------------------------------------------------
# GUIDs for iCAD SX (Fujitsu) Compatible Interfaces
# ---------------------------------------------------------
# IExtractImage: {BB2E617C-0920-11d1-9A0B-00C04FC2D6C1}
IID_IExtractImage = pythoncom.IID("{BB2E617C-0920-11d1-9A0B-00C04FC2D6C1}")

def get_icad_thumbnail_professional(file_path, size=512):
    """
    Professional iCAD SX Thumbnail Extraction.
    Stage 1: Attempt IExtractImage (Legacy CAD standard)
    Stage 2: Fallback to IShellItemImageFactory
    """
    if not os.path.exists(file_path):
        return None, "File not found"

    try:
        # 1. Initialize COM in STA Mode (Crucial for Japanese CAD Shell Extensions)
        pythoncom.CoInitializeEx(pythoncom.COINIT_APARTMENTTHREADED)
        
        abs_path = os.path.abspath(file_path)
        print(f">>> [DIAG] Prof-Extraction for: {abs_path}")

        # 2. Get the Shell Folder and Relative PIDL
        desktop = shell.SHGetDesktopFolder()
        pidl, _ = desktop.ParseDisplayName(0, None, abs_path)
        
        # Get parent folder and relative PIDL
        parent_folder_pidl, _ = shell.SHBindToParent(pidl, shell.IID_IShellFolder)
        if not parent_folder_pidl:
            return None, "Could not bind to parent folder"
            
        folder, relative_pidl = parent_folder_pidl
        
        # 3. GET IExtractImage interface from the item
        try:
            extractor = folder.GetUIObjectOf(0, [relative_pidl], IID_IExtractImage, 0)
            print("  [SUCCESS] Found IExtractImage interface.")
            
            # 4. Prepare for Extraction (GetLocation)
            # We need to call GetLocation(LPWSTR pszPathBuffer, DWORD cch, DWORD *pdwPriority, 
            # SIZE *prgSize, DWORD dwRecClrDepth, DWORD *pdwFlags)
            # pywin32 wrapper: GetLocation(size, depth, flags) -> (path, priority, flags)
            
            # Flags: IEIFLAG_SCREEN = 0x20 (Good for CAD)
            location, priority, flags = extractor.GetLocation((size, size), 32, shellcon.IEIFLAG_SCREEN)
            print(f"  [STEP] Location: {location}, Priority: {priority}, Flags: {flags}")
            
            # 5. PERFORM EXTRACTION (Extract)
            # pywin32 wrapper: Extract() -> hbitmap
            hbitmap = extractor.Extract()
            
            if hbitmap:
                print("  [STEP] Successfully extracted HBITMAP.")
                # Convert HBITMAP to PIL
                import win32ui
                hdc = win32gui.GetDC(0)
                dc = win32ui.CreateDCFromHandle(hdc)
                img_dc = dc.CreateCompatibleDC()
                bmp = win32ui.CreateBitmapFromHandle(hbitmap)
                img_dc.SelectObject(bmp)
                
                info = bmp.GetInfo()
                w, h = info['bmWidth'], info['bmHeight']
                bits = bmp.GetBitmapBits(True)
                img = Image.frombuffer('RGBA', (w, h), bits, 'raw', 'BGRA', 0, 1).convert('RGB')
                
                # Cleanup
                img_dc.DeleteDC()
                dc.DeleteDC()
                win32gui.ReleaseDC(0, hdc)
                win32gui.DeleteObject(hbitmap)
                
                return img, "Success via IExtractImage"
                
        except Exception as e:
            print(f"  [INFO] IExtractImage failed: {e}. Trying Factory...")

        # 6. Fallback Stage: IShellItemImageFactory
        try:
            si = shell.SHCreateItemFromParsingName(abs_path, None, shell.IID_IShellItem)
            # IShellItemImageFactory: {bcc18b79-ba16-442f-80c4-8059c18159ef}
            # Note: pywin32 doesn't always have the full wrapper, but we can try QueryInterface
            # But for simplicity in this diag, we've already tried ExtractImage.
            pass
        except: pass

        return None, "All interfaces failed to provide a valid HBITMAP."

    except Exception as e:
        return None, f"Fatal COM Error: {e}"
    finally:
        pythoncom.CoUninitialize()

if __name__ == "__main__":
    # Test with the file we saw in icd_native_extractor.py
    test_local = r"d:\RAYSAN\KMTI Data Management\Systems\KMTIPURCHASEPARTS\KMTIPURCHASEPARTS\bin\Debug\DesktopSPF-4040a.icd"
    
    img, msg = get_icad_thumbnail_professional(test_local)
    if img:
        out_path = "d:\\RAYSAN\\KMTI Data Management\\Systems\\kmti_workstation_v3_new\\backend\\test_prof_output.png"
        img.save(out_path)
        print(f"DONE! Preview saved to {out_path}")
    else:
        print(f"FAILED: {msg}")
