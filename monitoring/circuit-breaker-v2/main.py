"""
main.py — Circuit Breaker v2: Service Lifecycle Manager.

FastAPI app on port 8310 that:
- Runs a 30s health loop checking all services
- Enforces run modes (ALWAYS_ON auto-restart, ON_DEMAND hibernate, etc.)
- Exposes Prometheus metrics at /metrics
- Provides v2 REST API for mode changes, wake-on-call, vacation, maintenance
- Serves the dashboard UI at /
- Persists state across restarts (cb_state.json + cb_events.json)

Wires together:
- circuit_breaker.py (enhanced state machine)
- lifecycle_manager.py (auto-restart, hibernate, wake, vacation)
- event_store.py (rolling history)
- prometheus_metrics.py (30+ metrics)
- dependencies.py (cascade detection)
- services_config_v2.py (26 services with run modes)
- service_control.py (systemd + Docker start/stop)
- promql_queries.py (PromQL catalog + Prometheus proxy + digest builders)
"""

import asyncio
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional

# ── Local modules ─────────────────────────────────────────────────────
from circuit_breaker import CircuitBreakerRegistry, CLOSED, OPEN, HALF_OPEN
from circuit_breaker import FORCED_OPEN, HIBERNATING, STARTING, DEGRADED
from dependencies import DependencyGraph
from event_store import EventStore, ServiceEvent
from lifecycle_manager import LifecycleManager
from prometheus_metrics import (
    get_metrics_output,
    cb_service_state, cb_service_uptime_seconds,
    cb_service_memory_bytes, cb_service_latency_ms,
    cb_breaker_state, cb_breaker_failures_total,
    cb_breaker_trips_total, cb_breaker_recovery_total,
    cb_breaker_cooldown_remaining_seconds,
    cb_restart_total, cb_restart_failures_total,
    cb_hibernate_total, cb_wake_total, cb_wake_latency_seconds,
    cb_idle_seconds, cb_last_used_timestamp,
    cb_services_total, cb_services_healthy, cb_services_degraded,
    cb_services_down, cb_services_hibernating, cb_vacation_mode_active,
    cb_event_total, cb_restart_attempt, cb_restart_escalated,
    cb_restart_approval_pending, cb_dependency_blocked,
    CB_STATE_MAP,
)
from services_config_v2 import (
    SERVICES, SERVICE_MAP, DEPENDENCIES, GROUP_META,
    TOOL_SERVICE_MAP, ALWAYS_ON_SERVICES, ON_DEMAND_SERVICES,
    CRITICAL_SERVICES, VACATION_KEEP_ALIVE,
)
from service_control import control_service, get_service_status
from promql_queries import PromClient, QUERIES, RECORDING_RULE_QUERIES

# ── Logging ───────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("cb-main")

# ── Configuration ─────────────────────────────────────────────────────
HEALTH_INTERVAL_S = 30          # How often to check all services
PORT = 8310
PERSIST_INTERVAL_S = 300        # Save state every 5 min
LATENCY_TIMEOUT_S = 10          # HTTP health check timeout
DEGRADED_LATENCY_MS = 5000.0   # Latency above this = degraded

# ── Global State ──────────────────────────────────────────────────────
cb_registry: CircuitBreakerRegistry = None
lifecycle: LifecycleManager = None
dep_graph: DependencyGraph = None
events: EventStore = None
prom: PromClient = None
_health_task: asyncio.Task = None
_persist_task: asyncio.Task = None
_startup_time = time.time()


# ══════════════════════════════════════════════════════════════════════
# Health Check Loop
# ══════════════════════════════════════════════════════════════════════

