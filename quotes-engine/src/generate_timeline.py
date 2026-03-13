#!/usr/bin/env python3
"""
ASI 360 — Project Timeline HTML/PDF Generator (Engine 3.0)
==========================================================
Generates branded Gantt chart HTML from Supabase project data.
Pulls project + tasks from asi360_projects / asi360_project_tasks,
auto-schedules Gantt bars from default_duration_days.

Usage:
  python3 generate_timeline.py PROJ364                     # From Supabase
  python3 generate_timeline.py PROJ364 PROJ365             # Multiple projects
  python3 generate_timeline.py project_data.json           # From JSON file
  python3 generate_timeline.py                             # Goldman demo
"""

import json, sys, os, subprocess, math
from datetime import datetime, timedelta, date
from pathlib import Path

TEMPLATE_DIR = Path(__file__).parent / "templates" / "timeline"
OUTPUT_DIR = Path(__file__).parent.parent  # quotes-engine/

# Load .env from quotes-engine root (not repo root — that points to ASEAGI)
_env_path = Path(__file__).parent.parent / ".env"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://gtfffxwfgcxiiauliynd.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY", "")

# ─── ASI 360 Brand Constants ───
ASI360 = {
    "name": "Allied Systems Integrations 360",
    "short": "ASI 360",
    "phone": "(510) 288-0994",
    "email": "ops@asi360.co",
    "tagline": "One Company.. Unlimited Solutions..",
}

# ─── Phase Color Palette ───
PHASE_COLORS = {
    1: "#0B5394",  # Dark blue  — Site Survey
    2: "#45818E",  # Teal       — Equipment & Procurement
    3: "#B85B22",  # Orange     — Installation & Cutover
    4: "#38761D",  # Green      — Programming & Commissioning
    5: "#351C75",  # Purple     — Training & Closeout
    0: "#434343",  # Milestone gray
}


# ─── JINJA RENDERER ───

def render_html(template_data: dict) -> str:
    """Render Jinja2 template to HTML string."""
    try:
        from jinja2 import Environment, FileSystemLoader
        env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
        template = env.get_template("timeline.html")
        return template.render(**template_data)
    except ImportError:
        print("jinja2 not installed. Run: pip install jinja2")
        sys.exit(1)


# ─── SUPABASE FETCH (curl-based for macOS SSL compat) ───

def _supa_get(path: str) -> list:
    """Fetch from Supabase REST API using curl (avoids Python 3.13 SSL issues)."""
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    result = subprocess.run(
        ["curl", "-s", "-H", f"apikey: {SUPABASE_KEY}",
         "-H", f"Authorization: Bearer {SUPABASE_KEY}",
         "-H", "Content-Type: application/json", url],
        capture_output=True, text=True, timeout=15
    )
    if result.returncode != 0:
        raise RuntimeError(f"curl failed: {result.stderr}")
    data = json.loads(result.stdout)
    if isinstance(data, dict) and "message" in data:
        raise RuntimeError(f"Supabase error: {data['message']}")
    return data


def from_supabase(project_no: str) -> dict:
    """
    Fetch project + tasks from Supabase and transform into timeline JSON.
    Uses critical path scheduling: reads depends_on constraints from template
    and schedules parallel tasks where dependencies allow.
    """
    # Fetch project metadata
    projects = _supa_get(f"asi360_projects?project_no=eq.{project_no}&select=*")
    if not projects:
        raise ValueError(f"Project {project_no} not found in Supabase")
    proj = projects[0]

    # Fetch project tasks (ordered by phase then task_no)
    tasks = _supa_get(
        f"asi360_project_tasks?project_id=eq.{proj['id']}"
        f"&select=task_no,task_name,phase_no,phase_name,status,is_milestone"
        f"&order=phase_no.asc,task_no.asc"
    )

    # Fetch template tasks for duration AND dependency info
    template_id = proj.get("template_id")
    durations = {}
    dependencies = {}
    if template_id:
        tmpl_tasks = _supa_get(
            f"asi360_template_tasks?template_id=eq.{template_id}"
            f"&select=task_no,default_duration_days,depends_on"
        )
        durations = {t["task_no"]: t["default_duration_days"] for t in tmpl_tasks}
        dependencies = {t["task_no"]: t.get("depends_on") for t in tmpl_tasks}

    return _transform_supabase(proj, tasks, durations, dependencies)


