import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'
import HelpButton from '../components/HelpButton'

/* ══════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════ */

function AccordionSection({ id, title, icon, isExpanded, onToggle, children }) {
  return (
    <div
      id={id}
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--card-shadow)' }}
    >
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors"
        style={{ color: 'var(--text-primary)' }}
        aria-expanded={isExpanded}
        aria-controls={`${id}-content`}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <span className="font-semibold">{title}</span>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {isExpanded && (
        <div id={`${id}-content`} className="px-5 pb-5 animate-slide-up">
          {children}
        </div>
      )}
    </div>
  )
}

function CodeBlock({ code }) {
  return (
    <pre
      className="rounded-lg p-4 text-xs font-mono overflow-x-auto"
      style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)' }}
    >
      <code>{code}</code>
    </pre>
  )
}

function InfoBox({ type = 'info', children }) {
  const colors = {
    info: { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)', label: 'Info' },
    warning: { border: '#eab308', bg: 'rgba(234, 179, 8, 0.08)', label: 'Warning' },
    tip: { border: '#22c55e', bg: 'rgba(34, 197, 94, 0.08)', label: 'Tip' },
  }
  const c = colors[type] || colors.info
  return (
    <div
      className="rounded-lg p-4 text-sm my-3"
      style={{ backgroundColor: c.bg, borderLeft: `3px solid ${c.border}`, color: 'var(--text-secondary)' }}
    >
      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: c.border }}>{c.label}</span>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function DataTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto rounded-lg border my-3" style={{ borderColor: 'var(--border-primary)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: 'var(--bg-card-hover)' }}>
            {headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-primary)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border-primary)' : 'none' }}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2" style={{ color: j === 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {typeof cell === 'string' && cell.startsWith('`') && cell.endsWith('`')
                    ? <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-mono)' }}>{cell.slice(1, -1)}</code>
                    : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionHeading({ children }) {
  return <h3 className="text-sm font-bold uppercase tracking-wide mt-4 mb-2" style={{ color: 'var(--text-primary)' }}>{children}</h3>
}

function P({ children }) {
  return <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--text-secondary)' }}>{children}</p>
}

/* ══════════════════════════════════════════════
   Section Content Definitions
   ══════════════════════════════════════════════ */

