import asyncio
from sqlalchemy import text
from db.database import AsyncSessionLocal

async def check_last_ticket():
    async with AsyncSessionLocal() as session:
        try:
            res = await session.execute(text("SELECT id, workstation, subject, ip_address FROM kmti_tickets ORDER BY id DESC LIMIT 1"))
            ticket = res.fetchone()
            if ticket:
                print(f"Last Ticket: ID={ticket[0]}, WS={ticket[1]}, Subject='{ticket[2]}', IP={ticket[3]}")
            else:
                print("No tickets found.")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_last_ticket())