def _critical_path_schedule(tasks: list, durations: dict, dependencies: dict) -> dict:
    """
    Critical path scheduler — topological sort with parallel task support.

    Returns dict mapping task_no → (bar_start, bar_end) in working-day offsets.
    Tasks with no dependencies start at day 0.
    Tasks with dependencies start the day after ALL predecessors finish.
    Tasks that share the same predecessor run in PARALLEL.
    """
    scheduled = {}  # task_no → (start_day, end_day)

    # Build lookup: which task_nos exist in this project
    task_nos = {t["task_no"] for t in tasks}

    def schedule_task(task_no: str) -> tuple:
        """Recursively schedule a task, resolving dependencies first."""
        if task_no in scheduled:
            return scheduled[task_no]

        duration = durations.get(task_no, 2)
        dep_str = dependencies.get(task_no)

        if not dep_str:
            # No dependency — starts at day 0
            start = 0
        else:
            # Parse comma-separated dependencies (e.g., "4.2,4.3")
            dep_list = [d.strip() for d in dep_str.split(",") if d.strip() in task_nos]
            if not dep_list:
                start = 0
            else:
                # Schedule all predecessors first, then start after the latest one finishes
                latest_end = -1
                for dep in dep_list:
                    _, dep_end = schedule_task(dep)
                    latest_end = max(latest_end, dep_end)
                start = latest_end + 1

        end = start + duration - 1
        scheduled[task_no] = (start, end)
        return (start, end)

    # Schedule every task (topological order handled by recursion)
    for t in tasks:
        schedule_task(t["task_no"])

    return scheduled


def _transform_supabase(proj: dict, tasks: list, durations: dict, dependencies: dict = None) -> dict:
    """
    Transform Supabase project data into timeline-ready structure.
    Uses critical path scheduling when dependencies are available,
    falls back to sequential scheduling otherwise.
    """
    if dependencies is None:
        dependencies = {}

    # Parse start date
    start_str = proj.get("start_date")
    if start_str:
        start_date = date.fromisoformat(start_str[:10])
    else:
        start_date = date.today()

    # Skip weekends — find next Monday if start is weekend
    while start_date.weekday() >= 5:
        start_date += timedelta(days=1)

    # Run critical path scheduler
    has_deps = any(v for v in dependencies.values() if v)
    if has_deps:
        schedule = _critical_path_schedule(tasks, durations, dependencies)
    else:
        # Fallback: sequential scheduling
        schedule = {}
        current_day = 0
        for t in tasks:
            duration = durations.get(t["task_no"], 2)
            schedule[t["task_no"]] = (current_day, current_day + duration - 1)
            current_day += duration

    # Group tasks by phase
    phase_groups = {}
    phase_names = {}
    for t in tasks:
        pno = t["phase_no"]
        if pno not in phase_groups:
            phase_groups[pno] = []
            phase_names[pno] = t["phase_name"]
        phase_groups[pno].append(t)

    # Find total working days from schedule
    max_end_day = max(end for _, end in schedule.values()) if schedule else 0
    total_days = max_end_day + 1

    phase_data = []
    for pno in sorted(phase_groups.keys()):
        phase_tasks = phase_groups[pno]
        task_bars = []

        for t in phase_tasks:
            # Strip project prefix from task name for display
            display_name = t["task_name"]
            if "-" in display_name and " " in display_name:
                parts = display_name.split(" ", 1)
                if parts[0].count("-") >= 1 and parts[0].count(".") >= 1:
                    display_name = parts[1] if len(parts) > 1 else display_name

            bar_start, bar_end = schedule.get(t["task_no"], (0, 1))

            # Short label for the bar
            words = display_name.split()
            bar_label = " ".join(words[:3]) if len(words) > 3 else display_name
            if len(bar_label) > 20:
                bar_label = bar_label[:18] + ".."

            task_bars.append({
                "name": display_name,
                "bar_start": bar_start,
                "bar_end": bar_end,
                "bar_color": PHASE_COLORS.get(pno, "#666"),
                "bar_label": bar_label,
                "is_milestone": t.get("is_milestone", False),
                "status": t.get("status", "open"),
            })

        phase_data.append({
            "number": pno,
            "name": phase_names[pno],
            "bar_start": -1,
            "bar_end": -1,
            "bar_label": "",
            "is_milestone": False,
            "is_buffer": False,
            "tasks": task_bars,
        })

    # Add milestone row
    phase_data.append({
        "number": 0,
        "name": "PROJECT COMPLETE",
        "is_milestone": True,
        "bar_start": max_end_day,
        "bar_end": max_end_day,
        "bar_label": "✓ COMPLETE",
        "tasks": [],
    })

    total_weeks = math.ceil(total_days / 5)

    # Build day labels (working days: Mon-Fri)
    day_labels = []
    day_names = ["MON", "TUE", "WED", "THU", "FRI"]
    cal_date = start_date
    for i in range(total_days):
        while cal_date.weekday() >= 5:  # Skip weekends
            cal_date += timedelta(days=1)
        day_labels.append(f"{day_names[cal_date.weekday()]}\n{cal_date.strftime('%m/%d')}")
        cal_date += timedelta(days=1)

    # Build period headers (weeks)
    periods = []
    for w in range(total_weeks):
        days_in_week = min(5, total_days - w * 5)
        periods.append({"label": f"WEEK {w + 1}", "span": days_in_week})

    # Auto-generate notes from project metadata
    notes = _build_notes(proj, total_days, has_deps)

    return {
        "title": proj.get("project_name", proj.get("project_no", "Project")),
        "client": proj.get("client_name", ""),
        "manager": "Don Bucknor",
        "date": start_str[:10] if start_str else date.today().isoformat(),
        "project_no": proj.get("project_no", ""),
        "contract_value": proj.get("contract_value"),
        "quote_no": proj.get("quote_no", ""),
        "periods": periods,
        "day_labels": day_labels,
        "phases": phase_data,
        "notes": notes,
    }


