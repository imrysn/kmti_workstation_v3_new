from fastapi import APIRouter, Depends, Request, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from db.database import get_db
from models.telemetry import WorkstationStatus
from datetime import datetime, timedelta, date as date_type

router = APIRouter()

# ── Queue: update nudges  key: comp_name / ip -> latest_version ──────────────
pending_nudges: dict = {}

# ── Queue: wave pings  key: target comp_name -> [sender, ...] ────────────────
pending_waves: dict = {}

# ── Wave timestamps  key: (sender, target) -> datetime ───────────────────────
wave_history: dict = {}

# ── Module heartbeat counts  key: comp_name -> {module: int} ─────────────────
# Special internal key "__minimized__" counts heartbeats sent while app is hidden
daily_module_durations: dict = {}

# ── Time-of-day records  key: comp_name -> set[int]  (0-23 hours) ────────────
daily_time_records: dict = {}

# ── Calendar days ever seen  key: comp_name -> list["YYYY-MM-DD"] ─────────────
workstation_days_seen: dict = {}

# ── Manual achievement unlocks  key: comp_name -> set[str] ───────────────────
unlocked_achievements: dict = {}

# ── Behavioral flags and counters ───────────────────────────────────────────
weekend_workers: dict = {}        # key: comp_name -> set[str] (dates)
broadcast_senders: dict = {}      # key: comp_name -> int (count)
ticket_submitters: dict = {}      # key: comp_name -> int (count)

# ── Continuous focus module streaks (consecutive runs in same module) ──────
# key: comp_name -> {module: int}
continuous_module_streaks: dict = {}

# ── Daily AI session counter  key: comp_name -> int ──────────────────────────
daily_ai_sessions: dict = {}

# ── Stopwatch record counts  key: comp_name -> int  (populated from stopwatch router) ──
stopwatch_counts: dict = {}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_active_streaks(comp_name: str, active_comps: list) -> list:
    """Return list of workstations that have a mutual wave streak with comp_name in last 12 h."""
    if not comp_name:
        return []
    streaks = []
    twelve_hours_ago = datetime.now() - timedelta(hours=12)
    for other in active_comps:
        if other == comp_name:
            continue
        t1 = wave_history.get((comp_name, other))
        t2 = wave_history.get((other, comp_name))
        if t1 and t2 and t1 >= twelve_hours_ago and t2 >= twelve_hours_ago:
            streaks.append(other)
    return streaks


def _check_consecutive_streak(comp: str, days: int = 7) -> bool:
    """Return True if workstation has >= `days` consecutive calendar days logged."""
    seen = sorted(set(workstation_days_seen.get(comp, [])))
    if len(seen) < days:
        return False
    streak = 1
    for i in range(1, len(seen)):
        d1 = date_type.fromisoformat(seen[i - 1])
        d2 = date_type.fromisoformat(seen[i])
        if (d2 - d1).days == 1:
            streak += 1
            if streak >= days:
                return True
        else:
            streak = 1
    return False


def _check_perfect_attendance(comp: str) -> bool:
    """Return True if workstation has logged a heartbeat on every weekday of any calendar month (min 15 weekdays logged)."""
    days = workstation_days_seen.get(comp, [])
    if not days:
        return False
    dates = []
    for d_str in days:
        try:
            dates.append(date_type.fromisoformat(d_str))
        except ValueError:
            continue
    if not dates:
        return False
    by_month = {}
    for d in dates:
        key = (d.year, d.month)
        if key not in by_month:
            by_month[key] = set()
        by_month[key].add(d.day)
    for (year, month), logged_days in by_month.items():
        today = date_type.today()
        import calendar
        num_days = calendar.monthrange(year, month)[1]
        limit = num_days if (year != today.year or month != today.month) else today.day
        weekdays = []
        for day in range(1, limit + 1):
            d = date_type(year, month, day)
            if d.weekday() < 5:
                weekdays.append(day)
        if len(weekdays) >= 15 and all(wd in logged_days for wd in weekdays):
            return True
    return False


def _check_tagapagma(comp: str) -> bool:
    """Return True if workstation has logged a heartbeat on every weekday of the entire calendar year (min 200 weekdays logged)."""
    days = workstation_days_seen.get(comp, [])
    if not days:
        return False
    dates = []
    for d_str in days:
        try:
            dates.append(date_type.fromisoformat(d_str))
        except ValueError:
            continue
    if not dates:
        return False
    by_year = {}
    for d in dates:
        if d.year not in by_year:
            by_year[d.year] = set()
        by_year[d.year].add(d)
    today = date_type.today()
    for year, logged_dates in by_year.items():
        limit_date = today if year == today.year else date_type(year, 12, 31)
        start_date = date_type(year, 1, 1)
        curr = start_date
        weekdays = []
        while curr <= limit_date:
            if curr.weekday() < 5:
                weekdays.append(curr)
            curr += timedelta(days=1)
        if len(weekdays) >= 200 and all(wd in logged_dates for wd in weekdays):
            return True
    return False


