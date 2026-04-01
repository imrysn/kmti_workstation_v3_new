import PyInstaller.__main__
import os
import sys
import customtkinter

# Define base directory
base_dir = os.path.dirname(os.path.abspath(__file__))
ctk_dir = os.path.dirname(customtkinter.__file__)

PyInstaller.__main__.run([
    'gui.py',                        # Main Entry Point (Windowed)
    '--name=server',                 # Output name: server.exe
    '--onefile',                     # Package into a single executable
    '--noconsole',                   # No console window (Desktop App)
    '--clean',                       # Clean cache before build
    '--icon=../src/assets/kmti.ico',
    # Add hidden imports for Uvicorn/FastAPI/Pystray
    '--hidden-import=uvicorn.logging',
    '--hidden-import=uvicorn.loops',
    '--hidden-import=uvicorn.loops.auto',
    '--hidden-import=uvicorn.protocols.http.auto',
    '--hidden-import=uvicorn.protocols.websockets.auto',
    '--hidden-import=uvicorn.lifespan.on',
    '--hidden-import=aiomysql',
    '--hidden-import=cryptography',
    '--hidden-import=pystray',
    '--hidden-import=PIL._tkinter_finder',
    # Include project data
    f'--add-data=core{os.pathsep}core',
    f'--add-data=db{os.pathsep}db',
    f'--add-data=models{os.pathsep}models',
    f'--add-data=routers{os.pathsep}routers',
    f'--add-data=data{os.pathsep}data',
    f'--add-data=.env{os.pathsep}.',
    # Include CustomTkinter assets
    f'--add-data={ctk_dir}{os.pathsep}customtkinter',
    # Include kmti_logo.png for GUI/Tray
    f'--add-data=../src/assets/kmti_logo.png{os.pathsep}src/assets',
    '--workpath=build',
    '--distpath=dist',
])

print("\n>>> Backend GUI build complete. Executable located in backend/dist/server.exe")
