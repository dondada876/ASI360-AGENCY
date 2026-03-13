#!/usr/bin/env python3
"""
ASI 360 — Proposal-to-Timeline Pipeline
=========================================
Converts signed proposal scope items into project-specific tasks
that replace or supplement generic template tasks in Supabase.

Flow:
  1. Load proposal scope (from JSON brief or inline dict)
  2. Map scope items → 5-phase project structure using template as skeleton
  3. Upsert project-specific tasks into asi360_project_tasks
  4. Generate Gantt timeline via generate_timeline.py

Usage:
  python3 proposal_pipeline.py briefs/mad_oak.json
  python3 proposal_pipeline.py --project PROJ356 --brief briefs/mad_oak.json
"""

import json, sys, os, subprocess
from datetime import date
from pathlib import Path

# Load .env from quotes-engine root
_env_path = Path(__file__).parent.parent / ".env"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://gtfffxwfgcxiiauliynd.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY", "")
BRIEFS_DIR = Path(__file__).parent.parent / "briefs"


# ─── SUPABASE HELPERS ───

def _supa_get(path: str) -> list:
    """GET from Supabase REST API (curl-based for macOS SSL compat)."""
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    result = subprocess.run(
        ["curl", "-s", "-H", f"apikey: {SUPABASE_KEY}",
         "-H", f"Authorization: Bearer {SUPABASE_KEY}",
         "-H", "Content-Type: application/json", url],
        capture_output=True, text=True, timeout=15
    )
    data = json.loads(result.stdout)
    if isinstance(data, dict) and "message" in data:
        raise RuntimeError(f"Supabase error: {data['message']}")
    return data


def _supa_delete(path: str) -> dict:
    """DELETE from Supabase REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    result = subprocess.run(
        ["curl", "-s", "-X", "DELETE",
         "-H", f"apikey: {SUPABASE_KEY}",
         "-H", f"Authorization: Bearer {SUPABASE_KEY}",
         "-H", "Content-Type: application/json",
         "-H", "Prefer: return=representation", url],
        capture_output=True, text=True, timeout=15
    )
    return json.loads(result.stdout) if result.stdout.strip() else {}


def _supa_post(path: str, payload: list) -> list:
    """POST (insert) to Supabase REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    body = json.dumps(payload)
    result = subprocess.run(
        ["curl", "-s", "-X", "POST",
         "-H", f"apikey: {SUPABASE_KEY}",
         "-H", f"Authorization: Bearer {SUPABASE_KEY}",
         "-H", "Content-Type: application/json",
         "-H", "Prefer: return=representation",
         "-d", body, url],
        capture_output=True, text=True, timeout=15
    )
    data = json.loads(result.stdout)
    if isinstance(data, dict) and "message" in data:
        raise RuntimeError(f"Supabase insert error: {data['message']}")
    return data


# ─── PROPOSAL BRIEF SCHEMA ───
#
# A proposal brief is a JSON file that maps signed proposal scope items
# into the 5-phase project structure. Each task has:
#   - task_no: e.g. "3.1" (phase.sequence)
#   - task_name: descriptive name from the proposal scope
#   - phase_no: 1-5
#   - phase_name: phase label
#   - duration_days: estimated working days
#   - depends_on: comma-separated task_no references (optional)
#   - is_milestone: boolean (optional, default false)
#   - notes: additional context from proposal (optional)
#
# Example brief: see briefs/mad_oak.json

def load_brief(path: str) -> dict:
    """Load a proposal brief JSON file."""
    with open(path) as f:
        return json.load(f)


def apply_brief_to_project(project_no: str, brief: dict, dry_run: bool = False) -> dict:
    """
    Apply a proposal brief to a Supabase project.

    Steps:
      1. Fetch the project record
      2. Delete existing generic project tasks
      3. Insert proposal-specific tasks from the brief
      4. Update template_tasks with custom durations/dependencies (if needed)

    Returns summary dict with counts.
    """
    # 1. Fetch project
    projects = _supa_get(f"asi360_projects?project_no=eq.{project_no}&select=*")
    if not projects:
        raise ValueError(f"Project {project_no} not found")
    proj = projects[0]
    project_id = proj["id"]

    # 2. Get existing tasks for count
    existing = _supa_get(f"asi360_project_tasks?project_id=eq.{project_id}&select=id")
    existing_count = len(existing)

    # 3. Build new task rows from brief
    scope_tasks = brief.get("tasks", [])
    new_rows = []
    for t in scope_tasks:
        new_rows.append({
            "project_id": project_id,
            "task_no": t["task_no"],
            "task_name": t["task_name"],
            "vtiger_task_name": f"Task {t['task_no']} {t['task_name'][:40]}",
            "phase_no": t["phase_no"],
            "phase_name": t["phase_name"],
            "status": t.get("status", "open"),
            "is_milestone": t.get("is_milestone", False),
            "notes": t.get("notes"),
        })

    if dry_run:
        print(f"\n{'='*60}")
        print(f"DRY RUN — {project_no} ({proj['client_name']})")
        print(f"{'='*60}")
        print(f"Existing tasks to delete: {existing_count}")
        print(f"New tasks to insert:      {len(new_rows)}")
        print(f"\nNew tasks:")
        for r in new_rows:
            ms = " [MILESTONE]" if r["is_milestone"] else ""
            print(f"  {r['task_no']:6s} | P{r['phase_no']} | {r['task_name']}{ms}")
        return {"deleted": existing_count, "inserted": len(new_rows), "dry_run": True}

    # 4. Delete existing generic tasks
    if existing:
        _supa_delete(f"asi360_project_tasks?project_id=eq.{project_id}")
        print(f"Deleted {existing_count} generic tasks for {project_no}")

    # 5. Insert new proposal-specific tasks
    inserted = _supa_post("asi360_project_tasks", new_rows)
    print(f"Inserted {len(inserted)} proposal-specific tasks for {project_no}")

    # 6. Upsert custom template tasks (durations & dependencies for Gantt scheduling)
    template_id = proj.get("template_id")
    if template_id and brief.get("template_overrides"):
        _apply_template_overrides(template_id, brief["template_overrides"])

    return {"deleted": existing_count, "inserted": len(inserted), "dry_run": False}


