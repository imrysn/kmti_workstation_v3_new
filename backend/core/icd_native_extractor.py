import os
import win32gui
import win32con
from win32com.shell import shell, shellcon
from PIL import Image
import pythoncom
import win32api

def get_shell_thumbnail(file_path, output_path, size=512):
    """
    Extracts a thumbnail from a file using the Windows Shell API via pywin32.
    """
    try:
        # Finalize path
        abs_path = os.path.abspath(file_path)
        if not os.path.exists(abs_path):
            return False, f"File not found: {abs_path}"

        # Initialize COM
        pythoncom.CoInitialize()

        # Create IShellItem from path
        # IID_IShellItem: {43826d1e-e718-42ee-bc55-a1e261c37bfe}
        si = shell.SHCreateItemFromParsingName(abs_path, None, shell.IID_IShellItem)
        
        # IShellItemImageFactory: {bcc18b79-ba16-442f-80c4-8059c18159ef}
        iid_factory = pythoncom.IID("{bcc18b79-ba16-442f-80c4-8059c18159ef}")
        factory = si.QueryInterface(iid_factory)
        
        # GetImage(size, flags) -> hbitmap
        # SIIGBF_RESIZETOFIT = 0x0
        # We use a helper to call the method by index if pywin32 doesn't have the wrapper
        # But factory should have GetImage if it's the correct interface.
        
        # However, QueryInterface returns a PyIUnknown. We need to call the method.
        # Since pywin32 doesn't have a wrapper for IShellItemImageFactory, 
        # we'll use a small trick: GetImage is the only method in the factory.
        # Use comtypes again, but fix the C-struct issue.
        
        return False, "IShellItemImageFactory wrapper missing in pywin32. Pivoting to robust PowerShell."

    except Exception as e:
        return False, str(e)

if __name__ == "__main__":
    import sys
    test_icd = r"d:\RAYSAN\KMTI Data Management\Systems\KMTIPURCHASEPARTS\KMTIPURCHASEPARTS\bin\Debug\DesktopSPF-4040a.icd"
    output = r"d:\RAYSAN\KMTI Data Management\Systems\kmti_workstation_v3_new\backend\.preview_cache\shell_test_v2.png"
    
    os.makedirs(os.path.dirname(output), exist_ok=True)
    success, result = get_shell_thumbnail(test_icd, output)
    if success:
        print(f"Successfully extracted thumbnail: {result}")
    else:
        print(f"Failed: {result}")