def _build_achievements(comp: str | None, active_names: list) -> dict:
    """Compute all 34 achievement flags for a workstation with extreme, expert difficulty thresholds."""
    if not comp:
        return {k: False for k in _ACHIEVEMENT_KEYS}

    c = comp.strip()
    mods = daily_module_durations.get(c, {})
    times = daily_time_records.get(c, set())
    days_seen = workstation_days_seen.get(c, [])
    streaks = get_active_streaks(c, active_names)
    unlocked = unlocked_achievements.get(c, set())
    streaks_dict = continuous_module_streaks.get(c, {})

    # Distinct modules where massive time was spent (at least 100 heartbeats)
    real_modules_heavy = [m for m, cnt in mods.items() if not m.startswith('__') and cnt >= 100]

    return {
        # ── Calculator ──
        "isCalculatorVeteran": mods.get("Calculator", 0) >= 60,
        "isCalculatorExpert":  mods.get("Calculator", 0) >= 240,
        "isCalculatorKing":    streaks_dict.get("Calculator", 0) >= 480,

        # ── Findr ──
        "isFindrRookie":       mods.get("Findr", 0) >= 60,
        "isFindrScout":        mods.get("Findr", 0) >= 240,
        "isFindrMaster":       streaks_dict.get("Findr", 0) >= 480,

        # ── Drafting Notes ──
        "isDraftingApprentice": mods.get("Drafting Notes", 0) >= 60,
        "isDraftingScholar":    mods.get("Drafting Notes", 0) >= 240,
        "isDraftingSage":       streaks_dict.get("Drafting Notes", 0) >= 480,

        # ── Quotation ──
        "isQuotationBeginner":     mods.get("Quotation", 0) >= 60,
        "isQuotationProfessional":  mods.get("Quotation", 0) >= 240,
        "isQuotationAce":           streaks_dict.get("Quotation", 0) >= 480,

        # ── Special Process (Heat) ──
        "isHeatHelper":     mods.get("Special Process", 0) >= 60,
        "isHeatTech":       mods.get("Special Process", 0) >= 240,
        "isHeatSpecialist":  streaks_dict.get("Special Process", 0) >= 480,

        # ── System Guardian ──
        "isSystemGuard":    (mods.get("Help Center", 0) + mods.get("Billing Monitoring", 0)) >= 60,
        "isSystemDefender": (mods.get("Help Center", 0) + mods.get("Billing Monitoring", 0)) >= 240,
        "isSystemGuardian":  streaks_dict.get("SystemGuardianGroup", 0) >= 480,

        # ── Other achievements ──
        "isEasterEggHunter":  "easter_egg_hunter" in unlocked,
        "isEarlyBird":        len([h for h in times if h < 8]) >= 10,
        "isNightOwl":         len([h for h in times if h >= 20]) >= 10,
        "isSocialButterfly":  len(streaks) >= 5,
        "isMultitasker":      len(real_modules_heavy) >= 8,
        "isModuleVeteran":    len(set(days_seen)) >= 30,
        "isGhostMode":        mods.get("__minimized__", 0) >= 100,
        "isPolyglot":         mods.get("Special Process", 0) >= 100 and mods.get("Drafting Notes", 0) >= 100,
        "isWeekendWarrior":   len(weekend_workers.get(c, set())) >= 10,
        "isLoyalOperator":    _check_consecutive_streak(c, days=30),
        "isBroadcaster":      broadcast_senders.get(c, 0) >= 20,
        "isHelpSeeker":       ticket_submitters.get(c, 0) >= 10,
        "isAIWhisperer":      daily_ai_sessions.get(c, 0) >= 50,
        "isStopwatchHero":    stopwatch_counts.get(c, 0) >= 50,
        "isPerfectAttendance": _check_perfect_attendance(c),
        "isTagapagma":         _check_tagapagma(c),
    }


