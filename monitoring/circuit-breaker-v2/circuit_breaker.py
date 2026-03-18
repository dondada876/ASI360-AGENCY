"""
circuit_breaker.py — Enhanced Circuit Breaker state machine (v2).

Upgrade from v1:
- New states: FORCED_OPEN, HIBERNATING, STARTING, DEGRADED
- Sliding window (count-based) failure detection
- Integration with Prometheus metrics
- Latency-based degradation detection
- Dependency-aware blocking

State machine:
    CLOSED ──(failures >= threshold)──→ OPEN
    OPEN ──(cooldown elapsed)──→ HALF_OPEN
    HALF_OPEN ──(2 successes)──→ CLOSED
    HALF_OPEN ──(1 failure)──→ OPEN

    Any ──(manual_trip)──→ FORCED_OPEN  (requires explicit reset)
    Any ──(hibernate)──→ HIBERNATING     (ON_DEMAND idle timeout)
    Any ──(starting)──→ STARTING         (within startup grace period)
    CLOSED ──(latency > threshold)──→ DEGRADED
    DEGRADED ──(latency normalizes)──→ CLOSED

Research-validated defaults (Resilience4j):
- Sliding window: COUNT_BASED, size 10
- Min calls before eval: 5
- Failure rate threshold: 50% (5/10)
- Permitted calls in half-open: 2
"""

import json
import logging
import time
from collections import deque
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional

log = logging.getLogger("cb")

STATE_FILE = Path("/opt/mcp-circuit-breaker/cb_state.json")

# ── States ────────────────────────────────────────────────────────────

CLOSED = "CLOSED"
OPEN = "OPEN"
HALF_OPEN = "HALF_OPEN"
FORCED_OPEN = "FORCED_OPEN"
HIBERNATING = "HIBERNATING"
STARTING = "STARTING"
DEGRADED = "DEGRADED"

VALID_STATES = {CLOSED, OPEN, HALF_OPEN, FORCED_OPEN, HIBERNATING, STARTING, DEGRADED}

# State → numeric for Prometheus gauge
STATE_NUMERIC = {
    CLOSED: 0, OPEN: 1, HALF_OPEN: 2, FORCED_OPEN: 3,
}

# ── Sliding Window ────────────────────────────────────────────────────

@dataclass
class HealthResult:
    """A single health check result in the sliding window."""
    timestamp: float
    success: bool
    latency_ms: float = 0.0
    error: str = ""


class SlidingWindow:
    """
    Count-based sliding window for failure rate detection.
    Matches Resilience4j COUNT_BASED window (default size 10).
    """
    def __init__(self, size: int = 10):
        self.size = size
        self._results: deque[HealthResult] = deque(maxlen=size)

    def record(self, result: HealthResult):
        self._results.append(result)

    @property
    def count(self) -> int:
        return len(self._results)

    @property
    def failure_count(self) -> int:
        return sum(1 for r in self._results if not r.success)

    @property
    def success_count(self) -> int:
        return sum(1 for r in self._results if r.success)

    @property
    def failure_rate(self) -> float:
        """Failure rate as percentage (0-100)."""
        if self.count == 0:
            return 0.0
        return (self.failure_count / self.count) * 100

    @property
    def avg_latency_ms(self) -> float:
        successes = [r.latency_ms for r in self._results if r.success and r.latency_ms > 0]
        return sum(successes) / len(successes) if successes else 0.0

    @property
    def last_result(self) -> Optional[HealthResult]:
        return self._results[-1] if self._results else None

    def clear(self):
        self._results.clear()


# ── Circuit Breaker Instance ──────────────────────────────────────────

