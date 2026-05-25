import asyncio
import json
from decimal import Decimal
from sqlalchemy import text, select
from db.database import AsyncSessionLocal
from models.quotation import Quotation
from routers.quotations import calculate_grand_total

async def backfill():
    async with AsyncSessionLocal() as db:
        stmt = select(Quotation)
        result = await db.execute(stmt)
        quotations = result.scalars().all()
        
        print(f"Total quotations found: {len(quotations)}")
        updated_count = 0
        
        for q in quotations:
            if not q.data:
                continue
            
            try:
                data = json.loads(q.data)
            except Exception as e:
                print(f"Error parsing JSON for ID {q.id}: {e}")
                continue
                
            # Calculate grand total
            g_total = calculate_grand_total(data)
            
            # Extract metadata
            client_contact = data.get("clientInfo", {}).get("contact", "")
            p_incharge = data.get("billingDetails", {}).get("projectInCharge") or data.get("signatures", {}).get("quotation", {}).get("preparedBy", {}).get("name", "")
            b_to = data.get("clientInfo", {}).get("company", "") or data.get("billingDetails", {}).get("billTo", "")
            
            # Sync billingDetails dictionary inside JSON data if it doesn't match
            billing_details = data.get("billingDetails", {})
            changed_json = False
            
            if "projectInCharge" not in billing_details or billing_details.get("projectInCharge") != p_incharge:
                billing_details["projectInCharge"] = p_incharge
                changed_json = True
            
            if "billTo" not in billing_details or billing_details.get("billTo") != b_to:
                billing_details["billTo"] = b_to
                changed_json = True
                
            if changed_json:
                data["billingDetails"] = billing_details
                q.data = json.dumps(data, ensure_ascii=False)
            
            # Compare and update columns
            needs_update = False
            
            if q.grand_total != Decimal(str(g_total)):
                print(f"ID {q.id} ({q.quotation_no}): grand_total {q.grand_total} -> {g_total}")
                q.grand_total = g_total
                needs_update = True
                
            if q.customer_incharge != client_contact:
                print(f"ID {q.id} ({q.quotation_no}): customer_incharge '{q.customer_incharge}' -> '{client_contact}'")
                q.customer_incharge = client_contact
                needs_update = True
                
            if q.designer_name != p_incharge:
                print(f"ID {q.id} ({q.quotation_no}): designer_name '{q.designer_name}' -> '{p_incharge}'")
                q.designer_name = p_incharge
                needs_update = True
                
            if q.bill_to != b_to:
                print(f"ID {q.id} ({q.quotation_no}): bill_to '{q.bill_to}' -> '{b_to}'")
                q.bill_to = b_to
                # Also client_name is synced with bill_to for reporting
                q.client_name = b_to or q.client_name
                needs_update = True
                
            if needs_update:
                db.add(q)
                updated_count += 1
                
        if updated_count > 0:
            print(f"Committing {updated_count} updated quotations...")
            await db.commit()
            print("Done!")
        else:
            print("No updates needed.")

if __name__ == "__main__":
    asyncio.run(backfill())
