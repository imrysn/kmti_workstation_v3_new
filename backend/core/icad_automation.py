import os
import time
import win32com.client
from pathlib import Path

def generate_icad_preview(icd_path: str, output_path: str, timeout: int = 30) -> bool:
    """
    Generates a high-fidelity preview for an iCAD SX (.icd) file using native COM automation.
    """
    icad = None
    try:
        # Initialize COM
        icad = win32com.client.Dispatch("ICAD.APPLICATION")
        # icad.Visible = False # Not supported by iCAD SX
        
        # Normalize paths for iCAD (usually prefers double backslashes or single forward)
        abs_icd = str(Path(icd_path).resolve())
        abs_out = str(Path(output_path).resolve())
        
        # Sequence of commands to open and export
        # We try a few variations of 'Open' and 'Bitmap' commands
        commands = [
            f"FILE OPEN '{abs_icd}'",
            "VIEW ALL", # Ensure everything is in view
            f"WINDOW BITMAP SAVE '{abs_out}'",
            "FILE CLOSE"
        ]
        
        for cmd in commands:
            # Mode 1 is typically 'Immediate/Wait'
            icad.RunCommand(cmd, 1)
            time.sleep(0.5) # Give it a moment to process
            
        # Check if output file was created
        if os.path.exists(output_path):
            return True
        
        # Alternative method: If the above failed, try internal methods via ActiveDrawing
        if icad.ActiveDrawing:
            icad.ActiveDrawing.RunCommand(f"WINDOW BITMAP SAVE '{abs_out}'", 1)
            
        return os.path.exists(output_path)
        
    except Exception as e:
        print(f"iCAD Automation Error: {e}")
        return False
    finally:
        if icad:
            try:
                icad.Quit()
            except:
                pass

if __name__ == "__main__":
    # Test with the file we found
    test_file = r"d:\RAYSAN\KMTI Data Management\Systems\KMTIPURCHASEPARTS\KMTIPURCHASEPARTS\bin\Debug\DesktopSPF-4040a.icd"
    test_out = r"d:\RAYSAN\KMTI Data Management\Systems\kmti_workstation_v3_new\backend\test_icad_high_fid.png"
    if generate_icad_preview(test_file, test_out):
        print(f"Success! Preview saved to {test_out}")
    else:
        print("Failed to generate high-fidelity preview.")
