import asyncio
from sqlalchemy import text
from db.database import AsyncSessionLocal

async def check_messages():
    async with AsyncSessionLocal() as session:
        try:
            res = await session.execute(text("SELECT id, ticket_id, sender_type, sender_name, message FROM kmti_ticket_messages ORDER BY id DESC LIMIT 5"))
            messages = res.fetchall()
            print("Recent Messages:")
            for m in messages:
                print(f"ID={m[0]}, TicketID={m[1]}, Type='{m[2]}', Name='{m[3]}', Msg='{m[4]}'")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_messages())
