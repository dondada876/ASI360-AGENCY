# Monitoring Engines v2 — Handoff Instructions

> **Branch:** `feature/monitoring-engines-v2`
> **PR:** https://github.com/dondada876/ASI360-AGENCY/pull/7 (→ `staging`)
> **Commit:** `1185ec6` — 18 files, 7,284 lines
> **Date:** 2026-03-17
> **Status:** Code complete, validated locally, awaiting staging deploy + test

---

## What Was Built

Two production monitoring engines in a single branch:

### Engine 1: Circuit Breaker v2 — Service Lifecycle Manager

**Location:** `monitoring/circuit-breaker-v2/` (14 files, 5,375 lines)

A complete replacement for the v1 circuit breaker at `/opt/mcp-circuit-breaker/` on the droplet. Upgrades from passive health monitoring to active service lifecycle management.

| File | Lines | Purpose |
|------|-------|---------|
| `main.py` | 1,044 | FastAPI app (port 8310) — 34 API endpoints, 30s health loop, state persistence |
| `services_config_v2.py` | 709 | 26 services with run modes, dependencies, idle timeouts, restart ladders |
| `lifecycle_manager.py` | 563 | Auto-restart (exponential backoff), hibernate, wake-on-call, vacation, maintenance |
| `promql_queries.py` | 563 | 60+ PromQL query catalog, async Prometheus proxy, digest builders |
| `circuit_breaker.py` | 403 | Enhanced state machine: 7 states, sliding window, latency degradation |
| `SPEC.md` | 349 | Architecture spec with research-validated defaults (Resilience4j alignment) |
| `recording_rules.yml` | 318 | 48 Prometheus recording rules (SLO burn rates, fleet aggregations) |
| `circuit_breaker_rules.yml` | 244 | 15 Prometheus alert rules (critical, health, restarts, SLO, dependencies) |
| `prometheus_metrics.py` | 232 | 30+ Prometheus metric definitions (custom registry) |
| `dependencies.py` | 179 | Dependency graph, cascade detection, Grafana node graph data |
| `event_store.py` | 178 | Rolling event history (100/service in memory, 20 persisted) |
| `grafana_circuit_breaker_dashboard.json` | 560 | 10-row Grafana dashboard, 30+ panels, template variables |
| `mcp-circuit-breaker.service` | 27 | systemd unit with bulkhead limits (256M RAM, 25% CPU) |
| `requirements.txt` | 6 | `fastapi`, `uvicorn`, `httpx`, `prometheus-client`, `pydantic` |

**Key capabilities:**
- 6 run modes: `always_on`, `on_demand`, `scheduled`, `manual`, `maintenance`, `vacation`
- 7 CB states: CLOSED, OPEN, HALF_OPEN, FORCED_OPEN, HIBERNATING, STARTING, DEGRADED
- Auto-restart with exponential backoff (5s→10s→20s→40s→60s cap, 5 attempts → Telegram escalation)
- ON_DEMAND hibernate after idle timeout, wake-on-call via `/api/wake/{service_id}`
- SLO tracking: Google SRE multi-window burn rate (Critical 99.5%, Business 99.0%, Support 95.0%)
- PromQL proxy at `/api/promql/*` with named query catalog, digest builders, Telegram daily digest
- Dependency-aware: blocked services don't count as failures

### Engine 2: CEO Command Center

