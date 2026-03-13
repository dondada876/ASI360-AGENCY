#!/usr/bin/env python3
"""
ASI 360 — Project Timeline PDF Generator
=========================================
Generates branded Gantt chart PDFs from JSON project data.
Data can come from: JSON file, VTiger, Supabase, or Airtable.

Usage:
  python3 generate_timeline.py                          # Goldman demo
  python3 generate_timeline.py project_data.json        # From JSON file
  python3 generate_timeline.py --source vtiger PROJ-XXX # From VTiger
"""

import json, sys, os
from datetime import datetime, timedelta
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

TEMPLATE_DIR = Path(__file__).parent / "templates" / "timeline"
OUTPUT_DIR = Path(__file__).parent

# ─── ASI 360 Brand Constants ───
ASI360 = {
    "name": "Allied Systems Integrations 360",
    "short": "ASI 360",
    "phone": "(510) 495-0905",
    "email": "info@asi360.co",
    "tagline": "One Company.. Unlimited Solutions..",
    "logo_url": "",  # Set to file:// path or https:// URL
}

# ─── Phase Color Palette ───
PHASE_COLORS = {
    1: "#0B5394",  # Dark blue
    2: "#45818E",  # Teal
    3: "#B85B22",  # Orange
    4: "#38761D",  # Green
    5: "#351C75",  # Purple
    0: "#434343",  # Buffer/milestone gray
}


def build_template_data(project: dict) -> dict:
    """Transform raw project JSON into template-ready data."""

    phases = project["phases"]
    day_labels = project.get("day_labels", [])
    periods = project.get("periods", [])
    total_days = len(day_labels)

    # Build task rows with phase rowspan calculations
    tasks = []
    for phase in phases:
        phase_num = phase["number"]
        phase_color = PHASE_COLORS.get(phase_num, "#666")
        phase_tasks = phase.get("tasks", [])
        rowspan = 1 + len(phase_tasks)  # Phase header row + sub-tasks

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
                "phase_rowspan": 0,  # 0 = skip (rowspan handled by parent)
                "phase_color": phase_color,
                "name": task["name"],
                "is_phase_row": False,
                "is_milestone": phase.get("is_milestone", False),
                "is_buffer": phase.get("is_buffer", False),
                "bar_start": task.get("bar_start", -1),
                "bar_end": task.get("bar_end", -1),
                "bar_color": task.get("bar_color", phase_color),
                "bar_label": task.get("bar_label", ""),
            })

    # Day column headers
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


def render_html(template_data: dict) -> str:
    """Render Jinja2 template to HTML string."""
    env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
    template = env.get_template("timeline.html")
    return template.render(**template_data)


