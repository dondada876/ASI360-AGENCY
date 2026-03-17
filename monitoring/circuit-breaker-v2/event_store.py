"""
event_store.py — Service event history tracking.

Stores the last N events per service for dashboard display and audit trail.
- Last 100 events per service in memory
- Last 20 per service persisted to JSON
- Global event stream for Grafana annotations
"""

import json
import time
import logging
from collections import deque
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

log = logging.getLogger("events")

EVENTS_FILE = Path("/opt/mcp-circuit-breaker/cb_events.json")
MAX_MEMORY_EVENTS = 100   # Per service, in memory
MAX_PERSIST_EVENTS = 20   # Per service, on disk
MAX_GLOBAL_EVENTS = 500   # Global stream


@dataclass
class ServiceEvent:
    """A single event in a service's lifecycle."""
    service_id: str = ""
    event_type: str = ""        # health_check, restart, hibernate, wake, trip,
                                # recover, mode_change, escalate, approve, deny,
                                # vacation_on, vacation_off
    success: bool = True
    details: str = ""           # Human-readable description
    duration_ms: int = 0        # How long the action took
    trigger: str = "auto"       # auto, manual, on_demand, scheduled, webhook
    actor: str = "system"       # system, ceo, telegram, gateway
    timestamp: float = 0.0      # Unix timestamp (auto-filled if 0)

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = time.time()

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "ServiceEvent":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


class EventStore:
    """
    Rolling event store with per-service and global views.

    Usage:
        store = EventStore()
        store.record(ServiceEvent(service_id="mcp-gateway", event_type="restart", ...))
        last_3 = store.last_n("mcp-gateway", n=3)
        global_stream = store.global_stream(n=50)
    """

    def __init__(self):
        # Per-service event queues
        self._events: dict[str, deque] = {}
        # Global ordered stream (all services)
        self._global: deque = deque(maxlen=MAX_GLOBAL_EVENTS)

    def record(self, event: ServiceEvent):
        """Record a new event."""
        sid = event.service_id

        # Per-service queue
        if sid not in self._events:
            self._events[sid] = deque(maxlen=MAX_MEMORY_EVENTS)
        self._events[sid].append(event)

        # Global stream
        self._global.append(event)

        log.info(f"[event:{sid}] {event.event_type} "
                 f"{'✅' if event.success else '❌'} "
                 f"{event.details[:60]}")

    def last_n(self, service_id: str, n: int = 3) -> list[dict]:
        """Get last N events for a service."""
        q = self._events.get(service_id, deque())
        events = list(q)[-n:]
        return [e.to_dict() for e in events]

    def all_events(self, service_id: str) -> list[dict]:
        """Get all events for a service (up to MAX_MEMORY_EVENTS)."""
        q = self._events.get(service_id, deque())
        return [e.to_dict() for e in q]

    def global_stream(self, n: int = 50,
                      event_type: Optional[str] = None,
                      service_id: Optional[str] = None) -> list[dict]:
        """Get global event stream, optionally filtered."""
        events = list(self._global)
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        if service_id:
            events = [e for e in events if e.service_id == service_id]
        return [e.to_dict() for e in events[-n:]]

    def stats(self, service_id: str) -> dict:
        """Get summary stats for a service."""
        events = list(self._events.get(service_id, deque()))
        if not events:
            return {
                "total_events": 0,
                "restarts": 0,
                "failures": 0,
                "recoveries": 0,
                "hibernations": 0,
                "wakes": 0,
                "last_event": None,
            }

        return {
            "total_events": len(events),
            "restarts": sum(1 for e in events if e.event_type == "restart"),
            "failures": sum(1 for e in events if not e.success),
            "recoveries": sum(1 for e in events if e.event_type == "recover"),
            "hibernations": sum(1 for e in events if e.event_type == "hibernate"),
            "wakes": sum(1 for e in events if e.event_type == "wake"),
            "last_event": events[-1].to_dict() if events else None,
        }

    def global_stats(self) -> dict:
        """Portfolio-wide event stats."""
        events = list(self._global)
        now = time.time()
        last_24h = [e for e in events if (now - e.timestamp) < 86400]
        last_1h = [e for e in events if (now - e.timestamp) < 3600]

        return {
            "total_events": len(events),
            "events_24h": len(last_24h),
            "events_1h": len(last_1h),
            "restarts_24h": sum(1 for e in last_24h if e.event_type == "restart"),
            "failures_24h": sum(1 for e in last_24h if not e.success),
            "hibernations_24h": sum(1 for e in last_24h if e.event_type == "hibernate"),
            "wakes_24h": sum(1 for e in last_24h if e.event_type == "wake"),
            "escalations_24h": sum(1 for e in last_24h if e.event_type == "escalate"),
        }

    # ── Persistence ────────────────────────────────────────────────

    def save(self):
        """Persist last N events per service to disk."""
        try:
            data = {}
            for sid, q in self._events.items():
                events = list(q)[-MAX_PERSIST_EVENTS:]
                data[sid] = [e.to_dict() for e in events]

            EVENTS_FILE.parent.mkdir(parents=True, exist_ok=True)
            EVENTS_FILE.write_text(json.dumps(data, indent=2))
        except Exception as e:
            log.warning(f"Event store save failed: {e}")

    def load(self):
        """Load persisted events."""
        if not EVENTS_FILE.exists():
            return
        try:
            data = json.loads(EVENTS_FILE.read_text())
            for sid, events in data.items():
                self._events[sid] = deque(maxlen=MAX_MEMORY_EVENTS)
                for ed in events:
                    event = ServiceEvent.from_dict(ed)
                    self._events[sid].append(event)
                    self._global.append(event)
            log.info(f"Loaded events for {len(data)} services")
        except Exception as e:
            log.warning(f"Event store load failed: {e}")