def _build_notes(proj: dict, total_days: int = 0, has_deps: bool = False) -> list:
    """Auto-generate note cards from project metadata."""
    notes = []

    # Project info card
    info_items = [f"Project: <span class='highlight'>{proj.get('project_no', '')}</span>"]
    if proj.get("client_name"):
        info_items.append(f"Client: {proj['client_name']}")
    if proj.get("description"):
        info_items.append(proj["description"])
    if proj.get("site_address"):
        info_items.append(f"Site: {proj['site_address']}")
    if total_days:
        weeks = math.ceil(total_days / 5)
        sched_type = "Critical path" if has_deps else "Sequential"
        info_items.append(f"Duration: <span class='highlight'>{total_days} working days ({weeks} weeks)</span>")
        info_items.append(f"Schedule: {sched_type}")
    notes.append({"title": "Project Details", "color": "#0B5394", "bullet_items": info_items})

    # Financial card (if data exists)
    fin_items = []
    if proj.get("contract_value"):
        val = proj["contract_value"]
        fin_items.append(f"Contract value: <span class='highlight'>${val:,.2f}</span>")
        deposit = val * 0.5
        fin_items.append(f"At contract (50%): <span class='highlight'>${deposit:,.2f}</span>")
        fin_items.append(f"At completion (50%): <span class='highlight'>${val - deposit:,.2f}</span>")
    if proj.get("quote_no"):
        fin_items.append(f"Quote ref: {proj['quote_no']}")
    if fin_items:
        notes.append({"title": "Payment Milestones", "color": "#38761D", "bullet_items": fin_items})

    # Delivery strategy card
    notes.append({
        "title": "Delivery Strategy",
        "color": "#B85B22",
        "bullet_items": [
            "Pre-build all equipment at ASI 360 shop",
            "Minimize on-site disruption window",
            "Zero-lockout protocol during cutover",
            "Old hardware retained 48hrs for rollback",
        ],
    })

    return notes


# ─── TEMPLATE DATA BUILDER ───

