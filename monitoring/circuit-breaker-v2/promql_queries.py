"""
promql_queries.py — PromQL query library and Prometheus proxy for Circuit Breaker v2.

Three responsibilities:
1. QUERY CATALOG — Named PromQL queries for every dashboard panel, API endpoint,
   and Telegram alert digest. Single source of truth for all PromQL across the system.

2. PROMETHEUS CLIENT — Async HTTP client that executes queries against Prometheus
   and returns structured Python dicts. Used by the CB API to serve enriched
   responses without Grafana.

3. DIGEST BUILDER — Composes multi-query digests (fleet summary, service detail,
   SLO report) that combine several PromQL results into one structured payload.
   Powers Telegram daily digest, API /summary endpoint, and the dashboard UI.

Usage:
    from promql_queries import PromClient, QUERIES

    prom = PromClient("http://127.0.0.1:9090")
    result = await prom.query(QUERIES["fleet_health_pct"])
    digest = await prom.fleet_digest()
"""

import logging
import time
from dataclasses import dataclass
from typing import Optional, Any

import httpx

log = logging.getLogger("promql")

# Default Prometheus URL (same droplet)
PROMETHEUS_URL = "http://127.0.0.1:9090"


# ══════════════════════════════════════════════════════════════════════
# 1. QUERY CATALOG — Every PromQL query used in the system
# ══════════════════════════════════════════════════════════════════════

QUERIES = {
    # ── Fleet Status (Row 1 stat panels) ──────────────────────────
    "fleet_total":            "count(cb_service_state)",
    "fleet_healthy":          "cb_services_healthy",
    "fleet_degraded":         "cb_services_degraded",
    "fleet_down":             "cb_services_down",
    "fleet_hibernating":      "cb_services_hibernating",
    "fleet_health_pct":       "cb:fleet:health_pct",   # recording rule
    "fleet_always_on_pct":    "cb:fleet:always_on_health_pct",
    "vacation_mode":          "cb_vacation_mode_active",

    # ── Restart & Recovery ────────────────────────────────────────
    "restarts_24h":           "sum(increase(cb_restart_total[24h]))",
    "restarts_1h":            "cb:fleet:restarts_1h",
    "approvals_pending":      "sum(cb_restart_approval_pending)",
    "escalated_count":        "sum(cb_restart_escalated)",
    "trips_24h":              "cb:fleet:trips_24h",
    "fleet_events_24h":       "cb:fleet:events_24h",

    # ── Per-Service State (instant queries) ───────────────────────
    "all_service_states":     "cb_service_state",
    "all_breaker_states":     "cb_breaker_state",
    "all_uptimes":            "cb_service_uptime_seconds",
    "all_latencies":          "cb_service_latency_ms",
    "all_idle_times":         "cb_idle_seconds",
    "all_memory":             "cb_service_memory_bytes / 1024 / 1024",
    "all_restart_attempts":   "cb_restart_attempt",
    "all_cooldowns":          "cb_breaker_cooldown_remaining_seconds",

    # ── SLO & Availability ────────────────────────────────────────
    "availability_5m":        "cb:service_availability:ratio_5m",
    "availability_1h":        "cb:service_availability:ratio_1h",
    "availability_24h":       "cb:service_availability:ratio_24h",
    "availability_7d":        "cb:service_availability:ratio_7d",
    "availability_30d":       "cb:service_availability:ratio_30d",

    # Burn rates (recording rules)
    "burn_rate_critical_1h":  "cb:burn_rate:critical_1h",
    "burn_rate_critical_6h":  "cb:burn_rate:critical_6h",
    "burn_rate_business_1h":  "cb:burn_rate:business_1h",
    "burn_rate_business_6h":  "cb:burn_rate:business_6h",

    # Error budget consumed (0-1, >1 = breached)
    "budget_critical_30d":    "cb:error_budget_consumed:critical_30d",
    "budget_business_30d":    "cb:error_budget_consumed:business_30d",
    "budget_support_30d":     "cb:error_budget_consumed:support_30d",

    # ── Latency & Performance ─────────────────────────────────────
    "fleet_avg_latency":      "cb:fleet:avg_latency_ms",
    "fleet_max_latency":      "cb:fleet:max_latency_ms",
    "fleet_total_memory_mb":  "cb:fleet:total_memory_mb",
    "latency_by_group":       "cb:latency:avg_by_group",
    "wake_p50":               "cb:wake_latency:p50",
    "wake_p95":               "cb:wake_latency:p95",
    "wake_p99":               "cb:wake_latency:p99",
    "wake_p95_by_service":    "cb:wake_latency:p95_by_service",

    # ── Idle & Hibernation ────────────────────────────────────────
    "on_demand_idle":         'cb_idle_seconds{mode="on_demand"}',
    "near_hibernate":         "cb:idle:near_hibernate_count",
    "ram_saved_mb":           "cb:fleet:hibernated_ram_saved_mb",

    # ── Dependencies ──────────────────────────────────────────────
    "blocked_total":          "cb:deps:blocked_total",
    "blocked_by_service":     "cb:deps:blocked_by_service",
    "gateway_cascade":        "cb:deps:gateway_cascade_active",
    "blocked_services":       "cb_dependency_blocked == 1",

    # ── Lifecycle Event Rates ─────────────────────────────────────
    "event_rates_1h":         "cb:events:rate_1h",
    "hibernations_24h":       "sum(increase(cb_hibernate_total[24h]))",
    "wakes_24h":              "sum(increase(cb_wake_total[24h]))",

    # ── Single Service Queries (parameterized — use .format()) ────
    "svc_state":              'cb_service_state{{service="{svc}"}}',
    "svc_availability_24h":   'cb:service_availability:ratio_24h{{service="{svc}"}}',
    "svc_availability_30d":   'cb:service_availability:ratio_30d{{service="{svc}"}}',
    "svc_latency":            'cb_service_latency_ms{{service="{svc}"}}',
    "svc_memory":             'cb_service_memory_bytes{{service="{svc}"}} / 1024 / 1024',
    "svc_uptime":             'cb_service_uptime_seconds{{service="{svc}"}}',
    "svc_idle":               'cb_idle_seconds{{service="{svc}"}}',
    "svc_breaker":            'cb_breaker_state{{service="{svc}"}}',
    "svc_restarts_24h":       'increase(cb_restart_total{{service="{svc}"}}[24h])',
    "svc_failures_24h":       'increase(cb_breaker_failures_total{{service="{svc}"}}[24h])',
    "svc_restart_attempt":    'cb_restart_attempt{{service="{svc}"}}',

    # ── Range Queries (for time series panels) ────────────────────
    "svc_state_timeline":     'cb_breaker_state{{service="{svc}"}}',
    "svc_latency_timeline":   'cb_service_latency_ms{{service="{svc}"}}',
    "fleet_restarts_timeline": "sum by (service) (increase(cb_restart_total[1h]))",
    "fleet_events_timeline":  "sum by (event_type) (increase(cb_event_total[1h]))",
}

