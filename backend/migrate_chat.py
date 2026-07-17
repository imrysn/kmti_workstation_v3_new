import asyncio
from sqlalchemy import text
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from db.database import engine

async def migrate_chat_schema():
    async with engine.begin() as conn:
        print("Migrating kmti_chat_messages...")
        try:
            # Add is_edited
            await conn.execute(text("ALTER TABLE kmti_chat_messages ADD COLUMN is_edited BOOLEAN NOT NULL DEFAULT FALSE;"))
            print("Added is_edited column.")
        except Exception as e:
            print(f"Skipped is_edited: {e}")

        try:
            # Add is_deleted
            await conn.execute(text("ALTER TABLE kmti_chat_messages ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;"))
            print("Added is_deleted column.")
        except Exception as e:
            print(f"Skipped is_deleted: {e}")

        try:
            # Add reply_to_id
            await conn.execute(text("ALTER TABLE kmti_chat_messages ADD COLUMN reply_to_id INTEGER NULL;"))
            print("Added reply_to_id column.")
        except Exception as e:
            print(f"Skipped reply_to_id: {e}")

        try:
            # Add fk constraint
            await conn.execute(text("ALTER TABLE kmti_chat_messages ADD CONSTRAINT fk_reply_to FOREIGN KEY (reply_to_id) REFERENCES kmti_chat_messages(id) ON DELETE SET NULL;"))
            print("Added fk_reply_to constraint.")
        except Exception as e:
            print(f"Skipped fk constraint: {e}")

        try:
            # Add reactions
            await conn.execute(text("ALTER TABLE kmti_chat_messages ADD COLUMN reactions TEXT NULL;"))
            print("Added reactions column.")
        except Exception as e:
            print(f"Skipped reactions: {e}")

    print("Migration complete!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate_chat_schema())
