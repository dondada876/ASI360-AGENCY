"""
dependencies.py — Service dependency graph and cascade failure detection.

Prevents false failures: if gateway is down, all tools are BLOCKED not FAILED.
Provides dependency tree visualization data for Grafana node graph panel.
"""

import logging
from typing import Optional

log = logging.getLogger("deps")


class DependencyGraph:
    """
    Manages service dependency relationships.

    Rules:
    - If a dependency is down, dependents are BLOCKED
    - BLOCKED services don't increment failure counters
    - Cascade detection: find all services affected by one failure
    """

    def __init__(self, dependencies: dict[str, list[str]]):
        """
        Args:
            dependencies: {service_id: [list of service_ids it depends on]}
        """
        self.deps = dependencies
        # Build reverse map: {dep: [services that depend on it]}
        self.reverse: dict[str, list[str]] = {}
        for svc, dep_list in dependencies.items():
            for dep in dep_list:
                self.reverse.setdefault(dep, []).append(svc)

    def get_dependencies(self, service_id: str) -> list[str]:
        """What does this service depend on?"""
        return self.deps.get(service_id, [])

    def get_dependents(self, service_id: str) -> list[str]:
        """What services depend on this one?"""
        return self.reverse.get(service_id, [])

    def is_blocked(self, service_id: str,
                   active_services: set[str]) -> Optional[str]:
        """
        Check if a service is blocked by a failed dependency.

        Returns:
            Name of the blocking dependency, or None if not blocked.
        """
        for dep in self.deps.get(service_id, []):
            if dep not in active_services:
                return dep
        return None

    def cascade_impact(self, failed_service: str) -> list[str]:
        """
        If this service goes down, what else is affected?
        Returns full transitive closure of dependents.
        """
        affected = set()
        queue = [failed_service]

        while queue:
            current = queue.pop(0)
            for dependent in self.reverse.get(current, []):
                if dependent not in affected:
                    affected.add(dependent)
                    queue.append(dependent)

        return sorted(affected)

    def dependency_tree(self, service_id: str, depth: int = 0,
                        visited: set = None) -> dict:
        """
        Build a tree structure for visualization.

        Returns:
            {"id": "service", "deps": [{"id": "dep1", "deps": [...]}, ...]}
        """
        if visited is None:
            visited = set()

        if service_id in visited:
            return {"id": service_id, "deps": [], "circular": True}

        visited.add(service_id)
        children = []
        for dep in self.deps.get(service_id, []):
            children.append(self.dependency_tree(dep, depth + 1, visited.copy()))

        return {"id": service_id, "deps": children}

    def to_graph_data(self, active_services: set[str]) -> dict:
        """
        Generate node graph data for Grafana.

        Returns:
            {
                "nodes": [{"id": "svc", "title": "name", "color": "green|red"}],
                "edges": [{"source": "svc", "target": "dep"}]
            }
        """
        nodes = set()
        edges = []

        for svc, dep_list in self.deps.items():
            nodes.add(svc)
            for dep in dep_list:
                nodes.add(dep)
                edges.append({"source": svc, "target": dep})

        # Add services with no dependencies too
        from services_config_v2 import SERVICE_MAP
        for sid in SERVICE_MAP:
            nodes.add(sid)

        node_list = []
        for n in sorted(nodes):
            color = "green" if n in active_services else "red"
            blocked_by = self.is_blocked(n, active_services)
            if blocked_by:
                color = "orange"
            node_list.append({
                "id": n,
                "title": n,
                "color": color,
                "blocked_by": blocked_by,
            })

        return {"nodes": node_list, "edges": edges}

    def health_summary(self, active_services: set[str]) -> dict:
        """
        Quick health summary considering dependencies.

        Returns:
            {
                "healthy": ["svc1", ...],
                "down": ["svc2", ...],
                "blocked": {"svc3": "blocked_by_svc", ...},
                "cascade_risks": [{"if_down": "gateway", "affects": 12}, ...]
            }
        """
        from services_config_v2 import SERVICE_MAP

        healthy = []
        down = []
        blocked = {}

        for sid in SERVICE_MAP:
            if sid in active_services:
                healthy.append(sid)
            else:
                blocker = self.is_blocked(sid, active_services)
                if blocker:
                    blocked[sid] = blocker
                else:
                    down.append(sid)

        # Cascade risk analysis: which services affect the most others?
        cascade_risks = []
        for sid in active_services:
            impact = self.cascade_impact(sid)
            if impact:
                cascade_risks.append({
                    "if_down": sid,
                    "affects": len(impact),
                    "affected_services": impact,
                })
        cascade_risks.sort(key=lambda x: x["affects"], reverse=True)

        return {
            "healthy": healthy,
            "down": down,
            "blocked": blocked,
            "cascade_risks": cascade_risks[:5],  # Top 5 risks
        }