class CircuitBreaker:
    """
    Per-service circuit breaker with enhanced state machine.

    Lifecycle:
        1. STARTING → grace period → CLOSED (if healthy) or OPEN (if unhealthy)
        2. CLOSED → tracks failures → OPEN when failure_rate >= threshold
        3. OPEN → waits cooldown → HALF_OPEN
        4. HALF_OPEN → 2 consecutive successes → CLOSED; 1 failure → OPEN
        5. DEGRADED → latency too high but reachable → auto-recovers when latency drops
        6. HIBERNATING → ON_DEMAND service stopped due to idle
        7. FORCED_OPEN → manual trip, requires explicit reset
    """

    def __init__(self, service_id: str, failure_threshold: int = 5,
                 cooldown_s: float = 300, window_size: int = 10,
                 min_calls: int = 5, half_open_permits: int = 2,
                 degraded_latency_ms: float = 5000.0):
        self.service_id = service_id
        self.failure_threshold = failure_threshold
        self.cooldown_s = cooldown_s
        self.min_calls = min_calls
        self.half_open_permits = half_open_permits
        self.degraded_latency_ms = degraded_latency_ms

        # State
        self.state = CLOSED
        self.state_changed_at = time.time()

        # Sliding window
        self.window = SlidingWindow(size=window_size)

        # Half-open tracking
        self._half_open_successes = 0
        self._half_open_calls = 0

        # Counters (lifetime, for Prometheus)
        self.total_failures = 0
        self.total_trips = 0
        self.total_recoveries = 0

        # Last check info
        self.last_check_ts = 0.0
        self.last_latency_ms = 0.0
        self.last_error = ""

    # ── State Transitions ─────────────────────────────────────────

    def _set_state(self, new_state: str):
        """Change state with logging."""
        if new_state == self.state:
            return
        old = self.state
        self.state = new_state
        self.state_changed_at = time.time()
        log.info(f"[cb:{self.service_id}] {old} → {new_state}")

    def record_success(self, latency_ms: float = 0.0):
        """Record a successful health check."""
        self.last_check_ts = time.time()
        self.last_latency_ms = latency_ms
        self.last_error = ""

        result = HealthResult(
            timestamp=time.time(),
            success=True,
            latency_ms=latency_ms,
        )
        self.window.record(result)

        if self.state == CLOSED:
            # Check for degradation
            if latency_ms > 0 and latency_ms > self.degraded_latency_ms:
                self._set_state(DEGRADED)
            return

        if self.state == DEGRADED:
            # Recover from degraded if latency is good
            if latency_ms <= self.degraded_latency_ms:
                self._set_state(CLOSED)
            return

        if self.state == HALF_OPEN:
            self._half_open_successes += 1
            self._half_open_calls += 1
            if self._half_open_successes >= self.half_open_permits:
                # Recovery! Back to CLOSED
                self._set_state(CLOSED)
                self.total_recoveries += 1
                self.window.clear()
                self._half_open_successes = 0
                self._half_open_calls = 0
                log.info(f"[cb:{self.service_id}] RECOVERED — circuit closed")
            return

        if self.state == STARTING:
            # Startup complete — move to CLOSED
            self._set_state(CLOSED)
            self.window.clear()
            return

        if self.state == HIBERNATING:
            # Was hibernating, now responding — wake up
            self._set_state(CLOSED)
            self.window.clear()
            return

    def record_failure(self, error: str = "", latency_ms: float = 0.0):
        """Record a failed health check."""
        self.last_check_ts = time.time()
        self.last_latency_ms = latency_ms
        self.last_error = error
        self.total_failures += 1

        result = HealthResult(
            timestamp=time.time(),
            success=False,
            latency_ms=latency_ms,
            error=error,
        )
        self.window.record(result)

        if self.state in (FORCED_OPEN, HIBERNATING, STARTING):
            return  # Don't trip from these states

        if self.state == HALF_OPEN:
            # Any failure in half-open → back to OPEN
            self._set_state(OPEN)
            self._half_open_successes = 0
            self._half_open_calls = 0
            return

        if self.state in (CLOSED, DEGRADED):
            # Check if we should trip
            if (self.window.count >= self.min_calls and
                    self.window.failure_rate >= (self.failure_threshold / self.window.size * 100)):
                self._trip()
            return

    def _trip(self):
        """Trip the circuit: CLOSED/DEGRADED → OPEN."""
        self._set_state(OPEN)
        self.total_trips += 1
        log.warning(f"[cb:{self.service_id}] TRIPPED — "
                    f"failure rate {self.window.failure_rate:.0f}% "
                    f"({self.window.failure_count}/{self.window.count})")

    def check_cooldown(self):
        """
        Called periodically. If OPEN and cooldown elapsed, move to HALF_OPEN.
        """
        if self.state != OPEN:
            return

        elapsed = time.time() - self.state_changed_at
        if elapsed >= self.cooldown_s:
            self._set_state(HALF_OPEN)
            self._half_open_successes = 0
            self._half_open_calls = 0
            log.info(f"[cb:{self.service_id}] Cooldown expired — probing (HALF_OPEN)")

    @property
    def cooldown_remaining_s(self) -> float:
        """Seconds until OPEN → HALF_OPEN transition."""
        if self.state != OPEN:
            return 0.0
        elapsed = time.time() - self.state_changed_at
        return max(0.0, self.cooldown_s - elapsed)

    # ── Manual Controls ───────────────────────────────────────────

    def manual_trip(self, reason: str = ""):
        """Manually force the circuit open. Requires explicit reset."""
        self._set_state(FORCED_OPEN)
        self.last_error = reason or "Manually tripped"
        log.warning(f"[cb:{self.service_id}] FORCED OPEN: {self.last_error}")

    def manual_reset(self):
        """Reset from FORCED_OPEN or OPEN to CLOSED."""
        if self.state in (FORCED_OPEN, OPEN):
            self._set_state(CLOSED)
            self.window.clear()
            self._half_open_successes = 0
            self._half_open_calls = 0
            log.info(f"[cb:{self.service_id}] Manual reset → CLOSED")

    def set_hibernating(self):
        """Mark as hibernating (ON_DEMAND idle timeout)."""
        self._set_state(HIBERNATING)

    def set_starting(self):
        """Mark as starting (within startup grace period)."""
        self._set_state(STARTING)

    # ── Serialization ─────────────────────────────────────────────

    def to_dict(self) -> dict:
        return {
            "state": self.state,
            "state_changed_at": self.state_changed_at,
            "total_failures": self.total_failures,
            "total_trips": self.total_trips,
            "total_recoveries": self.total_recoveries,
            "last_check_ts": self.last_check_ts,
            "last_latency_ms": self.last_latency_ms,
            "last_error": self.last_error,
            "window_failure_rate": self.window.failure_rate,
            "window_count": self.window.count,
            "cooldown_remaining_s": self.cooldown_remaining_s,
        }

    def load_dict(self, data: dict):
        self.state = data.get("state", CLOSED)
        self.state_changed_at = data.get("state_changed_at", time.time())
        self.total_failures = data.get("total_failures", 0)
        self.total_trips = data.get("total_trips", 0)
        self.total_recoveries = data.get("total_recoveries", 0)
        self.last_check_ts = data.get("last_check_ts", 0)
        self.last_latency_ms = data.get("last_latency_ms", 0)
        self.last_error = data.get("last_error", "")


