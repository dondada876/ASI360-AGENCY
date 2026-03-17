#!/usr/bin/env python3
"""
ASI 360 CEO Command Center — Prometheus Exporter
Port: 9108
Interval: 300s (5 minutes)

Aggregates ALL business metrics across ALL organizations into
Prometheus gauges for the unified Grafana CEO dashboard.

Metric families:
  ceo_org_*                — Per-organization rollups
  ceo_portfolio_*          — Cross-org portfolio totals
  ceo_financial_*          — Cash flow, pipeline, DSO
  ceo_team_*               — Utilization, capacity, availability
  ceo_activity_*           — Activity stream volume/velocity
  ceo_scorecard_*          — EOS KPI tracking
  ceo_risk_*               — Risk register heatmap
  ceo_intent_*             — Work distribution by strategic intent
  ceo_sentinel_*           — Sentinel compliance (delegates to sentinel_exporter)
"""

import os
import sys
import time
import json
import logging
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone, timedelta

from prometheus_client import (
    Gauge, Counter, Info,
    generate_latest, CONTENT_TYPE_LATEST,
    CollectorRegistry,
)

# ── Config ──────────────────────────────────────────────────────────
PORT = int(os.environ.get("CEO_EXPORTER_PORT", 9108))
COLLECT_INTERVAL = int(os.environ.get("CEO_COLLECT_INTERVAL", 300))
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format="%(asctime)s [ceo-exporter] %(levelname)s %(message)s",
)
log = logging.getLogger("ceo-exporter")

# ── Vault Bootstrap ─────────────────────────────────────────────────
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://gtfffxwfgcxiiauliynd.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_SERVICE_KEY:
    log.error("SUPABASE_SERVICE_KEY not set. Exiting.")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ── Prometheus Metrics ──────────────────────────────────────────────
registry = CollectorRegistry()

exporter_info = Info("ceo_exporter", "CEO Command Center exporter metadata", registry=registry)
exporter_info.info({"version": "1.0.0", "port": str(PORT)})

exporter_up = Gauge("ceo_exporter_up", "Exporter health", registry=registry)
audit_ts = Gauge("ceo_audit_timestamp", "Last collection timestamp", registry=registry)
audit_dur = Gauge("ceo_audit_duration_seconds", "Collection duration", registry=registry)

# ── Portfolio-Level ─────────────────────────────────────────────────
ORG_LABELS = ["org"]

portfolio_projects = Gauge(
    "ceo_portfolio_projects_total", "Total projects across portfolio",
    ["status"], registry=registry
)
portfolio_tasks = Gauge(
    "ceo_portfolio_tasks_total", "Total tasks across portfolio",
    ["status"], registry=registry
)
portfolio_tickets = Gauge(
    "ceo_portfolio_tickets_total", "Total tickets across portfolio",
    ["status"], registry=registry
)

# ── Per-Organization ────────────────────────────────────────────────
org_projects = Gauge(
    "ceo_org_projects", "Projects per org by status",
    ["org", "status"], registry=registry
)
org_tasks = Gauge(
    "ceo_org_tasks", "Tasks per org by status",
    ["org", "status"], registry=registry
)
org_completion_pct = Gauge(
    "ceo_org_completion_pct", "Task completion % per org",
    ORG_LABELS, registry=registry
)
org_active_projects = Gauge(
    "ceo_org_active_projects", "Active projects per org",
    ORG_LABELS, registry=registry
)

# ── Intent Distribution ─────────────────────────────────────────────
intent_tasks = Gauge(
    "ceo_intent_tasks_total", "Tasks by intent category",
    ["intent"], registry=registry
)
intent_hours = Gauge(
    "ceo_intent_hours_total", "Hours by intent category",
    ["intent"], registry=registry
)