const SECTIONS = [
  {
    id: 'overview',
    title: 'Dashboard Overview',
    icon: '\uD83D\uDCCA',
    render: () => (
      <>
        <P>
          The ASI 360 Project HUD is a single-page application (SPA) that provides real-time project tracking with Gantt charts, Kanban boards, and task lists. Built with React 19, Vite 6, Tailwind CSS 4, and Supabase.
        </P>

        <SectionHeading>Page Structure</SectionHeading>
        <DataTable
          headers={['Route', 'Page', 'Purpose']}
          rows={[
            ['`/`', 'Project List', 'Grid of all active projects with health indicators and phase progress'],
            ['`/:slug-HUD`', 'Project HUD', 'Full dashboard for a single project: Gantt, Kanban, List views + PM Triangle'],
            ['`/help`', 'Help Page', 'This documentation page'],
          ]}
        />

        <SectionHeading>Key Features</SectionHeading>
        <ul className="text-sm space-y-1.5 ml-4 list-disc" style={{ color: 'var(--text-secondary)' }}>
          <li><strong>Auto-refresh</strong> every 60 seconds keeps data current</li>
          <li><strong>Dark/Light mode</strong> with system preference detection and localStorage persistence</li>
          <li><strong>Keyboard shortcut</strong>: Press the search box to filter tasks by name, number, or assignee</li>
          <li><strong>Mobile responsive</strong>: Cards stack, Kanban uses tap-to-select, Gantt scrolls horizontally</li>
          <li><strong>Zero extra dependencies</strong>: Only React, React Router, Supabase JS, and Tailwind</li>
        </ul>

        <SectionHeading>URL Pattern</SectionHeading>
        <P>
          Project URLs follow the pattern: <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }}>projects.asi360.co/project-slug-HUD</code>. The slug is derived from the project name (lowercase, hyphens). The "-HUD" suffix is stripped internally to look up the project in Supabase.
        </P>
      </>
    ),
  },
  {
    id: 'databases',
    title: 'Database Connections',
    icon: '\uD83D\uDDC4\uFE0F',
    render: () => (
      <>
        <SectionHeading>Supabase (Primary Data Store)</SectionHeading>
        <P>
          Project: <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }}>asi360-commerce</code> (gtfffxwfgcxiiauliynd). The dashboard reads and writes using the Supabase anon key (browser-safe, row-level security).
        </P>

        <DataTable
          headers={['Table', 'Purpose', 'Key Columns']}
          rows={[
            ['`asi360_projects`', 'Project records', 'project_no, project_name, client_name, slug, start_date, target_close_date, contract_value, health_score'],
            ['`asi360_project_tasks`', 'Tasks per project', 'task_no, task_name, phase_no, status, estimated_days, assigned_to, is_milestone, estimated_hours, actual_hours'],
            ['`project_events`', 'Activity log', 'project_no, title, event_type, event_source, created_at'],
          ]}
        />

        <P>8 CRUD functions in <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }}>src/lib/supabase.js</code>:</P>
        <DataTable
          headers={['Function', 'Operation', 'Description']}
          rows={[
            ['`fetchProjects()`', 'READ', 'All active projects (not cancelled), sorted by created_at'],
            ['`fetchProjectBySlug(slug)`', 'READ', 'Single project by URL slug'],
            ['`fetchTasksForProject(id)`', 'READ', 'All tasks for a project, sorted by task_no'],
            ['`fetchProjectEvents(no)`', 'READ', 'Activity log entries, latest first'],
            ['`updateTaskStatus(id, status)`', 'WRITE', 'Change task status (Kanban drag, modal)'],
            ['`updateTaskAssignment(id, to)`', 'WRITE', 'Change assigned_to field'],
            ['`updateTaskDetails(id, data)`', 'WRITE', 'Update milestone, hours, budget, risk, dates'],
            ['`updateProjectHealth(id, data)`', 'WRITE', 'Persist health_score to project'],
          ]}
        />

        <InfoBox type="info">
          All writes include <code>modified_source: 'dashboard'</code> and a fresh <code>updated_at</code> timestamp. This enables tri-sync conflict resolution: VTiger, Airtable, and the dashboard each tag their writes so the sync gateway can detect and prevent echo loops.
        </InfoBox>

        <SectionHeading>VTiger CRM (Project Source)</SectionHeading>
        <P>
          VTiger is the CRM where projects originate. The Gateway API at <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }}>104.248.69.86:3004</code> (Docker container) syncs project data from VTiger to Supabase. Project IDs follow VTiger's auto-increment format: PROJ361, PROJ362, etc.
        </P>
        <ul className="text-sm space-y-1 ml-4 list-disc" style={{ color: 'var(--text-secondary)' }}>
          <li>VTiger Workflow Webhooks trigger on project/task changes</li>
          <li>Gateway receives webhook, writes to Supabase</li>
          <li>Dashboard reads updated data on next auto-refresh (60s) or manual refresh</li>
        </ul>

        <SectionHeading>Airtable (CEO Dashboard)</SectionHeading>
        <P>
          The CEO Dashboard base (<code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }}>appOkZt0CLLBLo2Fr</code>) contains a Project Registry with 427+ projects synced from VTiger. Airtable automation webhooks trigger on status changes and push updates to the gateway.
        </P>
        <P>Bug tracking uses the Airtable Bug Tracker table for issue logging and resolution tracking.</P>

        <SectionHeading>Data Flow</SectionHeading>
        <div className="flex flex-col items-center gap-2 py-4">
          {/* Data flow diagram */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono">
            <div className="px-3 py-2 rounded-lg border text-center" style={{ backgroundColor: 'var(--bg-card-hover)', borderColor: 'var(--border-secondary)', color: 'var(--text-primary)' }}>
              <div className="font-bold">VTiger CRM</div>
              <div style={{ color: 'var(--text-muted)' }}>Source of truth</div>
            </div>
            <span style={{ color: 'var(--text-muted)' }}>&rarr;</span>
            <div className="px-3 py-2 rounded-lg border text-center" style={{ backgroundColor: 'var(--bg-card-hover)', borderColor: '#3b82f6', color: 'var(--text-primary)' }}>
              <div className="font-bold">Gateway API</div>
              <div style={{ color: 'var(--text-muted)' }}>:3004 Docker</div>
            </div>
            <span style={{ color: 'var(--text-muted)' }}>&rarr;</span>
            <div className="px-3 py-2 rounded-lg border text-center" style={{ backgroundColor: 'var(--bg-card-hover)', borderColor: '#22c55e', color: 'var(--text-primary)' }}>
              <div className="font-bold">Supabase</div>
              <div style={{ color: 'var(--text-muted)' }}>Dashboard DB</div>
            </div>
            <span style={{ color: 'var(--text-muted)' }}>&larr;</span>
            <div className="px-3 py-2 rounded-lg border text-center" style={{ backgroundColor: 'var(--bg-card-hover)', borderColor: '#eab308', color: 'var(--text-primary)' }}>
              <div className="font-bold">Dashboard</div>
              <div style={{ color: 'var(--text-muted)' }}>This app</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono mt-1">
            <span style={{ color: 'var(--text-muted)' }}>Airtable &larr;&rarr; Gateway (async mirror)</span>
          </div>
        </div>
      </>
    ),
  },
  {
    id: 'views',
    title: 'Dashboard Views',
    icon: '\uD83D\uDCC5',
    render: () => (
      <>
        <SectionHeading>Gantt Chart</SectionHeading>
        <P>
          The default view. A CSS grid-based timeline showing task bars positioned across business days (Monday-Friday). Features include:
        </P>
        <ul className="text-sm space-y-1 ml-4 list-disc mb-3" style={{ color: 'var(--text-secondary)' }}>
          <li><strong>Week headers</strong> with day columns (MON-FRI)</li>
          <li><strong>Today marker</strong>: Blue vertical line showing current day</li>
          <li><strong>Target end line</strong>: Red dashed line at the project's contract close date</li>
          <li><strong>Phase-colored bars</strong>: Each phase has a distinct color (blue, teal, orange, green, purple)</li>
          <li><strong>Hover tooltips</strong>: Show task name, status, assignee, dates, notes</li>
          <li><strong>Click to detail</strong>: Opens the task detail modal for editing</li>
          <li><strong>Progress bars</strong>: Bottom 4px of each bar fills based on actual vs estimated hours</li>
          <li><strong>Diamond markers</strong>: Milestone tasks show as rotated squares instead of bars</li>
          <li><strong>Overdue indicators</strong>: Red outline on tasks extending past the target end date</li>
        </ul>

        <SectionHeading>Kanban Board</SectionHeading>
        <P>
          Five-column drag-and-drop board for task status management:
        </P>
        <DataTable
          headers={['Column', 'Status', 'Color']}
          rows={[
            ['To Do', '`open`', 'Gray'],
            ['In Progress', '`in_progress`', 'Blue'],
            ['Blocked', '`blocked`', 'Red'],
            ['Waiting', '`waiting`', 'Yellow'],
            ['Done', '`completed`', 'Green'],
          ]}
        />
        <P>
          Desktop: Drag cards between columns to change status. Mobile: Tap a card to select it, then tap the destination column header. Changes are saved immediately to Supabase with optimistic UI updates.
        </P>

        <SectionHeading>Task List</SectionHeading>
        <P>
          A sortable table view with 7 columns: Task No, Name, Phase, Status, Assigned To, Duration, and Notes. On mobile, each task becomes a card. Click any row to open the detail modal. Supports search filtering across name, task number, and assignee.
        </P>
      </>
    ),
  },
  {
    id: 'health',
    title: 'Project Health & EVM',
    icon: '\uD83D\uDCC8',
    render: () => (
      <>
        <P>
          The dashboard uses <strong>Earned Value Management (EVM)</strong> to calculate project health. EVM compares planned progress vs actual progress vs actual cost to determine if a project is on track.
        </P>

        <SectionHeading>EVM Terminology</SectionHeading>
        <DataTable
          headers={['Metric', 'Formula', 'Meaning']}
          rows={[
            ['PV (Planned Value)', 'Budget x Time%', 'How much work should be done by now'],
            ['EV (Earned Value)', 'Budget x Completion%', 'How much work is actually done'],
            ['AC (Actual Cost)', 'Sum of cost_actual', 'How much has been spent'],
            ['SPI (Schedule Index)', 'EV / PV', '>1 = ahead, <1 = behind schedule'],
            ['CPI (Cost Index)', 'EV / AC', '>1 = under budget, <1 = over budget'],
            ['SV (Schedule Variance)', 'EV - PV', 'Positive = ahead, negative = behind'],
            ['CV (Cost Variance)', 'EV - AC', 'Positive = savings, negative = overrun'],
            ['EAC (Estimate at Complete)', 'Budget / CPI', 'Projected total cost at current rate'],
          ]}
        />

        <SectionHeading>Health Score Formula</SectionHeading>
        <CodeBlock code={`Health Score (0-100) =
  Schedule Score (SPI) x 40%
+ Budget Score (CPI)  x 40%
+ Scope Score          x 20%

Where:
  Schedule Score = min(SPI, 1.5) / 1.5 x 100
  Budget Score   = min(CPI, 1.5) / 1.5 x 100
  Scope Score    = 100 - |scope_variance| x 2`} />

        <SectionHeading>Traffic Light Thresholds</SectionHeading>
        <DataTable
          headers={['Score Range', 'Status', 'Color', 'Meaning']}
          rows={[
            ['80-100', 'On Track', 'Green', 'Project is healthy, no intervention needed'],
            ['60-79', 'At Risk', 'Yellow', 'Some metrics are off, monitor closely'],
            ['0-59', 'Off Track', 'Red', 'Project needs immediate attention'],
          ]}
        />

        <SectionHeading>PM Triangle</SectionHeading>
        <P>
          The PM Triangle in the sidebar shows three SVG arc gauges: Schedule (SPI), Budget (CPI), and Scope (task count variance). Below the gauges, four metric cards display PV, EV, AC, and EAC values. A composite health badge at the top shows the overall score and status.
        </P>

        <InfoBox type="tip">
          The health score persists to Supabase every 5 seconds (debounced) when it changes. This allows the Project List page to show health indicators without recalculating EVM for every project.
        </InfoBox>
      </>
    ),
  },
  {
    id: 'scheduler',
    title: 'Scheduling Engine',
    icon: '\u23F1\uFE0F',
    render: () => (
      <>
        <P>
          The scheduling engine transforms project data into Gantt-ready timelines. It lives in <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }}>src/lib/scheduler.js</code> (311 lines).
        </P>

        <SectionHeading>5-Phase Project Structure</SectionHeading>
        <DataTable
          headers={['Phase', 'Name', 'Color', 'Typical Tasks']}
          rows={[
            ['1', 'Scope & Design', 'Blue (#0B5394)', 'Site survey, requirements, proposal'],
            ['2', 'Build & Test', 'Teal (#45818E)', 'Installation, configuration, testing'],
            ['3', 'Ship & Close', 'Orange (#B85B22)', 'Final walkthrough, training, handoff'],
            ['4', 'Phase 4', 'Green (#38761D)', 'Extended scope or maintenance'],
            ['5', 'Phase 5', 'Purple (#351C75)', 'Additional phases as needed'],
          ]}
        />

        <SectionHeading>Business Day Math</SectionHeading>
        <P>
          The scheduler works in business days only (Monday-Friday). Three helper functions handle date math:
        </P>
        <ul className="text-sm space-y-1 ml-4 list-disc mb-3" style={{ color: 'var(--text-secondary)' }}>
          <li><strong>addBusinessDays(start, days)</strong>: Adds N business days, skipping weekends</li>
          <li><strong>skipWeekend(date)</strong>: If date falls on Sat/Sun, advances to next Monday</li>
          <li><strong>businessDaysBetween(start, end)</strong>: Counts business days in a range</li>
        </ul>

        <SectionHeading>Two Scheduling Modes</SectionHeading>
        <P>
          <strong>Sequential</strong> (default): Tasks are placed back-to-back by phase order. Task 1 ends on day 2, Task 2 starts on day 3, etc. Each task's duration comes from <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }}>estimated_days</code> (default: 2 days).
        </P>
        <P>
          <strong>Critical Path</strong>: Activated when tasks have dependencies. Each task starts after its last dependency finishes. Parallel tasks run simultaneously. Dependencies are defined in the <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }}>dependencies</code> array field on tasks.
        </P>

        <SectionHeading>Task Statuses</SectionHeading>
        <DataTable
          headers={['Status', 'Progress', 'Description']}
          rows={[
            ['`open`', '0%', 'Not started'],
            ['`in_progress`', 'Hours-based or 50%', 'Actively being worked on'],
            ['`blocked`', 'N/A', 'Waiting on external dependency'],
            ['`waiting`', 'N/A', 'Waiting on client or internal review'],
            ['`completed`', '100%', 'Finished'],
          ]}
        />

        <SectionHeading>Completion Calculation</SectionHeading>
        <P>
          Overall project completion = (completed tasks / total tasks) x 100. Simple ratio, no weighting by duration or budget.
        </P>
      </>
    ),
  },
  {
    id: 'theme',
    title: 'Theme System',
    icon: '\uD83C\uDFA8',
    render: () => (
      <>
        <P>
          The dashboard supports dark and light mode via CSS custom properties. The theme is controlled by a <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }}>dark</code> class on the HTML element.
        </P>

        <SectionHeading>How It Works</SectionHeading>
        <ol className="text-sm space-y-1 ml-4 list-decimal mb-3" style={{ color: 'var(--text-secondary)' }}>
          <li><strong>index.html</strong>: Inline script reads <code>localStorage('asi360-theme')</code> before React mounts (prevents flash of wrong theme)</li>
          <li><strong>ThemeContext.jsx</strong>: React Context + Provider with <code>useTheme()</code> hook. Falls back to <code>prefers-color-scheme</code> system preference</li>
          <li><strong>ThemeToggle.jsx</strong>: Sun/moon icon button in headers. Adds <code>theme-transitioning</code> class for smooth 0.3s CSS transitions</li>
          <li><strong>index.css</strong>: Defines all variables in both <code>:root</code> (light) and <code>.dark</code> (dark) blocks</li>
        </ol>

        <SectionHeading>CSS Custom Properties</SectionHeading>
        <DataTable
          headers={['Variable', 'Light Value', 'Dark Value', 'Usage']}
          rows={[
            ['`--bg-primary`', '#f1f5f9', '#030712', 'Page background'],
            ['`--bg-card`', '#ffffff', '#111827', 'Card/panel backgrounds'],
            ['`--bg-card-hover`', '#f8fafc', '#1f2937', 'Hover states, code blocks'],
            ['`--text-primary`', '#0f172a', '#ffffff', 'Headings, primary text'],
            ['`--text-secondary`', '#475569', '#9ca3af', 'Body text, descriptions'],
            ['`--text-muted`', '#64748b', '#6b7280', 'Labels, captions, metadata'],
            ['`--border-primary`', '#cbd5e1', '#1f2937', 'Card borders, dividers'],
            ['`--border-secondary`', '#94a3b8', '#374151', 'Active borders, hover'],
            ['`--card-shadow`', '0 1px 3px...', 'none', 'Card elevation (light only)'],
            ['`--phase-1` to `--phase-5`', 'Darker tones', 'Brighter tones', 'Phase bar colors'],
            ['`--progress-track`', '#e2e8f0', '#1f2937', 'Progress bar background'],
            ['`--modal-bg`', '#ffffff', '#111827', 'Modal/tooltip backgrounds'],
          ]}
        />

        <SectionHeading>Styling Pattern</SectionHeading>
        <P>
          All components use inline styles with CSS variable references. This ensures theme changes propagate automatically:
        </P>
        <CodeBlock code={`// Standard card pattern used throughout:
<div
  className="rounded-xl border p-4"
  style={{
    backgroundColor: 'var(--bg-card)',
    borderColor: 'var(--border-primary)',
    boxShadow: 'var(--card-shadow)',
  }}
>
  <h3 style={{ color: 'var(--text-primary)' }}>Title</h3>
  <p style={{ color: 'var(--text-secondary)' }}>Body text</p>
</div>`} />
      </>
    ),
  },
  {
    id: 'components',
    title: 'Component Reference',
    icon: '\uD83E\uDDE9',
    render: () => (
      <>
        <P>
          The dashboard consists of 14+ components across 20 files, totaling ~3,500 lines of code. All components are functional React components with hooks.
        </P>

        <SectionHeading>Pages</SectionHeading>
        <DataTable
          headers={['Component', 'File', 'LOC', 'Purpose']}
          rows={[
            ['ProjectList', '`src/pages/ProjectList.jsx`', '~167', 'Project card grid with health indicators, search, and phase progress'],
            ['ProjectHUD', '`src/pages/ProjectHUD.jsx`', '~440', 'Main dashboard: Gantt/Kanban/List views, PM Triangle, Details sidebar'],
            ['HelpPage', '`src/pages/HelpPage.jsx`', '~700', 'This interactive documentation page'],
          ]}
        />

        <SectionHeading>View Components</SectionHeading>
        <DataTable
          headers={['Component', 'File', 'Purpose']}
          rows={[
            ['GanttTimeline', '`src/components/GanttTimeline.jsx`', 'CSS grid timeline with week headers, day columns, today marker, target-end line'],
            ['GanttBar', '`src/components/GanttBar.jsx`', 'Individual task bars: phase colors, progress fill, milestones (diamond), overdue (red outline), tooltips'],
            ['KanbanBoard', '`src/components/KanbanBoard.jsx`', '5-column drag-and-drop board with mobile tap-to-move support'],
            ['TaskListView', '`src/components/TaskListView.jsx`', 'Sortable table with responsive card layout for mobile'],
          ]}
        />

        <SectionHeading>UI Elements</SectionHeading>
        <DataTable
          headers={['Component', 'File', 'Purpose']}
          rows={[
            ['TaskDetailModal', '`src/components/TaskDetailModal.jsx`', 'Slide-in modal for task editing: status, assignee, hours, budget, risk, milestone, dates'],
            ['PMTriangle', '`src/components/PMTriangle.jsx`', '3 SVG arc gauges (Schedule/Budget/Scope) + 4 metric cards (PV/EV/AC/EAC)'],
            ['OnTargetIndicator', '`src/components/OnTargetIndicator.jsx`', 'Traffic light dot + label. Compact mode for cards, full mode for header'],
            ['ViewControls', '`src/components/ViewControls.jsx`', 'Tab bar for switching views + search + phase/status filter dropdowns'],
            ['NextSteps', '`src/components/NextSteps.jsx`', 'Sidebar widget showing next 5 incomplete tasks'],
            ['PhaseBadge', '`src/components/PhaseBadge.jsx`', 'Phase number badge + multi-phase progress bar'],
            ['ThemeToggle', '`src/components/ThemeToggle.jsx`', 'Sun/moon icon button for dark/light mode'],
            ['HelpButton', '`src/components/HelpButton.jsx`', 'Question mark icon linking to /help'],
            ['Skeleton', '`src/components/Skeleton.jsx`', 'Shimmer loading placeholders matching dashboard layout'],
          ]}
        />

        <SectionHeading>Library Modules</SectionHeading>
        <DataTable
          headers={['Module', 'File', 'Purpose']}
          rows={[
            ['supabase', '`src/lib/supabase.js`', 'Supabase client + 8 CRUD functions for projects/tasks/events'],
            ['scheduler', '`src/lib/scheduler.js`', 'Timeline builder: sequential + critical path scheduling, business day math'],
            ['evm', '`src/lib/evm.js`', 'Earned Value Management: calculateEVM, calculateHealthScore, getHealthStatus, formatCurrency'],
            ['ThemeContext', '`src/lib/ThemeContext.jsx`', 'React Context for theme state: useTheme() hook, localStorage + system preference'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'extending',
    title: 'How to Modify & Extend',
    icon: '\uD83D\uDD27',
    render: () => (
      <>
        <SectionHeading>Adding a New Route</SectionHeading>
        <ol className="text-sm space-y-1 ml-4 list-decimal mb-3" style={{ color: 'var(--text-secondary)' }}>
          <li>Create your page component in <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }}>src/pages/</code></li>
          <li>Import it in <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }}>src/main.jsx</code></li>
          <li>Add a <code>&lt;Route&gt;</code> element <strong>before</strong> the <code>/:slugHUD</code> catch-all route</li>
        </ol>
        <InfoBox type="warning">
          The <code>/:slugHUD</code> route is a catch-all parameter. Any new routes (like <code>/help</code>, <code>/status</code>) must be placed <strong>above</strong> it in the Routes block, otherwise React Router will treat your path as a project slug.
        </InfoBox>

        <SectionHeading>Adding a New Component</SectionHeading>
        <ol className="text-sm space-y-1 ml-4 list-decimal mb-3" style={{ color: 'var(--text-secondary)' }}>
          <li>Create the file in <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }}>src/components/</code></li>
          <li>Use the inline style pattern with CSS variables (see Theme System section)</li>
          <li>Export as default function component</li>
          <li>Import where needed</li>
        </ol>

        <SectionHeading>Adding a Supabase Function</SectionHeading>
        <P>Add your function to <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }}>src/lib/supabase.js</code>. Follow the existing pattern:</P>
        <CodeBlock code={`export async function myNewFunction(param) {
  const { data, error } = await supabase
    .from('table_name')
    .select('*')          // or .update(), .insert()
    .eq('column', param)
  if (error) throw error
  return data
}`} />

        <SectionHeading>Adding a New CSS Variable</SectionHeading>
        <P>Add the variable to <strong>both</strong> blocks in <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }}>src/index.css</code>:</P>
        <CodeBlock code={`:root {
  --my-new-var: #light-value;
}

.dark {
  --my-new-var: #dark-value;
}`} />

        <SectionHeading>Build & Deploy</SectionHeading>
        <CodeBlock code={`# Build
cd quotes-engine/dashboard
npm run build          # Output: dist/ (~484KB JS, ~37KB CSS)

# Deploy to production
scp -r dist/* root@104.248.69.86:/var/www/project-dashboard/

# Clean old assets on droplet (optional)
ssh root@104.248.69.86 'ls /var/www/project-dashboard/assets/'

# Nginx serves from /var/www/project-dashboard/
# No restart needed — static files, SPA fallback configured`} />

        <SectionHeading>Environment Variables</SectionHeading>
        <DataTable
          headers={['Variable', 'Default', 'Purpose']}
          rows={[
            ['`VITE_SUPABASE_URL`', 'https://gtfffxwfgcxiiauliynd.supabase.co', 'Supabase project URL'],
            ['`VITE_SUPABASE_ANON_KEY`', '(hardcoded fallback)', 'Supabase anon/public key (browser-safe)'],
          ]}
        />
        <InfoBox type="info">
          Both environment variables are optional. The dashboard has hardcoded fallbacks for the production Supabase project. Set these only if you need to point at a different Supabase instance (e.g., for local development).
        </InfoBox>

        <SectionHeading>Testing</SectionHeading>
        <P>Two Playwright test suites are available:</P>
        <CodeBlock code={`# Theme audit (46 assertions)
node tests/theme-audit.spec.mjs

# Full audit (28 assertions)
node tests/full-audit.spec.mjs

# Both require the dev server running:
npm run dev  # port 3210`} />
      </>
    ),
  },
]

