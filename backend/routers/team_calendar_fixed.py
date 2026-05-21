# CHANGES FOR DUE DATE DISPLAY
# Lines 140-180 in get_team_grid() - Updated FMS assignment mapping

# Replace the section starting from "# 2. Fetch assignments from remote FMS database"
# with this updated code:

    # 2. Fetch assignments from remote FMS database in the date range
    try:
        from datetime import datetime, time as dt_time
        
        # Expand search window to include assignments that START before range but DUE within range
        # or START within range (to catch ongoing work)
        search_start = datetime.combine(start_date, dt_time.min) - timedelta(days=90)  # Look back 90 days for long assignments
        search_end = datetime.combine(end_date, dt_time.max)
        
        fms_assign_query = (
            select(FmsAssignment)
            .where(
                FmsAssignment.due_date >= search_start,
                FmsAssignment.due_date <= search_end
            )
            .options(selectinload(FmsAssignment.members))
        )
        
        fms_assign_res = await fms_db.execute(fms_assign_query)
        fms_assignments = fms_assign_res.scalars().all()
        
        # Load FMS users for mapping names
        fms_users_res = await fms_db.execute(select(FmsUser))
        fms_users_list = fms_users_res.scalars().all()
        fms_user_id_to_obj = {u.id: u for u in fms_users_list}
        
        EXCLUDED_USERNAMES = {"test", "test_user", "team.leader", "test fms assignee"}
        
        for fa in fms_assignments:
            # Determine assignment start and due dates
            if fa.due_date:
                due_date_obj = fa.due_date.date()
            else:
                # Fallback: if no due date, use created_at + 7 days or just created_at
                due_date_obj = (fa.created_at.date() + timedelta(days=7)) if fa.created_at else start_date
            
            # Start date: when assignment was created (work begins)
            if fa.created_at:
                start_date_obj = fa.created_at.date()
            else:
                # Fallback: default to due date if no created_at
                start_date_obj = due_date_obj
            
            # Only show if the assignment span overlaps with our calendar view range
            if due_date_obj < start_date or start_date_obj > end_date:
                continue
            
            for member in fa.members:
                fms_u = fms_user_id_to_obj.get(member.user_id)
                if not fms_u or fms_u.username.lower() in EXCLUDED_USERNAMES:
                    continue
                
                l_user_id = user_name_to_id.get(fms_u.username.lower(), current_user.id)
                
                # Task status based on member submission status
                if member.status == "submitted" or fa.status == "completed":
                    t_status = "Completed"
                else:
                    t_status = "Claimed"
                
                # CRITICAL: Now we expose start_date, end_date (span), AND due_date separately
                response_events.append({
                    "id": 3000000 + member.id,
                    "event_type": "Task_Claim",
                    "user_id": l_user_id,
                    "username": fms_u.username,
                    "engineer_name": fms_u.fullName,
                    "todo_id": None,
                    "todo_title": fa.title,
                    "todo_description": fa.description,
                    "todo_priority": "Normal",
                    "todo_status": t_status,
                    "start_date": start_date_obj.isoformat(),  # When work begins
                    "end_date": due_date_obj.isoformat(),      # When work must be done
                    "due_date": due_date_obj.isoformat(),      # EXPLICIT due date field
                    "status": "Approved",
                    "leave_type": None,
                })
    except Exception as e:
        import logging
        logger = logging.getLogger("uvicorn.error")
        logger.warning(f"Failed to query FMS assignments for grid: {e}")

    return {
        "success": True,
        "events": response_events
    }
