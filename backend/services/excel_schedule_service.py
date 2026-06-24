import os
import re
import datetime
import unicodedata
import asyncio
from typing import Dict, List, Any, Optional, Tuple
from io import BytesIO
import openpyxl
from copy import copy

class ExcelScheduleService:
    # Static cache to store the layout structure of the timeline (members and columns)
    # This avoids reloading the heavy Excel workbook on every timeline read.
    _cached_layout: Optional[Dict[str, Any]] = None
    _cached_template_bytes: Optional[bytes] = None   # raw bytes of the template file
    _lock = asyncio.Lock()

    @classmethod
    def clear_cache(cls):
        cls._cached_layout = None
        cls._cached_template_bytes = None  # force re-read on next import/export

    @classmethod
    async def get_target_row_for_member(cls, excel_path: str, member_name: str) -> Optional[int]:
        if cls._cached_layout is None:
            async with cls._lock:
                if cls._cached_layout is None:
                    cls._cached_layout = await asyncio.to_thread(cls._load_and_parse_layout, excel_path)
        
        norm_member_name = unicodedata.normalize('NFC', member_name.strip().lower())
        return cls._cached_layout.get("member_rows", {}).get(norm_member_name)

    @staticmethod
    def parse_excel_for_import(excel_path: str) -> Dict[str, Any]:
        # Import clears and resets the DB, so we invalidate the layout cache
        ExcelScheduleService.clear_cache()
        
        wb = openpyxl.load_workbook(excel_path, data_only=True)
        ws = wb['Schedule']
        
        jobs_dict = {}
        current_job = None
        
        for r in range(1, ws.max_row + 1):
            val_a = ws.cell(row=r, column=1).value
            val_a_str = str(val_a).strip() if val_a is not None else ""
            
            if "Job Status" in val_a_str:
                m = re.match(r"(\d+)\s+Job\s+Status", val_a_str, re.IGNORECASE)
                job_id = m.group(1) if m else val_a_str.replace("Job Status", "").strip()
                
                deadline_val = ws.cell(row=r, column=2).value
                deadline_str = str(deadline_val).strip() if deadline_val is not None else ""
                
                current_job = {
                    "deadline": deadline_str,
                    "components": []
                }
                jobs_dict[job_id] = current_job
                
            elif current_job:
                if val_a_str == "" or val_a_str == "Machine/Unit Code" or val_a_str == "Legend:":
                    continue
                    
                unit_code = val_a_str
                assembly_3d = str(ws.cell(row=r, column=2).value or "").strip()
                parts_3d = str(ws.cell(row=r, column=5).value or "").strip()
                assembly_2d = str(ws.cell(row=r, column=7).value or "").strip()
                parts_2d = str(ws.cell(row=r, column=10).value or "").strip()
                status_val = str(ws.cell(row=r, column=12).value or "").strip()
                submitted_val = ws.cell(row=r, column=16).value
                
                sub_date = None
                if submitted_val:
                    if isinstance(submitted_val, (datetime.datetime, datetime.date)):
                        sub_date = submitted_val.date() if isinstance(submitted_val, datetime.datetime) else submitted_val
                    else:
                        try:
                            sub_date = datetime.datetime.strptime(str(submitted_val).split()[0], "%Y-%m-%d").date()
                        except Exception:
                            pass
                            
                current_job["components"].append({
                    "unit_code": unit_code,
                    "assembly_3d": assembly_3d if assembly_3d else "-",
                    "parts_3d": parts_3d if parts_3d else "-",
                    "assembly_2d": assembly_2d if assembly_2d else "-",
                    "parts_2d": parts_2d if parts_2d else "-",
                    "status": status_val if status_val else "Pending/Not Started",
                    "submitted_date": sub_date
                })
                
        return jobs_dict

    @classmethod
    def _load_and_parse_layout(cls, excel_path: str) -> Dict[str, Any]:
        wb = openpyxl.load_workbook(excel_path, data_only=True)
        ws = wb['Schedule']
        
        # Get members (Rows 5 to 10)
        members = []
        for r in range(5, 11):
            name_val = ws.cell(row=r, column=8).value
            if name_val:
                members.append({
                    "row": r,
                    "name": str(name_val).strip()
                })
                
        # Find the last column that has a day number in row 4
        max_gantt_col = 20
        for c in range(ws.max_column, 19, -1):
            if ws.cell(row=4, column=c).value is not None:
                max_gantt_col = c
                break
                
        raw_days = []
        for c in range(20, max_gantt_col + 1):
            day_num = ws.cell(row=4, column=c).value
            day_week = ws.cell(row=3, column=c).value
            
            # Backtrack to find month
            month_name = ""
            for col_idx in range(c, 19, -1):
                m_val = ws.cell(row=2, column=col_idx).value
                if m_val:
                    month_name = str(m_val).strip()
                    break
                    
            # Cache spreadsheet assignments default values
            default_assignments = {}
            for m in members:
                cell_val = ws.cell(row=m["row"], column=c).value
                default_assignments[m["name"]] = str(cell_val).strip() if cell_val is not None else ""

            raw_days.append({
                "col_index": c,
                "month": month_name,
                "day": day_num,
                "weekday": day_week,
                "default_assignments": default_assignments
            })
            
        return {
            "members": [m["name"] for m in members],
            "member_rows": {unicodedata.normalize('NFC', m["name"].strip().lower()): m["row"] for m in members},
            "days": raw_days
        }

    @classmethod
    async def parse_timeline(cls, excel_path: str, db_assignments: List[Any]) -> Dict[str, Any]:
        # Load and parse layout structure only if not cached
        if cls._cached_layout is None:
            async with cls._lock:
                if cls._cached_layout is None:
                    cls._cached_layout = await asyncio.to_thread(cls._load_and_parse_layout, excel_path)

        # Map database assignments onto the cached layout structure
        db_map = {}
        for a in db_assignments:
            db_map[(a.member_name.strip().lower(), a.col_index)] = a.value
            
        timeline_days = []
        for d in cls._cached_layout["days"]:
            assignments = {}
            for member_name in cls._cached_layout["members"]:
                key = (member_name.strip().lower(), d["col_index"])
                if key in db_map:
                    assignments[member_name] = db_map[key] if db_map[key] is not None else ""
                else:
                    assignments[member_name] = d["default_assignments"].get(member_name, "")
                    
            timeline_days.append({
                "col_index": d["col_index"],
                "month": d["month"],
                "day": d["day"],
                "weekday": d["weekday"],
                "assignments": assignments
            })
            
        return {
            "members": cls._cached_layout["members"],
            "timeline": timeline_days
        }

    @staticmethod
    def generate_excel_export(
        excel_path: str,
        db_components: List[Any],
        db_jobs: List[Any],
        db_assignments: List[Any]
    ) -> BytesIO:
        # Load template from cached bytes (avoids repeated disk reads of the large xlsx)
        if ExcelScheduleService._cached_template_bytes is None:
            with open(excel_path, 'rb') as f:
                ExcelScheduleService._cached_template_bytes = f.read()
        wb = openpyxl.load_workbook(BytesIO(ExcelScheduleService._cached_template_bytes), data_only=False)
        ws = wb['Schedule']
        
        db_map = {}
        for c in db_components:
            key = (str(c.job_id).strip().lower(), str(c.unit_code).strip().lower())
            db_map[key] = c

        # ── Helper functions defined early so they're available throughout ──────
        def copy_cell_style(src_cell, dst_cell):
            if src_cell.has_style:
                dst_cell.font = copy(src_cell.font)
                dst_cell.border = copy(src_cell.border)
                dst_cell.fill = copy(src_cell.fill)
                dst_cell.alignment = copy(src_cell.alignment)
                dst_cell.number_format = src_cell.number_format

        # Status fill colors: Completed=orange/gold, For Checking=green, else no fill
        _FILL_COMPLETED = openpyxl.styles.PatternFill(fill_type='solid', fgColor='FFC000')  # orange/gold
        _FILL_CHECKING  = openpyxl.styles.PatternFill(fill_type='solid', fgColor='92D050')  # green
        _FILL_NONE      = openpyxl.styles.PatternFill(fill_type=None)
        _FONT_BLACK     = openpyxl.styles.Font(name='Arial Unicode MS', color='FF000000', bold=False)

        def apply_status_fill(sheet, row, col, status_text):
            """Apply color fill + black regular font to the status cell and its merged neighbours (cols 12-15)."""
            s = (status_text or '').strip().lower()
            if s in ('completed', 'complete'):
                fill = _FILL_COMPLETED
            elif s in ('for checking', 'checking'):
                fill = _FILL_CHECKING
            else:
                fill = _FILL_NONE
            for c in range(col, col + 4):   # cols 12-15
                cell = sheet.cell(row=row, column=c)
                cell.fill = fill
                cell.font = _FONT_BLACK

        def fmt_pct(val):
            """Convert stored decimal (e.g. 0.9) back to display string (e.g. '90%'), or return '-' for dashes."""
            if val is None:
                return '-'
            s = str(val).strip()
            if s in ('-', '', 'None'):
                return '-'
            try:
                f = float(s)
                if f > 1:
                    return f"{int(round(f))}%"
                return f"{int(round(f * 100))}%"
            except ValueError:
                return s
        # ─────────────────────────────────────────────────────────────────────────
        # Single-pass scan: update existing rows + collect ref rows + find last row
        # (Previously 3 separate O(N) loops over 1200+ rows — now one pass)
        # ─────────────────────────────────────────────────────────────────────────
        current_job_id = None
        seen_jobs      = set()
        ref_header_row = None   # last "Job Status" row seen  → used as template
        ref_comp_row   = None   # a component row with a known status → style ref
        last_used_row  = 1      # last row with any value in cols A-S

        for r in range(1, ws.max_row + 1):
            val_a     = ws.cell(row=r, column=1).value
            val_a_str = str(val_a).strip() if val_a is not None else ""

            # Track last non-empty row
            if val_a is not None or any(
                ws.cell(row=r, column=c).value is not None for c in range(2, 20)
            ):
                last_used_row = r

            if "Job Status" in val_a_str:
                m = re.match(r"(\d+)\s+Job\s+Status", val_a_str, re.IGNORECASE)
                current_job_id = m.group(1) if m else val_a_str.replace("Job Status", "").strip()
                seen_jobs.add(current_job_id.strip().lower())
                ref_header_row = r   # keep updating → ends up as last header row

            elif current_job_id:
                if val_a_str in ("", "Machine/Unit Code", "Legend:"):
                    continue

                unit_code = val_a_str
                key = (str(current_job_id).strip().lower(), str(unit_code).strip().lower())

                if key in db_map:
                    db_comp = db_map[key]
                    ws.cell(row=r, column=12, value=db_comp.status)
                    apply_status_fill(ws, r, 12, db_comp.status)
                    if db_comp.submitted_date:
                        ws.cell(row=r, column=16, value=db_comp.submitted_date.strftime("%Y/%m/%d"))
                    else:
                        ws.cell(row=r, column=16, value=None)

                # Track a real component row as style reference
                status_here = ws.cell(row=r, column=12).value
                if ref_comp_row is None and status_here and \
                        str(status_here).strip().lower() in ("pending/not started", "complete", "for checking"):
                    ref_comp_row = r

        if not ref_header_row:
            ref_header_row = 1212
        if not ref_comp_row:
            ref_comp_row   = 1216

        next_row = last_used_row + 1

        for j in db_jobs:
            j_key = j.job_id.strip().lower()
            if j_key not in seen_jobs:
                ref_spacer_row = ref_header_row - 2  # rows just above first job header in template
                for spacer_offset in range(2):
                    for c in range(1, 20):
                        src = ws.cell(row=ref_spacer_row, column=c)
                        dst = ws.cell(row=next_row, column=c)
                        dst.value = None
                        if src.has_style:
                            dst.fill = copy(src.fill)
                            dst.border = copy(src.border)
                    # Merge spacer row across all columns (A:S)
                    ws.merge_cells(start_row=next_row, start_column=1, end_row=next_row, end_column=19)
                    if ws.row_dimensions[ref_spacer_row].height:
                        ws.row_dimensions[next_row].height = ws.row_dimensions[ref_spacer_row].height
                    next_row += 1
                
                for c in range(1, 20):
                    copy_cell_style(ws.cell(row=ref_header_row, column=c), ws.cell(row=next_row, column=c))
                ws.cell(row=next_row, column=1, value=f"{j.job_id} Job Status")
                
                raw_deadline = str(j.deadline).strip() if j.deadline else ""
                formatted_deadline = re.sub(r"(\d{4})-(\d{2})-(\d{2})", r"\1/\2/\3", raw_deadline)
                ws.cell(row=next_row, column=2, value=f"Deadline: {formatted_deadline}" if formatted_deadline else "Deadline:")
                
                if ws.row_dimensions[ref_header_row].height:
                    ws.row_dimensions[next_row].height = ws.row_dimensions[ref_header_row].height
                next_row += 1
                
                for c in range(1, 20):
                    copy_cell_style(ws.cell(row=ref_header_row + 1, column=c), ws.cell(row=next_row, column=c))
                ws.cell(row=next_row, column=1, value="Machine/Unit Code")
                ws.cell(row=next_row, column=2, value="3D")
                ws.cell(row=next_row, column=7, value="2D")
                ws.cell(row=next_row, column=12, value="Status")
                ws.cell(row=next_row, column=16, value="Submitted Date")
                if ws.row_dimensions[ref_header_row + 1].height:
                    ws.row_dimensions[next_row].height = ws.row_dimensions[ref_header_row + 1].height
                
                ws.merge_cells(start_row=next_row, start_column=1, end_row=next_row + 1, end_column=1)
                ws.merge_cells(start_row=next_row, start_column=2, end_row=next_row, end_column=6)
                ws.merge_cells(start_row=next_row, start_column=7, end_row=next_row, end_column=11)
                ws.merge_cells(start_row=next_row, start_column=12, end_row=next_row + 1, end_column=15)
                ws.merge_cells(start_row=next_row, start_column=16, end_row=next_row, end_column=19)
                next_row += 1
                
                for c in range(1, 20):
                    copy_cell_style(ws.cell(row=ref_header_row + 2, column=c), ws.cell(row=next_row, column=c))
                ws.cell(row=next_row, column=2, value="Assembly")
                ws.cell(row=next_row, column=5, value="Parts")
                ws.cell(row=next_row, column=7, value="Assembly")
                ws.cell(row=next_row, column=10, value="Parts")
                ws.cell(row=next_row, column=16, value="Date")
                if ws.row_dimensions[ref_header_row + 2].height:
                    ws.row_dimensions[next_row].height = ws.row_dimensions[ref_header_row + 2].height
                    
                ws.merge_cells(start_row=next_row, start_column=2, end_row=next_row, end_column=4)
                ws.merge_cells(start_row=next_row, start_column=5, end_row=next_row, end_column=6)
                ws.merge_cells(start_row=next_row, start_column=7, end_row=next_row, end_column=9)
                ws.merge_cells(start_row=next_row, start_column=10, end_row=next_row, end_column=11)
                ws.merge_cells(start_row=next_row, start_column=16, end_row=next_row, end_column=19)
                next_row += 1
                
                j_comps = [c_item for c_item in db_components if str(c_item.job_id).strip().lower() == j_key]
                for c_item in j_comps:
                    for c in range(1, 20):
                        copy_cell_style(ws.cell(row=ref_comp_row, column=c), ws.cell(row=next_row, column=c))
                    
                    ws.cell(row=next_row, column=1, value=c_item.unit_code)
                    ws.cell(row=next_row, column=2, value=fmt_pct(c_item.assembly_3d))
                    ws.cell(row=next_row, column=5, value=fmt_pct(c_item.parts_3d))
                    ws.cell(row=next_row, column=7, value=fmt_pct(c_item.assembly_2d))
                    ws.cell(row=next_row, column=10, value=fmt_pct(c_item.parts_2d))
                    ws.cell(row=next_row, column=12, value=c_item.status)
                    apply_status_fill(ws, next_row, 12, c_item.status)
                    if c_item.submitted_date:
                        ws.cell(row=next_row, column=16, value=c_item.submitted_date.strftime("%Y/%m/%d"))
                    else:
                        ws.cell(row=next_row, column=16, value=None)
                        
                    if ws.row_dimensions[ref_comp_row].height:
                        ws.row_dimensions[next_row].height = ws.row_dimensions[ref_comp_row].height
                        
                    ws.merge_cells(start_row=next_row, start_column=2, end_row=next_row, end_column=4)
                    ws.merge_cells(start_row=next_row, start_column=5, end_row=next_row, end_column=6)
                    ws.merge_cells(start_row=next_row, start_column=7, end_row=next_row, end_column=9)
                    ws.merge_cells(start_row=next_row, start_column=10, end_row=next_row, end_column=11)
                    ws.merge_cells(start_row=next_row, start_column=12, end_row=next_row, end_column=15)
                    ws.merge_cells(start_row=next_row, start_column=16, end_row=next_row, end_column=19)

                    if c_item == j_comps[-1]:
                        from openpyxl.styles import Border, Side
                        medium_side = Side(style='medium', color='000000')
                        for c in range(1, 20):
                            cell = ws.cell(row=next_row, column=c)
                            cell.border = Border(
                                left=cell.border.left,
                                right=cell.border.right,
                                top=cell.border.top,
                                bottom=medium_side
                            )
                    next_row += 1

        member_rows = {}
        for r in range(5, 11):
            name_val = ws.cell(row=r, column=8).value
            if name_val:
                norm_name = unicodedata.normalize('NFC', str(name_val).strip().lower())
                member_rows[norm_name] = r
                
        for a in db_assignments:
            member_key = unicodedata.normalize('NFC', a.member_name.strip().lower())
            if member_key in member_rows:
                target_row = member_rows[member_key]
                ws.cell(row=target_row, column=a.col_index, value=a.value if a.value else None)
            
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        return output
