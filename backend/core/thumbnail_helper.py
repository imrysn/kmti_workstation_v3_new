import os
import ctypes
from ctypes import wintypes
from PIL import Image
import io
import pythoncom
from win32com.shell import shell, shellcon
from win32 import win32gui
from typing import Optional

# ---------------------------------------------------------
# Professional COM Interface Definitions
# ---------------------------------------------------------
# IExtractImage: {BB2E617C-0920-11d1-9A0B-00C04FC2D6C1}
IID_IExtractImage = pythoncom.MakeIID("{BB2E617C-0920-11d1-9A0B-00C04FC2D6C1}")
# IShellItemImageFactory: {bcc18b79-ba16-442f-80c4-8059c18159ef}
IID_IShellItemImageFactory = pythoncom.MakeIID("{bcc18b79-ba16-442f-80c4-8059c18159ef}")

def _hbitmap_to_pil(hbitmap):
    """Converts a Windows HBITMAP to a PIL Image using win32ui for bit-safety."""
    import win32ui
    hdc = win32gui.GetDC(0)
    dc = win32ui.CreateDCFromHandle(hdc)
    memdc = dc.CreateCompatibleDC()
    
    bmp = win32ui.CreateBitmapFromHandle(hbitmap)
    info = bmp.GetInfo()
    w, h = info['bmWidth'], info['bmHeight']
    
    memdc.SelectObject(bmp)
    bits = bmp.GetBitmapBits(True)
    img = Image.frombuffer('RGBA', (w, h), bits, 'raw', 'BGRA', 0, 1)
    
    # Final cleanup
    memdc.DeleteDC()
    dc.DeleteDC()
    win32gui.ReleaseDC(0, hdc)
    
    return img.convert('RGB')

def get_shell_thumbnail(file_path: str, size: int = 1024) -> Optional[Image.Image]:
    """
    Professional Multi-Tier Thumbnail Extraction Engine.
    Tier 1: IShellItemImageFactory (Modern, High-Res)
    Tier 2: IExtractImage (Legacy, CAD-Standard for iCAD SX)
    """
    if not os.path.exists(file_path):
        return None

    pythoncom.CoInitializeEx(pythoncom.COINIT_APARTMENTTHREADED)
    try:
        abs_path = os.path.abspath(file_path).replace('/', '\\')
        
        # --- Tier 1: Modern IShellItemImageFactory ---
        try:
            # We use SHCreateItemFromParsingName to get the IShellItem
            si = shell.SHCreateItemFromParsingName(abs_path, None, shell.IID_IShellItem)
            
            # Note: pywin32's shell module has limited support for IID_IShellItemImageFactory
            # but we can try to QueryInterface if it's available. 
            # If not, we fall back to Tier 2 immediately.
            factory = si.QueryInterface(IID_IShellItemImageFactory)
            if factory:
                # flags: SIIGBF_THUMBNAILONLY (0x2) | SIIGBF_BIGGERSIZEOK (0x1)
                hbitmap = factory.GetImage((size, size), 0x2 | 0x1)
                if hbitmap:
                    img = _hbitmap_to_pil(hbitmap)
                    win32gui.DeleteObject(hbitmap)
                    return img
        except Exception as e:
            # -2147467262 = E_NOINTERFACE (Common for CAD files on IShellItemImageFactory)
            pass

        # --- Tier 2: Legacy IExtractImage (The iCAD SX / CAD Specialist) ---
        try:
            desktop = shell.SHGetDesktopFolder()
            # 1. Get PIDL
            pidl, _ = desktop.ParseDisplayName(0, None, abs_path)
            
            # 2. Bind to parent folder
            parent_shell_folder, relative_pidl = shell.SHBindToParent(pidl, shell.IID_IShellFolder)
            
            # 3. Get IExtractImage UI Object
            # This is the industry-standard way for Fujitsu iCAD SX and SolidWorks legacy handlers
            extractor = parent_shell_folder.GetUIObjectOf(0, [relative_pidl], IID_IExtractImage, 0)
            
            # GetLocation flags: IEIFLAG_SCREEN (0x20)
            # This asks the CAD handler to provide a screen-ready preview
            location, priority, flags = extractor.GetLocation((size, size), 32, shellcon.IEIFLAG_SCREEN)
            
            # Extract the actual HBITMAP
            hbitmap = extractor.Extract()
            if hbitmap:
                img = _hbitmap_to_pil(hbitmap)
                win32gui.DeleteObject(hbitmap)
                return img
        except Exception:
            pass

    except Exception as e:
        print(f"Professional Preview Extraction Failed for {file_path}: {e}")
        return None
    finally:
        pythoncom.CoUninitialize()
    
    return None

if __name__ == "__main__":
    pass
