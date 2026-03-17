# MCP Circuit Breaker v2 — Service Lifecycle Manager

## Architecture Overview

The Circuit Breaker evolves from a **passive health monitor** to an **active service lifecycle manager** that enforces run modes, auto-heals, hibernates idle services, and exposes comprehensive Prometheus metrics for a master Grafana dashboard.

## Service Run Modes (6 Modes)

```
┌──────────────┬──────────────────────────────────────────────────────────┐
│ Mode         │ Behavior                                                │
├──────────────┼──────────────────────────────────────────────────────────┤
│ ALWAYS_ON    │ 24/7. Auto-restart if down. Alert if restart fails.     │
│ ON_DEMAND    │ Start on tool call/webhook. Stop after idle timeout.    │
│ SCHEDULED    │ Start on cron schedule. Stop when task completes.       │
│ MANUAL       │ Only start/stop via dashboard or API.                   │
│ MAINTENANCE  │ Intentionally down. No alerts, no auto-restart.         │
│ VACATION     │ Everything non-critical goes to sleep. Minimal footprint│
└──────────────┴──────────────────────────────────────────────────────────┘
```

### Mode Details

**ALWAYS_ON** — For core infrastructure that must never be down:
- Auto-restart with exponential backoff: 5s → 10s → 20s → 40s → 60s (cap)
- Max 5 restart attempts before escalation
- Escalation = Telegram alert + flag for manual review
- Examples: mcp-gateway, key-custodian, telegram-hub, prometheus

**ON_DEMAND** — For tools that only run when called:
- Wake trigger: Gateway receives a tool call for this service
- Startup grace period: configurable per service (5-30s)
- Idle timeout: configurable (default 300s = 5 min, max 3600s)
- Last-used tracking via Prometheus counters
- Examples: designer-agent, firecrawl, mapbox, vtiger-api

**SCHEDULED** — For periodic batch jobs:
- Cron expression defines start time
- Runs until task completes or max_runtime exceeded
- Auto-stop after completion
- Examples: wj-sync (could be cron instead of 24/7), billing engine

**MANUAL** — For staging/dev environments:
- No auto-start, no auto-stop
- Only respond to explicit API/dashboard commands
- Examples: mcp-gateway-staging, duckdb-mcp

**MAINTENANCE** — For planned downtime:
- Suppresses all alerts and auto-restart
- Records who put it in maintenance and why
- Auto-exit maintenance after configurable duration (default 4h)
- Shows "maintenance" badge on dashboard
- Can be entered from any other mode, returns to previous mode

**VACATION** — Global mode affecting all services:
- Only ALWAYS_ON services tagged `critical: true` keep running
- Everything else hibernates
- Reduced alert thresholds (only critical alerts)
- Intended for: CEO is away, PH team handles emergencies only
- Enter/exit via dashboard toggle or Telegram command

## Research-Validated Defaults (Resilience4j / Industry Standard)

| Parameter | Our Value | Industry Default | Source |
|-----------|-----------|-----------------|--------|
| Failure Rate Threshold | 50% (5/10) | 50% | Resilience4j |
| Sliding Window Type | COUNT_BASED (10) | COUNT_BASED (10) | ✅ Matches |
| Min Calls Before Eval | 5 | 5 | ✅ Matches |
| Wait Duration (Open) | 300s (always_on), 120s (on_demand) | 30s default | Tuned up for our use case |
| Permitted Calls in Half-Open | 2 | 3 | Close enough |
| Restart Ladder | 5→10→20→40→60s cap, 5 attempts | 5→15→45→2m→5m, 10 attempts | Both exponential |
| Restart Escalation | Attempt 4+ → Telegram | Attempt 4+ → alert | ✅ Matches |
| SLO: Critical services | 99.5% (3.6h/month) | 99.5% | AWS Well-Architected |
| SLO: Business services | 99.0% (7.2h/month) | 99.0% | Industry standard |
| SLO: Support services | 95.0% (36h/month) | 95.0% | Industry standard |

