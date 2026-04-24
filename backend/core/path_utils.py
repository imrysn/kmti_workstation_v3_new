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
    if not path_str or os.name != 'nt':
        return path_str or ""
    
    p_norm = path_str.replace("/", "\\")
    
    # If the path already exists locally on the server PC, use it as is.
    if os.path.exists(p_norm):
        return p_norm

    # 1. Attempt Dynamic UNC Resolution via Windows API (The most precise way)
    if len(p_norm) >= 2 and p_norm[1] == ':':
        try:
            import win32wnet
            # 1 = UNIVERSAL_NAME_INFO_LEVEL
            unc_path = win32wnet.WNetGetUniversalName(p_norm, 1)
            # The result is usually a record or value depending on the level
            if unc_path:
                return unc_path
        except Exception:
            pass

    # 2. Fallback to Hardcoded Map + Auto Discovery
    for drive, unc in UNC_MAP.items():
        if p_norm.upper().startswith(drive.upper()):
            # Reconstruct the UNC path
            candidate = unc.rstrip("\\") + "\\" + p_norm[len(drive):].lstrip("\\")
            # If the candidate actually exists on the network, return it!
            if os.path.exists(candidate):
                return candidate
            
    # 3. Final heuristic: If drive C/D/etc. is missing on server, try common NAS root
    if len(p_norm) >= 2 and p_norm[1] == ':' and not os.path.exists(p_norm[:3]):
        candidate = "\\\\KMTI-NAS\\Shared\\" + p_norm[3:].lstrip("\\")
        if os.path.exists(candidate):
            return candidate
            
    return p_norm