async def check_service_health(service: dict) -> tuple[bool, float, str]:
    """
    Check if a service is healthy via HTTP health endpoint.

    Returns: (is_healthy, latency_ms, error_message)
    """
    health_url = service.get("health_url")

    if not health_url:
        # No health URL — check systemd/docker status instead
        status = get_service_status(service)
        is_up = status.get("active", False)
        return is_up, 0.0, "" if is_up else "Service not active"

    try:
        async with httpx.AsyncClient(timeout=LATENCY_TIMEOUT_S) as client:
            start = time.monotonic()
            resp = await client.get(health_url)
            latency_ms = (time.monotonic() - start) * 1000

            if resp.status_code < 400:
                return True, latency_ms, ""
            else:
                return False, latency_ms, f"HTTP {resp.status_code}"

    except httpx.TimeoutException:
        return False, LATENCY_TIMEOUT_S * 1000, "Timeout"
    except httpx.ConnectError:
        return False, 0.0, "Connection refused"
    except Exception as e:
        return False, 0.0, str(e)[:100]


async def health_loop():
    """Main health check loop — runs every HEALTH_INTERVAL_S seconds."""
    global cb_registry, lifecycle, dep_graph, events

    log.info(f"Health loop started (interval: {HEALTH_INTERVAL_S}s)")

    while True:
        try:
            await _run_health_cycle()
        except Exception as e:
            log.error(f"Health cycle error: {e}", exc_info=True)

        await asyncio.sleep(HEALTH_INTERVAL_S)


async def _run_health_cycle():
    """Execute one health check cycle for all services."""
    active_services = set()
    check_tasks = []

    # Phase 1: Check all services concurrently
    for svc in SERVICES:
        check_tasks.append(_check_one_service(svc))

    results = await asyncio.gather(*check_tasks, return_exceptions=True)

    # Phase 2: Process results
    for svc, result in zip(SERVICES, results):
        if isinstance(result, Exception):
            log.error(f"Check error for {svc['id']}: {result}")
            continue

        is_healthy, latency_ms, error = result
        sid = svc["id"]
        cb = cb_registry.get(sid)
        if not cb:
            continue

        # Dependency check — if blocked, don't count failures
        blocker = dep_graph.is_blocked(sid, active_services)
        if blocker and not is_healthy:
            # Blocked by dependency — skip failure counting
            _update_dependency_metric(sid, blocker)
            continue
        else:
            _clear_dependency_metric(sid)

        # Update circuit breaker
        if is_healthy:
            cb.record_success(latency_ms)
            active_services.add(sid)
        else:
            cb.record_failure(error, latency_ms)

        # Lifecycle management
        await lifecycle.check_and_restart(sid, is_healthy, cb.state)
        await lifecycle.check_and_hibernate(sid, is_healthy)

        # Update Prometheus metrics
        _update_service_metrics(svc, cb, is_healthy, latency_ms)

    # Phase 3: Check cooldowns for OPEN breakers
    cb_registry.check_cooldowns()

    # Phase 4: Update portfolio summary metrics
    _update_portfolio_metrics(active_services)


async def _check_one_service(service: dict) -> tuple[bool, float, str]:
    """Check one service's health."""
    cb = cb_registry.get(service["id"])
    if not cb:
        return False, 0.0, "No breaker"

    # Skip health check for certain states
    if cb.state == HIBERNATING:
        return False, 0.0, "Hibernating"
    if cb.state == FORCED_OPEN:
        return False, 0.0, "Forced open"
    if service.get("run_mode") == "maintenance":
        return False, 0.0, "In maintenance"

    return await check_service_health(service)


# ── Prometheus Metric Updaters ────────────────────────────────────────

