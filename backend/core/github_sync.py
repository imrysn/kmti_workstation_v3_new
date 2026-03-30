import asyncio
import httpx
import json
import logging
import subprocess
import os
from datetime import datetime

# Configure your GitHub repo details here or in .env
GITHUB_RAW_URL = "https://raw.githubusercontent.com/imrysn/kmti_workstation_v3_new/main/backend/status_override.json"
POLL_INTERVAL_SECONDS = 60  # Check every minute

logger = logging.getLogger(__name__)

class GitHubSyncService:
    _instance = None
    _overrides = {}
    _last_sync = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(GitHubSyncService, cls).__new__(cls)
        return cls._instance

    @property
    def overrides(self):
        return self._overrides

    @property
    def last_sync(self):
        return self._last_sync

    async def poll_github(self):
        """Background task to fetch status_override.json from GitHub."""
        # Centralized Server is intentionally offline — disabled GitHub polling.
        logger.info("GitHub Sync disabled: Server is running in offline mode.")
        pass

    async def trigger_update(self):
        """Executes git pull to update the local repository."""
        try:
            # Assumes the script is running inside the git repository
            repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
            logger.info(f"Triggering update in {repo_root}")
            
            # Run git pull
            process = subprocess.run(
                ["git", "pull"],
                cwd=repo_root,
                capture_output=True,
                text=True,
                check=True
            )
            
            logger.info(f"Git Pull Success: {process.stdout}")
            return {"success": True, "output": process.stdout}
        except subprocess.CalledProcessError as e:
            logger.error(f"Git Pull Failed: {e.stderr}")
            return {"success": False, "error": e.stderr}
        except Exception as e:
            logger.error(f"Update Error: {e}")
            return {"success": False, "error": str(e)}

# Global singleton
sync_service = GitHubSyncService()
