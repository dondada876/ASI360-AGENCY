# ASI 360 Project HUD Dashboard

> DoorDash-style project tracking dashboard for Allied Systems Integrations

**Live:** [projects.asi360.co](https://projects.asi360.co)
**Version:** 3.1
**Stack:** React 19 + Vite 6 + Tailwind CSS 4 + Supabase JS + React Router 7
**Dependencies:** Zero extra npm packages beyond the core stack

---

## Quick Start

```bash
# Prerequisites: Node.js 18+
cd quotes-engine/dashboard
npm install
npm run dev          # http://localhost:3210
npm run build        # Production build → dist/
```

---

## Architecture

```
React SPA (Vite)
├── src/pages/           # 3 pages: ProjectList, ProjectHUD, HelpPage
├── src/components/      # 13 components: Gantt, Kanban, Modal, PM Triangle, etc.
├── src/lib/             # 4 modules: supabase, scheduler, evm, ThemeContext
├── src/index.css        # Theme system (CSS custom properties)
└── index.html           # SPA entry + dark mode flash prevention
```

### Key Design Decisions

- **Zero extra dependencies** — no charting library, no state manager, no CSS-in-JS. Gantt is pure CSS grid, Kanban is drag-and-drop via native events.
- **CSS custom properties for theming** — `:root` (light) and `.dark` (dark) with 30+ variables. Components use inline `style={{ backgroundColor: 'var(--bg-card)' }}`.
- **Supabase anon key** — browser-safe, RLS-protected. Hardcoded fallback for production.
- **Auto-refresh** — 60-second interval polls Supabase for data changes.
- **Tri-sync conflict resolution** — All dashboard writes include `modified_source: 'dashboard'` to prevent echo loops with VTiger and Airtable.

---

## Database Connections

### Supabase (Primary Data Store)

**Project:** `asi360-commerce` (`gtfffxwfgcxiiauliynd`)

| Table | Purpose |
|-------|---------|
| `asi360_projects` | Project records: name, client, dates, budget, health_score, slug |
| `asi360_project_tasks` | Tasks per project: task_no, phase, status, hours, budget, milestone |
| `project_events` | Activity log: status changes, sync events, manual updates |

**8 CRUD functions** in `src/lib/supabase.js`:
- `fetchProjects()` — All active projects
- `fetchProjectBySlug(slug)` — Single project by URL slug
- `fetchTasksForProject(id)` — Tasks for a project
- `fetchProjectEvents(no)` — Activity log
- `updateTaskStatus(id, status)` — Change task status
- `updateTaskAssignment(id, to)` — Change assignee
- `updateTaskDetails(id, updates)` — Milestone, hours, budget, risk, dates
- `updateProjectHealth(id, data)` — Persist health score

### VTiger CRM (Project Source)

Gateway API at `104.248.69.86:3004` (Docker container `500gl-vtiger-api`).

- VTiger Workflow Webhooks trigger on project/task changes
- Gateway receives webhook → writes to Supabase
- Project IDs: VTiger-native auto-increment (PROJ361, PROJ362, etc.)

### Airtable (CEO Dashboard)

Base `appOkZt0CLLBLo2Fr` — Project Registry (427+ projects synced from VTiger).

- Automation webhooks for status change notifications
- Bug tracker table for issue tracking

### Data Flow

```
VTiger ──→ Gateway API (:3004) ──→ Supabase ←── Dashboard reads/writes
                                └──→ Airtable (async mirror)
```

---

## File Structure

```
dashboard/
├── index.html                    # SPA entry + dark mode script
├── package.json                  # Dependencies
├── vite.config.js                # Vite config + Tailwind plugin
├── README.md                     # This file
├── PROJ367-PROJECT-HUD-DASHBOARD.md  # Project reference doc
├── src/
│   ├── main.jsx                  # Router: /, /help, /:slugHUD
│   ├── index.css                 # Theme variables + animations (243 LOC)
│   ├── pages/
│   │   ├── ProjectList.jsx       # Project cards grid (167 LOC)
│   │   ├── ProjectHUD.jsx        # Main dashboard (440 LOC)
│   │   └── HelpPage.jsx          # Interactive docs (700 LOC)
│   ├── components/
│   │   ├── GanttTimeline.jsx     # CSS grid timeline
│   │   ├── GanttBar.jsx          # Task bars + milestones
│   │   ├── KanbanBoard.jsx       # 5-column drag-and-drop
│   │   ├── TaskListView.jsx      # Sortable table
│   │   ├── TaskDetailModal.jsx   # Task edit modal
│   │   ├── PMTriangle.jsx        # SVG gauge meters
│   │   ├── OnTargetIndicator.jsx # Traffic light health
│   │   ├── ViewControls.jsx      # Tab bar + filters
│   │   ├── NextSteps.jsx         # Upcoming tasks sidebar
│   │   ├── PhaseBadge.jsx        # Phase indicator
│   │   ├── ThemeToggle.jsx       # Dark/light switch
│   │   ├── HelpButton.jsx        # ? icon → /help
│   │   └── Skeleton.jsx          # Loading placeholders
│   └── lib/
│       ├── supabase.js           # Data layer (137 LOC)
│       ├── scheduler.js          # Timeline engine (311 LOC)
│       ├── evm.js                # EVM calculations (124 LOC)
│       └── ThemeContext.jsx       # Theme provider
└── tests/
    ├── theme-audit.spec.mjs      # Theme/color audit (46 assertions)
    ├── full-audit.spec.mjs       # Full audit (28 assertions)
    └── screenshots/              # Test screenshots
```

---

## Project Health (EVM)

The dashboard uses **Earned Value Management** to score project health.

### Formulas

| Metric | Formula | Meaning |
|--------|---------|---------|
| PV | Budget x Time% | Planned progress by now |
| EV | Budget x Completion% | Actual progress |
| AC | Sum of cost_actual | Money spent |
| SPI | EV / PV | Schedule performance (>1 = ahead) |
| CPI | EV / AC | Cost performance (>1 = under budget) |
| EAC | Budget / CPI | Projected total cost |

### Health Score

```
Score = SPI_score * 40% + CPI_score * 40% + Scope_score * 20%

Thresholds:
  80-100 = On Track (green)
  60-79  = At Risk (yellow)
  0-59   = Off Track (red)
```

---

## Scheduling Engine

Tasks are scheduled using business days (Mon-Fri only).

**Two modes:**
1. **Sequential** (default): Tasks chain back-to-back by phase order
2. **Critical Path**: Activated when tasks have dependencies. Parallel tasks overlap.

Each task has an `estimated_days` value (default: 2). The scheduler builds day labels, week headers, and phase-colored bar positions for the Gantt chart.

---

## Theme System

30+ CSS custom properties defined in `src/index.css`:

| Variable | Light | Dark |
|----------|-------|------|
| `--bg-primary` | `#f1f5f9` | `#030712` |
| `--bg-card` | `#ffffff` | `#111827` |
| `--text-primary` | `#0f172a` | `#ffffff` |
| `--text-secondary` | `#475569` | `#9ca3af` |
| `--border-primary` | `#cbd5e1` | `#1f2937` |
| `--card-shadow` | `0 1px 3px...` | `none` |

Toggle via the sun/moon icon in the header. Persists in `localStorage('asi360-theme')`. Falls back to system `prefers-color-scheme`.

---

## Deployment

```bash
# Build
npm run build

# Deploy (SCP to droplet)
scp -r dist/* root@104.248.69.86:/var/www/project-dashboard/

# Nginx serves static files from /var/www/project-dashboard/
# SPA fallback: try_files $uri $uri/ /index.html
# No server restart needed
```

---

## Environment Variables

| Variable | Default | Required |
|----------|---------|----------|
| `VITE_SUPABASE_URL` | `https://gtfffxwfgcxiiauliynd.supabase.co` | No (has fallback) |
| `VITE_SUPABASE_ANON_KEY` | Hardcoded anon key | No (has fallback) |

Both are optional — the dashboard ships with hardcoded defaults for the production Supabase project.

---

## Testing

```bash
# Start dev server first
npm run dev

# Theme audit (46 assertions)
node tests/theme-audit.spec.mjs

# Full audit (28 assertions)
node tests/full-audit.spec.mjs
```

Tests use Playwright headless Chromium. Screenshots saved to `tests/screenshots/`.

---

## In-App Help

Navigate to `/help` or click the **?** icon in any page header for interactive documentation covering all topics above plus component reference, extending guide, and EVM formulas.

---

## Related Documents

- [PROJ367-PROJECT-HUD-DASHBOARD.md](./PROJ367-PROJECT-HUD-DASHBOARD.md) — Project reference with credentials and architecture
- VTiger: PROJ368 — Project HUD v2.0 Dashboard Upgrade
- Airtable: Bug Tracker — rec9VGQsxgarpVsOf (BUG-008 resolution)
