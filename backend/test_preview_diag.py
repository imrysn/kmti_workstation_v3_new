import os
import ctypes
from ctypes import wintypes
import pythoncom
from win32com.shell import shell, shellcon

# ---------------------------------------------------------
# GUIDs for iCAD SX (Fujitsu) Compatible Interfaces
# ---------------------------------------------------------
IID_IExtractImage = pythoncom.IID("{BB2E617C-0920-11d1-9A0B-00C04FC2D6C1}")

def test_icad_preview(file_path):
    print(f"\n>>> [DIAG] Testing Professional Preview for: {file_path}")
    
    if not os.path.exists(file_path):
        print("  [ERROR] File not found.")
        return False

    try:
        # Initialize COM in STA mode (Crucial for CAD Shell Extensions)
        pythoncom.CoInitializeEx(pythoncom.COINIT_APARTMENTTHREADED)
        
        # 1. Create IShellItem
        abs_path = os.path.abspath(file_path)
        print(f"  [STEP 1] Creating Shell Item...")
        si = shell.SHCreateItemFromParsingName(abs_path, None, shell.IID_IShellItem)
        
        # 2. Try modern IShellItemImageFactory (The one that was failing before)
        try:
            print("  [STEP 2] Trying IShellItemImageFactory...")
            # {bcc18b79-ba16-442f-80c4-8059c18159ef}
            iid_factory = pythoncom.IID("{bcc18b79-ba16-442f-80c4-8059c18159ef}")
            factory = si.QueryInterface(iid_factory)
            print("  [SUCCESS] IShellItemImageFactory supported! (Modern Path)")
            # In a real app we'd call GetImage here...
        except Exception as e:
            print(f"  [INFO] IShellItemImageFactory failed: {e}. (Expected for some CAD)")

        # 3. Try Legacy IExtractImage (The "Professional" fallback)
        try:
            print("  [STEP 3] Trying IExtractImage (Legacy/CAD Path)...")
            # First get the Desktop folder as a starting point
            desktop = shell.SHGetDesktopFolder()
            
            # Parse the display name to get the PIDL
            pidl, _ = desktop.ParseDisplayName(0, None, abs_path)
            
            # Get the parent folder and relative PIDL
            parent_pidl = shell.SHBindToParent(pidl, shell.IID_IShellFolder)
            if parent_pidl:
                folder, relative_pidl = parent_pidl
                # Get the UI Object (IExtractImage) for the file
                extractor = folder.GetUIObjectOf(0, [relative_pidl], IID_IExtractImage, 0)
                print("  [SUCCESS] IExtractImage supported! (Professional CAD Path)")
                # This confirms the iCAD SX handler is alive and ready for conversation.
            else:
                print("  [ERROR] Could not bind to parent folder.")
        except Exception as e:
            print(f"  [ERROR] IExtractImage failed: {e}")

        return True
    except Exception as e:
        print(f"  [FATAL] COM Error: {e}")
        return False
    finally:
        pythoncom.CoUninitialize()

if __name__ == "__main__":
    # Test with one of the files from the logs (KUSAKABE Project)
    test_file = r"//KMTI-NAS/Database/PROJECTS/KUSAKABE/2015/01.icd"
    test_icad_preview(test_file)