# ── Financial Pipeline ──────────────────────────────────────────────
financial_pipeline = Gauge(
    "ceo_financial_pipeline_value", "Pipeline value by status",
    ["status"], registry=registry
)
financial_overdue = Gauge(
    "ceo_financial_overdue_count", "Overdue invoices count",
    registry=registry
)
financial_overdue_value = Gauge(
    "ceo_financial_overdue_value", "Overdue invoice total value",
    registry=registry
)
financial_dso_avg = Gauge(
    "ceo_financial_dso_avg", "Average Days Sales Outstanding",
    registry=registry
)
financial_days_to_close_avg = Gauge(
    "ceo_financial_days_to_close_avg", "Average days to close deals",
    registry=registry
)

# ── Team / Utilization ──────────────────────────────────────────────
team_total = Gauge("ceo_team_total", "Total team members", ORG_LABELS, registry=registry)
team_available = Gauge("ceo_team_available", "Available team members", ORG_LABELS, registry=registry)
team_utilization_pct = Gauge(
    "ceo_team_utilization_pct", "Weekly billable utilization %",
    ["member"], registry=registry
)
team_capacity_hours = Gauge(
    "ceo_team_capacity_hours_weekly", "Total weekly capacity hours",
    registry=registry
)
team_allocated_hours = Gauge(
    "ceo_team_allocated_hours_weekly", "Allocated hours this week",
    registry=registry
)

# ── Activity Stream ─────────────────────────────────────────────────
activity_24h = Gauge(
    "ceo_activity_24h_total", "Activities in last 24 hours",
    ["action"], registry=registry
)
activity_by_org = Gauge(
    "ceo_activity_24h_by_org", "Activities in last 24h by org",
    ORG_LABELS, registry=registry
)
activity_by_entity = Gauge(
    "ceo_activity_24h_by_entity", "Activities in last 24h by entity type",
    ["entity_type"], registry=registry
)
activity_by_impact = Gauge(
    "ceo_activity_24h_by_impact", "Activities in last 24h by impact level",
    ["impact"], registry=registry
)

# ── EOS Scorecard ───────────────────────────────────────────────────
scorecard_value = Gauge(
    "ceo_scorecard_value", "KPI current value",
    ["metric", "category", "org"], registry=registry
)
scorecard_target = Gauge(
    "ceo_scorecard_target", "KPI target value",
    ["metric", "category", "org"], registry=registry
)
scorecard_on_track = Gauge(
    "ceo_scorecard_on_track", "1=on track, 0=off track",
    ["metric", "category", "org"], registry=registry
)
scorecard_off_track_total = Gauge(
    "ceo_scorecard_off_track_total", "Total off-track KPIs",
    registry=registry
)

# ── Rocks (Quarterly Priorities) ────────────────────────────────────
rocks_total = Gauge("ceo_rocks_total", "Total rocks this quarter", ["status"], registry=registry)
rocks_completion_avg = Gauge("ceo_rocks_completion_avg", "Avg rock completion %", registry=registry)

# ── Risk Register ───────────────────────────────────────────────────
risk_total = Gauge(
    "ceo_risk_total", "Open risks by severity",
    ["likelihood", "impact"], registry=registry
)
risk_score_max = Gauge(
    "ceo_risk_score_max", "Highest risk score in register",
    registry=registry
)

# ── Handoff Notes ───────────────────────────────────────────────────
handoff_today = Gauge(
    "ceo_handoff_submitted_today", "Whether today's handoff note exists",
    ["author"], registry=registry
)
handoff_blocked_items = Gauge(
    "ceo_handoff_blocked_items_total", "Total blocked items across today's handoffs",
    registry=registry
)
handoff_decisions_needed = Gauge(
    "ceo_handoff_decisions_needed_total", "Decisions awaiting CEO input",
    registry=registry
)


# ── Helpers ─────────────────────────────────────────────────────────
def safe_query(table, select="*", filters=None):
    """Query Supabase with error handling. Returns data or empty list."""
    try:
        q = sb.table(table).select(select)
        if filters:
            for method, args in filters:
                q = getattr(q, method)(*args)
        return q.execute().data or []
    except Exception as e:
        log.warning(f"Query failed on {table}: {e}")
        return []


def table_exists(table_name):
    """Check if a table exists by trying a minimal query."""
    try:
        sb.table(table_name).select("id").limit(1).execute()
        return True
    except Exception:
        return False


