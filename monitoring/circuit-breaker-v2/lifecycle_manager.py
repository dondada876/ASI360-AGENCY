"""
lifecycle_manager.py — Active service lifecycle management.

This is the upgrade from passive monitoring to active management:
- Auto-restart ALWAYS_ON services with exponential backoff
- Hibernate idle ON_DEMAND services
- Wake ON_DEMAND services on tool call
- Enforce VACATION mode (only critical services stay up)
- Track restart attempts and escalate to Telegram

Industry patterns:
- Netflix Hystrix exponential backoff
- Kubernetes restart policy (CrashLoopBackOff equivalent)
- Istio circuit breaker with outlier detection
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field, asdict
from typing import Optional

from event_store import EventStore, ServiceEvent
from service_control import control_service, get_service_status

log = logging.getLogger("lifecycle")


@dataclass
class RestartTracker:
    """Tracks restart attempts with exponential backoff."""
    service_id: str
    attempt: int = 0
    max_attempts: int = 5
    backoff_base_s: float = 5.0
    backoff_cap_s: float = 120.0
    last_attempt_ts: float = 0.0
    last_success_ts: float = 0.0
    escalated: bool = False         # True if Telegram alert sent
    approval_pending: bool = False  # True if waiting for CEO approval

    @property
    def next_delay_s(self) -> float:
        """Exponential backoff: base * 2^attempt, capped."""
        delay = self.backoff_base_s * (2 ** self.attempt)
        return min(delay, self.backoff_cap_s)

    @property
    def can_restart(self) -> bool:
        """Check if enough time has passed for next attempt."""
        if self.approval_pending:
            return False
        if self.attempt >= self.max_attempts:
            return False
        elapsed = time.time() - self.last_attempt_ts
        return elapsed >= self.next_delay_s

    def record_attempt(self):
        self.attempt += 1
        self.last_attempt_ts = time.time()

    def record_success(self):
        self.attempt = 0
        self.last_success_ts = time.time()
        self.escalated = False
        self.approval_pending = False

    def reset(self):
        self.attempt = 0
        self.last_attempt_ts = 0.0
        self.escalated = False
        self.approval_pending = False


class LifecycleManager:
    """
    Active service lifecycle management.

    Responsibilities:
    - Auto-restart ALWAYS_ON services that go down
    - Hibernate idle ON_DEMAND services after timeout
    - Wake ON_DEMAND services when tool calls arrive
    - Enforce vacation mode
    - Track and escalate restart failures
    """

    def __init__(self, services: list, event_store: EventStore,
                 telegram_callback=None):
        self.services = {s["id"]: s for s in services}
        self.events = event_store
        self.telegram_callback = telegram_callback

        # Restart tracking per service
        self._restart_trackers: dict[str, RestartTracker] = {}
        for s in services:
            self._restart_trackers[s["id"]] = RestartTracker(
                service_id=s["id"],
                max_attempts=s.get("max_restart_attempts", 5),
                backoff_base_s=s.get("restart_backoff_base_s", 5),
            )

        # Idle tracking (unix timestamp of last activity)
        self._last_activity: dict[str, float] = {
            s["id"]: time.time() for s in services
        }

        # Vacation mode
        self.vacation_mode = False
        self.vacation_reason = ""
        self.vacation_started_at = 0.0

        # Previous run mode (for restoring after maintenance/vacation)
        self._saved_modes: dict[str, str] = {}

    # ── Auto-Restart Logic ─────────────────────────────────────────

    async def check_and_restart(self, service_id: str, is_active: bool,
                                cb_state: str):
        """
        Called on each health check cycle. Decides whether to auto-restart.

        Rules:
        1. Only restart if run_mode == "always_on"
        2. Don't restart if in MAINTENANCE or VACATION (non-critical)
        3. Use exponential backoff between attempts
        4. After max_attempts, escalate via Telegram
        5. Require approval for attempts 4+
        """
        svc = self.services.get(service_id)
        if not svc:
            return

        tracker = self._restart_trackers[service_id]
        mode = svc["run_mode"]

        # Service is healthy — reset tracker
        if is_active and cb_state == "CLOSED":
            if tracker.attempt > 0:
                log.info(f"[lifecycle:{service_id}] Recovered after "
                         f"{tracker.attempt} restart attempts")
                self.events.record(ServiceEvent(
                    service_id=service_id,
                    event_type="recover",
                    success=True,
                    details=f"Recovered after {tracker.attempt} attempts",
                    trigger="auto",
                    actor="system",
                ))
            tracker.record_success()
            return

        # Service is down — should we restart?
        if mode == "always_on" and not is_active:
            # Skip if in maintenance
            if mode == "maintenance":
                return

            # Skip if vacation and not critical
            if self.vacation_mode and not svc.get("critical", False):
                return

            # Skip if manually tripped
            if cb_state == "FORCED_OPEN":
                return

            # Check if we can attempt restart
            if not tracker.can_restart:
                return

            # Attempts 4+ require approval
            if tracker.attempt >= 3 and not tracker.escalated:
                await self._escalate(service_id, tracker)
                return

            # Attempt restart
            await self._do_restart(service_id, tracker)

    async def _do_restart(self, service_id: str, tracker: RestartTracker):
        """Execute a restart attempt."""
        svc = self.services[service_id]
        tracker.record_attempt()
        delay = tracker.next_delay_s

        log.warning(f"[lifecycle:{service_id}] Auto-restart attempt "
                    f"{tracker.attempt}/{tracker.max_attempts} "
                    f"(backoff: {delay:.0f}s)")

        self.events.record(ServiceEvent(
            service_id=service_id,
            event_type="restart",
            success=False,  # Will be updated on next health check
            details=f"Auto-restart attempt {tracker.attempt}/{tracker.max_attempts}",
            trigger="auto",
            actor="system",
        ))

        result = control_service(svc, "start")

        if result.get("ok"):
            log.info(f"[lifecycle:{service_id}] Restart command sent successfully")
            # Don't mark success yet — wait for next health check
        else:
            log.error(f"[lifecycle:{service_id}] Restart failed: "
                      f"{result.get('message')}")
            self.events.record(ServiceEvent(
                service_id=service_id,
                event_type="restart",
                success=False,
                details=f"Restart command failed: {result.get('message', '')}",
                trigger="auto",
                actor="system",
            ))

    async def _escalate(self, service_id: str, tracker: RestartTracker):
        """Send Telegram alert after max auto-restart attempts."""
        tracker.escalated = True
        tracker.approval_pending = True

        message = (
            f"🔴 <b>RESTART ESCALATION</b>\n\n"
            f"Service: <code>{service_id}</code>\n"
            f"Failed {tracker.attempt} auto-restart attempts\n"
            f"Backoff exhausted at {tracker.backoff_cap_s}s\n\n"
            f"Reply:\n"
            f"/approve_{service_id} — Retry restart\n"
            f"/deny_{service_id} — Leave down, will investigate\n"
            f"/maintenance_{service_id} — Put in maintenance mode"
        )

        log.critical(f"[lifecycle:{service_id}] Escalating to Telegram "
                     f"after {tracker.attempt} failed restarts")

        self.events.record(ServiceEvent(
            service_id=service_id,
            event_type="escalate",
            success=False,
            details=f"Escalated after {tracker.attempt} failed restarts",
            trigger="auto",
            actor="system",
        ))

        if self.telegram_callback:
            await self.telegram_callback(message)

    def approve_restart(self, service_id: str):
        """CEO approved restart via Telegram."""
        tracker = self._restart_trackers.get(service_id)
        if tracker:
            tracker.approval_pending = False
            tracker.attempt = 0  # Reset counter for fresh round
            tracker.escalated = False
            log.info(f"[lifecycle:{service_id}] Restart approved by CEO")
            self.events.record(ServiceEvent(
                service_id=service_id,
                event_type="approve",
                success=True,
                details="Restart approved by CEO",
                trigger="manual",
                actor="ceo",
            ))

    def deny_restart(self, service_id: str):
        """CEO denied restart — leave service down."""
        tracker = self._restart_trackers.get(service_id)
        if tracker:
            tracker.approval_pending = False
            tracker.escalated = True  # Don't re-escalate
            log.info(f"[lifecycle:{service_id}] Restart denied by CEO")
            self.events.record(ServiceEvent(
                service_id=service_id,
                event_type="deny",
                success=True,
                details="Restart denied by CEO — will not auto-restart",
                trigger="manual",
                actor="ceo",
            ))

    # ── Idle Detection & Hibernation ───────────────────────────────

    def record_activity(self, service_id: str):
        """Record that a service was used (tool call, webhook, etc.)."""
        self._last_activity[service_id] = time.time()

    def get_idle_seconds(self, service_id: str) -> float:
        """How many seconds since last activity."""
        last = self._last_activity.get(service_id, 0)
        return time.time() - last if last else float("inf")

    async def check_and_hibernate(self, service_id: str, is_active: bool):
        """
        Check if an ON_DEMAND service should be hibernated.

        Rules:
        1. Only hibernate if run_mode == "on_demand"
        2. Only if service is currently active
        3. Only if idle time exceeds idle_timeout_s
        """
        svc = self.services.get(service_id)
        if not svc or svc["run_mode"] != "on_demand":
            return

        if not is_active:
            return  # Already down

        idle_timeout = svc.get("idle_timeout_s", 300)
        idle_time = self.get_idle_seconds(service_id)

        if idle_time >= idle_timeout:
            log.info(f"[lifecycle:{service_id}] Idle for {idle_time:.0f}s "
                     f"(threshold: {idle_timeout}s) — hibernating")

            result = control_service(svc, "stop")

            self.events.record(ServiceEvent(
                service_id=service_id,
                event_type="hibernate",
                success=result.get("ok", False),
                details=f"Hibernated after {idle_time:.0f}s idle",
                trigger="auto",
                actor="system",
            ))

    # ── Wake-on-Call ───────────────────────────────────────────────

    async def wake_service(self, service_id: str, trigger: str = "tool_call",
                           actor: str = "gateway") -> dict:
        """
        Wake an ON_DEMAND service. Returns {ok, wait_s, message}.

        Called by the gateway when a tool call arrives for a hibernating service.
        """
        svc = self.services.get(service_id)
        if not svc:
            return {"ok": False, "wait_s": 0, "message": "Unknown service"}

        self.record_activity(service_id)

        log.info(f"[lifecycle:{service_id}] Waking for {trigger} "
                 f"(estimated startup: {svc.get('estimated_startup_s', 10)}s)")

        result = control_service(svc, "start")

        self.events.record(ServiceEvent(
            service_id=service_id,
            event_type="wake",
            success=result.get("ok", False),
            details=f"Woken by {trigger} from {actor}",
            trigger=trigger,
            actor=actor,
        ))

        if result.get("ok"):
            return {
                "ok": True,
                "wait_s": svc.get("startup_grace_s", 10),
                "message": f"Starting {service_id}, ready in ~{svc.get('estimated_startup_s', 10)}s",
            }
        else:
            return {
                "ok": False,
                "wait_s": 0,
                "message": f"Failed to start: {result.get('message', '')}",
            }

    # ── Vacation Mode ──────────────────────────────────────────────

    async def enter_vacation(self, reason: str = "CEO away"):
        """
        Enter vacation mode:
        - Stop all non-critical services
        - Only critical ALWAYS_ON services keep running
        - Suppress non-critical alerts
        """
        from services_config_v2 import VACATION_KEEP_ALIVE

        self.vacation_mode = True
        self.vacation_reason = reason
        self.vacation_started_at = time.time()

        log.warning(f"[lifecycle] VACATION MODE ON: {reason}")
        self.events.record(ServiceEvent(
            service_id="__global__",
            event_type="vacation_on",
            success=True,
            details=f"Vacation mode enabled: {reason}",
            trigger="manual",
            actor="ceo",
        ))

        stopped = []
        for sid, svc in self.services.items():
            if sid in VACATION_KEEP_ALIVE:
                continue
            # Save current mode for restore
            self._saved_modes[sid] = svc["run_mode"]
            # Stop the service
            result = control_service(svc, "stop")
            if result.get("ok"):
                stopped.append(sid)

        log.info(f"[lifecycle] Vacation: stopped {len(stopped)} services, "
                 f"keeping {len(VACATION_KEEP_ALIVE)} critical")

        return {
            "stopped": stopped,
            "kept_alive": VACATION_KEEP_ALIVE,
            "message": f"Vacation mode: {len(stopped)} services hibernated",
        }

    async def exit_vacation(self):
        """
        Exit vacation mode:
        - Restore all services to their previous run mode
        - Restart ALWAYS_ON services that were stopped
        """
        self.vacation_mode = False
        self.vacation_reason = ""

        log.warning("[lifecycle] VACATION MODE OFF")
        self.events.record(ServiceEvent(
            service_id="__global__",
            event_type="vacation_off",
            success=True,
            details="Vacation mode disabled",
            trigger="manual",
            actor="ceo",
        ))

        restarted = []
        for sid, saved_mode in self._saved_modes.items():
            svc = self.services.get(sid)
            if not svc:
                continue
            svc["run_mode"] = saved_mode
            if saved_mode == "always_on":
                result = control_service(svc, "start")
                if result.get("ok"):
                    restarted.append(sid)

        self._saved_modes.clear()
        log.info(f"[lifecycle] Restored {len(restarted)} services from vacation")

        return {
            "restarted": restarted,
            "message": f"Vacation ended: {len(restarted)} services restored",
        }

    # ── Maintenance Mode ───────────────────────────────────────────

    def enter_maintenance(self, service_id: str, reason: str = "",
                          duration_h: float = 4.0):
        """Put a single service into maintenance mode."""
        svc = self.services.get(service_id)
        if not svc:
            return {"ok": False, "message": "Unknown service"}

        self._saved_modes[service_id] = svc["run_mode"]
        svc["run_mode"] = "maintenance"

        self.events.record(ServiceEvent(
            service_id=service_id,
            event_type="mode_change",
            success=True,
            details=f"Entered maintenance: {reason} (auto-exit in {duration_h}h)",
            trigger="manual",
            actor="ceo",
        ))

        # Reset restart tracker
        tracker = self._restart_trackers.get(service_id)
        if tracker:
            tracker.reset()

        return {
            "ok": True,
            "previous_mode": self._saved_modes[service_id],
            "duration_h": duration_h,
            "message": f"{service_id} in maintenance for {duration_h}h",
        }

    def exit_maintenance(self, service_id: str):
        """Restore a service from maintenance to its previous mode."""
        svc = self.services.get(service_id)
        if not svc:
            return {"ok": False, "message": "Unknown service"}

        previous = self._saved_modes.pop(service_id, "manual")
        svc["run_mode"] = previous

        self.events.record(ServiceEvent(
            service_id=service_id,
            event_type="mode_change",
            success=True,
            details=f"Exited maintenance, restored to {previous}",
            trigger="manual",
            actor="ceo",
        ))

        return {"ok": True, "restored_mode": previous}

    # ── Mode Change ────────────────────────────────────────────────

    def change_mode(self, service_id: str, new_mode: str, reason: str = ""):
        """Change a service's run mode."""
        svc = self.services.get(service_id)
        if not svc:
            return {"ok": False, "message": "Unknown service"}

        old_mode = svc["run_mode"]
        if old_mode == new_mode:
            return {"ok": True, "message": f"Already in {new_mode}"}

        svc["run_mode"] = new_mode

        self.events.record(ServiceEvent(
            service_id=service_id,
            event_type="mode_change",
            success=True,
            details=f"Mode: {old_mode} → {new_mode}. {reason}",
            trigger="manual",
            actor="ceo",
        ))

        # Reset restart tracker on mode change
        tracker = self._restart_trackers.get(service_id)
        if tracker:
            tracker.reset()

        return {
            "ok": True,
            "old_mode": old_mode,
            "new_mode": new_mode,
            "message": f"{service_id}: {old_mode} → {new_mode}",
        }

    # ── Serialization ──────────────────────────────────────────────

    def get_state(self) -> dict:
        """Serialize full lifecycle state for persistence."""
        return {
            "vacation_mode": self.vacation_mode,
            "vacation_reason": self.vacation_reason,
            "vacation_started_at": self.vacation_started_at,
            "saved_modes": self._saved_modes,
            "restart_trackers": {
                sid: asdict(t) for sid, t in self._restart_trackers.items()
            },
            "last_activity": self._last_activity,
        }

    def load_state(self, data: dict):
        """Restore lifecycle state from persistence."""
        self.vacation_mode = data.get("vacation_mode", False)
        self.vacation_reason = data.get("vacation_reason", "")
        self.vacation_started_at = data.get("vacation_started_at", 0)
        self._saved_modes = data.get("saved_modes", {})
        self._last_activity = data.get("last_activity", {})
        for sid, td in data.get("restart_trackers", {}).items():
            if sid in self._restart_trackers:
                t = self._restart_trackers[sid]
                for k, v in td.items():
                    if hasattr(t, k):
                        setattr(t, k, v)