def generate_pdf(html: str, output_path: str) -> str:
    """Convert HTML to PDF via Playwright (Chromium headless)."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content(html, wait_until="networkidle")
        page.pdf(
            path=output_path,
            landscape=True,
            format="Letter",
            margin={"top": "0.4in", "bottom": "0.5in", "left": "0.35in", "right": "0.35in"},
            print_background=True,
        )
        browser.close()
    return output_path


# ─── DATA FEED ADAPTERS ───

def from_json_file(path: str) -> dict:
    """Load project data from a JSON file."""
    with open(path) as f:
        return json.load(f)


def from_vtiger(project_no: str) -> dict:
    """
    Fetch project data from VTiger via ASI360 Gateway.
    Transforms VTiger project + tasks into timeline JSON.
    """
    import urllib.request
    gateway = "http://104.248.69.86:3004"
    url = f"{gateway}/api/projects/{project_no}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=15) as resp:
        vtiger_data = json.loads(resp.read())

    # Transform VTiger phases/tasks → timeline format
    return _transform_vtiger(vtiger_data)


def from_supabase(project_no: str) -> dict:
    """
    Fetch project data from Supabase asi360_projects table.
    """
    sb_url = os.environ.get("SUPABASE_URL", "https://gtfffxwfgcxiiauliynd.supabase.co")
    sb_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    import urllib.request
    url = f"{sb_url}/rest/v1/asi360_projects?project_no=eq.{project_no}&select=*"
    req = urllib.request.Request(url, headers={
        "apikey": sb_key,
        "Authorization": f"Bearer {sb_key}",
    })
    with urllib.request.urlopen(req, timeout=15) as resp:
        rows = json.loads(resp.read())

    if not rows:
        raise ValueError(f"Project {project_no} not found in Supabase")
    return _transform_supabase(rows[0])


def from_airtable(record_id: str, base_id: str = "appOkZt0CLLBLo2Fr") -> dict:
    """
    Fetch project data from Airtable CEO Dashboard.
    """
    api_key = os.environ.get("AIRTABLE_API_KEY", "")
    import urllib.request
    url = f"https://api.airtable.com/v0/{base_id}/Projects/{record_id}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {api_key}",
    })
    with urllib.request.urlopen(req, timeout=15) as resp:
        record = json.loads(resp.read())

    return _transform_airtable(record)


def _transform_vtiger(data: dict) -> dict:
    """Map VTiger project structure to timeline JSON schema."""
    # Stub — implement per VTiger project response shape
    return data


def _transform_supabase(row: dict) -> dict:
    """Map Supabase project row to timeline JSON schema."""
    # Stub — implement per Supabase schema
    return row


def _transform_airtable(record: dict) -> dict:
    """Map Airtable record to timeline JSON schema."""
    # Stub — implement per Airtable fields
    return record


# ─── GOLDMAN LAW FIRM DEMO DATA ───

def goldman_demo() -> dict:
    """Goldman Law Firm — Access Control Upgrade project data."""
    return {
        "title": "Goldman Law Firm — Access Control Upgrade",
        "client": "Goldman Law Firm",
        "manager": "Don Bucknor",
        "date": "03/09/2026",
        "quote_no": "QUO202366 / QUO202368",
        "contract_value": 7115.00,

        "periods": [
            {"label": "WEEK 1", "span": 5},
            {"label": "WEEK 2", "span": 5},
        ],

        "day_labels": [
            "MON", "TUE", "WED", "THU", "FRI",
            "MON", "TUE", "WED", "THU", "FRI",
        ],

        "phases": [
            {
                "number": 1,
                "name": "Site Survey & Data Harvest",
                "bar_start": -1, "bar_end": -1, "bar_label": "",
                "tasks": [
                    {"name": "Door hardware audit & photos", "bar_start": 0, "bar_end": 0,
                     "bar_label": "Door Audit"},
                    {"name": "Credential inventory (fobs/cards)", "bar_start": 0, "bar_end": 0,
                     "bar_label": "Credentials"},
                    {"name": "Network & cable verification", "bar_start": 1, "bar_end": 1,
                     "bar_label": "Cable Verify"},
                ],
            },
            {
                "number": 2,
                "name": "Equipment Staging",
                "is_buffer": True,
                "bar_start": -1, "bar_end": -1, "bar_label": "",
                "tasks": [
                    {"name": "Procurement & delivery", "bar_start": 2, "bar_end": 3,
                     "bar_label": "Procurement", "bar_color": "#78909C"},
                    {"name": "Shop pre-build & programming", "bar_start": 3, "bar_end": 4,
                     "bar_label": "Shop Build", "bar_color": "#78909C"},
                    {"name": "Pre-deployment QA testing", "bar_start": 4, "bar_end": 4,
                     "bar_label": "QA Test", "bar_color": "#78909C"},
                ],
            },
            {
                "number": 3,
                "name": "Installation & Cutover",
                "bar_start": -1, "bar_end": -1, "bar_label": "",
                "tasks": [
                    {"name": "Demo existing hardware", "bar_start": 5, "bar_end": 5,
                     "bar_label": "Demo"},
                    {"name": "Mount & wire new controller", "bar_start": 5, "bar_end": 6,
                     "bar_label": "Install Controller"},
                    {"name": "Reader swap & door hardware", "bar_start": 6, "bar_end": 7,
                     "bar_label": "Reader Swap"},
                ],
            },
            {
                "number": 4,
                "name": "Programming & Commissioning",
                "bar_start": -1, "bar_end": -1, "bar_label": "",
                "tasks": [
                    {"name": "Software configuration", "bar_start": 7, "bar_end": 8,
                     "bar_label": "SW Config"},
                    {"name": "Credential enrollment & testing", "bar_start": 8, "bar_end": 8,
                     "bar_label": "Enrollment"},
                    {"name": "Integration & system testing", "bar_start": 8, "bar_end": 9,
                     "bar_label": "Integration Test"},
                ],
            },
            {
                "number": 5,
                "name": "Training & Closeout",
                "bar_start": -1, "bar_end": -1, "bar_label": "",
                "tasks": [
                    {"name": "Staff training session", "bar_start": 9, "bar_end": 9,
                     "bar_label": "Training"},
                    {"name": "Documentation & as-builts", "bar_start": 9, "bar_end": 9,
                     "bar_label": "As-Builts"},
                    {"name": "Final walkthrough & signoff", "bar_start": 9, "bar_end": 9,
                     "bar_label": "Signoff"},
                ],
            },
            {
                "number": 0,
                "name": "PROJECT COMPLETE",
                "is_milestone": True,
                "bar_start": 9, "bar_end": 9, "bar_label": "✓ COMPLETE",
                "tasks": [],
            },
        ],

        "notes": [
            {
                "title": "Delivery Strategy",
                "color": "#0B5394",
                "bullet_items": [
                    "Pre-build all equipment at ASI 360 shop",
                    "On-site cutover window: <span class='highlight'>90 minutes</span>",
                    "Zero-lockout protocol — security escort during swap",
                    "Old hardware retained 48 hrs for rollback",
                ],
            },
            {
                "title": "Payment Milestones",
                "color": "#38761D",
                "bullet_items": [
                    "At contract: <span class='highlight'>$5,627.50</span> (100% equipment + 50% labor)",
                    "At completion: <span class='highlight'>$1,487.50</span> (50% labor balance)",
                    "Grand total: <span class='highlight'>$7,115.00</span>",
                    "Quote refs: QUO202366 (Equipment) + QUO202368 (Services)",
                ],
            },
            {
                "title": "Scope Summary",
                "color": "#B85B22",
                "bullet_items": [
                    "Keri Systems NXT controller (on-prem + keypad)",
                    "2-door access control: front entry + suite",
                    "LAN-520 readers with existing fob credentials",
                    "Dedicated workstation + Doors.NET software",
                    "Contact: Zachary Stewart, zstewart@goldmanlawfirm.net",
                ],
            },
        ],
    }


# ─── MAIN ───

if __name__ == "__main__":
    source = sys.argv[1] if len(sys.argv) > 1 else "demo"

    if source == "demo":
        project_data = goldman_demo()
    elif source.endswith(".json"):
        project_data = from_json_file(source)
    elif source == "--source":
        adapter = sys.argv[2] if len(sys.argv) > 2 else ""
        ref = sys.argv[3] if len(sys.argv) > 3 else ""
        if adapter == "vtiger":
            project_data = from_vtiger(ref)
        elif adapter == "supabase":
            project_data = from_supabase(ref)
        elif adapter == "airtable":
            project_data = from_airtable(ref)
        else:
            print(f"Unknown source adapter: {adapter}")
            sys.exit(1)
    else:
        project_data = from_json_file(source)

    # Build template context
    template_data = build_template_data(project_data)

    # Render HTML
    html = render_html(template_data)

    # Save HTML (for debugging)
    client_slug = project_data.get("client", "project").replace(" ", "_")
    html_path = OUTPUT_DIR / f"{client_slug}_Timeline.html"
    with open(html_path, "w") as f:
        f.write(html)
    print(f"HTML: {html_path}")

    # Generate PDF
    pdf_path = OUTPUT_DIR / f"{client_slug}_Timeline.pdf"
    generate_pdf(html, str(pdf_path))
    print(f"PDF:  {pdf_path}")
    print(f"Size: {os.path.getsize(pdf_path) / 1024:.1f} KB")