def _update_service_metrics(svc: dict, cb, is_healthy: bool, latency_ms: float):
    """Update per-service Prometheus metrics."""
    sid = svc["id"]
    mode = svc.get("run_mode", "manual")
    group = svc.get("group", "unknown")

    # Service state gauge
    if cb.state == HIBERNATING:
        state_val = 3
    elif cb.state in (FORCED_OPEN, OPEN):
        state_val = 0  # down
    elif cb.state == DEGRADED:
        state_val = 2
    elif svc.get("run_mode") == "maintenance":
        state_val = 4
    elif cb.state == STARTING:
        state_val = 5
    elif is_healthy:
        state_val = 1  # up
    else:
        state_val = 0  # down

    cb_service_state.labels(service=sid, mode=mode, group=group).set(state_val)

    # Uptime (seconds since state became CLOSED)
    if is_healthy:
        uptime = time.time() - cb.state_changed_at if cb.state == CLOSED else 0
        cb_service_uptime_seconds.labels(service=sid).set(uptime)

    # Latency
    if latency_ms > 0:
        cb_service_latency_ms.labels(service=sid).set(latency_ms)

    # Circuit breaker state
    cb_state_val = CB_STATE_MAP.get(cb.state, 0)
    cb_breaker_state.labels(service=sid).set(cb_state_val)

    # Cooldown remaining
    cb_breaker_cooldown_remaining_seconds.labels(service=sid).set(
        cb.cooldown_remaining_s
    )

    # Idle tracking
    idle_s = lifecycle.get_idle_seconds(sid)
    cb_idle_seconds.labels(service=sid).set(idle_s)
    last_used = lifecycle._last_activity.get(sid, 0)
    if last_used:
        cb_last_used_timestamp.labels(service=sid).set(last_used)

    # Restart tracking
    tracker = lifecycle._restart_trackers.get(sid)
    if tracker:
        cb_restart_attempt.labels(service=sid).set(tracker.attempt)
        cb_restart_escalated.labels(service=sid).set(1 if tracker.escalated else 0)
        cb_restart_approval_pending.labels(service=sid).set(
            1 if tracker.approval_pending else 0
        )


def _update_portfolio_metrics(active_services: set):
    """Update portfolio-wide summary metrics."""
    healthy = 0
    degraded = 0
    down = 0
    hibernating = 0

    for svc in SERVICES:
        cb = cb_registry.get(svc["id"])
        if not cb:
            continue

        if cb.state == HIBERNATING:
            hibernating += 1
        elif cb.state == DEGRADED:
            degraded += 1
        elif cb.state in (OPEN, FORCED_OPEN):
            down += 1
        elif svc["id"] in active_services:
            healthy += 1
        else:
            down += 1

    cb_services_healthy.set(healthy)
    cb_services_degraded.set(degraded)
    cb_services_down.set(down)
    cb_services_hibernating.set(hibernating)
    cb_vacation_mode_active.set(1 if lifecycle.vacation_mode else 0)


def _update_dependency_metric(service_id: str, blocked_by: str):
    cb_dependency_blocked.labels(service=service_id, blocked_by=blocked_by).set(1)


def _clear_dependency_metric(service_id: str):
    # Clear any previous blocked status
    try:
        cb_dependency_blocked.labels(service=service_id, blocked_by="").set(0)
    except Exception:
        pass


# ── State Persistence ─────────────────────────────────────────────────

async def persist_loop():
    """Periodically persist state to disk."""
    while True:
        await asyncio.sleep(PERSIST_INTERVAL_S)
        try:
            cb_registry.save()
            events.save()
            _save_lifecycle_state()
            log.debug("State persisted to disk")
        except Exception as e:
            log.error(f"Persist failed: {e}")


def _save_lifecycle_state():
    """Save lifecycle manager state."""
    state_file = Path("/opt/mcp-circuit-breaker/cb_lifecycle.json")
    try:
        state_file.write_text(json.dumps(lifecycle.get_state(), indent=2))
    except Exception as e:
        log.warning(f"Lifecycle state save failed: {e}")


def _load_lifecycle_state():
    """Load lifecycle manager state."""
    state_file = Path("/opt/mcp-circuit-breaker/cb_lifecycle.json")
    if state_file.exists():
        try:
            data = json.loads(state_file.read_text())
            lifecycle.load_state(data)
            log.info("Lifecycle state restored")
        except Exception as e:
            log.warning(f"Lifecycle state load failed: {e}")


# ══════════════════════════════════════════════════════════════════════
# Telegram Callback (for escalation alerts)
# ══════════════════════════════════════════════════════════════════════