# ── Convenience: queries that map to recording rules ──────────────────
RECORDING_RULE_QUERIES = {k: v for k, v in QUERIES.items()
                          if v.startswith("cb:")}


# ══════════════════════════════════════════════════════════════════════
# 2. PROMETHEUS CLIENT — Async query execution
# ══════════════════════════════════════════════════════════════════════

@dataclass
class PromResult:
    """Parsed Prometheus query result."""
    status: str                     # "success" or "error"
    result_type: str                # "vector", "matrix", "scalar"
    data: list[dict]                # List of {metric: {labels}, value: [ts, val]}
    query: str                      # The original PromQL
    duration_ms: float              # How long the query took
    error: str = ""                 # Error message if any

    @property
    def scalar(self) -> Optional[float]:
        """Extract single scalar value (first result)."""
        if self.data and len(self.data) > 0:
            val = self.data[0].get("value", [None, None])
            if isinstance(val, list) and len(val) >= 2:
                try:
                    return float(val[1])
                except (ValueError, TypeError):
                    return None
        return None

    @property
    def as_dict(self) -> dict[str, float]:
        """Convert vector result to {label: value} dict."""
        result = {}
        for item in self.data:
            metric = item.get("metric", {})
            # Use 'service' label if present, else join all labels
            key = metric.get("service") or metric.get("instance") or \
                  "_".join(f"{k}={v}" for k, v in sorted(metric.items())
                           if k != "__name__") or "value"
            val = item.get("value", [None, None])
            if isinstance(val, list) and len(val) >= 2:
                try:
                    result[key] = float(val[1])
                except (ValueError, TypeError):
                    result[key] = None
        return result

    @property
    def as_labeled_dict(self) -> list[dict]:
        """Convert to list of {labels..., value} dicts."""
        results = []
        for item in self.data:
            metric = item.get("metric", {})
            val = item.get("value", [None, None])
            entry = dict(metric)
            if isinstance(val, list) and len(val) >= 2:
                try:
                    entry["value"] = float(val[1])
                except (ValueError, TypeError):
                    entry["value"] = None
            results.append(entry)
        return results