def build_template_data(project: dict) -> dict:
    """Transform project JSON into Jinja2 template context."""
    phases = project["phases"]
    day_labels = project.get("day_labels", [])
    periods = project.get("periods", [])
    total_days = len(day_labels)

    tasks = []
    for phase in phases:
        phase_num = phase["number"]
        phase_color = PHASE_COLORS.get(phase_num, "#666")
        phase_tasks = phase.get("tasks", [])
        rowspan = 1 + len(phase_tasks)

        # Phase header row
        tasks.append({
            "phase_num": phase_num if phase_num > 0 else "",
            "phase_rowspan": rowspan,
            "phase_color": phase_color,
            "name": phase["name"],
            "is_phase_row": True,
            "is_milestone": phase.get("is_milestone", False),
            "is_buffer": phase.get("is_buffer", False),
            "bar_start": phase.get("bar_start", -1),
            "bar_end": phase.get("bar_end", -1),
            "bar_color": phase_color,
            "bar_label": phase.get("bar_label", ""),
        })

        # Sub-task rows
        for task in phase_tasks:
            tasks.append({
                "phase_num": "",
                "phase_rowspan": 0,
                "phase_color": phase_color,
                "name": task["name"],
                "is_phase_row": False,
                "is_milestone": task.get("is_milestone", False),
                "is_buffer": phase.get("is_buffer", False),
                "bar_start": task.get("bar_start", -1),
                "bar_end": task.get("bar_end", -1),
                "bar_color": task.get("bar_color", phase_color),
                "bar_label": task.get("bar_label", ""),
            })

    days = [{"label": lbl} for lbl in day_labels]

    return {
        "project": {
            "title": project["title"],
            "client": project["client"],
            "manager": project["manager"],
            "date": project.get("date", datetime.now().strftime("%m/%d/%Y")),
        },
        "company": ASI360,
        "days": days,
        "periods": periods,
        "tasks": tasks,
        "total_days": total_days,
        "notes": project.get("notes", []),
        "generated_date": datetime.now().strftime("%B %d, %Y"),
    }


# ─── JSON FILE ADAPTER ───

def from_json_file(path: str) -> dict:
    """Load project data from a JSON file."""
    with open(path) as f:
        return json.load(f)


# ─── GOLDMAN DEMO (fallback if no Supabase key) ───

def goldman_demo() -> dict:
    """Goldman Law Firm — hardcoded demo data."""
    return {
        "title": "Goldman Law Firm — Access Control Upgrade",
        "client": "Goldman Law Firm",
        "manager": "Don Bucknor",
        "date": "03/17/2026",
        "project_no": "PROJ364",
        "contract_value": 7115.00,
        "quote_no": "QUO202366 / QUO202368",
        "periods": [
            {"label": "WEEK 1", "span": 5},
            {"label": "WEEK 2", "span": 5},
            {"label": "WEEK 3", "span": 5},
            {"label": "WEEK 4", "span": 5},
            {"label": "WEEK 5", "span": 5},
            {"label": "WEEK 6", "span": 5},
            {"label": "WEEK 7", "span": 5},
            {"label": "WEEK 8", "span": 3},
        ],
        "day_labels": [f"D{i+1}" for i in range(38)],
        "phases": [
            {"number": 1, "name": "Site Survey & Data Harvest", "bar_start": -1, "bar_end": -1, "bar_label": "",
             "tasks": [
                 {"name": "Site Assessment & Photos", "bar_start": 0, "bar_end": 1, "bar_label": "Site Assessment"},
                 {"name": "Existing System Audit", "bar_start": 2, "bar_end": 2, "bar_label": "System Audit"},
                 {"name": "Network & Power Verification", "bar_start": 3, "bar_end": 3, "bar_label": "Network Verify"},
                 {"name": "Survey Report & Sign-off", "bar_start": 4, "bar_end": 4, "bar_label": "Sign-off"},
             ]},
            {"number": 2, "name": "Equipment & Procurement", "bar_start": -1, "bar_end": -1, "bar_label": "",
             "tasks": [
                 {"name": "Bill of Materials & Vendor Quotes", "bar_start": 5, "bar_end": 6, "bar_label": "BOM & Quotes"},
                 {"name": "Vendor Availability & Lead Times", "bar_start": 7, "bar_end": 7, "bar_label": "Lead Times"},
                 {"name": "Purchase Order & Procurement", "bar_start": 8, "bar_end": 9, "bar_label": "PO & Procurement"},
                 {"name": "Shipping & Receiving", "bar_start": 10, "bar_end": 12, "bar_label": "Shipping"},
                 {"name": "Shop Pre-Build & Programming", "bar_start": 13, "bar_end": 15, "bar_label": "Shop Build"},
                 {"name": "Pre-Deployment QA", "bar_start": 16, "bar_end": 16, "bar_label": "QA"},
             ]},
            {"number": 3, "name": "Installation & Cutover", "bar_start": -1, "bar_end": -1, "bar_label": "",
             "tasks": [
                 {"name": "Demo Existing Hardware", "bar_start": 17, "bar_end": 17, "bar_label": "Demo"},
                 {"name": "Cable & Conduit Runs", "bar_start": 18, "bar_end": 19, "bar_label": "Cable Runs"},
                 {"name": "Mount & Wire New Equipment", "bar_start": 20, "bar_end": 22, "bar_label": "Install"},
                 {"name": "Cutover & System Switch", "bar_start": 23, "bar_end": 23, "bar_label": "Cutover"},
             ]},
            {"number": 4, "name": "Programming & Commissioning", "bar_start": -1, "bar_end": -1, "bar_label": "",
             "tasks": [
                 {"name": "Software Configuration", "bar_start": 24, "bar_end": 25, "bar_label": "SW Config"},
                 {"name": "Credential Enrollment & Testing", "bar_start": 26, "bar_end": 27, "bar_label": "Enrollment"},
                 {"name": "Integration & System Testing", "bar_start": 28, "bar_end": 29, "bar_label": "Integration"},
                 {"name": "Commissioning Sign-off", "bar_start": 30, "bar_end": 30, "bar_label": "Commission"},
             ]},
            {"number": 5, "name": "Training & Closeout", "bar_start": -1, "bar_end": -1, "bar_label": "",
             "tasks": [
                 {"name": "Staff Training Session", "bar_start": 31, "bar_end": 31, "bar_label": "Training"},
                 {"name": "Documentation & As-Builts", "bar_start": 32, "bar_end": 33, "bar_label": "As-Builts"},
                 {"name": "Final Walkthrough & Sign-off", "bar_start": 34, "bar_end": 34, "bar_label": "Walkthrough"},
                 {"name": "Warranty & Support Handoff", "bar_start": 35, "bar_end": 35, "bar_label": "Handoff"},
             ]},
            {"number": 0, "name": "PROJECT COMPLETE", "is_milestone": True,
             "bar_start": 35, "bar_end": 35, "bar_label": "✓ COMPLETE", "tasks": []},
        ],
        "notes": [
            {"title": "Delivery Strategy", "color": "#0B5394", "bullet_items": [
                "Pre-build all equipment at ASI 360 shop",
                "On-site cutover window: <span class='highlight'>90 minutes</span>",
                "Zero-lockout protocol — security escort during swap",
                "Old hardware retained 48 hrs for rollback",
            ]},
            {"title": "Payment Milestones", "color": "#38761D", "bullet_items": [
                "At contract: <span class='highlight'>$5,627.50</span> (100% equip + 50% labor)",
                "At completion: <span class='highlight'>$1,487.50</span> (50% labor balance)",
                "Grand total: <span class='highlight'>$7,115.00</span>",
                "Quote refs: QUO202366 + QUO202368",
            ]},
            {"title": "Scope Summary", "color": "#B85B22", "bullet_items": [
                "Keri Systems NXT controller (on-prem + keypad)",
                "2-door access control: front entry + suite",
                "LAN-520 readers with existing fob credentials",
                "Dedicated workstation + Doors.NET software",
                "Contact: Zachary Stewart",
            ]},
        ],
    }