async def send_telegram_alert(message: str):
    """Send alert via Telegram Hub."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                "http://127.0.0.1:9501/send",
                json={"text": message, "parse_mode": "HTML"},
            )
    except Exception as e:
        log.error(f"Telegram alert failed: {e}")


# ══════════════════════════════════════════════════════════════════════
# FastAPI Application
# ══════════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    global cb_registry, lifecycle, dep_graph, events, prom
    global _health_task, _persist_task

    # Initialize components
    cb_registry = CircuitBreakerRegistry(SERVICES)
    cb_registry.load()

    events = EventStore()
    events.load()

    dep_graph = DependencyGraph(DEPENDENCIES)

    prom = PromClient("http://127.0.0.1:9090")

    lifecycle = LifecycleManager(
        services=SERVICES,
        event_store=events,
        telegram_callback=send_telegram_alert,
    )
    _load_lifecycle_state()

    events.record(ServiceEvent(
        service_id="__global__",
        event_type="startup",
        success=True,
        details="Circuit Breaker v2 started",
        trigger="auto",
        actor="system",
    ))

    log.info("Circuit Breaker v2 initialized — "
             f"{len(SERVICES)} services, "
             f"{len(ALWAYS_ON_SERVICES)} always-on, "
             f"{len(ON_DEMAND_SERVICES)} on-demand")

    # Start background tasks
    _health_task = asyncio.create_task(health_loop())
    _persist_task = asyncio.create_task(persist_loop())

    yield

    # Shutdown
    _health_task.cancel()
    _persist_task.cancel()
    cb_registry.save()
    events.save()
    _save_lifecycle_state()
    log.info("Circuit Breaker v2 shutdown — state saved")


app = FastAPI(
    title="MCP Circuit Breaker v2",
    description="Service Lifecycle Manager — auto-restart, hibernate, wake-on-call",
    version="2.0.0",
    lifespan=lifespan,
)


# ── Pydantic Models ───────────────────────────────────────────────────

class ModeChangeRequest(BaseModel):
    mode: str
    reason: str = ""

class MaintenanceRequest(BaseModel):
    duration_h: float = 4.0
    reason: str = ""

class VacationRequest(BaseModel):
    reason: str = "CEO away"

class WakeRequest(BaseModel):
    trigger: str = "manual"
    actor: str = "dashboard"


# ══════════════════════════════════════════════════════════════════════
# API Routes
# ══════════════════════════════════════════════════════════════════════

# ── Prometheus Metrics ────────────────────────────────────────────────

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint (no auth)."""
    output, content_type = get_metrics_output()
    return Response(content=output, media_type=content_type)


# ── Service List & Detail ─────────────────────────────────────────────

@app.get("/api/services")
async def list_services():
    """All services with current status and CB state."""
    result = []
    for svc in SERVICES:
        cb = cb_registry.get(svc["id"])
        tracker = lifecycle._restart_trackers.get(svc["id"])
        last_events = events.last_n(svc["id"], n=3)

        entry = {
            "id": svc["id"],
            "name": svc["name"],
            "description": svc.get("description", ""),
            "group": svc.get("group", ""),
            "group_meta": GROUP_META.get(svc.get("group", ""), {}),
            "run_mode": svc.get("run_mode", "manual"),
            "critical": svc.get("critical", False),
            "port": svc.get("port"),
            "host": svc.get("host"),
            "idle_timeout_s": svc.get("idle_timeout_s"),
            "cb": cb.to_dict() if cb else {},
            "restart": {
                "attempt": tracker.attempt if tracker else 0,
                "max_attempts": tracker.max_attempts if tracker else 0,
                "escalated": tracker.escalated if tracker else False,
                "approval_pending": tracker.approval_pending if tracker else False,
                "next_delay_s": tracker.next_delay_s if tracker else 0,
            },
            "idle_seconds": lifecycle.get_idle_seconds(svc["id"]),
            "last_events": last_events,
            "dependencies": dep_graph.get_dependencies(svc["id"]),
            "dependents": dep_graph.get_dependents(svc["id"]),
        }
        result.append(entry)

    return result