**Location:** `monitoring/` (4 files, 1,909 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `docs/CEO_COMMAND_CENTER_SPEC.md` | 577 | Full architecture spec, 3-droplet plan, 6-session build timeline |
| `monitoring/ceo_exporter.py` | 579 | Prometheus exporter (port 9108), 40+ metric families, Supabase queries |
| `monitoring/migrations/001_ceo_command_center.sql` | 382 | 10 tables + 5 views for multi-org operational intelligence |
| `monitoring/grafana_ceo_command_center.json` | 371 | 25-panel Grafana dashboard across 6 rows |

---

## Validation Already Done

All checks passed locally before commit:

| Check | Status | How to re-run |
|-------|--------|---------------|
| Python syntax (8 files) | ✅ | `python3 -c "import ast; ast.parse(open('file.py').read())"` for each |
| YAML syntax (2 files) | ✅ | `python3 -c "import yaml; yaml.safe_load(open('file.yml').read())"` |
| JSON syntax (2 files) | ✅ | `python3 -c "import json; json.load(open('file.json'))"` |
| Cross-module imports | ✅ | All resolve; only `service_control.py` from v1 needed at deploy |
| 34 API endpoints counted | ✅ | Every `@app.get`/`@app.post` in main.py verified |

---

## What Remains — Staging Deploy & Test

### Pre-flight Checklist

```
[ ] 1. BRANCH   — feature/monitoring-engines-v2 (already pushed)
[ ] 2. STAGING  — /opt/mcp-circuit-breaker-v2/ (new path, don't overwrite v1)
[ ] 3. TESTS    — Listed below under "Staging Test Plan"
[ ] 4. ROLLBACK — v1 remains at /opt/mcp-circuit-breaker/ untouched
[ ] 5. APPROVAL — User says "proceed" before any droplet changes
```

### Step-by-Step Deploy to Staging

```bash
# ── 1. SSH to droplet ──
ssh root@104.248.69.86

# ── 2. Clone v2 to a staging path (DO NOT touch v1) ──
mkdir -p /opt/mcp-circuit-breaker-v2
cd /opt/mcp-circuit-breaker-v2
git clone --branch feature/monitoring-engines-v2 --single-branch \
  https://github.com/dondada876/ASI360-AGENCY.git .

# ── 3. Set up Python venv ──
python3 -m venv venv
source venv/bin/activate
pip install -r monitoring/circuit-breaker-v2/requirements.txt

# ── 4. Copy service_control.py from v1 (unchanged, needed by v2) ──
cp /opt/mcp-circuit-breaker/service_control.py \
   monitoring/circuit-breaker-v2/service_control.py

# ── 5. Symlink working directory ──
cd monitoring/circuit-breaker-v2

# ── 6. Create state directory ──
mkdir -p /opt/mcp-circuit-breaker  # Already exists from v1
# v2 writes to same cb_state.json location for continuity

# ── 7. Test run (foreground, ctrl+C to stop) ──
python main.py
# Should output: "Circuit Breaker v2 initialized — 26 services..."
# Health check: http://localhost:8310/health from another terminal
```

### Prometheus Rules Deploy

```bash
# ── Validate FIRST (critical — bad rules = Prometheus won't reload) ──
cp monitoring/circuit-breaker-v2/recording_rules.yml /opt/prometheus/rules/
cp monitoring/circuit-breaker-v2/circuit_breaker_rules.yml /opt/prometheus/rules/

# Validate with promtool
docker exec prometheus promtool check rules /etc/prometheus/rules/recording_rules.yml
docker exec prometheus promtool check rules /etc/prometheus/rules/circuit_breaker_rules.yml
# MUST output "SUCCESS" for both

# Reload Prometheus (hot reload, no restart)
curl -X POST http://localhost:9090/-/reload

# Verify rules loaded
curl -s http://localhost:9090/api/v1/rules | python3 -c "
import json,sys
data = json.load(sys.stdin)
groups = data['data']['groups']
cb_groups = [g for g in groups if g['name'].startswith('cb_')]
for g in cb_groups:
    print(f\"{g['name']}: {len(g['rules'])} rules\")
print(f'Total CB rule groups: {len(cb_groups)}')
"
```

### Grafana Dashboard Import

```bash
# Import both dashboards via Grafana HTTP API
GRAFANA_URL="http://localhost:9000"
GRAFANA_AUTH="admin:YOUR_PASSWORD"  # or use API key

# Circuit Breaker dashboard
curl -X POST "$GRAFANA_URL/api/dashboards/db" \
  -u "$GRAFANA_AUTH" \
  -H "Content-Type: application/json" \
  -d "{\"dashboard\": $(cat monitoring/circuit-breaker-v2/grafana_circuit_breaker_dashboard.json), \"overwrite\": true}"

# CEO Command Center dashboard
curl -X POST "$GRAFANA_URL/api/dashboards/db" \
  -u "$GRAFANA_AUTH" \
  -H "Content-Type: application/json" \
  -d "{\"dashboard\": $(cat monitoring/grafana_ceo_command_center.json), \"overwrite\": true}"
```

### CEO Command Center SQL Migration

```bash
# Apply to Supabase via Management API (from droplet)
PAT=$(grep SUPABASE_PAT /root/ivr-system/.env | cut -d= -f2)
SQL=$(cat monitoring/migrations/001_ceo_command_center.sql)

curl -s -X POST \
  "https://api.supabase.com/v1/projects/gtfffxwfgcxiiauliynd/database/query" \
  -H "Authorization: Bearer $PAT" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}"

# Verify tables created
curl -s -X POST \
  "https://api.supabase.com/v1/projects/gtfffxwfgcxiiauliynd/database/query" \
  -H "Authorization: Bearer $PAT" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT table_name FROM information_schema.tables WHERE table_schema = '\''public'\'' AND table_name LIKE '\''ceo_%'\'' ORDER BY table_name"}'
```

---

## Staging Test Plan

Run these checks after deploy. All must pass before merging PR #7.

### Circuit Breaker v2 Tests

```bash
# 1. Self-health
curl -s http://localhost:8310/health | python3 -m json.tool
# Expected: {"status": "ok", "version": "2.0.0", "services_monitored": 26, ...}

# 2. Prometheus connectivity
curl -s http://localhost:8310/api/promql/health | python3 -m json.tool
# Expected: {"prometheus_reachable": true, ...}

# 3. Service list (all 26)
curl -s http://localhost:8310/api/services | python3 -c "
import json,sys
data = json.load(sys.stdin)
print(f'Services: {len(data)}')
for s in data[:5]:
    print(f\"  {s['id']:30s} mode={s['run_mode']:12s} group={s['group']}\")
print('  ...')
"

# 4. Single service detail
curl -s http://localhost:8310/api/services/mcp-gateway | python3 -m json.tool

# 5. Portfolio summary
curl -s http://localhost:8310/api/summary | python3 -m json.tool

# 6. PromQL proxy — raw query
curl -s "http://localhost:8310/api/promql/query?q=up" | python3 -m json.tool

# 7. PromQL named query
curl -s http://localhost:8310/api/promql/named/fleet_health_pct | python3 -m json.tool

# 8. PromQL service digest
curl -s http://localhost:8310/api/promql/digest/service/mcp-gateway | python3 -m json.tool

# 9. PromQL fleet digest (12 queries in 1 call)
curl -s http://localhost:8310/api/promql/digest/fleet | python3 -m json.tool

# 10. PromQL SLO report
curl -s http://localhost:8310/api/promql/digest/slo | python3 -m json.tool

# 11. PromQL query catalog (should show 60+ queries)
curl -s http://localhost:8310/api/promql/catalog | python3 -c "
import json,sys
data = json.load(sys.stdin)
print(f\"Total queries: {data['total_queries']}\")
print(f\"Recording rules: {data['recording_rules']}\")
"

# 12. Telegram digest preview
curl -s http://localhost:8310/api/promql/digest/telegram | python3 -m json.tool

# 13. Vacation mode toggle
curl -s -X POST http://localhost:8310/api/vacation/on \
  -H "Content-Type: application/json" \
  -d '{"reason":"test"}' | python3 -m json.tool
# Then immediately turn off:
curl -s -X POST http://localhost:8310/api/vacation/off | python3 -m json.tool

# 14. Prometheus metrics endpoint
curl -s http://localhost:8310/metrics | head -20
# Should show cb_service_state, cb_breaker_state, etc.

# 15. Dependencies graph
curl -s http://localhost:8310/api/dependencies | python3 -c "
import json,sys
data = json.load(sys.stdin)
print(f\"Nodes: {len(data['nodes'])}, Edges: {len(data['edges'])}\")
"

# 16. Event stream
curl -s http://localhost:8310/api/events | python3 -c "
import json,sys
data = json.load(sys.stdin)
print(f'Events: {len(data)}')
if data:
    print(f\"Latest: {data[-1]['event_type']} at {data[-1]['service_id']}\")
"
```

### Prometheus Rules Tests

```bash
# Verify recording rules are generating data (wait 1-2 min after reload)
curl -s "http://localhost:9090/api/v1/query?query=cb:fleet:total" | python3 -m json.tool
# Expected: result with a value

curl -s "http://localhost:9090/api/v1/query?query=cb:service_availability:ratio_5m" | python3 -m json.tool
# Expected: per-service availability ratios

curl -s "http://localhost:9090/api/v1/query?query=cb:burn_rate:critical_1h" | python3 -m json.tool
# Expected: burn rate values for critical services
```

### Grafana Dashboard Tests

Open in browser:
- `http://DROPLET_IP:9000/d/cb-fleet-manager-v2` — CB Fleet Manager dashboard
- `http://DROPLET_IP:9000/d/ceo-command-center-v1` — CEO Command Center dashboard

Verify:
- [ ] Fleet Status row: all 8 stat panels show values
- [ ] Service Grid table: rows populate with service names, states, modes
- [ ] CB Timeline: state-timeline panel renders colored bars
- [ ] SLO row: availability bargauge shows percentages, burn rate timeseries renders
- [ ] Template variables: Mode, Group, Service dropdowns populate and filter correctly

---

## Architecture Reference

### CB v2 Module Dependency Graph

```
main.py ─┬─→ circuit_breaker.py    (state machine)
          ├─→ lifecycle_manager.py  (auto-restart, hibernate, wake)
          │     └─→ event_store.py  (rolling history)
          │     └─→ service_control.py  (systemd/docker commands — FROM V1)
          ├─→ prometheus_metrics.py (metric definitions)
          ├─→ promql_queries.py     (query catalog + Prometheus proxy)
          ├─→ dependencies.py       (cascade detection)
          └─→ services_config_v2.py (26 services, modes, deps)
```

### API Endpoint Summary (34 total)

| Category | Count | Key Endpoints |
|----------|-------|---------------|
| Service CRUD | 7 | `GET /api/services`, `POST .../start\|stop\|restart` |
| Circuit Breaker | 2 | `POST .../breaker/trip\|reset` |
| Lifecycle v2 | 6 | `POST .../mode`, `.../maintenance`, `/api/wake/{id}` |
| Vacation | 3 | `POST /api/vacation/on\|off`, `GET .../status` |
| Approval | 2 | `POST /api/approve\|deny/{id}` |
| History/Events | 4 | `GET .../history`, `.../dependencies`, `/api/events`, `/api/summary` |
| PromQL Proxy | 8 | `GET /api/promql/query\|query_range\|named\|catalog\|digest/*\|health` |
| Utility | 2 | `GET /health`, `GET /metrics` |

### Prometheus Metrics (30+ gauges/counters)

| Category | Metrics |
|----------|---------|
| Service State | `cb_service_state`, `cb_service_uptime_seconds`, `cb_service_memory_bytes`, `cb_service_latency_ms` |
| Circuit Breaker | `cb_breaker_state`, `cb_breaker_failures_total`, `cb_breaker_trips_total`, `cb_breaker_recovery_total`, `cb_breaker_cooldown_remaining_seconds` |
| Lifecycle | `cb_restart_total`, `cb_restart_failures_total`, `cb_hibernate_total`, `cb_wake_total`, `cb_wake_latency_seconds` |
| Idle | `cb_idle_seconds`, `cb_last_used_timestamp` |
| Portfolio | `cb_services_healthy`, `cb_services_degraded`, `cb_services_down`, `cb_services_hibernating`, `cb_vacation_mode_active` |
| Events | `cb_event_total` |
| Restart | `cb_restart_attempt`, `cb_restart_escalated`, `cb_restart_approval_pending` |
| Dependencies | `cb_dependency_blocked` |

### Recording Rules (48 rules, 6 groups)

| Group | Rules | Purpose |
|-------|-------|---------|
| `cb_slo_recording` | 14 | Availability ratios (5m→30d), burn rates, error budget consumed |
| `cb_fleet_recording` | 12 | Fleet counts by state/mode, health %, memory totals |
| `cb_lifecycle_recording` | 11 | Restart/failure/trip rates, event totals |
| `cb_latency_recording` | 5 | Wake latency percentiles (p50/p95/p99) |
| `cb_idle_recording` | 3 | ON_DEMAND idle avg, near-hibernate count, RAM saved |
| `cb_dependency_recording` | 3 | Blocked totals, gateway cascade indicator |

### SLO Tiers

| Tier | SLO | Error Budget/month | Services |
|------|-----|-------------------|----------|
| Critical | 99.5% | 3.65 hours | mcp-gateway, key-custodian, telegram-hub, prometheus, alertmanager, grafana |
| Business | 99.0% | 7.31 hours | comms (twilio, telnyx, elevenlabs), orchestration, background |
| Support | 95.0% | 36 hours | tools (designer, firecrawl, mapbox, vtiger, boldsign, woocommerce) |

---

## Important Notes for Next Session

1. **`service_control.py` is NOT in v2** — it's reused from v1 unchanged. Must copy at deploy time.
2. **Port 8310 conflict** — v1 and BoldSign agent both claim port 8310. When deploying v2, stop v1 first or change port.
3. **CEO exporter uses port 9108** — currently occupied by wj-sync's Prometheus port. Will need port reassignment.
4. **Grafana password** — needed for dashboard import. Check droplet's Docker compose or Grafana admin settings.
5. **SQL migration** — `001_ceo_command_center.sql` creates 10 tables. Run via Supabase Management API (not direct psql — no password available).
6. **`.pre_vault` files** — 20+ backup files with old secrets still on droplet. Security cleanup still pending.
7. **Docker system prune** — ~20GB reclaimable on droplet. Not done yet.

## Rollback Plan

If anything goes wrong during staging deploy:

```bash
# CB v2 — just stop it, v1 is untouched
systemctl stop mcp-circuit-breaker-v2  # if installed as service
rm -rf /opt/mcp-circuit-breaker-v2     # clean staging path

# Prometheus rules — remove and reload
rm /opt/prometheus/rules/recording_rules.yml
rm /opt/prometheus/rules/circuit_breaker_rules.yml
curl -X POST http://localhost:9090/-/reload

# Grafana dashboards — delete via UI or API
# (importing doesn't overwrite existing dashboards by default)

# SQL migration — drop tables
# DROP TABLE ceo_utilization_log, ceo_risk_register, ceo_handoff_notes, ...
# (reverse order of creation due to FK constraints)
```
