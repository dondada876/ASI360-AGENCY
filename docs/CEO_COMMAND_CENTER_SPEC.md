# CEO Command Center — Spec-Driven Development Plan

## CRITICAL: Droplet Capacity Assessment

### Main Droplet: 104.248.69.86 (SFO2)

| Spec | Value | Status |
|------|-------|--------|
| **CPU** | 2 vCPU (DO-Premium-Intel) | ⚠️ Load avg 1.34 — 67% utilized |
| **RAM** | 8 GB total, 3.1 GB used, 4.7 GB available | ⚠️ 39% used + 635 MB swap active |
| **Disk** | 160 GB total, 42 GB used (27%) | ✅ Healthy |
| **Docker images** | 15.7 GB (13.5 GB reclaimable!) | ⚠️ Needs prune |
| **Docker build cache** | 11.7 GB (7.4 GB reclaimable) | ⚠️ Needs prune |
| **Running services** | 52 systemd + 14 Docker containers | ⚠️ DENSE |
| **Prometheus retention** | 60 days TSDB | ✅ Configured |

### Verdict: This Droplet Is Approaching Its Ceiling

- **52 services + 14 containers on 2 vCPUs / 8 GB RAM** — one more memory-hungry service and you hit swap pressure
- **635 MB already in swap** — means RAM is periodically insufficient
- **Load average 1.34 on 2 CPUs** — sustained 67% CPU. Spikes will cause latency
- **Quick win: `docker system prune`** reclaims ~20 GB (13.5 GB images + 7.4 GB build cache)

### Recommendation: Split Into 3 Droplets

| Droplet | Purpose | Size | Monthly | Services |
|---------|---------|------|---------|----------|
| **ops-1** (existing 104.248.69.86) | Gateway + Core Ops | 8 GB / 2 vCPU (current) | $48 | Gateway, Key Custodian, Telegram bots, sync agents |
| **mon-1** (NEW) | Monitoring + Dashboards | 4 GB / 2 vCPU | $24 | Prometheus, Grafana, Alertmanager, all exporters, CEO/Sentinel dashboards |
| **aseagi-1** (NEW) | Legal Intelligence | 4 GB / 2 vCPU | $24 | Athena MCP (HTTP), document processing, digital twin, ASEAGI Supabase agent |

**Total: $96/month** (vs current $48 for one overloaded droplet)

### Why ASEAGI Must Be Separate

1. **Data sovereignty** — Legal documents (D22-03244, custody case) must not share runtime with food hall order processing
2. **Different Supabase project** — ASEAGI uses `jvjlhxodmbkodzmggwpu`, not `gtfffxwfgcxiiauliynd`
3. **Resource isolation** — Document processing (OCR, PDF parsing, embedding generation) is CPU-heavy burst workload; shouldn't compete with real-time ops
4. **Access control** — PH team gets access to ops-1, NOT aseagi-1
5. **Compliance** — Legal data handling standards differ from commercial ops

### Why Monitoring Should Be Separate

1. **Observer shouldn't crash with the observed** — If ops-1 goes down, mon-1 still captures the failure and alerts you
2. **Prometheus + Grafana + Alertmanager** consume 600+ MB RAM combined — they're the #2, #3, #4 memory consumers on the droplet
3. **Scraping 28+ targets** generates sustained CPU load that competes with Gateway request handling
4. **Dashboard queries** (Grafana) spike CPU when you browse — shouldn't impact live API latency

### Migration Strategy (Zero Downtime)

```
Phase A: Provision mon-1 + aseagi-1 droplets
Phase B: Docker compose up monitoring stack on mon-1
Phase C: Point Prometheus on mon-1 to scrape ops-1 exporters (remote scrape)
Phase D: Move ASEAGI services to aseagi-1
Phase E: Stop monitoring containers on ops-1 (frees ~1.5 GB RAM)
Phase F: docker system prune on ops-1 (frees ~20 GB disk)
```

---

## Infrastructure Reality Check (Audited March 16, 2026)

### What Is ALREADY Running on the Droplet

