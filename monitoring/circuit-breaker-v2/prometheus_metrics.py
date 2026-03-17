"""
prometheus_metrics.py — All Prometheus metric definitions for Circuit Breaker v2.

Exposes on /metrics (port 8310, no auth).
Scraped by Prometheus every 30s.
Feeds the Master Circuit Breaker Grafana dashboard.
"""

from prometheus_client import (
    Gauge, Counter, Histogram, Info,
    CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST,
)

registry = CollectorRegistry()

# ── Exporter Info ──────────────────────────────────────────────────

exporter_info = Info(
    "cb_exporter", "Circuit Breaker v2 exporter metadata",
    registry=registry
)
exporter_info.info({"version": "2.0.0", "port": "8310"})

# ── Service State ──────────────────────────────────────────────────
# State encoding: 0=down, 1=up, 2=degraded, 3=hibernating, 4=maintenance, 5=starting

cb_service_state = Gauge(
    "cb_service_state",
    "Service state (0=down, 1=up, 2=degraded, 3=hibernating, 4=maintenance, 5=starting)",
    ["service", "mode", "group"],
    registry=registry,
)

cb_service_uptime_seconds = Gauge(
    "cb_service_uptime_seconds",
    "Seconds since service last started",
    ["service"],
    registry=registry,
)

cb_service_memory_bytes = Gauge(
    "cb_service_memory_bytes",
    "Current RSS memory usage in bytes",
    ["service"],
    registry=registry,
)

cb_service_latency_ms = Gauge(
    "cb_service_latency_ms",
    "Last health check response latency in milliseconds",
    ["service"],
    registry=registry,
)

# ── Circuit Breaker State ──────────────────────────────────────────
# State encoding: 0=closed, 1=open, 2=half_open, 3=forced_open

CB_STATE_MAP = {"CLOSED": 0, "OPEN": 1, "HALF_OPEN": 2, "FORCED_OPEN": 3}

cb_breaker_state = Gauge(
    "cb_breaker_state",
    "Circuit breaker state (0=closed, 1=open, 2=half_open, 3=forced_open)",
    ["service"],
    registry=registry,
)

cb_breaker_failures_total = Counter(
    "cb_breaker_failures_total",
    "Total health check failures",
    ["service"],
    registry=registry,
)

cb_breaker_trips_total = Counter(
    "cb_breaker_trips_total",
    "Total circuit breaker trips (CLOSED→OPEN)",
    ["service"],
    registry=registry,
)

cb_breaker_recovery_total = Counter(
    "cb_breaker_recovery_total",
    "Successful recoveries (OPEN→CLOSED)",
    ["service"],
    registry=registry,
)

cb_breaker_cooldown_remaining_seconds = Gauge(
    "cb_breaker_cooldown_remaining_seconds",
    "Seconds remaining until half-open probe",
    ["service"],
    registry=registry,
)

# ── Lifecycle Actions ──────────────────────────────────────────────

cb_restart_total = Counter(
    "cb_restart_total",
    "Total restart attempts",
    ["service", "trigger"],   # trigger: auto, manual, on_demand, scheduled
    registry=registry,
)

cb_restart_failures_total = Counter(
    "cb_restart_failures_total",
    "Failed restart attempts",
    ["service"],
    registry=registry,
)

cb_hibernate_total = Counter(
    "cb_hibernate_total",
    "Times service was hibernated (idle timeout)",
    ["service"],
    registry=registry,
)

cb_wake_total = Counter(
    "cb_wake_total",
    "Times service was woken from hibernation",
    ["service", "trigger"],   # trigger: tool_call, webhook, scheduled, manual
    registry=registry,
)

cb_wake_latency_seconds = Histogram(
    "cb_wake_latency_seconds",
    "Time from wake request to service healthy",
    ["service"],
    buckets=[1, 2, 5, 10, 15, 20, 30, 45, 60],
    registry=registry,
)

# ── Idle Tracking ──────────────────────────────────────────────────

cb_idle_seconds = Gauge(
    "cb_idle_seconds",
    "Seconds since last tool call or activity",
    ["service"],
    registry=registry,
)

cb_last_used_timestamp = Gauge(
    "cb_last_used_timestamp",
    "Unix timestamp of last activity",
    ["service"],
    registry=registry,
)

# ── Portfolio Summary ──────────────────────────────────────────────

cb_services_total = Gauge(
    "cb_services_total",
    "Count of services by mode and state",
    ["mode", "state"],
    registry=registry,
)

cb_services_healthy = Gauge(
    "cb_services_healthy",
    "Total healthy services",
    registry=registry,
)

cb_services_degraded = Gauge(
    "cb_services_degraded",
    "Total degraded services",
    registry=registry,
)

cb_services_down = Gauge(
    "cb_services_down",
    "Total down services (excluding hibernating)",
    registry=registry,
)

cb_services_hibernating = Gauge(
    "cb_services_hibernating",
    "Total hibernating services",
    registry=registry,
)

cb_vacation_mode_active = Gauge(
    "cb_vacation_mode_active",
    "1 if vacation mode is enabled, 0 otherwise",
    registry=registry,
)

# ── Event Counters (for Grafana annotations) ──────────────────────

cb_event_total = Counter(
    "cb_event_total",
    "Total lifecycle events",
    ["service", "event_type"],   # restart, hibernate, wake, trip, recover, etc.
    registry=registry,
)

# ── Restart Tracking ──────────────────────────────────────────────

cb_restart_attempt = Gauge(
    "cb_restart_attempt",
    "Current restart attempt number (0=healthy)",
    ["service"],
    registry=registry,
)

cb_restart_escalated = Gauge(
    "cb_restart_escalated",
    "1 if restart has been escalated to Telegram",
    ["service"],
    registry=registry,
)

cb_restart_approval_pending = Gauge(
    "cb_restart_approval_pending",
    "1 if waiting for CEO approval",
    ["service"],
    registry=registry,
)

# ── Dependency Health ──────────────────────────────────────────────

cb_dependency_blocked = Gauge(
    "cb_dependency_blocked",
    "1 if service is blocked due to dependency failure",
    ["service", "blocked_by"],
    registry=registry,
)


def get_metrics_output() -> tuple[bytes, str]:
    """Generate Prometheus metrics output."""
    return generate_latest(registry), CONTENT_TYPE_LATEST
