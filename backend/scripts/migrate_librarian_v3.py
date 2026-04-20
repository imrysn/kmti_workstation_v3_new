import asyncio
import sys
import os
from sqlalchemy import text

# Add backend directory to sys.path so we can import db.database
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from db.database import AsyncSessionLocal, engine

async def migrate():
    print("Starting Librarian v3 Database Migration...")
    
    async with AsyncSessionLocal() as session:
        try:
            # 1. Create kmti_librarian_sessions table
            print("Checking for 'kmti_librarian_sessions' table...")
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS kmti_librarian_sessions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    ip_address VARCHAR(45) NOT NULL,
                    title VARCHAR(255) NOT NULL DEFAULT 'New Chat',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_lib_sess_ip (ip_address),
                    INDEX idx_lib_sess_created (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """))
            print("--- 'kmti_librarian_sessions' table verified/created.")

            # 2. Add 'session_id' column to 'kmti_librarian_history'
            print("Checking for 'session_id' column in 'kmti_librarian_history'...")
            res = await session.execute(text("SHOW COLUMNS FROM kmti_librarian_history LIKE 'session_id'"))
            column = res.fetchone()
            
            if not column:
                print("Adding 'session_id' column...")
                # Add column
                await session.execute(text("ALTER TABLE kmti_librarian_history ADD COLUMN session_id INT AFTER id"))
                
                # Add index
                print("Adding index for 'session_id'...")
                await session.execute(text("CREATE INDEX idx_lib_hist_sid ON kmti_librarian_history(session_id)"))
                
                # Add Foreign Key
                print("Adding Foreign Key constraint...")
                await session.execute(text("""
                    ALTER TABLE kmti_librarian_history 
                    ADD CONSTRAINT fk_lib_hist_session 
                    FOREIGN KEY (session_id) 
                    REFERENCES kmti_librarian_sessions(id) 
                    ON DELETE CASCADE
                """))
                
                await session.commit()
                print("--- Migration successful: 'session_id' added with constraints.")
            else:
                print("--- 'session_id' column already exists. Skipping.")

            # 3. Add 'updated_at' to sessions if it doesn't exist (safety)
            res = await session.execute(text("SHOW COLUMNS FROM kmti_librarian_sessions LIKE 'updated_at'"))
            if not res.fetchone():
                print("Adding 'updated_at' column to sessions...")
                await session.execute(text("ALTER TABLE kmti_librarian_sessions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"))
                await session.commit()

            print("\nMigration Complete!")
            
        except Exception as e:
            print(f"\nMigration error: {e}")
            await session.rollback()
            raise e

if __name__ == "__main__":
    asyncio.run(migrate())