| Layer | Component | Status | Port |
|-------|-----------|--------|------|
| **Orchestration** | Gateway FastAPI | RUNNING | 8443 |
| **Orchestration** | 500GL Orchestrator (Docker) | RUNNING | 8200 |
| **Orchestration** | Designer Agent (FastAPI) | RUNNING | 8205 |
| **Monitoring** | Prometheus (Docker) | RUNNING | 9090 |
| **Monitoring** | Grafana (Docker) | RUNNING | 9000 |
| **Monitoring** | Alertmanager (Docker) | RUNNING | 9093 |
| **Monitoring** | Node Exporter (Docker) | RUNNING | - |
| **Monitoring** | cAdvisor (Docker) | RUNNING | - |
| **Exporters** | 500gl-exporter (UDBRS) | RUNNING | 9101 |
| **Exporters** | ivr_exporter | RUNNING | 9102 |
| **Exporters** | infra-health | RUNNING | 9103/9104 |
| **Exporters** | kc-exporter (Key Custodian) | RUNNING | 9105 |
| **Exporters** | mcp-health-exporter | RUNNING | 9106 |
| **Exporters** | grafana-health-exporter | RUNNING | (internal) |
| **Exporters** | ceo_exporter | RUNNING | 9108 |
| **Telegram** | notebook-scanner-bot | RUNNING | - |
| **Telegram** | asi360-field-bot | RUNNING | - |
| **Telegram** | telegram-hub (Alert Aggregator) | RUNNING | - |
| **CRM** | VTiger API (Docker) | RUNNING | 3004 |
| **CRM** | BoldSign Agent | RUNNING | - |
| **Secrets** | Key Custodian | RUNNING | - |
| **Sync** | wj-sync (Supabase→Airtable) | RUNNING | - |
| **Billing** | 500gl-billing-engine | RUNNING | - |
| **Billing** | comm-watchdog (SMS/Voice) | RUNNING | - |
| **Billing** | 500gl-cost-sentinel | RUNNING | - |
| **Health** | 500gl-sentinel (workspace) | RUNNING | - |
| **API** | wj-api | RUNNING | - |
| **Scraping** | Firecrawl API (Docker) | RUNNING | 3005 |
| **Geo** | Mapbox API (Docker) | RUNNING | 3100 |

**Prometheus scrape config: 28 job targets already wired.**
**Alert rules: 6 rule files active (comm_watchdog, field_bot, infra_health, scraper, sentinel, service_health).**
**Alertmanager: Routes to Telegram (critical @ 1h repeat, warning @ 4h repeat).**

### What Is ALREADY Built (Local, Not Yet Deployed)

| Component | File | Status |
|-----------|------|--------|
| CEO Command Center SQL | `monitoring/migrations/001_ceo_command_center.sql` | WRITTEN, not applied |
| Sentinel Exporter | `monitoring/sentinel_exporter.py` | WRITTEN, not deployed |
| CEO Exporter | `monitoring/ceo_exporter.py` | WRITTEN, port 9108 RUNNING |
| Sentinel Dashboard (Grafana) | `monitoring/grafana_sentinel_dashboard.json` | WRITTEN, not imported |
| CEO Dashboard (Grafana) | `monitoring/grafana_ceo_command_center.json` | WRITTEN, not imported |
| Prometheus scrape + rules | `monitoring/prometheus_sentinel_scrape.yml` | WRITTEN, not merged |
| Deploy script | `monitoring/deploy_sentinel_exporter.sh` | WRITTEN |
| Sentinel service unit | `monitoring/sentinel-exporter.service` | WRITTEN |

---

## What Needs to Be Built — 8 Sprints

### Sprint 1: Database Foundation (2-3 hours)
**Apply the CEO Command Center schema to Supabase**

