import PyInstaller.__main__
import os
import sys
import customtkinter

# Define base directory
base_dir = os.path.dirname(os.path.abspath(__file__))
ctk_dir = os.path.dirname(customtkinter.__file__)
import kokoro_onnx
import language_tags
import espeakng_loader
kokoro_dir = os.path.dirname(kokoro_onnx.__file__)
lang_tags_dir = os.path.dirname(language_tags.__file__)
espeak_dir = os.path.dirname(espeakng_loader.__file__)

# Log paths for debugging
print(f">>> CustomTkinter Path: {ctk_dir}")
print(f">>> Kokoro ONNX Path: {kokoro_dir}")
print(f">>> Language Tags Path: {lang_tags_dir}")
print(f">>> EspeakNG Loader Path: {espeak_dir}")

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
    # We exclude models from the bundle to keep server.exe small (~30MB vs 380MB).
    # It will be copied to the dist folder as an external asset instead.
    # f'--add-data=models{os.pathsep}models',
    f'--add-data=routers{os.pathsep}routers',
    f'--add-data=data{os.pathsep}data',
    f'--add-data=.env{os.pathsep}.',
    # Include library internal files
    f'--add-data={ctk_dir}{os.pathsep}customtkinter/',
    f'--add-data={kokoro_dir}{os.pathsep}kokoro_onnx/',
    f'--add-data={lang_tags_dir}{os.pathsep}language_tags/',
    f'--add-data={espeak_dir}{os.pathsep}espeakng_loader/',
    # Include kmti_logo.png for GUI/Tray
    f'--add-data=../src/assets/kmti_logo.png{os.pathsep}src/assets',
    '--workpath=build',
    '--distpath=dist',
])

# --- Post-Build: Copy External Assets ---
import shutil

# 1. Copy Data folder for external template management
dist_data_path = os.path.join(base_dir, 'dist', 'data')
source_data_path = os.path.join(base_dir, 'data')

if os.path.exists(dist_data_path):
    shutil.rmtree(dist_data_path)
print(f">>> Copying external data templates to {dist_data_path}...")
shutil.copytree(source_data_path, dist_data_path)

# 2. Copy ONLY the TTS models (binary assets) to keep server.exe small and source code private
# dist_tts_path = os.path.join(base_dir, 'dist', 'models', 'tts')
# source_tts_path = os.path.join(base_dir, 'models', 'tts')
# 
# if os.path.exists(dist_tts_path):
#     shutil.rmtree(dist_tts_path)
# print(f">>> Copying external TTS models to {dist_tts_path}...")
# shutil.copytree(source_tts_path, dist_tts_path)

print("\n>>> Backend GUI build complete. Executable located in backend/dist/server.exe")