@app.get("/api/services/{service_id}")
async def get_service(service_id: str):
    """Single service detail."""
    svc = SERVICE_MAP.get(service_id)
    if not svc:
        raise HTTPException(status_code=404, detail=f"Service '{service_id}' not found")

    cb = cb_registry.get(service_id)
    tracker = lifecycle._restart_trackers.get(service_id)

    return {
        "service": svc,
        "cb": cb.to_dict() if cb else {},
        "restart": {
            "attempt": tracker.attempt if tracker else 0,
            "max_attempts": tracker.max_attempts if tracker else 0,
            "escalated": tracker.escalated if tracker else False,
            "approval_pending": tracker.approval_pending if tracker else False,
        },
        "idle_seconds": lifecycle.get_idle_seconds(service_id),
        "events": events.all_events(service_id),
        "event_stats": events.stats(service_id),
        "dependencies": dep_graph.dependency_tree(service_id),
        "dependents": dep_graph.get_dependents(service_id),
    }


# ── Service Control ───────────────────────────────────────────────────

@app.post("/api/services/{service_id}/start")
async def start_service(service_id: str):
    """Start a service."""
    svc = SERVICE_MAP.get(service_id)
    if not svc:
        raise HTTPException(404, f"Unknown service: {service_id}")

    cb = cb_registry.get(service_id)
    if cb:
        cb.set_starting()

    result = control_service(svc, "start")
    lifecycle.record_activity(service_id)

    events.record(ServiceEvent(
        service_id=service_id,
        event_type="start",
        success=result.get("ok", False),
        details=f"Manual start: {result.get('message', '')}",
        trigger="manual",
        actor="dashboard",
    ))

    return result


@app.post("/api/services/{service_id}/stop")
async def stop_service(service_id: str):
    """Stop a service."""
    svc = SERVICE_MAP.get(service_id)
    if not svc:
        raise HTTPException(404, f"Unknown service: {service_id}")

    result = control_service(svc, "stop")

    events.record(ServiceEvent(
        service_id=service_id,
        event_type="stop",
        success=result.get("ok", False),
        details=f"Manual stop: {result.get('message', '')}",
        trigger="manual",
        actor="dashboard",
    ))

    return result


@app.post("/api/services/{service_id}/restart")
async def restart_service(service_id: str):
    """Restart a service."""
    svc = SERVICE_MAP.get(service_id)
    if not svc:
        raise HTTPException(404, f"Unknown service: {service_id}")

    cb = cb_registry.get(service_id)
    if cb:
        cb.set_starting()

    result = control_service(svc, "restart")
    lifecycle.record_activity(service_id)

    events.record(ServiceEvent(
        service_id=service_id,
        event_type="restart",
        success=result.get("ok", False),
        details=f"Manual restart: {result.get('message', '')}",
        trigger="manual",
        actor="dashboard",
    ))

    return result


# ── Circuit Breaker Controls ──────────────────────────────────────────

@app.post("/api/services/{service_id}/breaker/trip")
async def trip_breaker(service_id: str):
    """Manually trip a circuit breaker (FORCED_OPEN)."""
    cb = cb_registry.get(service_id)
    if not cb:
        raise HTTPException(404, f"Unknown service: {service_id}")

    cb.manual_trip("Manually tripped via dashboard")

    events.record(ServiceEvent(
        service_id=service_id,
        event_type="trip",
        success=True,
        details="Manual trip → FORCED_OPEN",
        trigger="manual",
        actor="dashboard",
    ))

    return {"ok": True, "state": cb.state}


@app.post("/api/services/{service_id}/breaker/reset")
async def reset_breaker(service_id: str):
    """Reset a tripped circuit breaker."""
    cb = cb_registry.get(service_id)
    if not cb:
        raise HTTPException(404, f"Unknown service: {service_id}")

    cb.manual_reset()

    events.record(ServiceEvent(
        service_id=service_id,
        event_type="recover",
        success=True,
        details="Manual reset → CLOSED",
        trigger="manual",
        actor="dashboard",
    ))

    return {"ok": True, "state": cb.state}


# ── Mode Management (v2) ─────────────────────────────────────────────