| Task | Tool/Method | Est. |
|------|-------------|------|
| 1.1 Apply `001_ceo_command_center.sql` migration | Supabase MCP `execute_sql` | 10 min |
| 1.2 Verify all 10 tables + 5 views created | Supabase MCP `list_tables` | 5 min |
| 1.3 Add `intent_category` column to `asi360_project_tasks` | Supabase MCP | 5 min |
| 1.4 Add `org_id` column to `asi360_projects` + backfill to ASI360 org | SQL | 10 min |
| 1.5 Seed `ceo_scorecard` with 10 initial KPIs | SQL INSERT | 15 min |
| 1.6 Seed `ceo_rocks` with Q1 2026 priorities | SQL INSERT | 10 min |
| 1.7 Create `ceo_trigger_activity_on_project` — auto-log to activity stream | SQL trigger | 20 min |
| 1.8 Create `ceo_trigger_activity_on_task` — auto-log task changes | SQL trigger | 20 min |
| 1.9 Create `ceo_trigger_activity_on_ticket` — auto-log ticket changes | SQL trigger | 20 min |
| 1.10 Test all triggers with INSERT/UPDATE | Supabase MCP | 15 min |

**Skills used:** Supabase MCP, `run_sql` via Gateway
**Risk:** LOW — read/write to new tables only, no existing tables modified
**Rollback:** DROP TABLE cascade on all `ceo_*` tables

---

### Sprint 2: Sentinel Exporter Deploy (1-2 hours)
**Deploy the PMBOK compliance auditor to the droplet**

| Task | Tool/Method | Est. |
|------|-------------|------|
| 2.1 SCP `sentinel_exporter.py` + service unit to droplet | Bash SSH | 5 min |
| 2.2 Install Python deps (`supabase`, `prometheus_client`) | SSH pip3 | 5 min |
| 2.3 Create `/root/sentinel-exporter/.env` with bootstrap vars | SSH + Vault | 5 min |
| 2.4 Install + start `sentinel-exporter.service` | systemctl | 5 min |
| 2.5 Verify `:9107/metrics` returns data | curl | 2 min |
| 2.6 Add `sentinel_exporter` job to Prometheus Docker config | docker exec + volume mount | 10 min |
| 2.7 Verify Prometheus target is UP | curl :9090/api/v1/targets | 5 min |
| 2.8 Merge `sentinel_rules.yml` recording + alert rules | Already exists! Verify/update | 10 min |
| 2.9 Reload Prometheus config | docker exec prometheus kill -HUP 1 | 2 min |
| 2.10 Test alert fires in Telegram | Trigger test condition | 10 min |

**Skills used:** `500gl-ops` skill (file deploy), Docker MCP
**Risk:** LOW — new service on unused port 9107
**Rollback:** `systemctl stop sentinel-exporter && systemctl disable sentinel-exporter`

---

### Sprint 3: Grafana Dashboards (1-2 hours)
**Import both dashboards + connect to Prometheus**

| Task | Tool/Method | Est. |
|------|-------------|------|
| 3.1 Import Sentinel Governance dashboard via Grafana API | curl POST to :9000 | 10 min |
| 3.2 Import CEO Command Center dashboard via Grafana API | curl POST to :9000 | 10 min |
| 3.3 Verify Prometheus datasource is configured | Grafana API GET | 5 min |
| 3.4 Set CEO Command Center as home dashboard | Grafana API PUT | 5 min |
| 3.5 Create "ASI 360 CEO" folder in Grafana | Grafana API | 5 min |
| 3.6 Test all 25 CEO panels render with real data | Manual review via browser | 20 min |
| 3.7 Test all 17 Sentinel panels render | Manual review | 15 min |
| 3.8 Tune thresholds based on real data | Edit dashboard JSON | 15 min |
| 3.9 Add dashboard links between CEO ↔ Sentinel | Grafana API | 5 min |
| 3.10 Set auto-refresh to 5 min on both | Dashboard settings | 2 min |

**Skills used:** Docker MCP, Claude in Chrome (for visual QA)
**Risk:** LOW — additive only, no existing dashboards modified
**Rollback:** Delete dashboards via Grafana API

---

### Sprint 4: Telegram Alert Integration (2-3 hours)
**Wire all new metrics into the existing Alertmanager→Telegram pipeline**