### systemd Resource Limits (Per-Service Bulkhead)

Research recommends systemd-level resource isolation to prevent cascade:

```ini
# Add to each .service unit file
[Service]
MemoryMax=512M           # Prevent OOM cascade
CPUQuota=50%             # Prevent CPU starvation
TasksMax=100             # Prevent fork bombs
LimitNOFILE=4096         # Prevent FD exhaustion
```

### Fallback Responses When Circuit is OPEN

| Service | Fallback Strategy |
|---------|-------------------|
| VTiger queries | Return cached Supabase/Airtable data |
| VTiger writes | Queue to `pending_sync` table, retry on close |
| Supabase reads | Return Airtable data (slower but functional) |
| IVR (Twilio/ElevenLabs) | Play pre-recorded fallback audio |
| Telegram bot | Queue messages, deliver when API recovers |
| Dashboard API | Return last-known-good cached response + "stale" banner |

## Circuit Breaker State Machine (Enhanced)

```
                    ┌────────────────────┐
                    │                    │
          success   │     CLOSED         │  failure_count >= threshold
     ┌──────────────│   (Normal)         │──────────────────┐
     │              │                    │                  │
     │              └────────────────────┘                  │
     │                       ▲                             ▼
     │              2 consecutive     ┌────────────────────────┐
     │              successes         │                        │
     │                       │        │      OPEN              │
     │              ┌────────┴───┐    │   (Tripped)            │
     │              │            │    │                        │
     └──────────────│ HALF_OPEN  │    └───────────┬────────────┘
                    │  (Probing) │                 │
                    │            │    cooldown_s   │
                    └────────────┘    elapsed      │
                           ▲                       │
                           └───────────────────────┘

     Any State ──── manual_trip ────→ FORCED_OPEN (requires manual reset)
     Any State ──── maintenance ────→ MAINTENANCE (suppresses alerts)
```

### New States
- **FORCED_OPEN** — Manually tripped, requires explicit reset. Separate from auto-OPEN.
- **HIBERNATING** — ON_DEMAND service stopped due to idle timeout. Not a failure.
- **STARTING** — Service is starting up, within grace period. No failure counting.
- **DEGRADED** — Service is up but responding slowly (latency > threshold).

## Prometheus Metrics

```python
# ── Service State ──
cb_service_state{service, mode, group}              # 0=down, 1=up, 2=degraded, 3=hibernating, 4=maintenance
cb_service_mode{service}                            # Gauge encoded: 0=always_on, 1=on_demand, 2=scheduled, 3=manual, 4=maintenance, 5=vacation
cb_service_uptime_seconds{service}                  # Seconds since last start
cb_service_memory_bytes{service}                    # Current RSS memory usage
cb_service_latency_ms{service}                      # Last health check latency

# ── Circuit Breaker ──
cb_breaker_state{service}                           # 0=closed, 1=open, 2=half_open, 3=forced_open
cb_breaker_failures_total{service}                  # Counter: total failures
cb_breaker_trips_total{service}                     # Counter: total trips
cb_breaker_recovery_total{service}                  # Counter: successful recoveries (OPEN→CLOSED)
cb_breaker_cooldown_remaining_seconds{service}      # Gauge: seconds until half-open probe

# ── Lifecycle Actions ──
cb_restart_total{service, trigger}                  # Counter: restarts (trigger=auto|manual|on_demand|scheduled)
cb_restart_failures_total{service}                  # Counter: failed restart attempts
cb_hibernate_total{service}                         # Counter: times service was hibernated
cb_wake_total{service, trigger}                     # Counter: times service was woken (trigger=tool_call|webhook|scheduled|manual)
cb_wake_latency_seconds{service}                    # Histogram: time from wake request to service healthy

# ── Idle Tracking ──
cb_idle_seconds{service}                            # Gauge: seconds since last tool call / activity
cb_last_used_timestamp{service}                     # Gauge: unix timestamp of last activity

# ── Portfolio Summary ──
cb_services_total{mode, state}                      # Gauge: count of services by mode and state
cb_services_healthy                                 # Gauge: total healthy services
cb_services_degraded                                # Gauge: total degraded
cb_services_down                                    # Gauge: total down
cb_services_hibernating                             # Gauge: total hibernating
cb_vacation_mode_active                             # Gauge: 1 if vacation mode is on

# ── Event Log (for Grafana annotations) ──
cb_event_total{service, event_type}                 # Counter: state changes, restarts, trips, mode changes
```

