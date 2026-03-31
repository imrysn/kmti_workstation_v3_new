def normalize_path(path_str: str) -> str:
    if not path_str:
        return ""
    return str(path_str).replace("\\", "/").rstrip("/")

# Common drive mappings for KMTI network. 
# Key: Unified forward-slash prefix (e.g. "Z:")
# Value: UNC prefix (e.g. "//KMTI-NAS/Shared")
UNC_MAP = {
    "Z:": "//KMTI-NAS/Shared",
    "P:": "//KMTI-NAS/Shared/Project", 
    "S:": "//KMTI-NAS/Shared",
}

def globalize_path(path_str: str) -> str:
    """
    Converts a workstation-specific path (like Z:/foo) into a 
    globally accessible UNC path (like //KMTI-NAS/Shared/foo).
    """
    if not path_str:
        return ""
    
    # Normalize slashes first for consistent matching
    p = path_str.replace("\\", "/")
    
    for drive, unc in UNC_MAP.items():
        if p.upper().startswith(drive.upper()):
            return unc + p[len(drive):]
            
    return p
