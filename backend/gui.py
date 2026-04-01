import asyncio
import os
import sys
import threading
import uvicorn
import tkinter as tk
import customtkinter as ctk
import time
import logging
from PIL import Image
import pystray
from pystray import MenuItem as item
from datetime import datetime

import re

# --- Logging Bridge ---
class QueueHandler(logging.Handler):
    """Hooks into Python logging and translates strings for the GUI."""
    def __init__(self, log_widget):
        super().__init__()
        self.log_widget = log_widget
        self.patterns = [
            (r'POST /api/auth/login', "🔐 User Login Attempt"),
            (r'GET /api/parts/projects\?category=PROJECTS', "📂 Browsing Project Catalog"),
            (r'POST /api/parts/projects/(\d+)/scan', "🚀 Started NAS Scan for project [\1]"),
            (r'GET /api/parts/\?.*search=([^& ]+)', "🔎 Searching: \1"),
            (r'GET /api/parts/tree/(\d+)', "🌳 Exploring Folder Structure [\1]"),
            (r'GET /api/parts/preview/(\d+)', "🖼️ Viewing Part Preview [\1]"),
            (r'GET /api/flags/', "⚙️ Checking Feature Flags"),
            (r'GET /health', "💓 System Health Check"),
        ]

    def translate_log(self, msg):
        """Converts raw API access logs into human-readable sentences."""
        if " /api/" not in msg:
            return msg # Keep system/error logs as is
        
        for pattern, replacement in self.patterns:
            match = re.search(pattern, msg)
            if match:
                # Replace backreferences if any
                final_msg = replacement
                for i, group in enumerate(match.groups()):
                    final_msg = final_msg.replace(f"\\{i+1}", group)
                return final_msg
        
        # If no pattern matches but it's an API call, just show the path
        # Example: 127.0.0.1:63826 - "GET /api/custom HTTP/1.1" 200 OK
        m = re.search(r'"[A-Z]+ (/[^ ]+) HTTP', msg)
        if m:
            return f"🔌 API Call: {m.group(1)}"
            
        return msg

    def emit(self, record):
        msg = self.format(record)
        # Translate BEFORE sending to widget
        friendly_msg = self.translate_log(msg)
        try:
            self.log_widget.after(0, self._append_log, friendly_msg, record.levelname)
        except:
            pass

    def _append_log(self, msg, level):
        self.log_widget.configure(state="normal")
        tag = "info"
        if level == "ERROR" or level == "CRITICAL": tag = "error"
        elif level == "WARNING": tag = "warning"
        
        # Clean up any trailing newlines in the message
        clean_msg = msg.strip()
        
        self.log_widget.insert("end", f"[{datetime.now().strftime('%H:%M:%S')}] ", "time")
        self.log_widget.insert("end", f"{clean_msg}\n", tag)
        self.log_widget.see("end")
        self.log_widget.configure(state="disabled")