def _apply_template_overrides(template_id: int, overrides: list):
    """
    Update or insert template task records with custom durations/dependencies.
    This allows the critical path scheduler to use proposal-specific timings.
    """
    for o in overrides:
        task_no = o["task_no"]
        # Check if template task exists
        existing = _supa_get(
            f"asi360_template_tasks?template_id=eq.{template_id}&task_no=eq.{task_no}&select=id"
        )
        task_name = o.get("task_name", "")
        payload = {
            "template_id": template_id,
            "task_no": task_no,
            "task_name": task_name,
            "vtiger_task_name": f"Task {task_no} {task_name[:40]}",
            "phase_no": o.get("phase_no", 1),
            "phase_name": o.get("phase_name", ""),
            "default_duration_days": o.get("duration_days", 2),
            "depends_on": o.get("depends_on"),
        }
        if existing:
            # PATCH existing
            url = f"{SUPABASE_URL}/rest/v1/asi360_template_tasks?id=eq.{existing[0]['id']}"
            body = json.dumps(payload)
            subprocess.run(
                ["curl", "-s", "-X", "PATCH",
                 "-H", f"apikey: {SUPABASE_KEY}",
                 "-H", f"Authorization: Bearer {SUPABASE_KEY}",
                 "-H", "Content-Type: application/json",
                 "-d", body, url],
                capture_output=True, text=True, timeout=15
            )
        else:
            # POST new
            _supa_post("asi360_template_tasks", [payload])
    print(f"Applied {len(overrides)} template overrides for template {template_id}")


# ─── GENERATE TIMELINE FROM BRIEF ───

def generate_from_brief(project_no: str, brief_path: str = None, brief: dict = None,
                        dry_run: bool = False) -> str:
    """
    Full pipeline: load brief → apply to project → generate timeline HTML.
    Returns path to generated HTML file.
    """
    if brief is None:
        brief = load_brief(brief_path)

    # Apply brief to Supabase project
    result = apply_brief_to_project(project_no, brief, dry_run=dry_run)

    if dry_run:
        print("\nDry run complete. No changes made.")
        return None

    # Generate timeline
    from generate_timeline import generate_for_project
    html_path = generate_for_project(project_no)
    print(f"\nTimeline generated: {html_path}")
    return html_path


# ─── CLI ───

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="ASI 360 Proposal-to-Timeline Pipeline")
    parser.add_argument("brief", nargs="?", help="Path to proposal brief JSON")
    parser.add_argument("--project", "-p", help="Project number (e.g., PROJ356)")
    parser.add_argument("--dry-run", "-n", action="store_true", help="Preview without writing")
    parser.add_argument("--list-briefs", "-l", action="store_true", help="List available briefs")
    args = parser.parse_args()

    if args.list_briefs:
        print("Available briefs:")
        for f in sorted(BRIEFS_DIR.glob("*.json")):
            brief = json.loads(f.read_text())
            print(f"  {f.name:30s} | {brief.get('project_no', '?'):10s} | {brief.get('title', '?')}")
        sys.exit(0)

    if not args.brief:
        parser.print_help()
        sys.exit(1)

    brief_path = args.brief
    if not os.path.isabs(brief_path):
        # Check briefs/ directory first
        candidate = BRIEFS_DIR / brief_path
        if candidate.exists():
            brief_path = str(candidate)

    brief = load_brief(brief_path)
    project_no = args.project or brief.get("project_no")
    if not project_no:
        print("Error: --project required or set project_no in brief JSON")
        sys.exit(1)

    generate_from_brief(project_no, brief=brief, dry_run=args.dry_run)
