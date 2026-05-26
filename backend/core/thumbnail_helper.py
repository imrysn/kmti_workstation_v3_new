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
# IID_IExtractImage: {BB2E617C-0920-11d1-9A0B-00C04FC2D6C1}
IID_IExtractImage = pythoncom.MakeIID("{BB2E617C-0920-11d1-9A0B-00C04FC2D6C1}")
# IShellItemImageFactory: {BCC18B79-BA16-442F-80C4-8A59C30C463B}
IID_IShellItemImageFactory = pythoncom.MakeIID("{BCC18B79-BA16-442F-80C4-8A59C30C463B}")

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
    Uses IShellItemImageFactory (Tier 1), IExtractImage (Tier 2), and PowerShell Dynamic C# compilation (Tier 3).
    """
    if not os.path.exists(file_path):
        return None

    # CRITICAL: Initialize COM as Multi-Threaded for NAS performance
    pythoncom.CoInitializeEx(pythoncom.COINIT_MULTITHREADED)
    try:
        # Normalize and ensure UNC formatting for Windows Shell
        abs_path = os.path.abspath(file_path).replace('/', '\\')

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
            _, pidl, _ = desktop.ParseDisplayName(0, None, abs_path)
            parent_pidl = pidl[:-1]
            relative_pidl = [pidl[-1]]
            parent_folder = desktop.BindToObject(parent_pidl, None, shell.IID_IShellFolder)
            extractor = parent_folder.GetUIObjectOf(0, [relative_pidl], IID_IExtractImage, 0)
            
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
    
    # --- Tier 3: PowerShell Fallback (For missing pywin32 wrappers like IShellItemImageFactory) ---
    import subprocess
    import tempfile
    try:
        temp_dir = tempfile.gettempdir()
        temp_out = os.path.join(temp_dir, f"kmti_thumb_{os.path.basename(file_path)}.png")
        script_path = os.path.join(os.path.dirname(__file__), "..", "scripts", "extract_thumb_v2.ps1")
        
        cmd = [
            "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass",
            "-File", script_path,
            "-path", abs_path,
            "-outPath", temp_out,
            "-size", str(size)
        ]
        
        startupinfo = None
        if os.name == 'nt':
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            
        res = subprocess.run(cmd, capture_output=True, text=True, startupinfo=startupinfo)
        if os.path.exists(temp_out) and os.path.getsize(temp_out) > 0:
            img = Image.open(temp_out)
            img.load()
            try:
                os.remove(temp_out)
            except Exception:
                pass
            return img
    except Exception as e:
        print(f"[PowerShell Thumbnail Fallback Error] {e}")

    return None
    
    return None

if __name__ == "__main__":
    pass
