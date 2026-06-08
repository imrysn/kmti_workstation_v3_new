import asyncio
import json
from sqlalchemy import text
from db.database import engine

async def inspect():
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT id, quotation_no, grand_total, data FROM quotations WHERE id = 142 OR id = 122 OR id = 135"))
        rows = result.fetchall()
        for row in rows:
            q_id = row[0]
            q_no = row[1]
            gt_db = row[2]
            raw_data = row[3]
            data = json.loads(raw_data) if raw_data else {}
            tasks = data.get("tasks", [])
            print(f"ID: {q_id} | QuotNo: {q_no} | DB GT: {gt_db} | Tasks Count: {len(tasks)}")
            for idx, t in enumerate(tasks):
                print(f"  Task {idx}: id={t.get('id')} parentId={t.get('parentId')} isMainTask={t.get('isMainTask')} amount={t.get('amount')} unitPrice={t.get('unitPrice')} hours={t.get('hours')} minutes={t.get('minutes')} type={t.get('type')}")
            print(f"  Manual Overrides: {data.get('manualOverrides')}")
            print(f"  Base Rates: {data.get('baseRates')}")

if __name__ == "__main__":
    asyncio.run(inspect())