| Task | Tool/Method | Est. |
|------|-------------|------|
| 4.1 Create `ceo_command_center_rules.yml` alert file | Write locally | 20 min |
| 4.2 Alerts: `CEOScoreOffTrack` — KPIs below target | PromQL rule | 10 min |
| 4.3 Alerts: `CEORockOffTrack` — quarterly Rock falling behind | PromQL rule | 10 min |
| 4.4 Alerts: `CEOOverdueInvoice` — financial pipeline overdue | PromQL rule | 10 min |
| 4.5 Alerts: `CEORiskCritical` — risk score > 10 | PromQL rule | 10 min |
| 4.6 Alerts: `CEOHandoffMissing` — PH team didn't submit today | PromQL rule | 10 min |
| 4.7 Alerts: `SentinelComplianceDrop` — project below 60% | Already in sentinel_rules.yml | Verify |
| 4.8 Alerts: `SentinelViolationCritical` — critical violation count > 0 | Already in sentinel_rules.yml | Verify |
| 4.9 Deploy rule file to Prometheus Docker volume | docker cp + reload | 10 min |
| 4.10 Add `ceo-critical` route in Alertmanager | Edit alertmanager.yml | 10 min |
| 4.11 Test each alert fires correctly | Simulate conditions | 20 min |
| 4.12 Create Telegram Hub integration for CEO daily digest | Modify telegram-hub.service | 20 min |

**Skills used:** Docker MCP, `500gl-ops`, SSH
**Risk:** MEDIUM — modifying alertmanager.yml (existing routing). Backup first.
**Rollback:** Restore alertmanager.yml backup, remove rule file, reload

---

### Sprint 5: Activity Stream Wiring (2-3 hours)
**Make the activity stream the universal event bus**

| Task | Tool/Method | Est. |
|------|-------------|------|
| 5.1 Create Gateway middleware: log every tool call to `ceo_activity_stream` | Python (Gateway FastAPI) | 30 min |
| 5.2 Map Gateway tool names to intent categories | Config dict | 15 min |
| 5.3 Wire N8N webhook: order events → activity stream | N8N workflow edit | 15 min |
| 5.4 Wire ticket creation → activity stream (Supabase trigger) | SQL trigger | 15 min |
| 5.5 Wire case status changes → activity stream | SQL trigger | 15 min |
| 5.6 Wire project phase advancement → activity stream | SQL trigger | 15 min |
| 5.7 Wire financial pipeline changes → activity stream | SQL trigger | 10 min |
| 5.8 Create `ceo_daily_digest` SQL function | Supabase RPC | 15 min |
| 5.9 Test: create project → verify activity stream entry | Supabase MCP | 10 min |
| 5.10 Test: update task → verify activity stream + exporter picks it up | End-to-end | 10 min |

**Skills used:** Gateway MCP, Supabase MCP, N8N
**Risk:** MEDIUM — modifying Gateway middleware (add-only, no existing logic changed)
**Rollback:** Remove middleware, drop triggers

---

### Sprint 6: Handoff Notes + PH Team Interface (2-3 hours)
**Build the follow-the-sun handoff system**

