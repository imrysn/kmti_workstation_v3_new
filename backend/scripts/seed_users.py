"""
Seed script — creates the 3 base KMTI user accounts in the shared DB.
Run once after deployment:

  cd backend
  python scripts/seed_users.py

Idempotent: skips users that already exist. Safe to re-run.
"""
import asyncio
import os
import sys

# Allow imports from backend root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select

from db.database import DATABASE_URL, Base
from models.user import User, UserRole, FeatureFlag
from core.auth import hash_password

# ---------------------------------------------------------------------------
# Define base accounts here. Change passwords before first deploy.
# ---------------------------------------------------------------------------
USERS = [
    {
        "username": "viewer",
        "password": "viewer1234",   # shared account for all 20+ employees
        "role": UserRole.viewer,
    },
    {
        "username": "admin",
        "password": "Admin@KMTI2024",
        "role": UserRole.admin,
    },
    {
        "username": "it",
        "password": "IT@KMTI2024",
        "role": UserRole.it,
    },
]

DEFAULT_FLAGS = {
    "heat_treatment_enabled": True,
    "calculator_enabled": True,
    "maintenance_mode": False,
}


async def seed():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # --- Seed users ---
        for u in USERS:
            result = await db.execute(select(User).where(User.username == u["username"]))
            existing = result.scalar_one_or_none()
            if existing:
                print(f"  [SKIP] User '{u['username']}' already exists.")
            else:
                db.add(User(
                    username=u["username"],
                    hashed_password=hash_password(u["password"]),
                    role=u["role"],
                    is_active=True,
                ))
                print(f"  [OK]   Created user '{u['username']}' with role '{u['role'].value}'.")

        # --- Seed feature flags ---
        result = await db.execute(select(FeatureFlag))
        existing_keys = {f.key for f in result.scalars().all()}
        for key, val in DEFAULT_FLAGS.items():
            if key not in existing_keys:
                db.add(FeatureFlag(key=key, value=val))
                print(f"  [OK]   Created feature flag '{key}' = {val}.")
            else:
                print(f"  [SKIP] Feature flag '{key}' already exists.")

        await db.commit()

    await engine.dispose()
    print("\nSeeding complete.")


if __name__ == "__main__":
    asyncio.run(seed())
