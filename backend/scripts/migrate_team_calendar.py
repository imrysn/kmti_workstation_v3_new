import asyncio
import sys
import os
from sqlalchemy import text

# Add backend directory to sys.path so we can import db.database
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from db.database import AsyncSessionLocal

async def migrate():
    print("Starting Team Calendar Database Migration...")
    
    async with AsyncSessionLocal() as session:
        try:
            # 1. Create kmti_todos table
            print("Checking/Creating 'kmti_todos' table...")
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS kmti_todos (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_todo_status (status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """))
            print("--- 'kmti_todos' table verified/created.")

            # 2. Create kmti_calendar_events table
            print("Checking/Creating 'kmti_calendar_events' table...")
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS kmti_calendar_events (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    event_type VARCHAR(50) NOT NULL,
                    user_id INT NOT NULL,
                    todo_id INT DEFAULT NULL,
                    engineer_name VARCHAR(100) DEFAULT NULL,
                    start_date DATE NOT NULL,
                    end_date DATE NOT NULL,
                    status VARCHAR(50) NOT NULL DEFAULT 'Approved',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_cal_user FOREIGN KEY (user_id) REFERENCES kmti_users(id) ON DELETE CASCADE,
                    CONSTRAINT fk_cal_todo FOREIGN KEY (todo_id) REFERENCES kmti_todos(id) ON DELETE SET NULL,
                    INDEX idx_calendar_user_id (user_id),
                    INDEX idx_calendar_dates_range (start_date, end_date),
                    INDEX idx_calendar_user_dates (user_id, start_date, end_date)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """))
            print("--- 'kmti_calendar_events' table verified/created.")

            # 3. Add engineer_name column dynamically if it doesn't exist
            print("Adding 'engineer_name' column to 'kmti_calendar_events' if not exists...")
            try:
                await session.execute(text("""
                    ALTER TABLE kmti_calendar_events ADD COLUMN engineer_name VARCHAR(100) DEFAULT NULL;
                """))
                print("--- 'engineer_name' column added successfully.")
            except Exception as alter_err:
                print(f"--- 'engineer_name' column addition skipped (it may already exist).")

            await session.commit()
            print("\nMigration Complete Successfully!")
            
        except Exception as e:
            print(f"\nMigration error: {e}")
            await session.rollback()
            raise e

if __name__ == "__main__":
    asyncio.run(migrate())