@app.post("/api/services/{service_id}/mode")
async def change_mode(service_id: str, req: ModeChangeRequest):
    """Change a service's run mode."""
    valid_modes = {"always_on", "on_demand", "scheduled", "manual", "maintenance"}
    if req.mode not in valid_modes:
        raise HTTPException(400, f"Invalid mode: {req.mode}. Valid: {valid_modes}")

    result = lifecycle.change_mode(service_id, req.mode, req.reason)
    if not result.get("ok"):
        raise HTTPException(404, result.get("message"))

    return result


@app.post("/api/services/{service_id}/maintenance")
async def enter_maintenance(service_id: str, req: MaintenanceRequest):
    """Put a service into maintenance mode."""
    result = lifecycle.enter_maintenance(service_id, req.reason, req.duration_h)
    if not result.get("ok"):
        raise HTTPException(404, result.get("message"))
    return result


@app.post("/api/services/{service_id}/maintenance/exit")
async def exit_maintenance(service_id: str):
    """Take a service out of maintenance mode."""
    result = lifecycle.exit_maintenance(service_id)
    if not result.get("ok"):
        raise HTTPException(404, result.get("message"))
    return result


# ── History & Events (v2) ─────────────────────────────────────────────

@app.get("/api/services/{service_id}/history")
async def service_history(service_id: str, n: int = 50):
    """Get event history for a service."""
    if service_id not in SERVICE_MAP:
        raise HTTPException(404, f"Unknown service: {service_id}")
    return {
        "service_id": service_id,
        "events": events.all_events(service_id),
        "stats": events.stats(service_id),
    }


@app.get("/api/services/{service_id}/dependencies")
async def service_dependencies(service_id: str):
    """Get dependency tree for a service."""
    if service_id not in SERVICE_MAP:
        raise HTTPException(404, f"Unknown service: {service_id}")
    return {
        "service_id": service_id,
        "tree": dep_graph.dependency_tree(service_id),
        "dependents": dep_graph.get_dependents(service_id),
        "cascade_impact": dep_graph.cascade_impact(service_id),
    }


# ── Wake-on-Call (v2) ─────────────────────────────────────────────────

@app.post("/api/wake/{service_id}")
async def wake_service(service_id: str, req: WakeRequest = None):
    """
    Wake an ON_DEMAND service. Called by gateway when tool call arrives.
    """
    if req is None:
        req = WakeRequest()

    result = await lifecycle.wake_service(
        service_id, trigger=req.trigger, actor=req.actor
    )

    if result.get("ok"):
        cb = cb_registry.get(service_id)
        if cb:
            cb.set_starting()

    return result


# ── Vacation Mode (v2) ────────────────────────────────────────────────

@app.post("/api/vacation/on")
async def vacation_on(req: VacationRequest):
    """Enable vacation mode — only critical services keep running."""
    result = await lifecycle.enter_vacation(req.reason)
    return result


@app.post("/api/vacation/off")
async def vacation_off():
    """Disable vacation mode — restore all services."""
    result = await lifecycle.exit_vacation()
    return result


@app.get("/api/vacation/status")
async def vacation_status():
    """Get current vacation mode status."""
    return {
        "active": lifecycle.vacation_mode,
        "reason": lifecycle.vacation_reason,
        "started_at": lifecycle.vacation_started_at,
        "duration_h": (time.time() - lifecycle.vacation_started_at) / 3600
            if lifecycle.vacation_mode else 0,
        "keep_alive": VACATION_KEEP_ALIVE,
    }


# ── Telegram Approval (v2) ────────────────────────────────────────────

@app.post("/api/approve/{service_id}")
async def approve_restart(service_id: str):
    """CEO approves restart (called from Telegram webhook)."""
    lifecycle.approve_restart(service_id)
    return {"ok": True, "message": f"Restart approved for {service_id}"}


@app.post("/api/deny/{service_id}")
async def deny_restart(service_id: str):
    """CEO denies restart (called from Telegram webhook)."""
    lifecycle.deny_restart(service_id)
    return {"ok": True, "message": f"Restart denied for {service_id}"}


# ── Global Summary (v2) ───────────────────────────────────────────────