/* ══════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════ */

export default function HelpPage() {
  const location = useLocation()
  const [expandedSections, setExpandedSections] = useState(new Set())

  // Auto-expand from URL hash on mount
  useEffect(() => {
    const hash = location.hash?.replace('#', '')
    if (hash && SECTIONS.some(s => s.id === hash)) {
      setExpandedSections(new Set([hash]))
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSection(id) {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function expandAll() {
    setExpandedSections(new Set(SECTIONS.map(s => s.id)))
  }

  function collapseAll() {
    setExpandedSections(new Set())
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <header className="border-b backdrop-blur sticky top-0 z-10" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--modal-header-bg)' }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="hover:opacity-80 transition-colors text-sm" style={{ color: 'var(--text-muted)' }}>
              &larr; <span className="hidden sm:inline">Projects</span>
            </Link>
            <span style={{ color: 'var(--border-secondary)' }}>/</span>
            <h1 className="text-lg font-bold">Help & Documentation</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-4">
        {/* Intro */}
        <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--card-shadow)' }}>
          <h2 className="text-base font-bold mb-2">ASI 360 Project HUD Dashboard</h2>
          <P>
            DoorDash-style project tracking dashboard for Allied Systems Integrations. This guide covers architecture, database connections, views, health scoring, scheduling, theming, and how to extend the system.
          </P>
          <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>v3.1</span>
            <span>&bull;</span>
            <span>React 19 + Vite 6 + Tailwind 4 + Supabase</span>
            <span>&bull;</span>
            <span>Zero extra dependencies</span>
          </div>
        </div>

        {/* Table of Contents */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Jump to:</span>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => {
                if (!expandedSections.has(s.id)) toggleSection(s.id)
                setTimeout(() => {
                  document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }, 100)
              }}
              className="text-xs px-2.5 py-1 rounded-full border transition-colors"
              style={{
                borderColor: expandedSections.has(s.id) ? '#3b82f6' : 'var(--border-primary)',
                backgroundColor: expandedSections.has(s.id) ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-card)',
                color: expandedSections.has(s.id) ? '#3b82f6' : 'var(--text-secondary)',
              }}
            >
              {s.icon} {s.title}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={expandAll} className="text-xs px-2 py-1 rounded transition-colors" style={{ color: 'var(--text-muted)' }}>
            Expand all
          </button>
          <button onClick={collapseAll} className="text-xs px-2 py-1 rounded transition-colors" style={{ color: 'var(--text-muted)' }}>
            Collapse all
          </button>
        </div>

        {/* Accordion Sections */}
        {SECTIONS.map(section => (
          <AccordionSection
            key={section.id}
            id={section.id}
            title={section.title}
            icon={section.icon}
            isExpanded={expandedSections.has(section.id)}
            onToggle={toggleSection}
          >
            {section.render()}
          </AccordionSection>
        ))}

        {/* Footer */}
        <div className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>
          <p>ASI 360 Project HUD Dashboard v3.1</p>
          <p className="mt-1">Allied Systems Integrations &bull; (510) 288-0994 &bull; ops@asi360.co</p>
          <p className="mt-2">
            <Link to="/" className="underline" style={{ color: 'var(--text-secondary)' }}>Back to Projects</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
