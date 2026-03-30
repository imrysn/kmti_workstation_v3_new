import PyInstaller.__main__
import os
import sys

# Define base directory
base_dir = os.path.dirname(os.path.abspath(__file__))

PyInstaller.__main__.run([
    'main.py',                       # Entry point
    '--name=server',                 # Output name: server.exe
    '--onefile',                     # Package into a single executable
    # '--noconsole',                   # No console window
    '--clean',                       # Clean cache before build
    # Add hidden imports if necessary (FastAPI/Uvicorn often need these)
    '--hidden-import=uvicorn.logging',
    '--hidden-import=uvicorn.loops',
    '--hidden-import=uvicorn.loops.auto',
    '--hidden-import=uvicorn.protocols',
    '--hidden-import=uvicorn.protocols.http',
    '--hidden-import=uvicorn.protocols.http.auto',
    '--hidden-import=uvicorn.protocols.websockets',
    '--hidden-import=uvicorn.protocols.websockets.auto',
    '--hidden-import=uvicorn.lifespan',
    '--hidden-import=uvicorn.lifespan.on',
    '--hidden-import=aiomysql',
    '--hidden-import=cryptography',
    # Include data directories
    f'--add-data=core{os.pathsep}core',
    f'--add-data=db{os.pathsep}db',
    f'--add-data=models{os.pathsep}models',
    f'--add-data=routers{os.pathsep}routers',
    f'--add-data=data{os.pathsep}data',
    f'--add-data=.env{os.pathsep}.',   # Include .env for production if needed (or handle via env vars)
    '--workpath=build',
    '--distpath=dist',
])

print("\n>>> Backend build complete. Executable located in backend/dist/server.exe")