@app.get("/api/summary")
async def portfolio_summary():
    """Portfolio summary — counts by mode, state, group."""
    active = set()
    for svc in SERVICES:
        cb = cb_registry.get(svc["id"])
        if cb and cb.state in (CLOSED, DEGRADED):
            active.add(svc["id"])

    health = dep_graph.health_summary(active)
    cb_counts = cb_registry.counts_by_state()

    # Count by mode
    mode_counts = {}
    for svc in SERVICES:
        mode = svc.get("run_mode", "manual")
        mode_counts[mode] = mode_counts.get(mode, 0) + 1

    # Count by group
    group_counts = {}
    for svc in SERVICES:
        grp = svc.get("group", "unknown")
        group_counts[grp] = group_counts.get(grp, 0) + 1

    return {
        "total_services": len(SERVICES),
        "healthy": len(health["healthy"]),
        "down": len(health["down"]),
        "blocked": len(health["blocked"]),
        "cascade_risks": health["cascade_risks"],
        "by_cb_state": cb_counts,
        "by_mode": mode_counts,
        "by_group": group_counts,
        "vacation_mode": lifecycle.vacation_mode,
        "event_stats": events.global_stats(),
        "uptime_s": time.time() - _startup_time,
    }


@app.get("/api/events")
async def global_events(n: int = 100, event_type: str = None,
                         service_id: str = None):
    """Global event stream."""
    return events.global_stream(n=n, event_type=event_type,
                                service_id=service_id)


@app.get("/api/dependencies")
async def full_dependency_graph():
    """Full dependency graph data for Grafana node graph."""
    active = set()
    for svc in SERVICES:
        cb = cb_registry.get(svc["id"])
        if cb and cb.state in (CLOSED, DEGRADED):
            active.add(svc["id"])

    return dep_graph.to_graph_data(active)


# ── Service Logs ──────────────────────────────────────────────────────

@app.get("/api/services/{service_id}/logs")
async def service_logs(service_id: str, lines: int = 50):
    """Get recent service logs (systemd journal or docker logs)."""
    svc = SERVICE_MAP.get(service_id)
    if not svc:
        raise HTTPException(404, f"Unknown service: {service_id}")

    import subprocess

    try:
        if svc.get("run_type") == "docker":
            cmd = ["docker", "logs", "--tail", str(lines), svc.get("container", "")]
        else:
            unit = svc.get("systemd_unit", "")
            cmd = ["journalctl", "-u", unit, "-n", str(lines), "--no-pager"]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return {"logs": result.stdout, "stderr": result.stderr}
    except Exception as e:
        return {"logs": "", "error": str(e)}


# ══════════════════════════════════════════════════════════════════════
# PromQL Proxy & Query API
# ══════════════════════════════════════════════════════════════════════

@app.get("/api/promql/query")
async def promql_query(q: str, time: float = None):
    """
    Proxy a PromQL instant query to Prometheus.
    Allows dashboard UI and Telegram bot to query without direct Prometheus access.

    Example: /api/promql/query?q=cb_services_healthy
    """
    result = await prom.query(q, time_ts=time)
    return {
        "status": result.status,
        "result_type": result.result_type,
        "data": result.data,
        "scalar": result.scalar,
        "duration_ms": round(result.duration_ms, 1),
        "error": result.error,
    }


@app.get("/api/promql/query_range")
async def promql_query_range(q: str, start: float, end: float, step: str = "30s"):
    """
    Proxy a PromQL range query to Prometheus.

    Example: /api/promql/query_range?q=cb_breaker_state&start=1710600000&end=1710686400&step=1m
    """
    result = await prom.query_range(q, start_ts=start, end_ts=end, step=step)
    return {
        "status": result.status,
        "result_type": result.result_type,
        "data": result.data,
        "duration_ms": round(result.duration_ms, 1),
        "error": result.error,
    }