# ─── MAIN ───

def generate_for_project(project_no: str) -> str:
    """Generate timeline HTML for a single project. Returns output path."""
    if SUPABASE_KEY:
        project_data = from_supabase(project_no)
    else:
        print(f"Warning: No SUPABASE_SERVICE_KEY — using demo data")
        project_data = goldman_demo()

    template_data = build_template_data(project_data)
    html = render_html(template_data)

    client_slug = project_data.get("client", "project").replace(" ", "_").replace("&", "and")
    filename = f"{project_no}_{client_slug}_Timeline.html"
    out_path = OUTPUT_DIR / filename
    with open(out_path, "w") as f:
        f.write(html)
    return str(out_path)


if __name__ == "__main__":
    args = sys.argv[1:]

    if not args:
        # Demo mode
        project_data = goldman_demo()
        template_data = build_template_data(project_data)
        html = render_html(template_data)
        out = OUTPUT_DIR / "Goldman_Law_Firm_Timeline_v2.html"
        with open(out, "w") as f:
            f.write(html)
        print(f"HTML: {out}")
        print(f"Size: {os.path.getsize(out) / 1024:.1f} KB")
    else:
        for arg in args:
            if arg.endswith(".json"):
                project_data = from_json_file(arg)
                template_data = build_template_data(project_data)
                html = render_html(template_data)
                slug = Path(arg).stem
                out = OUTPUT_DIR / f"{slug}_Timeline.html"
                with open(out, "w") as f:
                    f.write(html)
                print(f"HTML: {out}")
            elif arg.startswith("PROJ"):
                out = generate_for_project(arg)
                print(f"HTML: {out}")
                print(f"Size: {os.path.getsize(out) / 1024:.1f} KB")
            else:
                print(f"Unknown arg: {arg} (use PROJ### or file.json)")