## History Tracking (Last N Runs)

For each service, maintain a rolling history:

```python
@dataclass
class ServiceEvent:
    timestamp: float
    event_type: str        # 'health_check', 'restart', 'hibernate', 'wake', 'trip', 'recover', 'mode_change'
    success: bool
    details: str           # Human-readable description
    duration_ms: int       # How long the action took
    trigger: str           # 'auto', 'manual', 'on_demand', 'scheduled'
    actor: str             # 'system', 'ceo', 'telegram', 'gateway'

# Store last 100 events per service in memory, persist last 20 to state file
# Display last 3 on dashboard card, full history on detail view
```

## Dependency Graph

Services have dependencies. If a dependency is down, dependents can't function:

```python
DEPENDENCIES = {
    # Every MCP tool depends on gateway
    "designer-agent":      ["mcp-gateway", "key-custodian"],
    "firecrawl-mcp":       ["mcp-gateway"],
    "mapbox-mcp":          ["mcp-gateway"],
    "vtiger-api":          ["mcp-gateway", "key-custodian"],
    "boldsign-agent":      ["mcp-gateway", "key-custodian"],
    "twilio-mcp":          ["mcp-gateway", "key-custodian"],
    "elevenlabs-mcp":      ["mcp-gateway", "key-custodian"],
    "telnyx-mcp":          ["mcp-gateway", "key-custodian"],
    "woocommerce-mcp":     ["mcp-gateway", "key-custodian"],
    # Monitoring chain
    "alertmanager":        ["prometheus"],
    "grafana":             ["prometheus"],
    # Telegram bots need hub
    "notebook-scanner-bot": ["telegram-hub"],
    "asi360-field-bot":     ["telegram-hub"],
    # Sync needs Supabase access
    "wj-sync":             ["key-custodian"],
}
```

When checking health:
- If a dependency is OPEN, the dependent is marked BLOCKED (not failed)
- BLOCKED services don't increment failure counters
- Dashboard shows dependency chain visually

## Approval Workflow

Some actions should require human approval via Telegram:

| Action | Auto-Approve | Requires Approval |
|--------|-------------|-------------------|
| Auto-restart (attempt 1-3) | ✅ | |
| Auto-restart (attempt 4-5) | | ✅ CEO via Telegram |
| Hibernate idle ON_DEMAND | ✅ | |
| Wake ON_DEMAND for tool call | ✅ | |
| Enter MAINTENANCE mode | | ✅ Dashboard auth |
| Enter VACATION mode | | ✅ Dashboard auth + confirmation |
| Exit VACATION mode | ✅ (any auth user) | |
| Mode change (e.g., ALWAYS_ON → ON_DEMAND) | | ✅ Dashboard auth |
| Force stop ALWAYS_ON service | | ✅ Dashboard auth + reason |

Telegram approval flow:
1. CB sends: "🔧 Service {name} failed 3 restart attempts. Approve restart #4? Reply /approve_{service_id} or /deny_{service_id}"
2. CEO replies in Telegram
3. CB receives webhook, acts accordingly
4. If no response in 30 min, auto-deny and escalate to "needs manual intervention"

## Grafana Dashboard Design

### Row 1: Global Status Bar
- **Total Services** (stat) | **Healthy** (stat, green) | **Degraded** (stat, yellow) | **Down** (stat, red) | **Hibernating** (stat, blue) | **Vacation Mode** (toggle indicator)