@app.get("/api/promql/named/{query_name}")
async def promql_named(query_name: str, svc: str = None):
    """
    Execute a named query from the QUERIES catalog.

    Example: /api/promql/named/fleet_health_pct
    Example: /api/promql/named/svc_availability_24h?svc=mcp-gateway
    """
    kwargs = {}
    if svc:
        kwargs["svc"] = svc

    result = await prom.query_named(query_name, **kwargs)
    return {
        "status": result.status,
        "query_name": query_name,
        "promql": result.query,
        "scalar": result.scalar,
        "data": result.as_labeled_dict,
        "duration_ms": round(result.duration_ms, 1),
        "error": result.error,
    }


@app.get("/api/promql/catalog")
async def promql_catalog():
    """
    List all available named queries with their PromQL expressions.
    Useful for dashboard builders and debugging.
    """
    catalog = []
    for name, promql in sorted(QUERIES.items()):
        is_parameterized = "{svc}" in promql
        is_recording_rule = promql.startswith("cb:")
        catalog.append({
            "name": name,
            "promql": promql,
            "parameterized": is_parameterized,
            "recording_rule": is_recording_rule,
        })
    return {
        "total_queries": len(QUERIES),
        "recording_rules": len(RECORDING_RULE_QUERIES),
        "queries": catalog,
    }


@app.get("/api/promql/digest/fleet")
async def promql_fleet_digest():
    """
    Pre-composed fleet digest — 12 queries in one call.
    Returns a structured summary of the entire service fleet.
    """
    return await prom.fleet_digest()


@app.get("/api/promql/digest/service/{service_id}")
async def promql_service_digest(service_id: str):
    """
    Pre-composed single-service deep dive — 11 queries in one call.
    Returns availability, latency, memory, SLO status for one service.
    """
    if service_id not in SERVICE_MAP:
        raise HTTPException(404, f"Unknown service: {service_id}")
    return await prom.service_digest(service_id)


@app.get("/api/promql/digest/slo")
async def promql_slo_report():
    """
    SLO compliance report — availability + error budgets + burn rates.
    Shows all three tiers: critical (99.5%), business (99.0%), support (95.0%).
    """
    return await prom.slo_report()


@app.get("/api/promql/digest/telegram")
async def promql_telegram_digest():
    """
    Pre-formatted daily digest for Telegram. Returns HTML-formatted message.
    Can be sent directly to Telegram Bot API.
    """
    message = await prom.telegram_daily_digest()
    return {"message": message, "format": "HTML"}


@app.get("/api/promql/health")
async def promql_health():
    """Check if Prometheus is reachable from the CB service."""
    healthy = await prom.health()
    return {
        "prometheus_reachable": healthy,
        "prometheus_url": prom.url,
        "recording_rules_count": len(RECORDING_RULE_QUERIES),
        "query_catalog_count": len(QUERIES),
    }


# ── Dashboard ─────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def dashboard():
    """Serve the dashboard UI."""
    static_dir = Path(__file__).parent / "static"
    index = static_dir / "index.html"
    if index.exists():
        return HTMLResponse(content=index.read_text())
    return HTMLResponse(content="""
    <html><body style="background:#0d1117;color:#c9d1d9;font-family:system-ui;padding:40px;text-align:center">
    <h1>⚡ Circuit Breaker v2</h1>
    <p>Service Lifecycle Manager</p>
    <p><a href="/api/services" style="color:#58a6ff">API: /api/services</a> |
       <a href="/metrics" style="color:#58a6ff">Prometheus: /metrics</a> |
       <a href="/api/summary" style="color:#58a6ff">Summary: /api/summary</a></p>
    <p>Dashboard UI not yet deployed. Use Grafana dashboard (CB Fleet Manager v2) for full visualization.</p>
    </body></html>
    """)


# ── Health (self) ─────────────────────────────────────────────────────

@app.get("/health")
async def self_health():
    """Circuit Breaker's own health endpoint."""
    return {
        "status": "ok",
        "version": "2.0.0",
        "uptime_s": round(time.time() - _startup_time),
        "services_monitored": len(SERVICES),
        "vacation_mode": lifecycle.vacation_mode if lifecycle else False,
    }


# ══════════════════════════════════════════════════════════════════════
# Entry Point
# ══════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
