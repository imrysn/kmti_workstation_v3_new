import os

def normalize_path(path_str: str) -> str:
    if not path_str:
        return ""
    # Standardize on forward slashes for internal logic
    return str(path_str).replace("\\", "/").rstrip("/")

# Common drive mappings for KMTI network (Hardcoded Fallback)
# Updated to use \\KMTI-NAS format as per user request
UNC_MAP = {
    "Z:": "\\\\KMTI-NAS\\Shared",
    "P:": "\\\\KMTI-NAS\\Shared\\Project", 
    "S:": "\\\\KMTI-NAS\\Shared",
}

def globalize_path(path_str: str) -> str:
    """
    Converts a workstation-specific path (like Z:/foo) into a 
    globally accessible UNC path (like \\KMTI-NAS\Shared\foo).
    Uses win32wnet for dynamic resolution if available.
    """
    if not path_str or not os.name == 'nt':
        return path_str or ""
    
    # 1. Attempt Dynamic UNC Resolution via Windows API (The most precise way)
    # This handles any drive letter dynamically without needing the map.
    if len(path_str) >= 2 and path_str[1] == ':':
        try:
            import win32wnet
            # Normalize to backslashes for the Windows API
            p_win = path_str.replace("/", "\\")
            # 1 = UNIVERSAL_NAME_INFO_LEVEL
            unc_path = win32wnet.WNetGetUniversalName(p_win, 1)
            if unc_path:
                return unc_path
        except Exception:
            # Fallback to hardcoded map if dynamic resolution fails 
            pass

    # 2. Fallback to Hardcoded Map
    p_norm = path_str.replace("\\", "/")
    for drive, unc in UNC_MAP.items():
        if p_norm.upper().startswith(drive.upper()):
            # Combine UNC and the remaining path, ensuring backslash consistency for UNC
            res = unc + p_norm[len(drive):].replace("/", "\\")
            return res
            
    return path_str.replace("/", "\\")
