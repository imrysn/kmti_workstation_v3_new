import os
import ctypes
from ctypes import wintypes
from PIL import Image
import io
import pythoncom
from win32 import win32gui
from typing import Optional

# GUID definitions
class GUID(ctypes.Structure):
    _fields_ = [
        ("Data1", wintypes.DWORD),
        ("Data2", wintypes.WORD),
        ("Data3", wintypes.WORD),
        ("Data4", wintypes.BYTE * 8)
    ]
    @classmethod
    def from_str(cls, guid_str):
        import uuid
        u = uuid.UUID(guid_str)
        return cls(u.time_low, u.time_mid, u.time_hi_version, (ctypes.c_ubyte * 8)(*u.bytes[8:]))

class SIZE(ctypes.Structure):
    _fields_ = [("cx", wintypes.LONG), ("cy", wintypes.LONG)]

GUID_IShellItem = GUID.from_str("43826d1e-e718-42ee-bc55-a1e261c37bfe")
GUID_IShellItemImageFactory = GUID.from_str("bcc18210-4834-4531-9a95-96a199bbc512")

shell32 = ctypes.windll.shell32

def _hbitmap_to_pil(hbitmap):
    """Converts a Windows HBITMAP to a PIL Image."""
    import win32ui
    hdc = win32gui.GetDC(0)
    dc = win32ui.CreateDCFromHandle(hdc)
    memdc = dc.CreateCompatibleDC()
    
    bmp = win32ui.CreateBitmapFromHandle(hbitmap)
    info = bmp.GetInfo()
    w, h = info['bmWidth'], info['bmHeight']
    
    memdc.SelectObject(bmp)
    
    # Get bitmap bits
    bits = bmp.GetBitmapBits(True)
    img = Image.frombuffer('RGBA', (w, h), bits, 'raw', 'BGRA', 0, 1)
    
    # Final cleanup
    memdc.DeleteDC()
    dc.DeleteDC()
    win32gui.ReleaseDC(0, hdc)
    
    return img.convert('RGB')

def get_shell_thumbnail(file_path: str, size: int = 1024) -> Optional[Image.Image]:
    """
    Extracts a high-quality thumbnail from the Windows Shell.
    Uses IShellItemImageFactory with SIIGBF_THUMBNAILONLY to force a real preview.
    """
    if not os.path.exists(file_path):
        return None

    try:
        # Initialize COM
        pythoncom.CoInitialize()

        # 1. Create IShellItem from path
        p_shell_item = ctypes.c_void_p()
        # Ensure path is absolute and uses backslashes
        abs_path = os.path.abspath(file_path).replace('/', '\\')
        
        ret = shell32.SHCreateItemFromParsingName(
            ctypes.c_wchar_p(abs_path),
            None,
            GUID_IShellItem,
            ctypes.byref(p_shell_item)
        )

        if ret != 0 or not p_shell_item:
            return None

        # 2. Get IShellItemImageFactory interface
        p_factory = ctypes.c_void_p()
        p_vt = ctypes.cast(p_shell_item, ctypes.POINTER(ctypes.c_void_p))
        vtable = ctypes.cast(p_vt.contents, ctypes.POINTER(ctypes.c_void_p))
        
        # QueryInterface = index 0, AddRef = 1, Release = 2
        QI_Proto = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, ctypes.POINTER(GUID), ctypes.POINTER(ctypes.c_void_p))
        QI = QI_Proto(vtable[0])
        
        ret_qi = QI(p_shell_item, ctypes.byref(GUID_IShellItemImageFactory), ctypes.byref(p_factory))
        
        img = None
        if ret_qi == 0 and p_factory:
            # 3. Call GetImage(SIZE size, SIIGBF flags, HBITMAP *phbm)
            p_factory_vt = ctypes.cast(p_factory, ctypes.POINTER(ctypes.c_void_p))
            vtable_f = ctypes.cast(p_factory_vt.contents, ctypes.POINTER(ctypes.c_void_p))
            
            # GetImage = index 3
            GetImage_Proto = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, SIZE, ctypes.c_int, ctypes.POINTER(wintypes.HBITMAP))
            GetImage = GetImage_Proto(vtable_f[3])
            
            hbitmap = wintypes.HBITMAP()
            # SIIGBF_THUMBNAILONLY = 0x2, SIIGBF_BIGGERSIZEOK = 0x1
            ret_img = GetImage(p_factory, SIZE(size, size), 0x2 | 0x1, ctypes.byref(hbitmap))
            
            if ret_img == 0 and hbitmap:
                img = _hbitmap_to_pil(hbitmap)
                win32gui.DeleteObject(hbitmap)
            
            # Release Factory
            Release_Proto = ctypes.WINFUNCTYPE(ctypes.c_ulong, ctypes.c_void_p)
            Release_f = Release_Proto(vtable_f[2])
            Release_f(p_factory)

        # Release Shell Item
        Release_Item = Release_Proto(vtable[2])
        Release_Item(p_shell_item)

        return img

    except Exception as e:
        print(f"Shell thumbnail extraction failed: {e}")
        return None
    finally:
        try:
            pythoncom.CoUninitialize()
        except: pass

if __name__ == "__main__":
    pass