# ── Registry ──────────────────────────────────────────────────────────

class CircuitBreakerRegistry:
    """
    Manages all circuit breakers with persistence.
    """

    def __init__(self, services: list):
        self.breakers: dict[str, CircuitBreaker] = {}
        for svc in services:
            self.breakers[svc["id"]] = CircuitBreaker(
                service_id=svc["id"],
                failure_threshold=svc.get("cb_failure_threshold", 5),
                cooldown_s=svc.get("cb_cooldown_s", 300),
                window_size=10,
                min_calls=5,
                half_open_permits=2,
                degraded_latency_ms=svc.get("degraded_latency_ms", 5000.0),
            )

    def get(self, service_id: str) -> Optional[CircuitBreaker]:
        return self.breakers.get(service_id)

    def check_cooldowns(self):
        """Check all breakers for cooldown expiry. Call in health loop."""
        for cb in self.breakers.values():
            cb.check_cooldown()

    def summary(self) -> dict:
        """Get state summary for all breakers."""
        states = {}
        for sid, cb in self.breakers.items():
            states[sid] = cb.state
        return states

    def counts_by_state(self) -> dict[str, int]:
        """Count breakers in each state."""
        counts = {}
        for cb in self.breakers.values():
            counts[cb.state] = counts.get(cb.state, 0) + 1
        return counts

    # ── Persistence ───────────────────────────────────────────────

    def save(self):
        """Persist all breaker states to disk."""
        try:
            data = {sid: cb.to_dict() for sid, cb in self.breakers.items()}
            STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
            STATE_FILE.write_text(json.dumps(data, indent=2))
        except Exception as e:
            log.warning(f"CB state save failed: {e}")

    def load(self):
        """Load breaker states from disk."""
        if not STATE_FILE.exists():
            return
        try:
            data = json.loads(STATE_FILE.read_text())
            for sid, cbd in data.items():
                cb = self.breakers.get(sid)
                if cb:
                    cb.load_dict(cbd)
            log.info(f"Loaded CB state for {len(data)} services")
        except Exception as e:
            log.warning(f"CB state load failed: {e}")
