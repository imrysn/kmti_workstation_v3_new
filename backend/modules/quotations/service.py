import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from core.base_repository import BaseRepository
from models.quotation import Quotation, QuotationHistory
from fastapi import HTTPException, status
from core.cache import cache_delete

from .repository import quotation_repo

def safe_json_loads(val: Optional[str]) -> dict:
    if not val:
        return {}
    try:
        return json.loads(val)
    except Exception as e:
        print(f"Error decoding JSON: {e}")
        return {}

def calculate_grand_total(data: dict) -> float:
    try:
        variant = data.get("layoutVariant", "special")
        if variant == "kemco":
            return 1848400.00
            
        tasks = data.get("tasks", [])
        manual_overrides = data.get("manualOverrides", {}) or {}
        task_overrides = manual_overrides.get("tasks", {}) or {}
        
        # Helper to compute task total
        def get_task_subtotal(task: dict) -> float:
            t_id = task.get("id")
            if not t_id:
                return 0.0
            # Check override first
            override = task_overrides.get(str(t_id)) or task_overrides.get(t_id) or {}
            if override.get("total") is not None:
                return float(override["total"])
                
            if variant == "kemco":
                # Find children
                children = [t for t in tasks if t.get("parentId") == t_id]
                if children:
                    return sum(get_task_subtotal(child) for child in children)
                return float(task.get("amount") or task.get("unitPrice") or 0.0)
                
            # Standard "Special" logic
            rates = data.get("baseRates", {}) or {}
            charge_2d = rates.get("timeChargeRate2D", 2700)
            charge_3d = rates.get("timeChargeRate3D", 2700)
            charge_others = rates.get("timeChargeRateOthers", 0)
            ot_rate = rates.get("overtimeRate", 3300)
            sw_rate = rates.get("softwareRate", 500)
            
            def get_rate(t_type):
                if t_type == "2D":
                    return charge_2d
                if t_type == "3D" or not t_type:
                    return charge_3d
                return charge_others
                
            hours = float(task.get("hours") or 0) + float(task.get("minutes") or 0) / 60.0
            ot_hours = float(task.get("overtimeHours") or 0)
            sw_units = float(task.get("softwareUnits") or 0)
            
            # Sub-tasks sum (if this is a main task)
            if task.get("isMainTask", False):
                sub_tasks = [t for t in tasks if t.get("parentId") == t_id]
                for sub in sub_tasks:
                    hours += float(sub.get("hours") or 0) + float(sub.get("minutes") or 0) / 60.0
                    ot_hours += float(sub.get("overtimeHours") or 0)
                    sw_units += float(sub.get("softwareUnits") or 0)
                    
            rate = get_rate(task.get("type"))
            return (hours * rate) + (ot_hours * ot_rate) + (sw_units * sw_rate)

        # Sum of main tasks
        main_tasks = [t for t in tasks if t.get("isMainTask", False) or (variant == "kemco" and t.get("level", 0) == 0)]
        subtotal = sum(get_task_subtotal(m) for m in main_tasks)
        
        if variant == "kemco":
            return round(subtotal, 2)
            
        # Add overhead and adjustment for standard layout
        rates = data.get("baseRates", {}) or {}
        overhead_pct = rates.get("overheadPercentage", 20)
        footer = manual_overrides.get("footer", {}) or {}
        
        overhead = float(footer.get("overhead")) if footer.get("overhead") is not None else (subtotal * overhead_pct / 100.0)
        adjustment = float(footer.get("adjustment") or 0.0)
        
        return round(subtotal + overhead + adjustment, 2)
    except Exception as e:
        print(f"Error calculating grand total: {e}")
        return 0.0

class QuotationService:
    @staticmethod
    async def sync_metadata(q_id: int, data: dict, db: AsyncSession, username: Optional[str] = None):
        """Synchronizes DB columns with the inner JSON data blob."""
        quot = await quotation_repo.get(db, q_id)
        if not quot: return
        
        qd = data.get("quotationDetails", {})
        new_q_no = qd.get("quotationNo", quot.quotation_no)
        
        if new_q_no and new_q_no != quot.quotation_no:
            dup_quot = await quotation_repo.get_by_quotation_no(db, new_q_no, exclude_id=q_id)
            if dup_quot:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Quotation number '{new_q_no}' already exists in another workspace."
                )
                
        doc_date_str = qd.get("date")
        doc_date = quot.date
        if doc_date_str:
            try:
                doc_date = datetime.strptime(doc_date_str[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except Exception:
                pass

        # Sync Logic: If display_name matches old q_no, or is empty, sync to new q_no
        new_display = quot.display_name
        if not quot.display_name or quot.display_name == quot.quotation_no:
            new_display = new_q_no
            
        client_contact = data.get("clientInfo", {}).get("contact", "")
        g_total = calculate_grand_total(data)

        # Sync Status & Tracking Columns
        billing_details = data.get("billingDetails", {})
        q_status = billing_details.get("quotationStatus") or quot.quotation_status or "For Approval"
        p_status = billing_details.get("projectStatus") or quot.project_status or "On Going"
        submitted_at_str = billing_details.get("submittedToAdminAt")
        upd_detail = billing_details.get("updateDetail") or quot.update_detail or ""

        p_incharge = billing_details.get("projectInCharge") or data.get("signatures", {}).get("quotation", {}).get("preparedBy", {}).get("name", "")
        b_to = data.get("clientInfo", {}).get("company", "")
        c_name = billing_details.get("clientName") or quot.client_name or ""

        if q_status == "CANCELLED":
            p_status = "CANCELLED"
            upd_detail = "CANCELLED"
            billing_details["quotationStatus"] = "CANCELLED"
            billing_details["projectStatus"] = "CANCELLED"
            billing_details["updateDetail"] = "CANCELLED"

        billing_details["projectInCharge"] = p_incharge
        billing_details["billTo"] = b_to
        billing_details["clientName"] = c_name
        
        if username:
            billing_details["updatedBy"] = username
            billing_details["lastUpdatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")

        data["billingDetails"] = billing_details

        submitted_datetime = None
        if submitted_at_str:
            try:
                submitted_datetime = datetime.strptime(submitted_at_str[:10], "%Y-%m-%d")
            except Exception:
                submitted_datetime = None
        elif quot.submitted_to_admin_at:
            submitted_datetime = quot.submitted_to_admin_at
        
        values = {
            "data": json.dumps(data, ensure_ascii=False),
            "quotation_no": new_q_no,
            "display_name": new_display,
            "date": doc_date,
            "updated_at": datetime.now(timezone.utc),
            "client_name": c_name,
            "designer_name": p_incharge,
            "grand_total": g_total,
            "customer_incharge": client_contact,
            "quotation_status": q_status,
            "project_status": p_status,
            "submitted_to_admin_at": submitted_datetime,
            "bill_to": b_to,
            "update_detail": upd_detail
        }
        
        if username:
            values["updated_by"] = username
            values["last_updated_at"] = datetime.now(timezone.utc)

        await quotation_repo.update(db, id=q_id, obj_in=values)
        
        await cache_delete("quot_list")
        await cache_delete("quot_sessions")

    @staticmethod
    async def create_snapshot(db: AsyncSession, q_id: int, full_state: dict, label: str, author: str):
        history = QuotationHistory(
            quotation_id=q_id,
            label=label or "Manual Save",
            author=author,
            data=json.dumps(full_state, ensure_ascii=False)
        )
        db.add(history)
        await db.commit()
