# KMTI Workstation Server Deployment Guide

This guide ensures the centralized Server PC (NAS) is correctly configured to provide file previews and data to all workstations.

## 1. Network Configuration
The workstations are configured to connect to a specific IP address. Ensure the Server PC (NAS) has a **Static IP**.
- **Static IP**: `192.168.200.105`
- **NAS Server Name**: `\\KMTI-NAS\Shared`
- **Port**: `8000` (FastAPI backend)

## 2. Server PC Hardware/OS
- **OS**: Windows 10/11 Pro or Windows Server 2019+
- **Permissions**: The `server.exe` must run as a user with **Read/Write access** to all project folders. If running as a Windows Service, do **not** use the "LocalSystem" account (use a designated user account instead).

## 3. Shell Extension Loaders (CRITICAL for Previews)
File previews for CAD files depend on the Windows Shell. The Server PC **must** have the following "loaders" installed to generate thumbnails:

### For SolidWorks Files (.sldprt, .sldasm, .slddrw)
- **Install**: [SolidWorks Explorer](https://www.solidworks.com/sw/support/downloads.htm) or the **SolidWorks Document Manager**.
- **Alternative**: If SolidWorks is already installed on the server PC, no action is needed.

### For iCAD SX Files (.icd)
- **Install**: **Fujitsu iCAD SX Shell Extension**. 
- This loader allows Windows (and our backend) to "see" the 2D/3D previews embedded in `.icd` files.

### For DWG/DXF Files
- **Install**: [Autodesk DWG TrueView](https://www.autodesk.com/products/dwg-trueview/overview) (Free).

---

## 4. Running the Server
1. Copy the `server.exe` from `backend/dist/` to a dedicated folder on the Server PC.
2. Ensure the database file (`kmti_workstation.db`) is in the **same folder** as the `.exe`.
3. Launch `server.exe`. 
4. Check the system tray icon to ensure the server is active.

## 5. Troubleshooting Previews
If a workstation sees the "Preview Unavailable" icon:
1. **Check the Backend Logs**: Check `backend/logs/backend.log` on the Server PC.
2. **"Shell Loader Missing"**: This means Step 3 was skipped. Install the required CAD loader.
3. **"File Not Found"**: The server cannot resolve the path. Ensure the project is using a **UNC path** (e.g., `\\KMTI-NAS\Shared\...`) instead of a local drive letter that the server doesn't have mapped.
