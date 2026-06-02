from db.database import AsyncSessionLocal
from models.activity_log import ActivityLog
from typing import Optional
import logging

logger = logging.getLogger("kmti_activity_logger")

async def log_activity(
    username: Optional[str],
    action: str,
    details: Optional[str] = None,
    ip_address: Optional[str] = None
):
    """
    Asynchronously write an audit event into the activity logs table.
    Uses an independent database session so logging is isolated and resilient.
    """
    try:
        async with AsyncSessionLocal() as db:
            log_entry = ActivityLog(
                username=username,
                action=action,
                details=details,
                ip_address=ip_address
            )
            db.add(log_entry)
            await db.commit()
    except Exception as e:
        logger.error(f"[ACTIVITY LOG ERROR] Failed to record action '{action}' for user '{username}': {e}")