class PromClient:
    """
    Async Prometheus HTTP API client.

    Supports:
    - Instant queries (GET /api/v1/query)
    - Range queries (GET /api/v1/query_range)
    - Metadata (GET /api/v1/targets, /api/v1/rules)
    - Named query execution from QUERIES catalog
    """

    def __init__(self, url: str = PROMETHEUS_URL, timeout: float = 10.0):
        self.url = url.rstrip("/")
        self.timeout = timeout

    async def query(self, promql: str, time_ts: float = None) -> PromResult:
        """
        Execute an instant PromQL query.

        Args:
            promql: PromQL expression
            time_ts: Optional evaluation timestamp (default: now)
        """
        params = {"query": promql}
        if time_ts:
            params["time"] = time_ts

        start = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(f"{self.url}/api/v1/query", params=params)
                duration_ms = (time.monotonic() - start) * 1000
                body = resp.json()

                if body.get("status") == "success":
                    return PromResult(
                        status="success",
                        result_type=body.get("data", {}).get("resultType", ""),
                        data=body.get("data", {}).get("result", []),
                        query=promql,
                        duration_ms=duration_ms,
                    )
                else:
                    return PromResult(
                        status="error",
                        result_type="",
                        data=[],
                        query=promql,
                        duration_ms=duration_ms,
                        error=body.get("error", "Unknown error"),
                    )
        except Exception as e:
            return PromResult(
                status="error",
                result_type="",
                data=[],
                query=promql,
                duration_ms=(time.monotonic() - start) * 1000,
                error=str(e),
            )

    async def query_range(self, promql: str, start_ts: float, end_ts: float,
                          step: str = "30s") -> PromResult:
        """
        Execute a range PromQL query (returns matrix/time series data).

        Args:
            promql: PromQL expression
            start_ts: Start timestamp
            end_ts: End timestamp
            step: Resolution step (e.g., "30s", "1m", "5m")
        """
        params = {
            "query": promql,
            "start": start_ts,
            "end": end_ts,
            "step": step,
        }

        start = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(
                    f"{self.url}/api/v1/query_range", params=params
                )
                duration_ms = (time.monotonic() - start) * 1000
                body = resp.json()

                if body.get("status") == "success":
                    return PromResult(
                        status="success",
                        result_type=body.get("data", {}).get("resultType", ""),
                        data=body.get("data", {}).get("result", []),
                        query=promql,
                        duration_ms=duration_ms,
                    )
                else:
                    return PromResult(
                        status="error", result_type="", data=[],
                        query=promql, duration_ms=duration_ms,
                        error=body.get("error", "Unknown"),
                    )
        except Exception as e:
            return PromResult(
                status="error", result_type="", data=[],
                query=promql, duration_ms=(time.monotonic() - start) * 1000,
                error=str(e),
            )

    async def query_named(self, name: str, **kwargs) -> PromResult:
        """
        Execute a named query from the QUERIES catalog.

        Args:
            name: Query name from QUERIES dict
            **kwargs: Format parameters (e.g., svc="mcp-gateway")
        """
        promql = QUERIES.get(name)
        if not promql:
            return PromResult(
                status="error", result_type="", data=[], query=name,
                duration_ms=0, error=f"Unknown query: {name}",
            )

        if kwargs:
            promql = promql.format(**kwargs)

        return await self.query(promql)

    async def multi_query(self, queries: dict[str, str]) -> dict[str, PromResult]:
        """
        Execute multiple queries concurrently.

        Args:
            queries: {label: promql_expression}

        Returns:
            {label: PromResult}
        """
        import asyncio

        async def _run(label, promql):
            return label, await self.query(promql)

        tasks = [_run(label, promql) for label, promql in queries.items()]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        output = {}
        for result in results:
            if isinstance(result, Exception):
                continue
            label, prom_result = result
            output[label] = prom_result

        return output

    # ── Convenience: check if Prometheus is reachable ─────────────

    async def health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{self.url}/-/healthy")
                return resp.status_code == 200
        except Exception:
            return False


    # ══════════════════════════════════════════════════════════════
    # 3. DIGEST BUILDERS — Composite queries for summaries
    # ══════════════════════════════════════════════════════════════

    async def fleet_digest(self) -> dict:
        """
        Comprehensive fleet digest — combines 12 queries into one payload.
        Used by: /api/summary, Telegram daily digest, dashboard overview.
        """
        results = await self.multi_query({
            "total":         QUERIES["fleet_total"],
            "healthy":       QUERIES["fleet_healthy"],
            "degraded":      QUERIES["fleet_degraded"],
            "down":          QUERIES["fleet_down"],
            "hibernating":   QUERIES["fleet_hibernating"],
            "health_pct":    QUERIES["fleet_health_pct"],
            "restarts_24h":  QUERIES["restarts_24h"],
            "trips_24h":     QUERIES["trips_24h"],
            "approvals":     QUERIES["approvals_pending"],
            "vacation":      QUERIES["vacation_mode"],
            "memory_mb":     QUERIES["fleet_total_memory_mb"],
            "avg_latency":   QUERIES["fleet_avg_latency"],
        })

        def _scalar(key, default=0):
            r = results.get(key)
            return r.scalar if r and r.scalar is not None else default

        return {
            "total_services":    int(_scalar("total")),
            "healthy":           int(_scalar("healthy")),
            "degraded":          int(_scalar("degraded")),
            "down":              int(_scalar("down")),
            "hibernating":       int(_scalar("hibernating")),
            "health_pct":        round(_scalar("health_pct"), 1),
            "restarts_24h":      int(_scalar("restarts_24h")),
            "trips_24h":         int(_scalar("trips_24h")),
            "approvals_pending": int(_scalar("approvals")),
            "vacation_mode":     bool(_scalar("vacation")),
            "total_memory_mb":   round(_scalar("memory_mb"), 1),
            "avg_latency_ms":    round(_scalar("avg_latency"), 1),
            "query_ms": {k: round(v.duration_ms, 1) for k, v in results.items()},
        }

    async def service_digest(self, service_id: str) -> dict:
        """
        Single-service deep dive — combines 10 queries.
        Used by: /api/services/{id}, service detail panel.
        """
        results = await self.multi_query({
            "state":           QUERIES["svc_state"].format(svc=service_id),
            "avail_24h":       QUERIES["svc_availability_24h"].format(svc=service_id),
            "avail_30d":       QUERIES["svc_availability_30d"].format(svc=service_id),
            "latency":         QUERIES["svc_latency"].format(svc=service_id),
            "memory_mb":       QUERIES["svc_memory"].format(svc=service_id),
            "uptime":          QUERIES["svc_uptime"].format(svc=service_id),
            "idle":            QUERIES["svc_idle"].format(svc=service_id),
            "breaker":         QUERIES["svc_breaker"].format(svc=service_id),
            "restarts_24h":    QUERIES["svc_restarts_24h"].format(svc=service_id),
            "failures_24h":    QUERIES["svc_failures_24h"].format(svc=service_id),
            "restart_attempt": QUERIES["svc_restart_attempt"].format(svc=service_id),
        })

        STATE_NAMES = {0: "down", 1: "up", 2: "degraded", 3: "hibernating",
                       4: "maintenance", 5: "starting"}
        CB_STATE_NAMES = {0: "CLOSED", 1: "OPEN", 2: "HALF_OPEN", 3: "FORCED_OPEN"}

        def _scalar(key, default=0):
            r = results.get(key)
            return r.scalar if r and r.scalar is not None else default

        state_num = int(_scalar("state"))
        cb_num = int(_scalar("breaker"))

        return {
            "service_id":       service_id,
            "state":            STATE_NAMES.get(state_num, "unknown"),
            "state_numeric":    state_num,
            "cb_state":         CB_STATE_NAMES.get(cb_num, "unknown"),
            "cb_state_numeric": cb_num,
            "availability_24h": round(_scalar("avail_24h") * 100, 2),
            "availability_30d": round(_scalar("avail_30d") * 100, 2),
            "latency_ms":       round(_scalar("latency"), 1),
            "memory_mb":        round(_scalar("memory_mb"), 1),
            "uptime_s":         round(_scalar("uptime")),
            "idle_s":           round(_scalar("idle")),
            "restarts_24h":     int(_scalar("restarts_24h")),
            "failures_24h":     int(_scalar("failures_24h")),
            "restart_attempt":  int(_scalar("restart_attempt")),
        }

    async def slo_report(self) -> dict:
        """
        SLO compliance report — availability + error budget for all tiers.
        Used by: weekly digest, SLO dashboard panel, CEO briefing.
        """
        results = await self.multi_query({
            "avail_30d":           QUERIES["availability_30d"],
            "budget_critical":     QUERIES["budget_critical_30d"],
            "budget_business":     QUERIES["budget_business_30d"],
            "budget_support":      QUERIES["budget_support_30d"],
            "burn_critical_1h":    QUERIES["burn_rate_critical_1h"],
            "burn_business_1h":    QUERIES["burn_rate_business_1h"],
        })

        # Parse per-service 30d availability
        avail_result = results.get("avail_30d")
        per_service = {}
        if avail_result and avail_result.data:
            for item in avail_result.data:
                svc = item.get("metric", {}).get("service", "")
                val = item.get("value", [None, None])
                if svc and isinstance(val, list) and len(val) >= 2:
                    try:
                        per_service[svc] = round(float(val[1]) * 100, 3)
                    except (ValueError, TypeError):
                        pass

        def _dict(key):
            r = results.get(key)
            return r.as_dict if r else {}

        return {
            "per_service_availability_30d": per_service,
            "error_budget_consumed": {
                "critical": _dict("budget_critical"),
                "business": _dict("budget_business"),
                "support":  _dict("budget_support"),
            },
            "burn_rate_1h": {
                "critical": _dict("burn_critical_1h"),
                "business": _dict("burn_business_1h"),
            },
            "slo_targets": {
                "critical": 99.5,
                "business": 99.0,
                "support":  95.0,
            },
            "services_breaching_slo": [
                svc for svc, avail in per_service.items()
                if avail < 95.0  # Any service below lowest SLO tier
            ],
        }

    async def telegram_daily_digest(self) -> str:
        """
        Generate a formatted Telegram daily digest message.
        Sent once per day (scheduled) or on-demand via /digest command.
        """
        fleet = await self.fleet_digest()
        slo = await self.slo_report()

        # Emoji for health
        health_emoji = "🟢" if fleet["health_pct"] >= 95 else \
                       "🟡" if fleet["health_pct"] >= 80 else "🔴"

        vac = " 🏖️ VACATION" if fleet["vacation_mode"] else ""

        msg = (
            f"{health_emoji} <b>Daily Fleet Digest</b>{vac}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"📊 <b>Fleet Status</b>\n"
            f"  ✅ Healthy: {fleet['healthy']}/{fleet['total_services']} "
            f"({fleet['health_pct']}%)\n"
        )

        if fleet["degraded"]:
            msg += f"  ⚠️ Degraded: {fleet['degraded']}\n"
        if fleet["down"]:
            msg += f"  🔴 Down: {fleet['down']}\n"
        if fleet["hibernating"]:
            msg += f"  💤 Hibernating: {fleet['hibernating']}\n"

        msg += (
            f"\n🔄 <b>Activity (24h)</b>\n"
            f"  Restarts: {fleet['restarts_24h']}\n"
            f"  CB Trips: {fleet['trips_24h']}\n"
        )

        if fleet["approvals_pending"]:
            msg += f"  ⏳ Approvals Pending: {fleet['approvals_pending']}\n"

        msg += (
            f"\n💾 <b>Resources</b>\n"
            f"  Memory: {fleet['total_memory_mb']} MB\n"
            f"  Avg Latency: {fleet['avg_latency_ms']} ms\n"
        )

        # SLO breaches
        breaching = slo.get("services_breaching_slo", [])
        if breaching:
            msg += (
                f"\n🚨 <b>SLO Breaches</b>\n"
                f"  {', '.join(breaching)}\n"
            )

        return msg