| Task | Tool/Method | Est. |
|------|-------------|------|
| 6.1 Create `handoff_submit` Gateway tool | Python route | 20 min |
| 6.2 Create `handoff_review` Gateway tool (today's notes) | Python route | 15 min |
| 6.3 Wire Telegram command: `/handoff` in field-bot | Modify asi360-field-bot | 20 min |
| 6.4 Structured format: completed, blocked, decisions, planned | Telegram inline keyboard | 15 min |
| 6.5 Auto-post handoff summary to CEO Telegram channel | telegram-hub integration | 15 min |
| 6.6 Create `CEOHandoffMissing` alert (5 PM Manila = 1 AM Pacific) | PromQL + cron window | 15 min |
| 6.7 Add handoff notes panel to CEO Grafana dashboard | Dashboard JSON update | 10 min |
| 6.8 Test full cycle: submit from Telegram → appears in Grafana | End-to-end | 15 min |

**Skills used:** Gateway MCP, Docker MCP, `500gl-ops`
**Risk:** LOW — new endpoints only
**Rollback:** Remove new Gateway routes, disable Telegram command

---

### Sprint 7: Financial Pipeline + Utilization (2-3 hours)
**Seed real financial data and team utilization tracking**

| Task | Tool/Method | Est. |
|------|-------------|------|
| 7.1 Backfill `ceo_financial_pipeline` from VTiger quotes | Gateway `run_sql` + VTiger API | 20 min |
| 7.2 Create `ceo_team_members` entries (CEO + PH team) | Supabase MCP | 10 min |
| 7.3 Create utilization logging Gateway tools | Python routes | 20 min |
| 7.4 Wire daily utilization reminder via Telegram | telegram-hub scheduled message | 15 min |
| 7.5 Backfill Q1 rocks from active projects | SQL INSERT | 10 min |
| 7.6 Create `ceo_risk_register` initial entries | SQL INSERT | 15 min |
| 7.7 Verify financial velocity panels in Grafana with real data | Visual QA | 10 min |
| 7.8 Verify utilization panels with real data | Visual QA | 10 min |

**Skills used:** Gateway MCP, Supabase MCP, VTiger (via Gateway)
**Risk:** LOW — populating new tables only
**Rollback:** TRUNCATE ceo_* tables

---

### Sprint 8: Agent Cards + Task Engine (3-4 hours)
**The A2A formalization — HTTP endpoints + task tracking**

| Task | Tool/Method | Est. |
|------|-------------|------|
| 8.1 Create `gateway_tasks` Supabase table | SQL | 10 min |
| 8.2 Add task_id return to all Gateway write operations | Python middleware | 30 min |
| 8.3 Add `GET /tasks/{task_id}` polling endpoint to Gateway | Python route | 15 min |
| 8.4 Create `/.well-known/agent.json` for Gateway | Nginx serve static JSON | 10 min |
| 8.5 Generate agent card JSON from MCP server package.json files | Node script | 20 min |
| 8.6 Add StreamableHTTPServerTransport to athena-mcp | TypeScript (20 lines) | 15 min |
| 8.7 Add StreamableHTTPServerTransport to orchestrator-mcp | TypeScript (20 lines) | 15 min |
| 8.8 Add StreamableHTTPServerTransport to supabase-mcp | TypeScript (20 lines) | 15 min |
| 8.9 Wire Key Custodian bearer validation into HTTP handlers | Python middleware | 20 min |
| 8.10 Test: agent discovery via well-known URL | curl | 10 min |
| 8.11 Test: create project returns task_id, pollable | End-to-end | 15 min |
| 8.12 Deploy all HTTP-enabled MCP servers | systemctl | 15 min |

**Skills used:** Gateway MCP, MCP-builder skill, `500gl-ops`, Docker MCP
**Risk:** MEDIUM — adding HTTP transport to existing MCP servers (backward compatible)
**Rollback:** Disable HTTP transport, revert to stdio-only

---

## Total Time Estimate

| Sprint | Description | Estimate | Dependencies |
|--------|-------------|----------|--------------|
| 1 | Database Foundation | 2-3 hours | None |
| 2 | Sentinel Exporter Deploy | 1-2 hours | Sprint 1 |
| 3 | Grafana Dashboards | 1-2 hours | Sprint 2 |
| 4 | Telegram Alerts | 2-3 hours | Sprint 3 |
| 5 | Activity Stream Wiring | 2-3 hours | Sprint 1 |
| 6 | Handoff Notes + PH Team | 2-3 hours | Sprint 5 |
| 7 | Financial + Utilization | 2-3 hours | Sprint 1 |
| 8 | Agent Cards + Task Engine | 3-4 hours | Sprint 5 |

### Critical Path: 1 → 2 → 3 → 4 (Monitoring pipeline)
### Parallel Path: 1 → 5 → 6 (Activity + Handoff)
### Parallel Path: 1 → 7 (Financial data)
### Final: 5 → 8 (A2A formalization)

### Time Summary

| Scenario | Total Hours | Calendar Days |
|----------|-------------|---------------|
| **Sequential** (one sprint at a time) | 15-23 hours | 3-4 days |
| **Parallel** (Sprints 2+5+7 concurrent after 1) | 12-18 hours | 2-3 days |
| **Aggressive** (all parallel paths, no breaks) | 10-14 hours | 1.5-2 days |

### Claude Code Session Strategy

| Session | Sprints | Estimated Duration |
|---------|---------|-------------------|
| Session 1 | Sprint 1 (DB) + Sprint 2 (Sentinel Deploy) | 3-4 hours |
| Session 2 | Sprint 3 (Grafana) + Sprint 4 (Telegram Alerts) | 3-4 hours |
| Session 3 | Sprint 5 (Activity Stream) + Sprint 6 (Handoff) | 4-5 hours |
| Session 4 | Sprint 7 (Financial) + Sprint 8 (A2A) | 5-6 hours |

---

## Skills Leveraged

| Skill | Sprint(s) | Purpose |
|-------|-----------|---------|
| `/project-sentinel` | 2, 3, 4 | PMBOK compliance rules, alert thresholds |
| `500gl-ops` | 2, 4, 6, 8 | Droplet deployment, service management |
| `vault-init` | 2, 8 | Bootstrap new services with Vault pattern |
| `mcp-builder` | 8 | Add HTTP transport to MCP servers |
| `frontend-design` | 3 | Grafana dashboard visual QA |
| `claude-api` | 8 | Agent card generation, A2A protocol |
| `site-factory` | — | Not needed (web production separate) |
| `astra-spectra-designer` | — | Not needed (web production separate) |
| Docker MCP | 2, 3, 4 | Prometheus/Grafana container management |
| Supabase MCP | 1, 5, 7 | Schema migration, data seeding |
| Gateway MCP | 5, 6, 7, 8 | New tools, middleware, task engine |
| GitHub MCP | All | Branch management, PRs |

---

## Pre-Flight Checklist (Per Global Rules)

```
[x] 1. BRANCH   — feature/ceo-command-center (from staging)
[ ] 2. STAGING  — Deploy to staging first (Supabase migration on staging branch)
[ ] 3. TESTS    — Each sprint has verification tasks built in
[ ] 4. ROLLBACK — Each sprint has rollback procedure documented
[ ] 5. APPROVAL — Required before Sprint 1 begins
```

## Version Control & Branch Strategy

### The Rule: Nothing Touches Production Without a Branch

```
feature/ceo-command-center
  ├── Sprint 1: DB migration SQL files (tested on Supabase staging branch first)
  ├── Sprint 2: sentinel_exporter.py + .service unit
  ├── Sprint 3: Grafana dashboard JSONs
  ├── Sprint 4: Alert rule .yml files
  ├── Sprint 5: Gateway middleware patch (activity stream)
  ├── Sprint 6: Handoff tools + Telegram bot patch
  ├── Sprint 7: Financial seeding scripts
  └── Sprint 8: Agent cards + task engine

→ PR to staging (test on staging droplet / Supabase branch)
→ PR to main (deploy to production)
```

### Per-Sprint Git Workflow

```bash
# Before each sprint
git checkout feature/ceo-command-center
git pull origin staging

# After each sprint
git add <specific files>
git commit -m "Sprint N: <description>"

# After all sprints
gh pr create --base staging --title "CEO Command Center v1.0"
```

### Supabase Migration Safety

Supabase supports database branches. The workflow:

1. **Create Supabase branch** `ceo-command-center` from production
2. **Apply migration** `001_ceo_command_center.sql` to the branch
3. **Run all Sprint 1 verification queries** against the branch
4. **Test triggers** fire correctly on the branch
5. **Merge Supabase branch** to production only after Sprint 1 passes

This means zero risk to existing tables. If anything fails, delete the Supabase branch.

### Droplet Deploy Safety (Per Service)

Every new service deployed to the droplet follows:

```bash
# 1. Deploy to staging dir
scp sentinel_exporter.py root@104.248.69.86:/root/sentinel-exporter/

# 2. Create .env with bootstrap vars only
ssh root@104.248.69.86 'cat > /root/sentinel-exporter/.env << EOF
SUPABASE_URL=https://gtfffxwfgcxiiauliynd.supabase.co
SUPABASE_SERVICE_KEY=<from vault>
EOF'

# 3. Install service unit (disabled)
scp sentinel-exporter.service root@104.248.69.86:/etc/systemd/system/
ssh root@104.248.69.86 'systemctl daemon-reload'

# 4. Dry run (foreground, watch output)
ssh root@104.248.69.86 'cd /root/sentinel-exporter && python3 sentinel_exporter.py'
# Ctrl+C after verifying /metrics endpoint returns data

# 5. Enable and start
ssh root@104.248.69.86 'systemctl enable sentinel-exporter && systemctl start sentinel-exporter'

# 6. Verify
ssh root@104.248.69.86 'systemctl status sentinel-exporter && curl -s localhost:9107/health'

# 7. Rollback if failed
ssh root@104.248.69.86 'systemctl stop sentinel-exporter && systemctl disable sentinel-exporter'
```

### Prometheus Config Safety

Prometheus config changes are the highest-risk modification (bad YAML = Prometheus crashes = all monitoring goes dark):

```bash
# 1. Backup current config
docker exec prometheus cp /etc/prometheus/prometheus.yml /etc/prometheus/prometheus.yml.bak

# 2. Validate new config BEFORE applying
docker exec prometheus promtool check config /etc/prometheus/prometheus.yml.new

# 3. Only if validation passes, swap and reload
docker exec prometheus cp /etc/prometheus/prometheus.yml.new /etc/prometheus/prometheus.yml
docker exec prometheus kill -HUP 1

# 4. Verify Prometheus is still up
curl -s http://localhost:9090/-/healthy

# 5. Rollback if broken
docker exec prometheus cp /etc/prometheus/prometheus.yml.bak /etc/prometheus/prometheus.yml
docker exec prometheus kill -HUP 1
```

### Grafana Dashboard Safety

Dashboards are purely additive — importing a new dashboard cannot break existing ones:

```bash
# Import via Grafana API (no restart needed)
curl -X POST http://admin:password@localhost:9000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @grafana_ceo_command_center.json

# Rollback: delete dashboard by UID
curl -X DELETE http://admin:password@localhost:9000/api/dashboards/uid/ceo-command-center-v1
```

---

## Revised Time Estimate (With Droplet Split)

### If Staying on Single Droplet (Current)

| Sprint | Hours | Risk |
|--------|-------|------|
| 1-8 (as specified above) | 15-23 hours | MEDIUM — RAM pressure |
| Docker prune first | +30 min | Frees ~20 GB disk, ~500 MB RAM |
| **Total** | **16-24 hours** | |

### If Splitting to 3 Droplets (Recommended)

| Task | Hours | Notes |
|------|-------|-------|
| Sprint 0: Provision mon-1 + aseagi-1 | 1-2 hours | DO API or console |
| Sprint 0.5: Docker compose monitoring on mon-1 | 2-3 hours | Move Prometheus + Grafana + Alertmanager |
| Sprint 0.75: Move ASEAGI services to aseagi-1 | 2-3 hours | Athena MCP + document processing |
| Sprint 0.9: Verify remote scrape working | 1 hour | mon-1 scrapes ops-1 exporters |
| Sprints 1-8 (original plan) | 15-23 hours | Now deploying to correct droplets |
| **Total** | **21-32 hours** | Spread over 4-5 days |

### Recommended Session Plan

| Session | Duration | Sprints | Droplet |
|---------|----------|---------|---------|
| **1** | 3-4 hrs | 0 + 0.5: Provision + monitoring migration | mon-1 |
| **2** | 3-4 hrs | 0.75: ASEAGI separation + Sprint 1 (DB) | aseagi-1 + Supabase |
| **3** | 3-4 hrs | Sprint 2 (Sentinel) + Sprint 3 (Grafana) | ops-1 + mon-1 |
| **4** | 3-4 hrs | Sprint 4 (Alerts) + Sprint 5 (Activity Stream) | mon-1 + ops-1 |
| **5** | 3-4 hrs | Sprint 6 (Handoff) + Sprint 7 (Financial) | ops-1 |
| **6** | 3-4 hrs | Sprint 8 (A2A Agent Cards + Task Engine) | all 3 |

---

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Supabase migration breaks existing tables | LOW | HIGH | New tables only, no ALTER on existing |
| Prometheus config reload fails | LOW | MEDIUM | Backup before edit, docker restart fallback |
| Alertmanager floods Telegram | MEDIUM | LOW | Test with `inhibit_rules`, tune repeat_interval |
| Gateway middleware slows responses | LOW | MEDIUM | Async logging (fire-and-forget to activity stream) |
| MCP HTTP transport breaks stdio | LOW | HIGH | Dual transport — both active simultaneously |
| Port conflict on 9107 | LOW | LOW | Check `ss -tlnp` before deploy |
| Droplet OOM on ops-1 | MEDIUM | HIGH | Docker prune first, monitor with `free -h` |
| ASEAGI data exposure | LOW | CRITICAL | Separate droplet, separate Supabase project |
| Prometheus crash on config change | LOW | HIGH | `promtool check config` before every reload |
| Branch merge conflict | LOW | LOW | Feature branch from staging, small focused commits |
| Supabase migration regression | LOW | HIGH | Use Supabase branching, test before merge |

---

## FastAPI Agents Inventory (What Runs Where After Split)

### ops-1 (104.248.69.86) — Core Operations

| Agent | Framework | Port | Protocol | Function |
|-------|-----------|------|----------|----------|
| mcp-gateway | FastAPI | 8443 | HTTP | Master orchestrator — 40+ tools |
| designer-agent | FastAPI | 8205 | HTTP | WordPress + Firecrawl + Claude |
| boldsign-agent | FastAPI | 8310 | HTTP | Document signing + PMA |
| key-custodian | FastAPI | — | Internal | Secrets broker |
| wj-api | FastAPI | — | Internal | Task API |
| 500gl-orchestrator | Node.js (Docker) | 8200 | HTTP | Parking, checkout, vendor |
| vtiger-api | Node.js (Docker) | 3004 | HTTP | CRM adapter |
| weather-jockey | Docker | 8201 | HTTP | Weather service |
| firecrawl-api | Docker | 3005 | HTTP | Web scraping cascade |
| mapbox-api | Docker | 3100 | HTTP | Geospatial |
| sentinel | Docker | 8085 | HTTP | Health monitor |

### mon-1 (NEW) — Monitoring & Intelligence

| Agent | Framework | Port | Protocol | Function |
|-------|-----------|------|----------|----------|
| prometheus | Docker | 9090 | HTTP | Metrics collection (28+ targets) |
| grafana | Docker | 9000 | HTTP | Dashboards (CEO + Sentinel + existing) |
| alertmanager | Docker | 9093 | HTTP | Alert routing → Telegram |
| node-exporter | Docker | 9100 | HTTP | Host metrics |
| cadvisor | Docker | — | Internal | Container metrics |
| sentinel-exporter | Python | 9107 | HTTP | PMBOK compliance metrics |
| ceo-exporter | Python | 9108 | HTTP | Multi-org portfolio metrics |
| grafana-health-exporter | Python | — | HTTP | Dashboard health |
| mcp-health-exporter | Python | 9106 | HTTP | MCP server health |
| infra-health | Python | 9103 | HTTP | Infrastructure health |

### aseagi-1 (NEW) — Legal Intelligence

| Agent | Framework | Port | Protocol | Function |
|-------|-----------|------|----------|----------|
| athena-mcp | TypeScript → FastAPI | 9201 | HTTP | Legal case tools (11 tools) |
| document-processor | Python | 8400 | HTTP | OCR, PDF parse, embeddings |
| digital-twin-agent | Python | 8401 | HTTP | Case simulation + strategy |
| aseagi-exporter | Python | 9110 | HTTP | Legal pipeline metrics |

### Supabase Projects (No Droplet Needed)

| Project | ID | Purpose | Accessed By |
|---------|-----|---------|------------|
| asi360-commerce | gtfffxwfgcxiiauliynd | All ops: projects, tasks, vendors, 500GL, CEO tables | ops-1, mon-1 |
| ASEAGI legal | jvjlhxodmbkodzmggwpu | Legal: cases, documents, discovery, digital twin | aseagi-1 only |