# ── Collection Logic ────────────────────────────────────────────────
def collect():
    start = time.time()
    log.info("Starting CEO Command Center collection...")

    try:
        # ── Orgs ──
        orgs = safe_query("ceo_organizations", "id,org_code,org_name,team_count,status",
                          [("eq", ("status", "active"))])
        org_map = {o["id"]: o["org_code"] for o in orgs}

        # ── Projects (from existing asi360_projects) ──
        projects = safe_query("asi360_projects", "id,project_no,project_status,template_id")
        proj_statuses = {}
        for p in projects:
            s = p.get("project_status", "unknown")
            proj_statuses[s] = proj_statuses.get(s, 0) + 1

        portfolio_projects._metrics.clear()
        for s, c in proj_statuses.items():
            portfolio_projects.labels(status=s).set(c)

        # ── Tasks (from existing asi360_project_tasks) ──
        # Use RPC or paginated query for large datasets
        task_statuses = {}
        task_intents = {}
        total_tasks = 0
        completed_tasks = 0

        for p in projects:
            tasks = safe_query("asi360_project_tasks", "status,intent_category,estimated_hours",
                               [("eq", ("project_id", p["id"]))])
            for t in tasks:
                total_tasks += 1
                s = t.get("status", "unknown")
                task_statuses[s] = task_statuses.get(s, 0) + 1
                if s == "completed":
                    completed_tasks += 1
                # Intent tracking
                intent = t.get("intent_category", "maintenance")
                task_intents[intent] = task_intents.get(intent, 0) + 1

        portfolio_tasks._metrics.clear()
        for s, c in task_statuses.items():
            portfolio_tasks.labels(status=s).set(c)

        intent_tasks._metrics.clear()
        for intent, count in task_intents.items():
            intent_tasks.labels(intent=intent).set(count)

        # ── Per-Org rollup (ASI360 only for now — expand as orgs are wired) ──
        org_projects._metrics.clear()
        org_tasks._metrics.clear()
        org_completion_pct._metrics.clear()
        org_active_projects._metrics.clear()

        # All current projects belong to ASI360
        for s, c in proj_statuses.items():
            org_projects.labels(org="ASI360", status=s).set(c)
        for s, c in task_statuses.items():
            org_tasks.labels(org="ASI360", status=s).set(c)

        pct = round((completed_tasks / total_tasks) * 100, 1) if total_tasks else 0
        org_completion_pct.labels(org="ASI360").set(pct)
        active = sum(1 for p in projects
                     if p.get("project_status") in ("in_progress", "in progress"))
        org_active_projects.labels(org="ASI360").set(active)

        # ── Financial Pipeline (if table exists) ──
        if table_exists("ceo_financial_pipeline"):
            financials = safe_query("ceo_financial_pipeline", "*")
            pipeline_by_status = {}
            overdue_count = 0
            overdue_val = 0
            dso_values = []
            dtc_values = []

            for f in financials:
                s = f.get("status", "unknown")
                amt = float(f.get("amount") or 0)
                pipeline_by_status[s] = pipeline_by_status.get(s, 0) + amt
                if s == "overdue":
                    overdue_count += 1
                    overdue_val += amt
                if f.get("days_sales_outstanding"):
                    dso_values.append(f["days_sales_outstanding"])
                if f.get("days_to_close"):
                    dtc_values.append(f["days_to_close"])

            financial_pipeline._metrics.clear()
            for s, v in pipeline_by_status.items():
                financial_pipeline.labels(status=s).set(v)
            financial_overdue.set(overdue_count)
            financial_overdue_value.set(overdue_val)
            financial_dso_avg.set(
                round(sum(dso_values) / len(dso_values), 1) if dso_values else 0
            )
            financial_days_to_close_avg.set(
                round(sum(dtc_values) / len(dtc_values), 1) if dtc_values else 0
            )

        # ── Team / Utilization (if tables exist) ──
        if table_exists("ceo_team_members"):
            members = safe_query("ceo_team_members", "*",
                                 [("eq", ("is_active", True))])
            team_total._metrics.clear()
            team_available._metrics.clear()

            total_capacity = 0
            for m in members:
                org_code = "ASI360"  # Default until org_id is resolved
                for oid, ocode in org_map.items():
                    if m.get("org_id") == oid:
                        org_code = ocode
                        break
                total_capacity += float(m.get("capacity_hours_per_week") or 40)

            # Group by org
            org_member_counts = {}
            org_available_counts = {}
            for m in members:
                oc = "ASI360"
                for oid, ocode in org_map.items():
                    if m.get("org_id") == oid:
                        oc = ocode
                        break
                org_member_counts[oc] = org_member_counts.get(oc, 0) + 1
                if m.get("availability_status") == "available":
                    org_available_counts[oc] = org_available_counts.get(oc, 0) + 1

            for oc, cnt in org_member_counts.items():
                team_total.labels(org=oc).set(cnt)
            for oc, cnt in org_available_counts.items():
                team_available.labels(org=oc).set(cnt)

            team_capacity_hours.set(total_capacity)

        # ── Utilization Log (this week) ──
        if table_exists("ceo_utilization_log"):
            # Get this week's logs
            week_start = (datetime.now(timezone.utc) - timedelta(days=datetime.now().weekday())).strftime("%Y-%m-%d")
            util_logs = safe_query("ceo_utilization_log", "member_id,hours,is_billable",
                                   [("gte", ("log_date", week_start))])
            member_hours = {}
            member_billable = {}
            total_allocated = 0
            for u in util_logs:
                mid = u.get("member_id", "unknown")
                h = float(u.get("hours") or 0)
                member_hours[mid] = member_hours.get(mid, 0) + h
                total_allocated += h
                if u.get("is_billable"):
                    member_billable[mid] = member_billable.get(mid, 0) + h

            team_allocated_hours.set(total_allocated)
            team_utilization_pct._metrics.clear()
            for mid, total_h in member_hours.items():
                bill_h = member_billable.get(mid, 0)
                pct = round((bill_h / total_h) * 100, 1) if total_h else 0
                team_utilization_pct.labels(member=mid[:8]).set(pct)

        # ── Activity Stream (last 24h) ──
        if table_exists("ceo_activity_stream"):
            yesterday = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
            activities = safe_query("ceo_activity_stream",
                                    "action,entity_type,impact_level,org_id",
                                    [("gte", ("created_at", yesterday))])

            activity_24h._metrics.clear()
            activity_by_entity._metrics.clear()
            activity_by_impact._metrics.clear()
            activity_by_org._metrics.clear()

            action_counts = {}
            entity_counts = {}
            impact_counts = {}
            org_activity = {}

            for a in activities:
                act = a.get("action", "unknown")
                action_counts[act] = action_counts.get(act, 0) + 1
                et = a.get("entity_type", "unknown")
                entity_counts[et] = entity_counts.get(et, 0) + 1
                imp = a.get("impact_level", "medium")
                impact_counts[imp] = impact_counts.get(imp, 0) + 1
                oid = a.get("org_id")
                if oid and oid in org_map:
                    oc = org_map[oid]
                    org_activity[oc] = org_activity.get(oc, 0) + 1

            for act, c in action_counts.items():
                activity_24h.labels(action=act).set(c)
            for et, c in entity_counts.items():
                activity_by_entity.labels(entity_type=et).set(c)
            for imp, c in impact_counts.items():
                activity_by_impact.labels(impact=imp).set(c)
            for oc, c in org_activity.items():
                activity_by_org.labels(org=oc).set(c)

        # ── EOS Scorecard ──
        if table_exists("ceo_scorecard"):
            kpis = safe_query("ceo_scorecard", "*")
            scorecard_value._metrics.clear()
            scorecard_target._metrics.clear()
            scorecard_on_track._metrics.clear()

            off_track = 0
            for k in kpis:
                org_code = "PORTFOLIO"
                if k.get("org_id") and k["org_id"] in org_map:
                    org_code = org_map[k["org_id"]]
                metric = k.get("metric_code", "unknown")
                cat = k.get("category", "operations")
                scorecard_value.labels(metric=metric, category=cat, org=org_code).set(
                    float(k.get("current_value") or 0))
                scorecard_target.labels(metric=metric, category=cat, org=org_code).set(
                    float(k.get("target_value") or 0))
                on = 1 if k.get("status") == "on_track" else 0
                scorecard_on_track.labels(metric=metric, category=cat, org=org_code).set(on)
                if not on and k.get("status") != "no_target":
                    off_track += 1

            scorecard_off_track_total.set(off_track)

        # ── Rocks ──
        if table_exists("ceo_rocks"):
            current_q = f"{datetime.now().year}-Q{(datetime.now().month - 1) // 3 + 1}"
            rocks = safe_query("ceo_rocks", "status,completion_pct",
                               [("eq", ("quarter", current_q))])
            rocks_total._metrics.clear()
            rock_statuses = {}
            completions = []
            for r in rocks:
                s = r.get("status", "on_track")
                rock_statuses[s] = rock_statuses.get(s, 0) + 1
                completions.append(float(r.get("completion_pct") or 0))
            for s, c in rock_statuses.items():
                rocks_total.labels(status=s).set(c)
            rocks_completion_avg.set(
                round(sum(completions) / len(completions), 1) if completions else 0
            )

        # ── Risk Register ──
        if table_exists("ceo_risk_register"):
            risks = safe_query("ceo_risk_register", "likelihood,impact,risk_score",
                               [("eq", ("status", "open"))])
            risk_total._metrics.clear()
            risk_grid = {}
            max_score = 0
            for r in risks:
                l = r.get("likelihood", "low")
                i = r.get("impact", "low")
                risk_grid[(l, i)] = risk_grid.get((l, i), 0) + 1
                max_score = max(max_score, int(r.get("risk_score") or 0))
            for (l, i), c in risk_grid.items():
                risk_total.labels(likelihood=l, impact=i).set(c)
            risk_score_max.set(max_score)

        # ── Handoff Notes ──
        if table_exists("ceo_handoff_notes"):
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            handoffs = safe_query("ceo_handoff_notes",
                                  "author,blocked_items,decisions_needed",
                                  [("eq", ("handoff_date", today))])
            handoff_today._metrics.clear()
            total_blocked = 0
            total_decisions = 0
            for h in handoffs:
                handoff_today.labels(author=h.get("author", "unknown")).set(1)
                total_blocked += len(h.get("blocked_items") or [])
                total_decisions += len(h.get("decisions_needed") or [])
            handoff_blocked_items.set(total_blocked)
            handoff_decisions_needed.set(total_decisions)

        # ── Finalize ──
        elapsed = time.time() - start
        audit_dur.set(round(elapsed, 2))
        audit_ts.set(time.time())
        exporter_up.set(1)

        log.info(f"CEO collection complete: {len(projects)} projects, "
                 f"{total_tasks} tasks, elapsed={elapsed:.1f}s")

    except Exception as e:
        log.error(f"Collection failed: {e}", exc_info=True)
        exporter_up.set(0)


# ── Background Loop ─────────────────────────────────────────────────
def collection_loop():
    while True:
        try:
            collect()
        except Exception as e:
            log.error(f"Loop error: {e}", exc_info=True)
        time.sleep(COLLECT_INTERVAL)


# ── HTTP Server ─────────────────────────────────────────────────────
class MetricsHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/metrics":
            output = generate_latest(registry)
            self.send_response(200)
            self.send_header("Content-Type", CONTENT_TYPE_LATEST)
            self.end_headers()
            self.wfile.write(output)
        elif self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "healthy",
                "service": "ceo-exporter",
                "port": PORT,
                "version": "1.0.0",
            }).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass


def main():
    log.info(f"Starting CEO Command Center Exporter on port {PORT}")
    collect()
    t = threading.Thread(target=collection_loop, daemon=True)
    t.start()
    server = HTTPServer(("0.0.0.0", PORT), MetricsHandler)
    log.info(f"Serving /metrics on http://0.0.0.0:{PORT}/metrics")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    main()
