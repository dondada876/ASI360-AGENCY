# PROJ367 — ASI 360 Project HUD Dashboard

> **Last Updated:** 2026-03-13
> **Status:** In Progress (30% Complete)
> **Branch:** `claude/optimistic-bose`
> **VTiger ID:** `31x95841`
> **Airtable Record:** `reczwqSKyKU7H7IWX`

---

## 🔐 Access Credentials

| Field | Value |
|-------|-------|
| **URL** | `https://projects.asi360.co` |
| **Username** | `admin` |
| **Password** | `ASI360projects!` |
| **Auth Type** | nginx HTTP Basic Auth (`/etc/nginx/.htpasswd-projects`) |
| **SSL** | Let's Encrypt (Certbot) — Expires 2026-06-11 |

---

## Project Overview

| Field | Value |
|-------|-------|
| **Project Number** | PROJ367 |
| **Project Name** | ASI 360 Project HUD Dashboard |
| **Client** | ASI 360 (Internal) |
| **Contact** | Dawit Bucknor — ops@asi360.co — (510) 288-0994 |
| **Description** | DoorDash-style per-client project tracking dashboard with bidirectional Airtable/VTiger/Supabase sync |
| **Start Date** | 2026-03-12 |
| **Target Close** | 2026-04-15 |
| **Template** | Software Dev (Template ID 6) |
| **Business Type** | Office / Internal |
| **Planner Group** | Allied Systems Integrations |
| **Planner Channel** | 15-Active-Projects |

---

## Architecture

### Tech Stack
- **Frontend:** React 19 + Vite 6 + Tailwind CSS 4 + React Router 7
- **Backend:** Supabase (PostgreSQL) — project `gtfffxwfgcxiiauliynd`
- **API Gateway:** VTiger API (Docker, port 3004) on droplet `104.248.69.86`
- **Hosting:** DigitalOcean Droplet → nginx → `/var/www/project-dashboard`
- **SSL:** Let's Encrypt via Certbot (auto-renew via `certbot.timer`)

### Data Flow
```
VTiger CRM  ←→  Gateway API (port 3004)  ←→  Supabase (source of truth)  ←→  Airtable
                        ↓
              React SPA Dashboard
           (projects.asi360.co)
```

### Bidirectional Sync
| Direction | Method | Endpoint |
|-----------|--------|----------|
| Gateway → Supabase | Direct PATCH | Supabase REST API |
| Gateway → Airtable | Airtable API | Via `update_at_task()` |
| Gateway → VTiger | VTiger REST | Via `update_vtiger_task()` |
| Airtable → Gateway | Webhook | `POST /api/webhooks/airtable-task-update` |
| VTiger → Gateway | Workflow Webhook | `POST /api/webhooks/vtiger-task-update` |

### Echo Prevention
Both webhook endpoints check `modified_source` and `updated_at` — skip processing if Supabase was updated <5 seconds ago from `gateway` source.

---

## URL Structure

| URL | Description |
|-----|-------------|
| `https://projects.asi360.co/` | Project directory (list all projects) |
| `https://projects.asi360.co/:slug-HUD/` | Per-client HUD page (e.g., `/goldman-HUD/`) |

---

## Infrastructure

### Droplet (104.248.69.86)

| Component | Status | Details |
|-----------|--------|---------|
| **nginx** | Active | `/etc/nginx/sites-enabled/project-dashboard` |
| **Dashboard Files** | Deployed | `/var/www/project-dashboard/` (456KB) |
| **Basic Auth** | Active | `/etc/nginx/.htpasswd-projects` |
| **SSL Cert** | Valid | Expires 2026-06-11, auto-renew via `certbot.timer` |
| **VTiger API** | Healthy | Docker `500gl-vtiger-api`, port 3004 |

### SSL Certificates

| Domain | Engine | Issuer | Expires | Auto-Renew |
|--------|--------|--------|---------|------------|
| `projects.asi360.co` | Certbot | Let's Encrypt E8 | 2026-06-11 | Yes (systemd timer) |
| `api.asi360.co` | Certbot | Let's Encrypt | 2026-06-08 | Yes (systemd timer) |
| `*.asi360.co` (SiteGround) | SiteGround | Let's Encrypt R13 | 2026-05-23 | Yes (SiteGround managed) |

### DNS
| Record | Type | Value |
|--------|------|-------|
| `projects.asi360.co` | A | `104.248.69.86` |
| `www.projects.asi360.co` | A | `104.248.69.86` |

---

## Tasks (10 total — 3 completed, 7 open)

### Phase 1: Scope & Design

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Feature Brief | Open | — |
| 1.2 | Architecture & Approach | **Completed** (2026-03-13) | Fixed `updated_at` bug in VTiger API main.py line 994. Docker container rebuilt. |
| 1.3 | Scope Sign-off | Open | — |