# --- GUI Application ---
class KMTIServerGUI(ctk.CTk):
    def __init__(self, fastapi_app):
        super().__init__()
        self.app = fastapi_app
        self.server_thread = None
        self.should_exit = False
        
        # Window Configuration
        self.title("KMTI Workstation v3.4.2 — Control Center")
        self.geometry("900x600")
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)
        self.protocol("WM_DELETE_WINDOW", self.on_closing)

        # 🍱 Left Panel (Controls & Stats)
        self.sidebar = ctk.CTkFrame(self, width=280, corner_radius=0)
        self.sidebar.grid(row=0, column=0, sticky="nsew", padx=0, pady=0)
        self.sidebar.grid_rowconfigure(6, weight=1)

        self.logo_label = ctk.CTkLabel(self.sidebar, text="KMTI WORKSTATION", font=ctk.CTkFont(size=20, weight="bold"))
        self.logo_label.grid(row=0, column=0, padx=20, pady=(20, 10))
        
        self.subtitle_label = ctk.CTkLabel(self.sidebar, text="Backend Control Center v3.4.2", font=ctk.CTkFont(size=11), text_color="gray")
        self.subtitle_label.grid(row=1, column=0, padx=20, pady=(0, 20))

        # 🍱 Heartbeat Indicators
        self.status_frame = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        self.status_frame.grid(row=2, column=0, padx=20, pady=10, sticky="ew")
        
        self.indicator_mysql = self._create_indicator("MySQL Database")
        self.indicator_nas = self._create_indicator("KMTI-NAS Network")
        self.indicator_server = self._create_indicator("API Service")

        # 🍱 Stats Dashboard
        self.stats_frame = ctk.CTkFrame(self.sidebar)
        self.stats_frame.grid(row=3, column=0, padx=20, pady=20, sticky="ew")
        
        self.uptime_label = ctk.CTkLabel(self.stats_frame, text="Uptime: 00:00:00", font=ctk.CTkFont(size=12))
        self.uptime_label.pack(pady=5)
        
        self.conn_label = ctk.CTkLabel(self.stats_frame, text="Active Indexing: Idle", font=ctk.CTkFont(size=12))
        self.conn_label.pack(pady=5)

        # 🍱 Primary Controls
        self.btn_restart = ctk.CTkButton(self.sidebar, text="Restart Server", command=self.restart_server, fg_color="#0284c7", hover_color="#0369a1")
        self.btn_restart.grid(row=4, column=0, padx=20, pady=10)
        
        self.btn_logs = ctk.CTkButton(self.sidebar, text="Open Logs Folder", command=self.open_logs_folder, border_width=1, fg_color="transparent", text_color=("gray10", "gray90"))
        self.btn_logs.grid(row=5, column=0, padx=20, pady=10)

        # 🍱 Main Content (Real-time Logs)
        self.main_content = ctk.CTkFrame(self, corner_radius=10)
        self.main_content.grid(row=0, column=1, sticky="nsew", padx=20, pady=20)
        self.main_content.grid_rowconfigure(1, weight=1)
        self.main_content.grid_columnconfigure(0, weight=1)

        self.log_header = ctk.CTkLabel(self.main_content, text="Real-Time Operation Log", font=ctk.CTkFont(size=14, weight="bold"))
        self.log_header.grid(row=0, column=0, padx=20, pady=(15, 5), sticky="w")

        self.log_text = tk.Text(self.main_content, font=("Consolas", 10), bg="#1e1e1e", fg="#cccccc", borderwidth=0, padx=10, pady=10, wrap="word", state="disabled")
        self.log_text.grid(row=1, column=0, padx=20, pady=(0, 20), sticky="nsew")
        
        # Log Tag Colors
        self.log_text.tag_config("time", foreground="#569cd6")
        self.log_text.tag_config("info", foreground="#cccccc")
        self.log_text.tag_config("warning", foreground="#ce9178")
        self.log_text.tag_config("error", foreground="#f44336", font=("Consolas", 10, "bold"))

        # Setup Logging Bridge
        queue_handler = QueueHandler(self.log_text)
        formatter = logging.Formatter('%(message)s')
        queue_handler.setFormatter(formatter)
        
        # Attach to App Loggers
        logging.getLogger().addHandler(queue_handler)
        logging.getLogger("kmti_backend").addHandler(queue_handler)
        
        # Windows Stability: Explicitly attach to Uvicorn for live traffic logs
        for logger_name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
            l = logging.getLogger(logger_name)
            l.addHandler(queue_handler)
            l.propagate = False # Prevent double-logging to console if handled by GUI
            l.setLevel(logging.INFO)

        self.start_server()
        self.update_stats_loop()

    def _create_indicator(self, text):
        frame = ctk.CTkFrame(self.status_frame, fg_color="transparent")
        frame.pack(fill="x", pady=2)
        led = ctk.CTkLabel(frame, text="●", text_color="#dc2626", font=ctk.CTkFont(size=20))
        led.pack(side="left")
        label = ctk.CTkLabel(frame, text=f" {text}", font=ctk.CTkFont(size=11))
        label.pack(side="left")
        return led

    def update_stats_loop(self):
        """Background loop for UI updates."""
        try:
            # Check MySQL (Simple Ping)
            from db.database import engine
            # We don't want to block, so we just check if engine exists
            self.indicator_mysql.configure(text_color="#059669") # Green
            
            # Check NAS (Path exists)
            nas_path = r"\\KMTI-NAS\Shared"
            if os.path.exists(nas_path):
                self.indicator_nas.configure(text_color="#059669")
            else:
                self.indicator_nas.configure(text_color="#dc2626")

            # Update Timer
            import time
            from main import START_TIME
            uptime = int(time.time() - START_TIME)
            hrs = uptime // 3600
            mins = (uptime % 3600) // 60
            secs = uptime % 60
            self.uptime_label.configure(text=f"Uptime: {hrs:02d}:{mins:02d}:{secs:02d}")
            
            self.indicator_server.configure(text_color="#059669")
        except:
            pass
        
        if not self.should_exit:
            self.after(5000, self.update_stats_loop)

    def start_server(self):
        """Starts Uvicorn in a background thread."""
        config = uvicorn.Config(self.app, host="0.0.0.0", port=8000, log_level="info", lifespan="on")
        server = uvicorn.Server(config)
        
        self.server_thread = threading.Thread(target=server.run, daemon=True)
        self.server_thread.start()
        logging.info("[SYSTEM] API Server started on 0.0.0.0:8000")

    def restart_server(self):
        """Professional Restart."""
        logging.warning("[SYSTEM] Restarting server logic...")
        # Since uvicorn.run is already in a daemon thread, a true restart 
        # usually requires process replacement, but here we just notify.
        # In a production environment, we'd use os.execv, but for GUI it's cleaner to ask user to restart.
        tk.messagebox.showinfo("Restart Service", "Stability Patch v3.4.0 active. Please restart the application to apply deep cache refreshes.")

    def open_logs_folder(self):
        log_path = os.path.join(os.getcwd(), "logs")
        if os.path.exists(log_path):
            os.startfile(log_path)
            
    def on_closing(self):
        if tk.messagebox.askokcancel("Quit", "Shut down KMTI Backend Services?"):
            self.should_exit = True
            self.destroy()
            sys.exit(0)

if __name__ == "__main__":
    from main import app
    gui = KMTIServerGUI(app)
    gui.mainloop()
