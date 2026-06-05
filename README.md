# KMTI Workstation v3 — Modernized Data Management

A robust, enterprise-grade desktop workstation application designed for **Kusakabe & Maeno Tech Inc (KMTI)**. It integrates a **React + TypeScript + Vite** frontend, an **Electron** desktop runtime, and a **Python FastAPI** backend communicating with a centralized **MySQL** database on the network.

---

## 🏗️ Architecture Overview

The system operates as a hybrid desktop-server application, splitting responsibilities across three key layers:

```
┌──────────────────────────────────────────────────────────────────┐
│                   Electron Shell (Desktop App)                   │
├────────────────────────────────┬─────────────────────────────────┤
│    React Frontend (Vite)       │      Python Backend (FastAPI)   │
│    - Single Page Application   │      - REST APIs & Websockets   │
│    - Custom title bar & themes │      - SQLAlchemy (Async)       │
│    - Real-time Sync & state    │      - CAD Thumbnail Engine     │
│    - Recharts & Excel Export   │      - Kokoro-ONNX TTS Engine   │
└────────────────────────────────┴─────────────────────────────────┘
```

1. **Electron Shell (`/electron`)**:
   - Manages desktop integrations (frameless window framing, screen capture, file/folder execution, file icon retrieval).
   - Handles local PDF generation via Chromium print streams.
   - Incorporates an automatic update mechanism (`electron-updater`) pointing to GitHub releases.
   - Spawns and manages the lifecycle of the local Python backend during development.

2. **React Frontend (`/src`)**:
   - Built on Vite, React 18, and TypeScript.
   - State-driven using Zustand, Context APIs (Auth, Theme, Flags, Updates), and custom hooks.
   - Styled with Vanilla CSS (fully responsive, modern dark/light styling, and desktop-native layouts).
   - Incorporates real-time syncing via Socket.IO and automated telemetry/heartbeats.

3. **Python Backend (`/backend`)**:
   - Built with FastAPI, Socket.IO ASGI, and SQLAlchemy (with asynchronous MySQL connectors via `aiomysql`).
   - Runs a full-text search indexer on files stored on the local NAS.
   - Integrates an offline Text-to-Speech (TTS) engine (`kokoro-onnx` + ONNX Runtime).
   - Operates either as a background CLI process or with a Tkinter-based GUI Control Panel (`gui.py`) for administrators.

---

## ✨ Features & Modules

- **📝 Quotation Module**: Create, edit, and print quotations and billing statements.
  - Automatically calculates rates for 2D, 3D, and miscellaneous tasks.
  - Fully supports PDF rendering, print previews, reference numbers, and custom billing statements.
  - Keeps track of unsaved changes in the OS title bar (using standard `●` prefixes).
- **📅 Team Calendar**: A multi-user interactive scheduling planner with real-time socket-based event synchronization.
- **🔩 Purchased Parts & librarian**: Index, search, and view CAD file metadata (SolidWorks, Fujitsu iCAD SX, DWG, DXF) from the NAS.
- **🎛️ IT Controls & Feature Flags**: Admins can dynamically toggle modules, enable maintenance modes, and monitor active user sessions.
- **📊 Material Calculator & Heat Treatment**: Advanced math utility to compute material volume, weights, and tolerances, alongside heat treatment tracking.
- **🗣️ KMTI Sensei (TTS)**: Leverages Kokoro TTS for spoken feedback and interface accessibility.
- **🏆 Achievement & Gamification**: Includes custom avatars, equipping of skins, and unlocking achievements based on workstation utilization.

---

## 📁 Repository Directory Structure

```
kmti_workstation_v3_new/
├── .vscode/               # Workspace settings for VS Code
├── backend/               # FastAPI Server codebase
│   ├── core/              # Config, NAS indexers, and sync services
│   ├── db/                # MySQL connection and migration setup
│   ├── models/            # SQLAlchemy Database entities
│   ├── routers/           # API endpoints (Auth, Quotations, Parts, etc.)
│   ├── services/          # Heavy tasks (like the TTS engine setup)
│   ├── gui.py             # Tkinter Server GUI monitor
│   └── requirements.txt   # Python package dependencies
├── docs/                  # System documentation and deployment guides
├── electron/              # Electron main/preload IPC scripts
├── public/                # Static public assets for Vite
├── src/                   # React Frontend codebase
│   ├── assets/            # Fonts, icons, and image assets
│   ├── components/        # Reusable UI widgets and layout modules
│   ├── context/           # Global providers (Auth, Theme, Flags)
│   ├── hooks/             # Custom React Hooks (Quotation, Heartbeat, Sync)
│   ├── pages/             # Major view routers (Quotation, Calendar, Materials)
│   ├── services/          # REST Client (Axios configuration)
│   ├── styles/            # CSS files for custom layouts
│   └── utils/             # Math libraries, parsers, and helper functions
├── package.json           # Node configuration and electron-builder setup
├── vite.config.ts         # Vite compilation rules
└── tsconfig.json          # TypeScript configurations
```

---

## 🚀 Setup & Local Development

### Prerequisites
- **Node.js**: v18+
- **Python**: v3.10+ (ensure `python` is added to your PATH)
- **MySQL Database**: An active MySQL instance.

### 1. Database & Environment Configuration
Create a `.env` file in the **`/backend`** directory containing the database credentials:
```env
DB_HOST=127.0.0.1
DB_NAME=kmti_workstation
DB_USER=your_db_user
DB_PASS=your_db_password

# Secondary database configurations (FMS Integration)
FMS_DB_HOST=KMTI-NAS
FMS_DB_PORT=3306
FMS_DB_NAME=kmtifms
FMS_DB_USER=kmtifms_user
FMS_DB_PASS=your_fms_password
```

Create a root-level `.env` file in the workspace root for the frontend environment if necessary:
```env
VITE_API_URL=http://localhost:8000
```

### 2. Backend Setup
Navigate into the `/backend` directory, set up your Python environment, and install dependencies:
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Frontend & Electron Setup
Install Node modules in the root directory:
```bash
npm install
```

### 4. Running the App in Development Mode
Execute the launch script, which uses `concurrently` to boot the Vite development server and launch the Electron application simultaneously:
```bash
npm run dev
```

---

## 📦 Packaging & Deployment

To package the application into a standalone Windows installer:

### 1. Build the Python Backend Executable
Compile the Python backend into a single executable `server.exe` using PyInstaller:
```bash
npm run backend:build
```
This runs the `backend/build_server.py` script and stores the packaged executable inside `backend/dist/`.

### 2. Build the Electron & React App
Bundle the React application using Vite, clean old builds, and run Electron Builder to generate the NSIS Installer package:
```bash
npm run dist
```
The output installer (e.g., `KMTI_Workstation_Setup_v3.8.0.exe`) will be generated inside the `/release` directory.

> [!IMPORTANT]
> For deploying the centralized NAS server configuration and registering Windows Shell extensions (thumbnail loaders for SolidWorks, Fujitsu iCAD, and DWG files), please refer to the detailed [KMTI Workstation Server Deployment Guide](file:///d:/RAYSAN/KMTI%20Data%20Management/Systems/kmti_workstation_v3_new/docs/deployment_guide.md).

---

## 📄 License
This project is proprietary software licensed to Kusakabe & Maeno Tech Inc. Details can be found in `LICENSE.txt`.
