import tkinter as tk
import customtkinter as ctk
import threading
import uvicorn
import os
import sys
import time
import logging
import queue
import json
from PIL import Image
import pystray
from pystray import MenuItem as item

# Set appearance mode and color theme
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

class UvicornServer(uvicorn.Server):
    """Custom Uvicorn server to allow programmatic start/stop in a thread."""
    def install_signal_handlers(self):
        pass

    @property
    def is_running(self):
        return not self.should_exit

class QueueHandler(logging.Handler):
    """Custom logging handler to pipe logs into a thread-safe queue."""
    def __init__(self, log_queue):
        super().__init__()
        self.log_queue = log_queue

    def emit(self, record):
        try:
            self.log_queue.put(self.format(record))
        except Exception:
            pass

class KMTIServerGUI(ctk.CTk):
    def __init__(self, fastapi_app, host="0.0.0.0", port=8000):
        super().__init__()

        self.fastapi_app = fastapi_app
        self.host = host
        self.port = port
        self.server_instance = None
        self.server_thread = None
        self.is_stopping_app = False
        
        # Logging Queue
        self.log_queue = queue.Queue()
        self.setup_logging()

        # --- Window Setup ---
        self.title("KMTI Workstation v3 - Server Control Panel")
        self.geometry("700x550") # Slightly taller for better log view
        self.protocol("WM_DELETE_WINDOW", self.minimize_to_tray)
        
        # Grid layout
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # --- Sidebar ---
        self.sidebar_frame = ctk.CTkFrame(self, width=140, corner_radius=0)
        self.sidebar_frame.grid(row=0, column=0, rowspan=4, sticky="nsew")
        
        self.logo_label = ctk.CTkLabel(self.sidebar_frame, text="KMTI SERVER", font=ctk.CTkFont(size=20, weight="bold"))
        self.logo_label.grid(row=0, column=0, padx=20, pady=(20, 10))

        self.status_indicator = ctk.CTkLabel(self.sidebar_frame, text="● STOPPED", text_color="#ff4b4b", font=ctk.CTkFont(weight="bold"))
        self.status_indicator.grid(row=1, column=0, padx=20, pady=10)

        self.start_button = ctk.CTkButton(self.sidebar_frame, text="Start Server", command=self.start_server, fg_color="#2eb85c", hover_color="#1e7e34")
        self.start_button.grid(row=2, column=0, padx=20, pady=10)

        self.stop_button = ctk.CTkButton(self.sidebar_frame, text="Stop Server", command=self.stop_server, fg_color="#e55353", hover_color="#c94444")
        self.stop_button.grid(row=3, column=0, padx=20, pady=10)
        self.stop_button.configure(state="disabled")

        self.restart_button = ctk.CTkButton(self.sidebar_frame, text="Restart", command=self.restart_server)
        self.restart_button.grid(row=4, column=0, padx=20, pady=10)

        self.indexer_button = ctk.CTkButton(self.sidebar_frame, text="Trigger NAS Scan", command=self.trigger_scan, fg_color="#3399ff")
        self.indexer_button.grid(row=5, column=0, padx=20, pady=10)

        self.appearance_mode_label = ctk.CTkLabel(self.sidebar_frame, text="Appearance:", anchor="w")
        self.appearance_mode_label.grid(row=6, column=0, padx=20, pady=(20, 0))
        self.appearance_mode_optionemenu = ctk.CTkOptionMenu(self.sidebar_frame, values=["Dark", "Light", "System"], command=self.change_appearance_mode)
        self.appearance_mode_optionemenu.grid(row=7, column=0, padx=20, pady=(10, 20))

        # --- Dashboard ---
        self.main_frame = ctk.CTkFrame(self, corner_radius=10)
        self.main_frame.grid(row=0, column=1, padx=20, pady=20, sticky="nsew")
        self.main_frame.grid_columnconfigure(0, weight=1)
        self.main_frame.grid_rowconfigure(1, weight=1)

        self.info_label = ctk.CTkLabel(self.main_frame, text=f"API running on: http://{self.host}:{self.port}", font=ctk.CTkFont(size=14))
        self.info_label.grid(row=0, column=0, padx=20, pady=10, sticky="w")

        # Log Window
        self.log_textbox = ctk.CTkTextbox(self.main_frame, font=ctk.CTkFont(family="Consolas", size=11))
        self.log_textbox.grid(row=1, column=0, padx=20, pady=(0, 20), sticky="nsew")
        self.log_textbox.configure(state="disabled")

        # --- System Tray ---
        self.setup_tray()

        # Start server automatically
        self.after(1000, self.start_server)
        
        # Start log polling
        self.after(100, self.poll_log_queue)

    def setup_logging(self):
        """Redirect Python logging to the Control Panel UI."""
        self.gui_handler = QueueHandler(self.log_queue)
        self.gui_handler.setFormatter(logging.Formatter('[%(asctime)s] %(message)s', datefmt='%H:%M:%S'))
        
        # Capture logs from our backend, uvicorn, and sqlalchemy
        target_loggers = ["kmti_backend", "uvicorn", "uvicorn.access", "sqlalchemy"]
        for logger_name in target_loggers:
            logging.getLogger(logger_name).addHandler(self.gui_handler)
            logging.getLogger(logger_name).setLevel(logging.INFO)

    def poll_log_queue(self):
        """Check the log queue and update the textbox (thread-safe)."""
        try:
            while True:
                record = self.log_queue.get_nowait()
                self.log_textbox.configure(state="normal")
                self.log_textbox.insert("end", record + "\n")
                
                # Limit line count to 500 for performance
                lines = int(self.log_textbox.index('end-1c').split('.')[0])
                if lines > 500:
                    self.log_textbox.delete('1.0', '2.0')
                
                self.log_textbox.see("end")
                self.log_textbox.configure(state="disabled")
        except queue.Empty:
            pass
        finally:
            self.after(100, self.poll_log_queue)

    def change_appearance_mode(self, new_appearance_mode):
        ctk.set_appearance_mode(new_appearance_mode)

    def setup_tray(self):
        try:
            icon_path = resource_path(os.path.join("src", "assets", "kmti_logo.png"))
            if not os.path.exists(icon_path):
                 icon_path = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "kmti_logo.png")
            image = Image.open(icon_path)
        except Exception:
            image = Image.new('RGB', (64, 64), color=(73, 109, 137))
        
        menu = (item('Show Control Panel', self.show_window), item('Stop & Exit Server', self.exit_app))
        self.tray_icon = pystray.Icon("kmti_server", image, "KMTI Server Control", menu)
        threading.Thread(target=self.tray_icon.run, daemon=True).start()

    def show_window(self):
        self.deiconify()
        self.lift()
        self.focus_force()

    def minimize_to_tray(self):
        if self.is_stopping_app:
            self.destroy()
        else:
            self.withdraw()

    def start_server(self):
        if self.server_thread and self.server_thread.is_alive():
            return

        config = uvicorn.Config(app=self.fastapi_app, host=self.host, port=self.port, log_level="info")
        self.server_instance = UvicornServer(config=config)
        
        self.server_thread = threading.Thread(target=self.server_instance.run, daemon=True)
        self.server_thread.start()

        self.status_indicator.configure(text="● RUNNING", text_color="#2eb85c")
        self.start_button.configure(state="disabled")
        self.stop_button.configure(state="normal")

    def stop_server(self):
        if not self.server_instance:
            return

        # Signal uvicorn to shut down
        self.server_instance.should_exit = True
        
        def check_stopped():
            if self.server_thread and self.server_thread.is_alive():
                # Some versions of uvicorn in threads need force_exit
                if hasattr(self.server_instance, 'force_exit'):
                    self.server_instance.force_exit = True
                self.after(500, check_stopped)
            else:
                self.status_indicator.configure(text="● STOPPED", text_color="#ff4b4b")
                self.start_button.configure(state="normal")
                self.stop_button.configure(state="disabled")
                self.server_instance = None
                self.server_thread = None

        self.after(200, check_stopped)

    def restart_server(self):
        self.stop_server()
        def wait_and_start():
            if self.server_thread and self.server_thread.is_alive():
                self.after(500, wait_and_start)
            else:
                self.start_server()
        self.after(500, wait_and_start)

    def trigger_scan(self):
        try:
            from main import indexer
            from db.database import AsyncSessionLocal
            from models.part import Project
            from sqlalchemy import select
            import asyncio
            
            async def run_scans():
                async with AsyncSessionLocal() as session:
                    res = await session.execute(select(Project))
                    projects = res.scalars().all()
                    for p in projects:
                        p.is_scanning = True
                        await session.commit()
                        if indexer:
                            asyncio.create_task(indexer.scan_project_async(p.id, p.root_path))
            
            threading.Thread(target=lambda: asyncio.run(run_scans()), daemon=True).start()
        except Exception as e:
            logging.error(f"Scan Trigger Error: {e}")

    def exit_app(self):
        self.is_stopping_app = True
        if self.server_instance:
            self.server_instance.should_exit = True
        if self.tray_icon:
            self.tray_icon.stop()
        self.after(1000, self.destroy)

if __name__ == "__main__":
    from main import app
    gui = KMTIServerGUI(app)
    gui.mainloop()
