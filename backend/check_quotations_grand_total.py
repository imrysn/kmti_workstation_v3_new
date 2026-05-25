import asyncio
import json
from sqlalchemy import text
from db.database import engine
from routers.quotations import calculate_grand_total

async def check_quotations():
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT id, quotation_no, grand_total, data FROM quotations LIMIT 10"))
        rows = result.fetchall()
        for row in rows:
            q_id = row[0]
            q_no = row[1]
            gt_db = row[2]
            raw_data = row[3]
            try:
                data = json.loads(raw_data) if raw_data else {}
                calc_gt = calculate_grand_total(data)
                print(f"ID: {q_id} | QuotNo: {q_no} | DB GT: {gt_db} | Calc GT: {calc_gt} | Has Tasks: {len(data.get('tasks', []))}")
            except Exception as e:
                print(f"ID: {q_id} | QuotNo: {q_no} | Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_quotations())