### Row 2: Service Grid (main panel)
- Table showing ALL services with columns:
  - Service Name | Group | Mode | CB State | Status | Uptime | Last Used | Latency | Memory | Last 3 Events (icons)
  - Color-coded rows: green=healthy, yellow=degraded, red=down, blue=hibernating, gray=maintenance
  - Sortable by any column
  - Filterable by group/mode/state

### Row 3: Circuit Breaker Timeline
- Annotations showing every CB state change across all services
- X-axis = time, Y-axis = services, dots/bars showing state changes

### Row 4: Run Mode Distribution
- Pie chart: services by mode
- Bar chart: services by group
- Gauge: resource utilization (total memory of running services)

### Row 5: History & Events
- Event log table (last 50 events across all services)
- Restart frequency graph (restarts per service over time)
- Wake latency histogram (how fast do ON_DEMAND services start?)

### Row 6: Dependency Health
- Node graph visualization of service dependencies
- Cascade failure indicator (if gateway goes down, show all dependents affected)

## API Endpoints (v2)

```
# Existing (keep)
GET  /api/services                      # All services with status
GET  /api/services/{id}                 # Single service detail
POST /api/services/{id}/start           # Start service
POST /api/services/{id}/stop            # Stop service
POST /api/services/{id}/restart         # Restart service
POST /api/services/{id}/breaker/trip    # Manual trip
POST /api/services/{id}/breaker/reset   # Manual reset
GET  /api/services/{id}/logs            # Service logs

# New v2
POST /api/services/{id}/mode            # Change run mode {"mode": "on_demand", "reason": "..."}
POST /api/services/{id}/maintenance     # Enter maintenance {"duration_h": 4, "reason": "upgrading"}
GET  /api/services/{id}/history         # Event history (last N events)
GET  /api/services/{id}/dependencies    # Dependency tree

# Global
POST /api/vacation/on                   # Enable vacation mode {"reason": "..."}
POST /api/vacation/off                  # Disable vacation mode
GET  /api/vacation/status               # Current vacation mode status
GET  /api/summary                       # Portfolio summary (counts by mode/state)
GET  /api/events                        # Global event stream (last 100)
GET  /api/dependencies                  # Full dependency graph
GET  /metrics                           # Prometheus metrics endpoint (no auth)

# Webhook (for gateway integration)
POST /api/wake/{service_id}             # Gateway calls this when it needs an ON_DEMAND service
```

## Gateway Integration (Wake-on-Call)

The MCP Gateway needs a small middleware patch:

```python
# In mcp-gateway main.py, before routing a tool call:
async def route_tool_call(tool_name: str, params: dict):
    service_id = tool_to_service_map.get(tool_name)
    if service_id:
        # Check if service needs waking
        cb_status = await httpx.get(f"http://localhost:8310/api/services/{service_id}")
        if cb_status.json().get("cb", {}).get("state") == "HIBERNATING":
            # Wake the service
            await httpx.post(f"http://localhost:8310/api/wake/{service_id}")
            # Wait for service to be healthy (with timeout)
            await wait_for_healthy(service_id, timeout=30)

    # Proceed with tool call
    return await forward_to_service(service_id, tool_name, params)
```

## File Structure

```
/opt/mcp-circuit-breaker/
├── main.py                    # FastAPI app (enhanced)
├── circuit_breaker.py         # CB state machine (enhanced with new states)
├── service_control.py         # Start/stop/restart (keep as-is)
├── services_config.py         # Service registry (add run_mode, dependencies)
├── lifecycle_manager.py       # NEW: auto-restart, hibernate, wake, vacation
├── event_store.py             # NEW: event history tracking
├── prometheus_metrics.py      # NEW: all Prometheus metric definitions
├── dependencies.py            # NEW: dependency graph and cascade detection
├── telegram_approvals.py      # NEW: approval workflow via Telegram
├── cb_state.json              # Persisted state
├── cb_events.json             # Persisted event history
├── static/
│   └── index.html             # Dashboard UI
├── .env
├── requirements.txt
└── mcp-circuit-breaker.service
```