_ACHIEVEMENT_KEYS = [
    "isCalculatorVeteran", "isCalculatorExpert", "isCalculatorKing",
    "isFindrRookie", "isFindrScout", "isFindrMaster",
    "isDraftingApprentice", "isDraftingScholar", "isDraftingSage",
    "isQuotationBeginner", "isQuotationProfessional", "isQuotationAce",
    "isHeatHelper", "isHeatTech", "isHeatSpecialist",
    "isSystemGuard", "isSystemDefender", "isSystemGuardian",
    "isEasterEggHunter", "isEarlyBird", "isNightOwl",
    "isSocialButterfly", "isMultitasker", "isModuleVeteran",
    "isGhostMode", "isPolyglot", "isWeekendWarrior", "isLoyalOperator",
    "isBroadcaster", "isHelpSeeker", "isAIWhisperer", "isStopwatchHero",
    "isPerfectAttendance", "isTagapagma"
]


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/heartbeat")
async def heartbeat(
    request: Request,
    module: str = Form("idle"),
    user_name: str = Form(None),
    version: str = Form(None),
    computer_name: str = Form(None),
    status_message: str = Form(None),
    display_name: str = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """Update current workstation status and retrieve queued nudges/waves."""
    ip = request.client.host

    result = await db.execute(select(WorkstationStatus).where(WorkstationStatus.ip_address == ip))
    status = result.scalar_one_or_none()

    if not status:
        status = WorkstationStatus(ip_address=ip)
        db.add(status)

    status.active_module = module
    status.current_user = user_name
    status.display_name = display_name
    status.version = version
    status.computer_name = computer_name
    status.status_message = status_message
    status.last_ping = datetime.now()

    await db.commit()

    if computer_name:
        c = computer_name.strip()
        now = datetime.now()

        # Module duration tracking (with minimized split)
        is_minimized = module.startswith('💤')
        clean_module = module.replace('💤', '').strip()
        if c not in daily_module_durations:
            daily_module_durations[c] = {}
        if clean_module:
            daily_module_durations[c][clean_module] = daily_module_durations[c].get(clean_module, 0) + 1
        if is_minimized:
            daily_module_durations[c]['__minimized__'] = daily_module_durations[c].get('__minimized__', 0) + 1

        # Time-of-day (Early Bird / Night Owl)
        if c not in daily_time_records:
            daily_time_records[c] = set()
        daily_time_records[c].add(now.hour)

        # Calendar days seen (Module Veteran / Loyal Operator)
        date_str = now.date().isoformat()
        if c not in workstation_days_seen:
            workstation_days_seen[c] = []
        if date_str not in workstation_days_seen[c]:
            workstation_days_seen[c].append(date_str)

        # Weekend Warrior
        if now.weekday() >= 5:
            if c not in weekend_workers:
                weekend_workers[c] = set()
            weekend_workers[c].add(date_str)

        # Continuous focus module streak tracking (2 hours straight without changing tabs/minimizing)
        if c not in continuous_module_streaks:
            continuous_module_streaks[c] = {}
        
        is_valid_focus = not is_minimized and clean_module and clean_module not in ("idle", "idle_overlay", "Overview")
        tracking_name = clean_module
        if clean_module in ("Help Center", "Billing Monitoring"):
            tracking_name = "SystemGuardianGroup"
            
        for mod_key in list(continuous_module_streaks[c].keys()):
            if not is_valid_focus or mod_key != tracking_name:
                continuous_module_streaks[c][mod_key] = 0
                
        if is_valid_focus:
            continuous_module_streaks[c][tracking_name] = continuous_module_streaks[c].get(tracking_name, 0) + 1

    # Nudge check
    nudge_version = None
    if computer_name and computer_name in pending_nudges:
        nudge_version = pending_nudges.pop(computer_name)
    elif ip in pending_nudges:
        nudge_version = pending_nudges.pop(ip)

    # Wave queue check
    waves = []
    if computer_name and computer_name in pending_waves:
        waves = pending_waves.pop(computer_name)
    elif ip in pending_waves:
        waves = pending_waves.pop(ip)

    response_data: dict = {"success": True}
    if nudge_version:
        response_data["nudge_version"] = nudge_version
    if waves:
        response_data["waves"] = waves

    return response_data


@router.get("/status")
async def get_all_status(db: AsyncSession = Depends(get_db)):
    """Retrieve list of all workstations seen in the last 5 minutes."""
    five_mins_ago = datetime.now() - timedelta(minutes=5)
    result = await db.execute(
        select(WorkstationStatus)
        .where(WorkstationStatus.last_ping >= five_mins_ago)
        .order_by(WorkstationStatus.last_ping.desc())
    )
    statuses = result.scalars().all()
    active_names = [s.computer_name for s in statuses if s.computer_name]

    return {
        "data": [
            {
                "ip_address": s.ip_address,
                "computer_name": s.computer_name or s.ip_address,
                "current_user": s.current_user,
                "display_name": s.display_name,
                "active_module": s.active_module,
                "version": s.version,
                "status_message": s.status_message,
                "equipped_skin": s.equipped_skin,
                "last_ping": s.last_ping.isoformat() if s.last_ping else None,
                "streaks": get_active_streaks(s.computer_name, active_names),
                "achievements": _build_achievements(s.computer_name, active_names),
            }
            for s in statuses
        ]
    }


@router.get("/stats")
async def get_telemetry_stats(db: AsyncSession = Depends(get_db)):
    """Retrieve daily shift operational aggregates for Admin / IT monitoring."""
    now = datetime.now()
    twenty_four_hours_ago = now - timedelta(hours=24)

    result_total = await db.execute(
        select(WorkstationStatus).where(WorkstationStatus.last_ping >= twenty_four_hours_ago)
    )
    all_seen = result_total.scalars().all()
    peak_users = len(set(s.computer_name for s in all_seen if s.computer_name))

    waves_exchanged = sum(1 for ts in wave_history.values() if ts >= twenty_four_hours_ago)

    sender_counts: dict = {}
    for (sender, target), ts in wave_history.items():
        if ts >= twenty_four_hours_ago:
            sender_counts[sender] = sender_counts.get(sender, 0) + 1
    wave_leader = max(sender_counts, key=sender_counts.get) if sender_counts else "None"

    module_counts: dict = {}
    for s in all_seen:
        mod = s.active_module or "Idle"
        clean_mod = mod.replace('💤', '').strip()
        if clean_mod and clean_mod not in ("Idle", "Overview"):
            module_counts[clean_mod] = module_counts.get(clean_mod, 0) + 1
    most_active_module = max(module_counts, key=module_counts.get) if module_counts else "Overview"

    return {
        "success": True,
        "peak_users": max(peak_users, 1),
        "waves_exchanged": waves_exchanged,
        "wave_leader": wave_leader,
        "most_active_module": most_active_module,
    }


@router.post("/nudge")
async def nudge_workstation(computer_name: str = Form(...), latest_version: str = Form(...)):
    """Queue a silent update nudge for a workstation."""
    pending_nudges[computer_name] = latest_version
    return {"success": True, "message": f"Nudge queued for {computer_name}"}


@router.post("/wave")
async def wave_workstation(from_computer: str = Form(...), to_computer: str = Form(...)):
    """Queue a real-time wave/ping from one workstation to another."""
    target = to_computer.strip()
    sender = from_computer.strip()
    if target not in pending_waves:
        pending_waves[target] = []
    if sender not in pending_waves[target]:
        pending_waves[target].append(sender)
    wave_history[(sender, target)] = datetime.now()
    return {"success": True, "message": f"Wave queued for {target} from {sender}"}


@router.post("/achievement")
async def unlock_achievement(computer_name: str = Form(...), achievement: str = Form(...)):
    """Register a manual achievement unlock (e.g. easter_egg_hunter via secret click)."""
    c = computer_name.strip()
    if c not in unlocked_achievements:
        unlocked_achievements[c] = set()
    unlocked_achievements[c].add(achievement)
    return {"success": True, "message": f"Achievement '{achievement}' unlocked for {c}"}


@router.post("/event")
async def record_event(computer_name: str = Form(...), event_type: str = Form(...)):
    """Record a behavioral event for achievement tracking.

    event_type values:
    - "ai_session"   → increments AI Whisperer counter
    - "broadcast"    → marks Broadcaster
    - "help_ticket"  → marks Help Seeker
    - "stopwatch"    → increments Stopwatch Hero counter
    """
    c = computer_name.strip()
    if event_type == "ai_session":
        daily_ai_sessions[c] = daily_ai_sessions.get(c, 0) + 1
    elif event_type == "broadcast":
        broadcast_senders[c] = broadcast_senders.get(c, 0) + 1
    elif event_type == "help_ticket":
        ticket_submitters[c] = ticket_submitters.get(c, 0) + 1
    elif event_type == "stopwatch":
        stopwatch_counts[c] = stopwatch_counts.get(c, 0) + 1
    return {"success": True}


@router.post("/skin")
async def save_equipped_skin(
    computer_name: str = Form(...),
    skin_key: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """Save the selected avatar skin key for the workstation."""
    c = computer_name.strip()
    result = await db.execute(
        select(WorkstationStatus).where(WorkstationStatus.computer_name == c)
    )
    statuses = result.scalars().all()
    if not statuses:
        return {"success": False, "message": f"No active workstation status row found for {c}."}
    
    for s in statuses:
        s.equipped_skin = skin_key
    await db.commit()
    return {"success": True, "message": f"Equipped skin '{skin_key}' saved for {c}."}