### Phase 2: Build & Test

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | Branch & Scaffold | **Completed** (2026-03-13) | React SPA: Vite+React 19+Tailwind 4+React Router. 16 files, 8,131 lines committed (`845c6a8`). Components: ProjectList, ProjectHUD, GanttTimeline, GanttBar, NextSteps, PhaseBadge, scheduler.js, supabase.js. |
| 2.2 | Core Implementation | Open | — |
| 2.3 | Integration Testing | Open | — |
| 2.4 | Code Review & QA | **Completed** (2026-03-13) | Dashboard deployed to `/var/www/project-dashboard`. Nginx with basic auth + SPA fallback. SSL via Certbot. |

### Phase 3: Ship & Close

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | Merge & Deploy | Open | — |
| 3.2 | Documentation & Handoff | Open | — |
| 3.3 | Retro & Close | Open | — |

---

## Events Timeline

| Date | Type | Title | Details |
|------|------|-------|---------|
| 2026-03-13 | Planning | Planning session initiated | Client requested DoorDash-style project tracker |
| 2026-03-13 | Decision | Sync gap identified | Gateway MCP only pushes to Airtable+VTiger, no reverse path exists |
| 2026-03-13 | Decision | `updated_at` bug discovered | VTiger API main.py:1003 — `updated_at` column never set during PATCH |
| 2026-03-13 | Decision | Architecture: VTiger reverse sync | VTiger Workflow Webhook Action for outgoing webhooks |
| 2026-03-13 | Decision | Architecture: Airtable webhook | Automation on Status change → POST to gateway |
| 2026-03-13 | Decision | Architecture: React SPA | Vite + React 19 + Tailwind 4 + React Router + Supabase JS |
| 2026-03-13 | Decision | URL structure finalized | `projects.asi360.co/:slug-HUD/` |
| 2026-03-13 | Planning | Plan v4 approved | 22 subtasks, 5 phases |
| 2026-03-13 | Deploy | SSL certificate issued | Let's Encrypt E8, expires 2026-06-11 |
| 2026-03-13 | Decision | SSL Certificate Inventory | 2 Certbot certs + 1 SiteGround wildcard documented |

---

## Git History (branch: `claude/optimistic-bose`)

```
2af0886  Update nginx config with SSL (certbot) for projects.asi360.co
97cb494  Add nginx config for projects.asi360.co deployment
845c6a8  React Project HUD Dashboard: Gantt timeline, project directory, auto-refresh
5e65cd5  Timeline v2: dark headers, colspan Gantt bars, PROJECT END column
e2c1102  Add tooltips, brief loader, and critical path scheduling
b9e5fc9  Add proposal-to-timeline pipeline for project-specific Gantt charts
```

---

## File Structure

```
quotes-engine/dashboard/
├── dist/                    # Production build (deployed to droplet)
│   ├── assets/
│   │   ├── index-DhljCJ-X.js    # 428KB bundled JS
│   │   └── index-TcmuTydW.css   # Tailwind CSS
│   └── index.html
├── nginx/
│   └── projects.asi360.co.conf  # nginx config (committed)
├── src/
│   ├── main.jsx                 # React Router entry
│   ├── App.jsx                  # Root component
│   ├── pages/
│   │   ├── ProjectList.jsx      # Project directory (157 lines)
│   │   └── ProjectHUD.jsx       # Per-client HUD (262 lines)
│   ├── components/
│   │   ├── GanttTimeline.jsx    # CSS grid Gantt chart
│   │   ├── GanttBar.jsx         # Individual bar with tooltips
│   │   ├── PhaseBadge.jsx       # StatusBadge, PhaseProgressBar
│   │   └── NextSteps.jsx        # Upcoming tasks panel
│   └── lib/
│       ├── supabase.js          # Supabase client
│       └── scheduler.js         # JS port of Python scheduling
├── package.json
├── vite.config.js
└── PROJ367-PROJECT-HUD-DASHBOARD.md  ← this file
```

---

## Cross-References

| System | ID | Link |
|--------|----|------|
| Supabase | `asi360_projects.id = 12` | `gtfffxwfgcxiiauliynd` |
| VTiger | `31x95841` | VTiger CRM → Projects |
| Airtable | `reczwqSKyKU7H7IWX` | CEO Dashboard base |
| GitHub | `dondada876/ASI360-AGENCY` | Branch: `claude/optimistic-bose` |
| Nginx Config | `/etc/nginx/sites-enabled/project-dashboard` | Droplet |
| htpasswd | `/etc/nginx/.htpasswd-projects` | Droplet |
| SSL Cert | `/etc/letsencrypt/live/projects.asi360.co/` | Droplet |

---

## Remaining Work

1. **Configure VTiger Workflow webhook** — Create Workflow on ProjectTask module, trigger on Status change, POST to `http://104.248.69.86:3004/api/webhooks/vtiger-task-update`
2. **End-to-end verification** — Test Airtable→Supabase, VTiger→Supabase, dashboard refresh
3. **Merge to staging** — `claude/optimistic-bose → staging → main`
4. **Final documentation & handoff**
