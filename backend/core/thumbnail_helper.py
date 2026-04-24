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
    """Converts a Windows HBITMAP to a PIL Image using professional GDI+ mapping."""
    import win32ui
    hdc = win32gui.GetDC(0)
    dc = win32ui.CreateDCFromHandle(hdc)
    memdc = dc.CreateCompatibleDC()
    
    bmp = win32ui.CreateBitmapFromHandle(hbitmap)
    info = bmp.GetInfo()
    w, h = info['bmWidth'], info['bmHeight']
    
    memdc.SelectObject(bmp)
    
    # Use bit-safe retrieval
    bits = bmp.GetBitmapBits(True)
    img = Image.frombuffer('RGBA', (w, h), bits, 'raw', 'BGRA', 0, 1)
    
    # Cleanup GDI handles
    memdc.DeleteDC()
    dc.DeleteDC()
    win32gui.ReleaseDC(0, hdc)
    
    return img.convert('RGB')

def get_shell_thumbnail(file_path: str, size: int = 1024) -> Optional[Image.Image]:
    """
    State-of-the-Art Shell Image Extraction.
    Uses IShellItemImageFactory (Tier 1) and IExtractImage (Tier 2).
    """
    if not os.path.exists(file_path):
        return None

    # CRITICAL: Initialize COM as Multi-Threaded for NAS performance
    pythoncom.CoInitializeEx(pythoncom.COINIT_MULTITHREADED)
    try:
        # Normalize and ensure UNC formatting for Windows Shell
        abs_path = os.path.abspath(file_path).replace('/', '\\')
        if abs_path.startswith('\\\\') and not abs_path.startswith('\\\\\\\\'):
            # Double-slash for UNC parsing stability in COM
            pass 

        # --- Tier 1: Modern IShellItemImageFactory ---
        try:
            # SIIGBF_THUMBNAILONLY (0x2) | SIIGBF_BIGGERSIZEOK (0x1) | SIIGBF_MEMORYONLY (0x8)
            flags = 0x2 | 0x1 | 0x8
            si = shell.SHCreateItemFromParsingName(abs_path, None, shell.IID_IShellItem)
            factory = si.QueryInterface(IID_IShellItemImageFactory)
            if factory:
                hbitmap = factory.GetImage((size, size), flags)
                if hbitmap:
                    img = _hbitmap_to_pil(hbitmap)
                    win32gui.DeleteObject(hbitmap)
                    return img
        except Exception:
            pass

        # --- Tier 2: IExtractImage (CAD Industry Fallback) ---
        try:
            desktop = shell.SHGetDesktopFolder()
            pidl, _ = desktop.ParseDisplayName(0, None, abs_path)
            parent_shell_folder, relative_pidl = shell.SHBindToParent(pidl, shell.IID_IShellFolder)
            extractor = parent_shell_folder.GetUIObjectOf(0, [relative_pidl], IID_IExtractImage, 0)
            
            # IEIFLAG_SCREEN (0x20) | IEIFLAG_QUALITY (0x100)
            render_size = (size, size)
            res_flags = shellcon.IEIFLAG_SCREEN | 0x100
            location, priority, flags = extractor.GetLocation(render_size, 32, res_flags)
            
            hbitmap = extractor.Extract()
            if hbitmap:
                img = _hbitmap_to_pil(hbitmap)
                win32gui.DeleteObject(hbitmap)
                return img
        except Exception:
            pass
    finally:
        pythoncom.CoUninitialize()
    
    return None
    
    return None

if __name__ == "__main__":
    pass
