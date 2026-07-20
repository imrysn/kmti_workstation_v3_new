import os
import uuid
import shutil
from typing import List, Optional
from fastapi import UploadFile, HTTPException
from datetime import datetime
import logging

logger = logging.getLogger("kmti_backend.help_center")

# NAS Storage Path for network accessibility
STORAGE_DIR = r"\\KMTI-NAS\Shared\data\storage\feedback"

try:
    os.makedirs(STORAGE_DIR, exist_ok=True)
except Exception as e:
    logger.warning(
        f"Failed to initialize STORAGE_DIR at '{STORAGE_DIR}' on boot: {e}. Screenshot uploads may fail until path is restored."
    )

class HelpCenterService:
    @staticmethod
    async def save_screenshots(screenshots: List[UploadFile]) -> Optional[str]:
        saved_paths = []
        if screenshots:
            try:
                os.makedirs(STORAGE_DIR, exist_ok=True)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Screenshot storage directory is unreachable: {e}")
                
            for screenshot in screenshots:
                if not screenshot.filename:
                    continue
                ext = os.path.splitext(screenshot.filename)[1]
                filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex}{ext}"
                save_path = os.path.join(STORAGE_DIR, filename)
                with open(save_path, "wb") as buffer:
                    shutil.copyfileobj(screenshot.file, buffer)
                saved_paths.append(f"/storage/feedback/{filename}")
        return ",".join(saved_paths) if saved_paths else None
