# MODULE 4: React Portal Frontend

> **Project:** ASI 360 Project Status Portal — `projects.asi360.co`
> **Stack:** React 18 + Vite + Tailwind CSS 3.4 + Supabase JS SDK v2
> **Auth model:** PIN-based (no user accounts)
> **Target:** Desktop-first, fully responsive to mobile

---

## 4.1 Design System

### Color Palette

| Token               | Hex       | Usage                                     |
|----------------------|-----------|--------------------------------------------|
| `primary-900`        | `#072B4D` | Darkest headings, header bg                |
| `primary-800`        | `#0A3F6E` | Hover states                               |
| `primary-700`        | `#0B5394` | **Primary brand** — buttons, links, bars   |
| `primary-600`        | `#1668B2` | Active states                              |
| `primary-500`        | `#2A7BC9` | Focus rings                                |
| `primary-100`        | `#D6E8F7` | Light backgrounds, selected rows           |
| `primary-50`         | `#EBF4FB` | Hover backgrounds                          |
| `secondary-700`      | `#35676F` | Dark teal                                  |
| `secondary-600`      | `#45818E` | **Secondary teal** — phase bars, badges    |
| `secondary-500`      | `#5A9CA8` | Hover teal                                 |
| `secondary-100`      | `#D4EAEE` | Light teal bg                              |
| `accent-700`         | `#8F4618` | Dark orange                                |
| `accent-600`         | `#B85B22` | **Accent orange** — alerts, warnings       |
| `accent-100`         | `#FDE8D5` | Light warning bg                           |
| `success-700`        | `#2B5A16` | Dark green                                 |
| `success-600`        | `#38761D` | **Success** — completed states             |
| `success-100`        | `#D9EED0` | Light success bg                           |
| `error-600`          | `#CC0000` | **Error** — validation, failures           |
| `error-100`          | `#FFE5E5` | Light error bg                             |
| `neutral-50`         | `#FAFBFC` | Page background                            |
| `neutral-100`        | `#F3F4F6` | Card backgrounds                           |
| `neutral-200`        | `#E5E7EB` | Borders                                    |
| `neutral-300`        | `#D1D5DB` | Disabled borders                           |
| `neutral-400`        | `#9CA3AF` | Placeholder text                           |
| `neutral-500`        | `#6B7280` | Secondary text                             |
| `neutral-600`        | `#4B5563` | Body text                                  |
| `neutral-700`        | `#374151` | Strong body text                           |
| `neutral-800`        | `#1F2937` | Headings                                   |
| `neutral-900`        | `#111827` | Darkest text                               |

### Phase Colors (Gantt bars and phase indicators)

| Phase | Name                         | Bar Color   | Background   |
|-------|------------------------------|-------------|--------------|
| 1     | Site Survey & Data Harvest   | `#0B5394`   | `#EBF4FB`    |
| 2     | Equipment Staging            | `#78909C`   | `#ECEFF1`    |
| 3     | Installation & Cutover       | `#E65100`   | `#FFF3E0`    |
| 4     | Programming & Commissioning  | `#45818E`   | `#D4EAEE`    |
| 5     | Training & Closeout          | `#38761D`   | `#D9EED0`    |

### Typography

```
Font stack:
  Headings: 'Inter', system-ui, -apple-system, sans-serif
  Body:     system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif
  Mono:     'JetBrains Mono', 'Fira Code', ui-monospace, monospace

Scale (rem):
  xs:    0.75rem  (12px)  — meta labels, timestamps
  sm:    0.875rem (14px)  — secondary text, table cells
  base:  1rem     (16px)  — body text
  lg:    1.125rem (18px)  — card titles
  xl:    1.25rem  (20px)  — section headings
  2xl:   1.5rem   (24px)  — page titles
  3xl:   1.875rem (30px)  — hero heading on lookup
  4xl:   2.25rem  (36px)  — project name on dashboard

Weight:
  normal:   400  — body text
  medium:   500  — labels, secondary headings
  semibold: 600  — card titles, emphasis
  bold:     700  — section headings
  extrabold:800  — project number, hero text

Line height:
  tight:  1.25
  snug:   1.375
  normal: 1.5
  relaxed:1.625
```

### Spacing Scale (4px base)

```
0:   0px       4:   16px      10:  40px      20:  80px
0.5: 2px       5:   20px      12:  48px      24:  96px
1:   4px       6:   24px      14:  56px      32: 128px
1.5: 6px       7:   28px      16:  64px
2:   8px       8:   32px      18:  72px
3:   12px      9:   36px
```

### Border Radius Tokens

| Token  | Value    | Usage                               |
|--------|----------|--------------------------------------|
| `sm`   | `4px`    | Input fields, small chips            |
| `md`   | `8px`    | Cards, note panels                   |
| `lg`   | `12px`   | Modal dialogs, large cards           |
| `xl`   | `16px`   | Hero sections, auth card             |
| `full` | `9999px` | Badges, avatars, progress rings      |

### Shadow Tokens

```
sm:  0 1px 2px 0 rgba(0,0,0,0.05)
md:  0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)
lg:  0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)
xl:  0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)
```

### Tailwind Config Extension

```js
// tailwind.config.js
import defaultTheme from 'tailwindcss/defaultTheme'

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#EBF4FB',
          100: '#D6E8F7',
          200: '#ADCFEE',
          300: '#7DB4E3',
          400: '#4D97D6',
          500: '#2A7BC9',
          600: '#1668B2',
          700: '#0B5394',
          800: '#0A3F6E',
          900: '#072B4D',
        },
        secondary: {
          100: '#D4EAEE',
          200: '#A9D5DD',
          300: '#7FBECC',
          400: '#5A9CA8',
          500: '#4C8C98',
          600: '#45818E',
          700: '#35676F',
        },
        accent: {
          100: '#FDE8D5',
          200: '#F9C9A0',
          300: '#E8954C',
          400: '#D47530',
          500: '#C46620',
          600: '#B85B22',
          700: '#8F4618',
        },
        success: {
          100: '#D9EED0',
          200: '#B3DDA1',
          300: '#7CC462',
          400: '#55A73A',
          500: '#449028',
          600: '#38761D',
          700: '#2B5A16',
        },
        error: {
          100: '#FFE5E5',
          200: '#FFB3B3',
          300: '#FF6666',
          400: '#E53333',
          500: '#D41111',
          600: '#CC0000',
          700: '#990000',
        },
        // Phase colors for Gantt
        phase: {
          1: '#0B5394',
          2: '#78909C',
          3: '#E65100',
          4: '#45818E',
          5: '#38761D',
        },
      },
      fontFamily: {
        heading: ['Inter', ...defaultTheme.fontFamily.sans],
        body: defaultTheme.fontFamily.sans,
        mono: ['JetBrains Mono', 'Fira Code', ...defaultTheme.fontFamily.mono],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0,0,0,0.05)',
        md: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
        lg: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
        xl: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'progress-fill': 'progressFill 1s ease-out forwards',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'bar-grow': 'barGrow 0.6s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        progressFill: {
          '0%': { width: '0%' },
          '100%': { width: 'var(--progress-target)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        barGrow: {
          '0%': { transform: 'scaleX(0)', transformOrigin: 'left' },
          '100%': { transform: 'scaleX(1)', transformOrigin: 'left' },
        },
      },
    },
  },
  plugins: [],
}
```

---

## 4.2 Page Specifications

### Page 1: LookupPage (`/`)

**Purpose:** Entry point. Client enters their project number and 6-digit PIN to authenticate.

#### Wireframe (Desktop)

```
+------------------------------------------------------------------+
|                                                                    |
|  [subtle geometric pattern background - #FAFBFC base]             |
|                                                                    |
|       +----------------------------------------------+            |
|       |                                              |            |
|       |           [ ASI 360 LOGO ]                   |            |
|       |     "One Company.. Unlimited Solutions.."    |            |
|       |                                              |            |
|       |  +-----------------------------------------+ |            |
|       |  |  PROJECT NUMBER                         | |            |
|       |  |  [ PROJ-XXXXXX-XXXX              ]  [->]| |            |
|       |  +-----------------------------------------+ |            |
|       |                                              |            |
|       |       ---- or after step 1 validates ----    |            |
|       |                                              |            |
|       |  Enter your 6-digit access PIN:              |            |
|       |   [_] [_] [_] [_] [_] [_]                    |            |
|       |                                              |            |
|       |  [ Access Project Status ]                   |            |
|       |                                              |            |
|       |  Don't have a PIN? [Request Access]          |            |
|       +----------------------------------------------+            |
|                                                                    |
|   ---------------------------------------------------------------  |
|   ASI 360 | (510) 288-0994 | ops@asi360.co | Powered by ASI 360   |
+------------------------------------------------------------------+
```

#### Wireframe (Mobile)

```
+------------------------------+
| [ ASI 360 LOGO ]             |
| "One Company.."              |
|                              |
| PROJECT NUMBER               |
| [ PROJ-XXXXXX-XXXX    ] [->] |
|                              |
| Enter your 6-digit PIN:     |
|  [_] [_] [_] [_] [_] [_]    |
|                              |
| [ Access Project Status ]    |
|                              |
| Don't have a PIN?            |
| [Request Access]             |
|                              |
| ─────────────────────────    |
| (510) 288-0994               |
| ops@asi360.co                |
+------------------------------+
```

#### Behavior

1. Page loads with focus on project number input
2. Input auto-formats as user types: `PROJ-` prefix locked, then `XXXXXX-XXXX` with auto-dashes
3. On submit or Enter: POST to `/api/validate-project` Edge Function
   - If valid project: slide in PIN input section with animation
   - If invalid: shake animation on input, error message "Project not found"
4. PIN input: 6 individual digit boxes
   - Auto-advance cursor on digit entry
   - Backspace moves to previous box and clears it
   - Paste support: distributes 6 digits across boxes
   - Mobile: `inputMode="numeric"` triggers number pad
5. On complete PIN: auto-submit to `/api/authenticate` Edge Function
   - If valid: success checkmark animation, redirect to `/status` after 400ms
   - If invalid: shake PIN boxes, clear them, error "Invalid PIN"
   - After 5 failed attempts: lock out for 15 minutes, show cooldown timer
6. "Request Access" link opens a modal with a simple form: name, email, project number. Submits to `/api/request-access` Edge Function.

#### Background Treatment

Subtle SVG geometric pattern (interlocking hexagons at 3% opacity) over a gradient from `#FAFBFC` to `#F0F4F8`. Pattern evokes security/technology without being distracting.

---

### Page 2: DashboardPage (`/status`)

**Purpose:** Project overview. Client sees progress at a glance and key information.

#### Wireframe (Desktop)

```
+------------------------------------------------------------------+
| [Logo]  Goldman Law Firm — Access Control    [Logout] [Full TL]  |
+------------------------------------------------------------------+
|                                                                    |
|  +---------------------------+  +-------------------------------+  |
|  | PROJECT STATUS            |  | OVERALL PROGRESS              |  |
|  | PROJ-202603-1234           |  |                               |  |
|  | Status: [In Progress]     |  |    (=====65%=====)            |  |
|  | Start: Mar 9, 2026        |  |    Progress Ring              |  |
|  | Target: Mar 20, 2026      |  |                               |  |
|  +---------------------------+  +-------------------------------+  |
|                                                                    |
|  +--------------------------------------------------------------+  |
|  | PHASE PROGRESS                                                |  |
|  |                                                               |  |
|  | 1. Survey & Data Harvest    [████████████████████] 100%  [x] |  |
|  | 2. Equipment Staging        [████████████░░░░░░░░]  60%  [~] |  |
|  | 3. Installation & Cutover   [░░░░░░░░░░░░░░░░░░░░]   0%  [ ] |  |
|  | 4. Programming & Commission [░░░░░░░░░░░░░░░░░░░░]   0%  [ ] |  |
|  | 5. Training & Closeout      [░░░░░░░░░░░░░░░░░░░░]   0%  [ ] |  |
|  +--------------------------------------------------------------+  |
|                                                                    |
|  +-------------------+  +-------------------+  +-----------------+ |
|  | KEY MILESTONES    |  | RECENT ACTIVITY   |  | YOUR PM         | |
|  |                   |  |                   |  |                 | |
|  | [x] Contract      |  | Mar 10 10:32 AM  |  | Don Bucknor     | |
|  |     Signed        |  | Task 2.1 started |  | (510) 288-0994  | |
|  | [x] Equipment     |  |                   |  | don@asi360.co   | |
|  |     Ordered       |  | Mar 9 4:15 PM    |  |                 | |
|  | [ ] Installation  |  | Phase 1 completed|  | [Call] [Email]  | |
|  |     Day           |  |                   |  |                 | |
|  | [ ] Go-Live       |  | Mar 9 9:00 AM    |  +-----------------+ |
|  |                   |  | Project created  |  | NEXT STEPS      | |
|  +-------------------+  +-------------------+  |                 | |
|                                                  | > Confirm net  | |
|  +----------------------------------------------+ closet access  | |
|  | QUICK ACTIONS                                 | by Mar 13      | |
|  | [View Full Timeline] [Download PDF] [Request] |                 | |
|  +----------------------------------------------+-----------------+ |
|                                                                    |
|  ----------------------------------------------------------------  |
|  ASI 360 | (510) 288-0994 | ops@asi360.co | Confidential           |
+------------------------------------------------------------------+
```

#### Wireframe (Mobile — stacked cards)

```
+------------------------------+
| [Logo]  Goldman Law  [Menu]  |
+------------------------------+
| PROJ-202603-1234             |
| Status: [In Progress]       |
|      (====65%====)           |
|      Progress Ring           |
+------------------------------+
| PHASE PROGRESS               |
| 1. Survey    [████] 100% [x]|
| 2. Staging   [███░]  60% [~]|
| 3. Install   [░░░░]   0% [ ]|
| 4. Program   [░░░░]   0% [ ]|
| 5. Training  [░░░░]   0% [ ]|
+------------------------------+
| KEY MILESTONES               |
| [x] Contract Signed         |
| [x] Equipment Ordered       |
| [ ] Installation Day        |
| [ ] Go-Live                 |
+------------------------------+
| RECENT ACTIVITY              |
| Mar 10 — Task 2.1 started   |
| Mar 9  — Phase 1 completed  |
+------------------------------+
| YOUR PM                     |
| Don Bucknor                 |
| [Call]  [Email]             |
+------------------------------+
| NEXT STEPS                  |
| Confirm closet access       |
| by Mar 13                   |
+------------------------------+
| [Timeline] [PDF] [Request]  |
+------------------------------+
```

#### Behavior

1. On mount: fetch project data via Supabase JS SDK (direct table read with RLS, or Edge Function)
2. Progress ring animates from 0 to current percentage on load
3. Phase progress bars animate sequentially with staggered delays (200ms between phases)
4. Real-time updates via Supabase Realtime subscription on `project_tasks` table
   - When a task status changes, the relevant phase bar animates to new width
   - Activity feed prepends new entry with slide-in animation
   - Toast notification: "Phase 1 completed" or "Task 2.1 started"
5. Milestone checkmarks appear with a green pop animation when marked complete
6. "View Full Timeline" navigates to `/status/timeline`
7. "Download PDF" triggers Edge Function that generates PDF from server-side template (same Jinja template used for quotes)
8. "Request Update" opens modal with textarea, sends notification to PM via Edge Function
9. Session: JWT checked on mount. If expired, redirect to `/` with toast "Session expired, please log in again."
10. Contact card: phone link (`tel:`), email link (`mailto:`)

---

### Page 3: TimelinePage (`/status/timeline`)

**Purpose:** Full Gantt chart view ported from the existing HTML/CSS template.

#### Wireframe (Desktop)

```
+------------------------------------------------------------------+
| [Logo]  Goldman Law Firm — Access Control    [<- Dashboard]      |
+------------------------------------------------------------------+
|                                                                    |
| PROJECT TIMELINE                                                   |
| Goldman Law Firm — Access Control Upgrade                          |
|                                                                    |
| +------+--------+------+------+------+------+------+------+...+  |
| | META | Title  | Client| PM   | Date | Contract | Status|    |  |
| +------+--------+------+------+------+------+------+------+...+  |
|                                                                    |
| +------+--------+------+------+------+------+------+------+------+|
| |PHASE | DETAIL | MON  | TUE  | WED  | THU  | FRI  | MON  | ... ||
| +------+--------+------+------+------+------+------+------+------+|
| |      | Survey |[==Door Audit==]|    |      |      |      |    ||
| |  1   | Creds  |[==Credentials=]|    |      |      |      |    ||
| |      | Cable  |      |[Cable]|      |      |      |      |    ||
| +------+--------+------+------+------+------+------+------+------+|
| |      | Procure|      |      |[===Procurement===]  |      |    ||
| |  2   | Build  |      |      |      |[===Shop Build===]   |    ||
| |      | QA     |      |      |      |      |[QA]   |      |    ||
| +------+--------+------+------+------+------+------+------+------+|
| ...                                        |<-- TODAY LINE -->|   |
| +------+--------+------+------+------+------+------+------+------+|
| | [x]  | COMPLETE|     |      |      |      |      |      |[x] ||
| +------+--------+------+------+------+------+------+------+------+|
|                                                                    |
| +-------------------+  +-------------------+  +-----------------+ |
| | Delivery Strategy |  | Payment Milestones|  | Scope Summary   | |
| | > Pre-build...    |  | > At contract...  |  | > Keri NXT...   | |
| | > Cutover: 90min  |  | > At completion.. |  | > 2-door...     | |
| +-------------------+  +-------------------+  +-----------------+ |
|                                                                    |
| [Export PDF]  [Export PNG]          [<- Back to Dashboard]          |
+------------------------------------------------------------------+
```

#### Wireframe (Mobile — condensed, horizontally scrollable)

```
+------------------------------+
| [<-]  Project Timeline       |
+------------------------------+
| Goldman Law Firm             |
| Access Control Upgrade       |
|                              |
| +------ scroll right ------> |
| | PH | DETAIL | M | T | W ..|
| |  1 | Survey |[==]|  |  ..|
| |    | Creds  |[==]|  |  ..|
| |    | Cable  |  |[=]|  ..|
| +------- scroll ----->      |
|                              |
| Delivery Strategy            |
| > Pre-build all equip...    |
| > Cutover: 90 min           |
|                              |
| Payment Milestones           |
| > At contract: $5,627.50    |
|                              |
| [Export PDF] [Back]          |
+------------------------------+
```

#### Behavior

1. Gantt chart renders as a CSS grid (ported from the HTML table), not an HTML `<table>`. This allows better responsive handling.
2. Today line: red dashed vertical line positioned at today's column. If today is outside the project date range, show a label indicating project is future/past.
3. Phase rows: colored bars span across day columns using `grid-column` computed from `bar_start` / `bar_end` values
4. Milestone row: highlighted with blue background and diamond marker
5. Hover on a task bar: tooltip showing full task name, date range, status, assigned person
6. On mobile (< 768px):
   - Phase number and detail columns are sticky-left
   - Day columns scroll horizontally with momentum scrolling
   - Touch-friendly: swipe to scroll
7. Note cards below chart render in a responsive grid: 3 columns on desktop, 2 on tablet, 1 on mobile
8. Export PDF: calls Edge Function that renders server-side template (same Jinja template) and returns a downloadable PDF
9. Export PNG: uses `html2canvas` to capture the Gantt chart div and trigger download
10. "Back to Dashboard" navigates to `/status`
11. Chart data comes from same project data already cached by React Query — no additional fetch

---

## 4.3 Component Architecture

### File Tree

```
src/
  App.jsx
  main.jsx
  index.css

  pages/
    LookupPage.jsx
    DashboardPage.jsx
    TimelinePage.jsx
    NotFoundPage.jsx

  components/
    layout/
      AppShell.jsx
      Header.jsx
      Footer.jsx
    auth/
      ProjectNumberInput.jsx
      PinInput.jsx
      RequestAccessModal.jsx
    dashboard/
      ProjectHeader.jsx
      OverallProgress.jsx
      PhaseProgress.jsx
      PhaseProgressBar.jsx
      MilestoneCard.jsx
      MilestoneItem.jsx
      ActivityFeed.jsx
      ActivityItem.jsx
      ContactCard.jsx
      NextStepsCard.jsx
      QuickActions.jsx
    timeline/
      GanttChart.jsx
      GanttMetaGrid.jsx
      GanttGrid.jsx
      GanttPhaseGroup.jsx
      GanttTaskBar.jsx
      GanttMilestoneRow.jsx
      GanttTodayLine.jsx
      GanttTooltip.jsx
      NoteCards.jsx
      NoteCard.jsx
      ExportControls.jsx
    shared/
      StatusBadge.jsx
      ProgressRing.jsx
      LoadingSpinner.jsx
      ErrorBoundary.jsx
      Toast.jsx
      ToastContainer.jsx
      Modal.jsx
      Button.jsx
      IconButton.jsx

  hooks/
    useAuth.js
    useProject.js
    useProjectStatus.js
    useRealtimeUpdates.js
    useTimeline.js
    useToast.js
    useCountdown.js

  context/
    AuthContext.jsx
    ToastContext.jsx

  lib/
    supabase.js
    api.js
    utils.js
    constants.js
    gantt-utils.js

  styles/
    gantt.css
    animations.css
```

### Component Props & Behavior (Exhaustive)

---

#### `App.jsx`

```jsx
// Root component. Sets up providers and routing.
// No props — top-level entry point.

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<LookupPage />} />
              <Route path="/status" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/status/timeline" element={<ProtectedRoute><TimelinePage /></ProtectedRoute>} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
```

---

#### `layout/AppShell.jsx`

```
Props: none (uses Outlet from react-router)

State:
  - none (stateless layout wrapper)

Renders:
  <div className="min-h-screen flex flex-col bg-neutral-50">
    <Header />
    <main className="flex-1">
      <Outlet />
    </main>
    <Footer />
    <ToastContainer />
  </div>

Behavior:
  - Wraps all pages with consistent header/footer
  - Main content area uses flex-1 to push footer to bottom
```

#### `layout/Header.jsx`

```
Props:
  - none (reads auth context internally)

State (from context):
  - isAuthenticated: boolean
  - projectName: string | null

Renders:
  Desktop:
    <header className="h-16 border-b border-neutral-200 bg-white px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src="/asi360-logo.svg" alt="ASI 360" className="h-8" />
        {isAuthenticated && <span className="text-sm text-neutral-500">|</span>}
        {isAuthenticated && <span className="font-heading font-semibold text-neutral-800 truncate max-w-[300px]">{projectName}</span>}
      </div>
      {isAuthenticated && (
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={navigateToTimeline}>Full Timeline</Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>Sign Out</Button>
        </div>
      )}
    </header>

  Mobile:
    Logo only, hamburger menu with nav items

Behavior:
  - Logo links to / (clears auth)
  - "Sign Out" calls auth.logout(), navigates to /
  - Conditionally shows project name and nav when authenticated
```

#### `layout/Footer.jsx`

```
Props: none

Renders:
  <footer className="border-t border-neutral-200 bg-white py-4 px-6">
    <div className="flex flex-col sm:flex-row justify-between text-xs text-neutral-400">
      <span>ASI 360 | (510) 288-0994 | ops@asi360.co</span>
      <span>Powered by Allied Systems Integrations 360</span>
    </div>
  </footer>
```

---

#### `auth/ProjectNumberInput.jsx`

```
Props:
  - onValidProject: (projectId: string) => void
  - disabled: boolean

State:
  - value: string (raw input)
  - formattedValue: string (displayed with PROJ- prefix and dashes)
  - isValidating: boolean
  - error: string | null

Key behaviors:
  - Renders a single text input with "PROJ-" prefix baked in (non-editable prefix displayed as label)
  - Auto-inserts dash after 6th digit: "202603-1234"
  - Validates format on blur: /^PROJ-\d{6}-\d{4}$/
  - On submit: calls api.validateProject(projectNumber)
    - Success: calls onValidProject with the project ID from response
    - Error: sets error state, input shakes (animate-shake CSS)
  - Keyboard: Enter submits

Tailwind:
  Container: "w-full"
  Label:     "text-sm font-medium text-neutral-700 mb-1.5"
  Input:     "w-full h-12 px-4 rounded-lg border border-neutral-300 text-lg font-mono
              tracking-wider focus:ring-2 focus:ring-primary-500 focus:border-primary-500
              disabled:bg-neutral-100 disabled:text-neutral-400"
  Error:     "text-sm text-error-600 mt-1.5 flex items-center gap-1"
  Button:    "absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full
              bg-primary-700 text-white flex items-center justify-center
              hover:bg-primary-800 transition-colors"
```

---

#### `auth/PinInput.jsx`

```
Props:
  - onComplete: (pin: string) => void
  - disabled: boolean
  - error: string | null
  - onClear: () => void

State:
  - digits: string[6] (array of single chars or empty strings)
  - activeIndex: number (which box is focused)

Refs:
  - inputRefs: RefObject<HTMLInputElement>[6]

Key behaviors:
  - Renders 6 individual <input> elements, each accepting 1 digit
  - On digit entry: store digit, auto-advance to next box
  - On backspace with empty box: move to previous box
  - On paste: distribute up to 6 digits across boxes, auto-submit if all filled
  - When all 6 filled: auto-call onComplete(digits.join(''))
  - When error prop changes to truthy: shake animation, clear all boxes, focus first
  - Mobile: inputMode="numeric" pattern="[0-9]" for number pad
  - Accessibility: aria-label="PIN digit {n} of 6" on each input

Tailwind per box:
  "w-12 h-14 text-center text-2xl font-bold rounded-lg border-2
   border-neutral-300 focus:border-primary-700 focus:ring-2 focus:ring-primary-500
   transition-all duration-150 caret-transparent
   disabled:bg-neutral-100 disabled:text-neutral-400"

  Filled state: "border-primary-700 bg-primary-50"
  Error state:  "border-error-600 bg-error-100 animate-shake"

Container:
  "flex gap-3 justify-center"
```

**JSX Code Snippet:**

```jsx
import { useRef, useState, useEffect } from 'react'

export default function PinInput({ onComplete, disabled, error, onClear }) {
  const [digits, setDigits] = useState(Array(6).fill(''))
  const inputRefs = useRef([])

  useEffect(() => {
    if (error) {
      setDigits(Array(6).fill(''))
      inputRefs.current[0]?.focus()
    }
  }, [error])

  const handleChange = (index, value) => {
    if (disabled) return
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    setDigits(next)

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    if (next.every(d => d !== '')) {
      onComplete(next.join(''))
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits]
      next[index - 1] = ''
      setDigits(next)
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const next = Array(6).fill('')
    pasted.split('').forEach((d, i) => { next[i] = d })
    setDigits(next)
    const focusIdx = Math.min(pasted.length, 5)
    inputRefs.current[focusIdx]?.focus()
    if (next.every(d => d !== '')) {
      onComplete(next.join(''))
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <label className="text-sm font-medium text-neutral-700">
        Enter your 6-digit access PIN
      </label>
      <div className="flex gap-3" onPaste={handlePaste}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={el => inputRefs.current[i] = el}
            type="text"
            inputMode="numeric"
            pattern="[0-9]"
            maxLength={1}
            value={digit}
            disabled={disabled}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            aria-label={`PIN digit ${i + 1} of 6`}
            className={`
              w-12 h-14 text-center text-2xl font-bold rounded-lg border-2
              transition-all duration-150 caret-transparent outline-none
              ${error
                ? 'border-error-600 bg-error-100 animate-shake'
                : digit
                  ? 'border-primary-700 bg-primary-50'
                  : 'border-neutral-300 bg-white'
              }
              focus:border-primary-700 focus:ring-2 focus:ring-primary-500
              disabled:bg-neutral-100 disabled:text-neutral-400
            `}
          />
        ))}
      </div>
      {error && (
        <p className="text-sm text-error-600 flex items-center gap-1" role="alert">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}
```

---

#### `auth/RequestAccessModal.jsx`

```
Props:
  - isOpen: boolean
  - onClose: () => void
  - defaultProjectNumber: string (pre-fill from the lookup input)

State:
  - name: string
  - email: string
  - projectNumber: string
  - isSubmitting: boolean
  - isSuccess: boolean

Behavior:
  - Modal overlay (dark scrim, centered card)
  - Form: name, email, project number (pre-filled)
  - Submit calls api.requestAccess({ name, email, projectNumber })
  - On success: show checkmark, "We'll email your PIN within 1 business day", auto-close after 3s
  - On error: show error message
  - Close on ESC, click outside, or X button
  - Focus trap inside modal (tab cycling)
```

---

#### `dashboard/ProjectHeader.jsx`

```
Props:
  - projectNumber: string       // "PROJ-202603-1234"
  - projectName: string         // "Goldman Law Firm — Access Control Upgrade"
  - status: 'initiated' | 'in_progress' | 'on_hold' | 'completed' | 'delivered'
  - startDate: string           // ISO date
  - targetDate: string          // ISO date

State: none (pure presentational)

Renders:
  <div className="bg-white rounded-lg border border-neutral-200 p-6 shadow-sm">
    <div className="flex items-start justify-between">
      <div>
        <p className="font-mono text-sm text-neutral-500 tracking-wide">{projectNumber}</p>
        <h1 className="font-heading text-2xl font-bold text-neutral-900 mt-1">{projectName}</h1>
      </div>
      <StatusBadge status={status} />
    </div>
    <div className="flex gap-6 mt-4 text-sm text-neutral-600">
      <span>Start: <strong>{formatDate(startDate)}</strong></span>
      <span>Target: <strong>{formatDate(targetDate)}</strong></span>
    </div>
  </div>
```

---

#### `dashboard/OverallProgress.jsx`

```
Props:
  - percentage: number  // 0-100
  - label: string       // "Overall Completion"

Renders:
  A card containing a centered ProgressRing (128px diameter) with the percentage
  displayed inside in large bold text. Label below the ring.

  <div className="bg-white rounded-lg border border-neutral-200 p-6 shadow-sm flex flex-col items-center">
    <ProgressRing size={128} strokeWidth={10} percentage={percentage} />
    <p className="text-sm text-neutral-500 mt-3">{label}</p>
  </div>
```

---

#### `dashboard/PhaseProgress.jsx`

```
Props:
  - phases: Phase[]
    where Phase = {
      number: number,
      name: string,
      status: 'not_started' | 'in_progress' | 'completed',
      percentage: number,
      taskCount: number,
      completedTasks: number,
    }

Renders:
  <div className="bg-white rounded-lg border border-neutral-200 p-6 shadow-sm">
    <h2 className="font-heading text-lg font-semibold text-neutral-800 mb-4">Phase Progress</h2>
    <div className="space-y-3">
      {phases.map((phase, i) => (
        <PhaseProgressBar key={phase.number} phase={phase} delay={i * 200} />
      ))}
    </div>
  </div>

Animation:
  Bars animate sequentially on mount with staggered delays.
```

#### `dashboard/PhaseProgressBar.jsx`

```
Props:
  - phase: Phase
  - delay: number (ms)

State:
  - animated: boolean (starts false, set true after delay)

Renders:
  <div className="flex items-center gap-3">
    <span className="w-6 h-6 rounded-full bg-phase-{N} text-white text-xs font-bold flex items-center justify-center shrink-0">
      {phase.number}
    </span>
    <div className="flex-1 min-w-0">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-neutral-700 truncate">{phase.name}</span>
        <span className="text-neutral-500 shrink-0">{phase.completedTasks}/{phase.taskCount}</span>
      </div>
      <div className="h-2.5 bg-neutral-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: animated ? `${phase.percentage}%` : '0%',
            backgroundColor: PHASE_COLORS[phase.number],
          }}
        />
      </div>
    </div>
    <StatusIcon status={phase.status} />  // checkmark, spinner, or empty circle
  </div>
```

**JSX Code Snippet for PhaseProgress:**

```jsx
import { useState, useEffect } from 'react'

const PHASE_COLORS = {
  1: '#0B5394',
  2: '#78909C',
  3: '#E65100',
  4: '#45818E',
  5: '#38761D',
}

function StatusIcon({ status }) {
  if (status === 'completed') {
    return (
      <div className="w-6 h-6 rounded-full bg-success-600 text-white flex items-center justify-center animate-scale-in">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    )
  }
  if (status === 'in_progress') {
    return (
      <div className="w-6 h-6 rounded-full border-2 border-accent-600 flex items-center justify-center animate-pulse-soft">
        <div className="w-2 h-2 rounded-full bg-accent-600" />
      </div>
    )
  }
  return <div className="w-6 h-6 rounded-full border-2 border-neutral-300" />
}

export default function PhaseProgressBar({ phase, delay = 0 }) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  return (
    <div className="flex items-center gap-3">
      <span
        className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
        style={{ backgroundColor: PHASE_COLORS[phase.number] }}
      >
        {phase.number}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium text-neutral-700 truncate">{phase.name}</span>
          <span className="text-neutral-500 text-xs shrink-0 ml-2">
            {phase.completedTasks}/{phase.taskCount}
          </span>
        </div>
        <div className="h-2.5 bg-neutral-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: animated ? `${phase.percentage}%` : '0%',
              backgroundColor: PHASE_COLORS[phase.number],
            }}
          />
        </div>
      </div>
      <StatusIcon status={phase.status} />
    </div>
  )
}
```

---

#### `dashboard/MilestoneCard.jsx`

```
Props:
  - milestones: Milestone[]
    where Milestone = {
      id: string,
      label: string,          // "Contract Signed"
      targetDate: string,     // ISO date or null
      completedDate: string,  // ISO date or null
      isComplete: boolean,
    }

Renders:
  Card with vertical milestone list. Each MilestoneItem shows a checkmark (complete)
  or empty circle (pending), the label, and the date.
```

#### `dashboard/MilestoneItem.jsx`

```
Props:
  - milestone: Milestone

Renders:
  <div className="flex items-start gap-3 py-2">
    {milestone.isComplete ? (
      <div className="w-5 h-5 rounded-full bg-success-600 text-white flex items-center justify-center mt-0.5 shrink-0">
        <CheckIcon className="w-3 h-3" />
      </div>
    ) : (
      <div className="w-5 h-5 rounded-full border-2 border-neutral-300 mt-0.5 shrink-0" />
    )}
    <div>
      <p className={`text-sm ${milestone.isComplete ? 'text-neutral-500 line-through' : 'font-medium text-neutral-700'}`}>
        {milestone.label}
      </p>
      {milestone.completedDate && (
        <p className="text-xs text-neutral-400">{formatDate(milestone.completedDate)}</p>
      )}
      {!milestone.isComplete && milestone.targetDate && (
        <p className="text-xs text-accent-600">Target: {formatDate(milestone.targetDate)}</p>
      )}
    </div>
  </div>
```

---

#### `dashboard/ActivityFeed.jsx`

```
Props:
  - activities: Activity[]
    where Activity = {
      id: string,
      timestamp: string,    // ISO datetime
      message: string,      // "Task 2.1 started"
      type: 'task_started' | 'task_completed' | 'phase_completed' | 'project_created' | 'note_added'
    }
  - maxItems: number (default 5)

Renders:
  Card with a vertical timeline of activities. Each activity has a colored dot
  (type-dependent), timestamp, and message. Most recent at top.

  <div className="bg-white rounded-lg border border-neutral-200 p-6 shadow-sm">
    <h3 className="font-heading text-lg font-semibold text-neutral-800 mb-4">Recent Activity</h3>
    <div className="space-y-0">
      {activities.slice(0, maxItems).map(activity => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
    </div>
  </div>

New items animate in with slideUp when added via realtime.
```

#### `dashboard/ActivityItem.jsx`

```
Props:
  - activity: Activity
  - isNew: boolean (triggers entrance animation)

Renders:
  <div className={`flex gap-3 py-2.5 border-b border-neutral-100 last:border-0 ${isNew ? 'animate-slide-up' : ''}`}>
    <div className="relative">
      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${typeColors[activity.type]}`} />
      <div className="absolute top-4 left-1 w-px h-full bg-neutral-200" />   // vertical line connector
    </div>
    <div>
      <p className="text-sm text-neutral-700">{activity.message}</p>
      <p className="text-xs text-neutral-400 mt-0.5">{formatRelativeTime(activity.timestamp)}</p>
    </div>
  </div>

Type color map:
  task_started:    'bg-primary-500'
  task_completed:  'bg-success-600'
  phase_completed: 'bg-accent-600'
  project_created: 'bg-neutral-400'
  note_added:      'bg-secondary-600'
```

---

#### `dashboard/ContactCard.jsx`

```
Props:
  - name: string         // "Don Bucknor"
  - phone: string        // "(510) 288-0994"
  - email: string        // "don@asi360.co"
  - role: string         // "Project Manager"

Renders:
  <div className="bg-white rounded-lg border border-neutral-200 p-6 shadow-sm">
    <h3 className="font-heading text-lg font-semibold text-neutral-800 mb-3">Your Project Manager</h3>
    <p className="font-semibold text-neutral-900">{name}</p>
    <p className="text-sm text-neutral-500">{role}</p>
    <div className="flex gap-3 mt-4">
      <a href={`tel:${phone}`} className="flex-1 h-10 rounded-lg bg-primary-700 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary-800 transition-colors">
        <PhoneIcon className="w-4 h-4" /> Call
      </a>
      <a href={`mailto:${email}`} className="flex-1 h-10 rounded-lg border border-primary-700 text-primary-700 text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary-50 transition-colors">
        <EmailIcon className="w-4 h-4" /> Email
      </a>
    </div>
  </div>
```

---

#### `dashboard/NextStepsCard.jsx`

```
Props:
  - steps: NextStep[]
    where NextStep = {
      id: string,
      description: string,   // "Provide network closet access"
      dueDate: string | null, // ISO date
      isUrgent: boolean,
    }

Renders:
  Card with a list of action items the client needs to do. Urgent items
  highlighted with accent-600 left border.

  Each step:
    <div className={`pl-4 py-2 border-l-3 ${step.isUrgent ? 'border-accent-600 bg-accent-100/50' : 'border-neutral-200'}`}>
      <p className="text-sm text-neutral-700">{step.description}</p>
      {step.dueDate && <p className="text-xs text-neutral-400 mt-0.5">Due: {formatDate(step.dueDate)}</p>}
    </div>
```

---

#### `dashboard/QuickActions.jsx`

```
Props:
  - onViewTimeline: () => void
  - onDownloadPdf: () => void
  - onRequestUpdate: () => void

Renders:
  <div className="flex flex-wrap gap-3">
    <Button variant="primary" onClick={onViewTimeline}>
      <ChartIcon className="w-4 h-4" /> View Full Timeline
    </Button>
    <Button variant="outline" onClick={onDownloadPdf}>
      <DownloadIcon className="w-4 h-4" /> Download PDF
    </Button>
    <Button variant="outline" onClick={onRequestUpdate}>
      <MessageIcon className="w-4 h-4" /> Request Update
    </Button>
  </div>
```

---

#### `timeline/GanttChart.jsx`

Top-level wrapper for the entire Gantt visualization. This is the main component that ports the existing HTML template to React.

```
Props:
  - project: ProjectData
    where ProjectData = {
      title: string,
      client: string,
      manager: string,
      date: string,
      quoteNo: string,
      contractValue: number,
      periods: { label: string, span: number }[],
      dayLabels: string[],
      phases: GanttPhase[],
      notes: Note[],
    }

State:
  - tooltipData: { task, position } | null
  - isExporting: boolean

Renders:
  <div className="space-y-6">
    <GanttMetaGrid project={project} />
    <div className="gantt-wrapper relative overflow-x-auto border border-neutral-300 rounded-md" ref={chartRef}>
      <GanttGrid
        periods={project.periods}
        dayLabels={project.dayLabels}
        phases={project.phases}
        onTaskHover={setTooltipData}
      />
      <GanttTodayLine totalDays={project.dayLabels.length} projectStartDate={project.date} />
      {tooltipData && <GanttTooltip {...tooltipData} />}
    </div>
    <NoteCards notes={project.notes} />
    <ExportControls chartRef={chartRef} projectTitle={project.title} />
  </div>
```

---

#### `timeline/GanttGrid.jsx`

Core grid that replaces the HTML `<table>`. Uses CSS Grid instead of `<table>` for better responsiveness.

```
Props:
  - periods: { label: string, span: number }[]
  - dayLabels: string[]
  - phases: GanttPhase[]
  - onTaskHover: (data | null) => void

Renders:
  CSS Grid with columns: [phase: 40px] [detail: 180px] [day x N: 1fr each] [end: 24px]

  - Period header row (week labels spanning multiple columns)
  - Day header row (MON, TUE, WED, etc.)
  - For each phase: a GanttPhaseGroup
  - Milestone row at the end

Styles (from gantt.css):
  .gantt-grid {
    display: grid;
    grid-template-columns: 40px 180px repeat(var(--total-days), 1fr) 24px;
    font-size: 0.75rem;
  }

Mobile (< 768px):
  Phase and detail columns are position: sticky; left: 0 with z-index: 10
  Day columns scroll horizontally within the overflow-x container
```

**JSX Code Snippet (GanttChart skeleton):**

```jsx
import { useRef } from 'react'
import GanttMetaGrid from './GanttMetaGrid'
import GanttGrid from './GanttGrid'
import GanttTodayLine from './GanttTodayLine'
import NoteCards from './NoteCards'
import ExportControls from './ExportControls'

export default function GanttChart({ project }) {
  const chartRef = useRef(null)

  const totalDays = project.dayLabels.length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Meta grid: project info summary */}
      <GanttMetaGrid
        title={project.title}
        client={project.client}
        manager={project.manager}
        date={project.date}
        quoteNo={project.quoteNo}
        contractValue={project.contractValue}
      />

      {/* Gantt chart container — horizontally scrollable on mobile */}
      <div
        ref={chartRef}
        className="relative border border-neutral-300 rounded-md overflow-x-auto"
        style={{ '--total-days': totalDays }}
      >
        <div
          className="gantt-grid min-w-[800px]"
          style={{
            display: 'grid',
            gridTemplateColumns: `40px 180px repeat(${totalDays}, 1fr) 24px`,
          }}
        >
          {/* Period header row */}
          <div className="gantt-cell-phase-header bg-neutral-700" />
          <div className="gantt-cell-detail-header bg-neutral-700" />
          {project.periods.map((period, i) => (
            <div
              key={i}
              className="bg-neutral-600 text-white text-center text-xs font-bold py-1 border-r border-neutral-500"
              style={{ gridColumn: `span ${period.span}` }}
            >
              {period.label}
            </div>
          ))}
          <div className="bg-neutral-700" />

          {/* Day label header row */}
          <div className="bg-neutral-800 text-white text-center text-xs font-bold py-1.5 border-r border-neutral-600">
            PHASE
          </div>
          <div className="bg-neutral-800 text-white text-xs font-bold py-1.5 pl-2 border-r border-neutral-600">
            DETAILS
          </div>
          {project.dayLabels.map((day, i) => (
            <div
              key={i}
              className="bg-neutral-700 text-white text-center text-xs font-bold py-1.5 border-r border-neutral-600"
            >
              {day}
            </div>
          ))}
          <div className="bg-neutral-700 text-white text-xs py-1.5 writing-vertical text-center">
            END
          </div>

          {/* Phase groups (task rows) */}
          {project.phases.map(phase => (
            <GanttPhaseGroup
              key={phase.number}
              phase={phase}
              totalDays={totalDays}
            />
          ))}
        </div>

        {/* Today line overlay */}
        <GanttTodayLine
          totalDays={totalDays}
          projectStartDate={project.date}
        />
      </div>

      {/* Note cards below chart */}
      {project.notes && project.notes.length > 0 && (
        <NoteCards notes={project.notes} />
      )}

      {/* Export buttons */}
      <ExportControls chartRef={chartRef} projectTitle={project.title} />
    </div>
  )
}
```

---

#### `timeline/GanttTaskBar.jsx`

```
Props:
  - barStart: number
  - barEnd: number
  - barLabel: string
  - barColor: string
  - totalDays: number
  - taskName: string (for tooltip)
  - onHover: (data | null) => void

Renders:
  Empty day cells before the bar, then a bar cell spanning (barEnd - barStart + 1) columns,
  then empty cells after.

  Bar element:
    <div
      className="gantt-bar h-4 rounded-sm text-white text-[0.625rem] font-semibold flex items-center justify-center whitespace-nowrap overflow-hidden px-1 animate-bar-grow"
      style={{ backgroundColor: barColor }}
      onMouseEnter={...}
      onMouseLeave={...}
    >
      {barLabel}
    </div>

  On hover: calls onHover with { taskName, barLabel, barStart, barEnd, position }
  On leave: calls onHover(null)
```

---

#### `timeline/GanttTodayLine.jsx`

```
Props:
  - totalDays: number
  - projectStartDate: string (ISO date)

State:
  - todayIndex: number | null (computed from projectStartDate and today)

Renders:
  If todayIndex is within range (0 to totalDays-1):
    Absolute-positioned red dashed vertical line at the correct column position.

    <div
      className="absolute top-0 bottom-0 border-l-2 border-dashed border-error-600 z-20 pointer-events-none"
      style={{
        left: `calc(220px + (${todayIndex} + 0.5) * ((100% - 244px) / ${totalDays}))`,
      }}
    >
      <span className="absolute -top-5 left-1 bg-error-600 text-white text-[0.5rem] px-1 rounded">
        TODAY
      </span>
    </div>

  If todayIndex is null (today is outside project range): renders nothing.
```

---

#### `timeline/NoteCards.jsx`

```
Props:
  - notes: Note[]
    where Note = {
      title: string,
      color: string,
      bulletItems: string[],
      content: string | null,
    }

Renders:
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {notes.map(note => <NoteCard key={note.title} note={note} />)}
  </div>
```

#### `timeline/NoteCard.jsx`

```
Props:
  - note: Note

Renders:
  <div className="border border-neutral-200 rounded-md overflow-hidden shadow-sm">
    <div className="px-4 py-2 text-white text-xs font-bold uppercase tracking-wide" style={{ backgroundColor: note.color }}>
      {note.title}
    </div>
    <div className="p-4 text-sm text-neutral-600 space-y-1.5">
      {note.bulletItems ? (
        <ul className="space-y-1">
          {note.bulletItems.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-neutral-400 shrink-0">&#9656;</span>
              <span dangerouslySetInnerHTML={{ __html: item }} />
            </li>
          ))}
        </ul>
      ) : (
        <div dangerouslySetInnerHTML={{ __html: note.content }} />
      )}
    </div>
  </div>
```

---

#### `timeline/ExportControls.jsx`

```
Props:
  - chartRef: RefObject<HTMLDivElement>
  - projectTitle: string

State:
  - isExportingPdf: boolean
  - isExportingPng: boolean

Behavior:
  Export PDF: calls Edge Function `/api/export-timeline-pdf` with project data, receives blob, triggers download
  Export PNG: uses html2canvas library to capture chartRef element, triggers download as PNG

Renders:
  <div className="flex gap-3">
    <Button variant="outline" onClick={handleExportPdf} disabled={isExportingPdf}>
      {isExportingPdf ? <LoadingSpinner size="sm" /> : <PdfIcon />}
      Export PDF
    </Button>
    <Button variant="outline" onClick={handleExportPng} disabled={isExportingPng}>
      {isExportingPng ? <LoadingSpinner size="sm" /> : <ImageIcon />}
      Export PNG
    </Button>
  </div>
```

---

#### `shared/StatusBadge.jsx`

```
Props:
  - status: 'initiated' | 'in_progress' | 'on_hold' | 'completed' | 'delivered'

Style map:
  initiated:   { bg: 'bg-neutral-100',   text: 'text-neutral-700',  dot: 'bg-neutral-400',  label: 'Initiated' }
  in_progress: { bg: 'bg-primary-100',   text: 'text-primary-700',  dot: 'bg-primary-600 animate-pulse-soft', label: 'In Progress' }
  on_hold:     { bg: 'bg-accent-100',    text: 'text-accent-700',   dot: 'bg-accent-600',   label: 'On Hold' }
  completed:   { bg: 'bg-success-100',   text: 'text-success-700',  dot: 'bg-success-600',  label: 'Completed' }
  delivered:   { bg: 'bg-secondary-100', text: 'text-secondary-700',dot: 'bg-secondary-600',label: 'Delivered' }

Renders:
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
    {label}
  </span>
```

---

#### `shared/ProgressRing.jsx`

```
Props:
  - size: number (px, default 128)
  - strokeWidth: number (px, default 10)
  - percentage: number (0-100)
  - color: string (default '#0B5394')
  - trackColor: string (default '#E5E7EB')

State:
  - animatedPercentage: number (animates from 0 to percentage on mount)

Renders:
  SVG circle with stroke-dasharray/dashoffset animation.

  <div className="relative" style={{ width: size, height: size }}>
    <svg viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
      {/* Track */}
      <circle cx={center} cy={center} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      {/* Progress */}
      <circle
        cx={center} cy={center} r={radius} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={circumference - (animatedPercentage / 100) * circumference}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
      />
    </svg>
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="text-3xl font-extrabold text-neutral-900">{Math.round(animatedPercentage)}%</span>
    </div>
  </div>

Animation:
  Uses requestAnimationFrame to animate from 0 to target percentage over 1 second on mount.
```

---

#### `shared/Button.jsx`

```
Props:
  - variant: 'primary' | 'outline' | 'ghost' | 'danger'
  - size: 'sm' | 'md' | 'lg'
  - disabled: boolean
  - loading: boolean
  - children: ReactNode
  - onClick: () => void
  - className: string (additional classes)
  - ...rest (forwarded to <button>)

Style map:
  primary: "bg-primary-700 text-white hover:bg-primary-800 active:bg-primary-900 focus:ring-primary-500"
  outline: "border border-primary-700 text-primary-700 hover:bg-primary-50 active:bg-primary-100 focus:ring-primary-500"
  ghost:   "text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200 focus:ring-neutral-500"
  danger:  "bg-error-600 text-white hover:bg-error-700 active:bg-error-800 focus:ring-error-500"

Size map:
  sm: "h-8 px-3 text-xs rounded-md gap-1.5"
  md: "h-10 px-4 text-sm rounded-lg gap-2"
  lg: "h-12 px-6 text-base rounded-lg gap-2.5"

Renders:
  <button
    className={`inline-flex items-center justify-center font-medium transition-colors
                focus:outline-none focus:ring-2 focus:ring-offset-2
                disabled:opacity-50 disabled:pointer-events-none
                ${variantStyles} ${sizeStyles} ${className}`}
    disabled={disabled || loading}
    onClick={onClick}
    {...rest}
  >
    {loading && <LoadingSpinner size="sm" />}
    {children}
  </button>
```

---

#### `shared/LoadingSpinner.jsx`

```
Props:
  - size: 'sm' | 'md' | 'lg' (default 'md')
  - className: string

Size map:
  sm: "w-4 h-4"
  md: "w-6 h-6"
  lg: "w-10 h-10"

Renders:
  <svg className={`animate-spin ${sizeClass} ${className}`} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
    <path d="M12 2 A10 10 0 0 1 22 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
```

---

#### `shared/Toast.jsx`

```
Props:
  - type: 'success' | 'error' | 'info' | 'warning'
  - message: string
  - onDismiss: () => void

Renders:
  Fixed-position notification at top-right. Auto-dismisses after 5 seconds.
  Entrance: animate-slide-up. Exit: fade out.

  Type styles:
    success: green left border, green icon
    error: red left border, red icon
    info: blue left border, blue icon
    warning: orange left border, orange icon
```

---

#### `shared/ErrorBoundary.jsx`

```
Props:
  - children: ReactNode
  - fallback: ReactNode (optional custom fallback)

State:
  - hasError: boolean
  - error: Error | null

Renders on error:
  <div className="min-h-screen flex items-center justify-center p-8">
    <div className="max-w-md text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-error-100 text-error-600 flex items-center justify-center mb-4">
        <AlertIcon className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-heading font-bold text-neutral-800 mb-2">Something went wrong</h2>
      <p className="text-sm text-neutral-500 mb-6">Please refresh the page or contact ASI 360 support.</p>
      <Button variant="primary" onClick={() => window.location.reload()}>Refresh Page</Button>
      <p className="text-xs text-neutral-400 mt-4">(510) 288-0994 | ops@asi360.co</p>
    </div>
  </div>
```

---

#### `shared/Modal.jsx`

```
Props:
  - isOpen: boolean
  - onClose: () => void
  - title: string
  - children: ReactNode
  - maxWidth: 'sm' | 'md' | 'lg' (default 'md')

Behavior:
  - Renders portal to document.body
  - Dark scrim overlay (bg-black/50)
  - Centered card with title, close X button, children
  - Close on ESC key, click outside
  - Focus trap: Tab cycles within modal
  - Body scroll lock when open
  - Entrance animation: fade scrim + scale-in card
```

---

## 4.4 State Management

### Auth Context (`context/AuthContext.jsx`)

```
Provided values:
  - jwt: string | null
  - projectId: string | null
  - projectData: ProjectData | null
  - isAuthenticated: boolean
  - isLoading: boolean
  - login: (projectNumber: string, pin: string) => Promise<void>
  - logout: () => void
  - validateProject: (projectNumber: string) => Promise<boolean>

Storage:
  - JWT stored in sessionStorage (not localStorage — cleared on tab close)
  - Key: 'asi360_portal_jwt'
  - On mount: check sessionStorage for existing JWT, validate expiry
  - If valid: set authenticated state, fetch project data
  - If expired: clear storage, set unauthenticated

JWT lifecycle:
  - Issued by /api/authenticate Edge Function
  - 24-hour expiry (exp claim)
  - Checked on every route navigation via ProtectedRoute wrapper
  - 30-minute warning toast before expiry: "Your session expires soon. You may need to log in again."
```

### Server State (React Query / TanStack Query)

```
Query keys:
  ['project', projectId]           — full project data (phases, tasks, milestones)
  ['project', projectId, 'tasks']  — tasks only (for realtime updates)
  ['project', projectId, 'activity'] — recent activity feed
  ['project', projectId, 'timeline'] — Gantt timeline data

Cache strategy:
  staleTime: 5 * 60 * 1000  (5 minutes — data is rarely stale since realtime updates it)
  gcTime:    30 * 60 * 1000  (30 minutes)
  refetchOnWindowFocus: true
  refetchOnReconnect: true

Invalidation:
  - On Supabase Realtime event: invalidate ['project', projectId, 'tasks'] and ['project', projectId, 'activity']
  - This triggers React Query to refetch, which updates all subscribed components
  - No optimistic updates needed — data flows one-way from server (read-only portal)
```

### Toast Context (`context/ToastContext.jsx`)

```
Provided values:
  - toasts: Toast[] (current visible toasts)
  - addToast: (type, message, duration?) => void
  - removeToast: (id) => void

Max visible: 3 (FIFO eviction)
Default duration: 5000ms
```

---

## 4.5 Routing

### Route Table

| Path               | Page            | Auth Required | Description                    |
|--------------------|-----------------|---------------|--------------------------------|
| `/`                | LookupPage      | No            | Login / project lookup         |
| `/status`          | DashboardPage   | Yes           | Project overview dashboard     |
| `/status/timeline` | TimelinePage    | Yes           | Full Gantt chart               |
| `*`                | NotFoundPage    | No            | 404 page                       |

### ProtectedRoute Wrapper

```jsx
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location, reason: 'session_expired' }} replace />
  }

  return children
}
```

### Navigation Behavior

- Login success: `navigate('/status', { replace: true })` — prevents back-button returning to login
- Logout: `navigate('/', { replace: true })`
- Session expiry detected on route change: redirect to `/` with `state.reason = 'session_expired'`
- LookupPage reads `location.state?.reason` to show "Session expired" toast on mount
- Direct URL access to `/status` or `/status/timeline` without valid JWT: redirect to `/`

### NotFoundPage

```
Renders:
  <div className="min-h-screen flex items-center justify-center p-8">
    <div className="max-w-md text-center">
      <p className="text-6xl font-extrabold text-primary-700 mb-4">404</p>
      <h1 className="text-2xl font-heading font-bold text-neutral-800 mb-2">Page not found</h1>
      <p className="text-neutral-500 mb-6">The page you're looking for doesn't exist.</p>
      <Button variant="primary" onClick={() => navigate('/')}>Back to Login</Button>
    </div>
  </div>
```

---

## 4.6 Responsive Design

### Breakpoints

| Name | Min-width | Target devices                  |
|------|-----------|----------------------------------|
| `sm` | 640px     | Large phones, landscape          |
| `md` | 768px     | Tablets (portrait)               |
| `lg` | 1024px    | Tablets (landscape), small laptop|
| `xl` | 1280px    | Desktop                          |

### Mobile-First Strategy

All base styles target mobile (< 640px). Larger breakpoints add complexity.

#### LookupPage Responsive

```
Base (mobile):
  - Full-width card with mx-4 margins
  - PIN boxes: w-10 h-12 (slightly smaller)
  - Single-column layout

sm+:
  - Card max-width: 420px, centered
  - PIN boxes: w-12 h-14

lg+:
  - Card centered vertically with min-height offset
  - Background pattern visible
```

#### DashboardPage Responsive

```
Base (mobile):
  - Single column stack
  - Cards full-width with mx-4 gap-4
  - Phase progress bars stack vertically
  - Contact card: buttons full-width stacked

md (tablet):
  - 2-column grid for top section (project header + progress ring)
  - Milestones + Activity side by side
  - Contact + Next Steps side by side

lg+ (desktop):
  - Full layout as shown in wireframe
  - 3-column grid for bottom cards
  - Phase progress full-width spanning both columns
```

#### TimelinePage Responsive

```
Base (mobile):
  - Gantt chart in overflow-x container
  - Phase column (40px) and detail column (140px) are position: sticky; left: 0
  - Day columns scroll horizontally with -webkit-overflow-scrolling: touch
  - Min-width on grid: 800px (forces horizontal scroll)
  - Note cards: single column
  - Meta grid: 2x2 layout

md (tablet):
  - Detail column widens to 170px
  - Note cards: 2 columns
  - Meta grid: 4 columns

lg+ (desktop):
  - Full width chart with no horizontal scroll (if <= 15 days)
  - Note cards: 3 columns
  - Export buttons in a row
```

### PIN Input Mobile Optimization

```
Each input element:
  inputMode="numeric"  — triggers numeric keyboard on iOS/Android
  pattern="[0-9]"      — numeric validation
  autoComplete="one-time-code"  — iOS will suggest from SMS

Container:
  gap-2 on mobile, gap-3 on sm+

Box sizing:
  Mobile: w-10 h-12 text-xl
  sm+:    w-12 h-14 text-2xl
```

---

## 4.7 Accessibility

### WCAG 2.1 AA Compliance Targets

| Criterion                      | Target  | Implementation                                              |
|--------------------------------|---------|--------------------------------------------------------------|
| 1.1.1 Non-text Content         | AA      | All icons have aria-labels, logo has alt text                |
| 1.3.1 Info & Relationships     | AA      | Semantic HTML (headings, lists, landmarks)                   |
| 1.4.1 Use of Color             | AA      | Status never conveyed by color alone (always has text label) |
| 1.4.3 Contrast (minimum)       | AA      | All text/bg combos ≥ 4.5:1 ratio                           |
| 1.4.4 Resize Text              | AA      | All text in rem, scales with browser zoom                    |
| 2.1.1 Keyboard                 | AA      | Tab navigation for all interactive elements                  |
| 2.4.3 Focus Order              | AA      | Logical focus order: project input → PIN → submit           |
| 2.4.7 Focus Visible            | AA      | Focus ring on all interactive elements (ring-2 ring-primary) |
| 3.3.1 Error Identification     | AA      | Errors announced via role="alert" and aria-live="polite"    |
| 4.1.2 Name, Role, Value        | AA      | All form inputs labeled, status badges have aria-label       |

### Keyboard Navigation

```
LookupPage:
  Tab: project input → submit button → PIN boxes (1-6) → submit → request access link
  Enter: submits current step
  Escape: closes request access modal

DashboardPage:
  Tab through all interactive elements (buttons, links)
  Skip link at top: "Skip to main content"

TimelinePage:
  Arrow keys: scroll Gantt chart horizontally when focused
  Tab: navigates between export buttons and back button

Modal:
  Focus trapped inside modal
  Tab cycles through form fields → submit → close button
  Escape closes modal
  Focus returns to trigger element on close
```

### Screen Reader Announcements

```
- PIN input: "Enter PIN digit 1 of 6" through "Enter PIN digit 6 of 6"
- Login success: aria-live region announces "Authentication successful, loading project dashboard"
- Phase completion (realtime): aria-live region announces "Phase 1: Site Survey completed"
- Task update: aria-live region announces "Task 2.1: Procurement started"
- Error: role="alert" announces error message
- Progress ring: aria-label="Overall project progress: 65 percent"
- Status badge: aria-label="Project status: In Progress"
```

### Color Contrast Ratios

| Pair                            | Ratio  | Pass |
|---------------------------------|--------|------|
| primary-700 (#0B5394) on white  | 7.2:1  | AAA  |
| neutral-700 (#374151) on white  | 9.5:1  | AAA  |
| neutral-600 (#4B5563) on white  | 7.0:1  | AAA  |
| white on primary-700            | 7.2:1  | AAA  |
| white on success-600            | 4.7:1  | AA   |
| white on accent-600             | 4.5:1  | AA   |
| white on error-600              | 5.6:1  | AAA  |
| neutral-500 (#6B7280) on white  | 4.6:1  | AA   |
| neutral-400 on white            | 3.0:1  | Fail — use only for decorative/non-essential |

---

## 4.8 Performance

### Code Splitting

```jsx
// App.jsx — lazy load pages
import { lazy, Suspense } from 'react'

const LookupPage = lazy(() => import('./pages/LookupPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const TimelinePage = lazy(() => import('./pages/TimelinePage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

// Wrap routes in Suspense with loading fallback
<Suspense fallback={<PageLoadingFallback />}>
  <Routes>...</Routes>
</Suspense>
```

### Bundle Size Budget

| Chunk            | Target Size (gzipped) | Contents                               |
|------------------|-----------------------|-----------------------------------------|
| `vendor.js`      | < 45 KB               | React, React DOM, React Router          |
| `app.js`         | < 15 KB               | App shell, auth context, routing        |
| `lookup.js`      | < 8 KB                | LookupPage + auth components            |
| `dashboard.js`   | < 20 KB               | DashboardPage + all dashboard components|
| `timeline.js`    | < 25 KB               | TimelinePage + Gantt components          |
| `supabase.js`    | < 20 KB               | Supabase JS SDK (tree-shaken)            |
| `query.js`       | < 12 KB               | TanStack Query                           |

Total initial load (LookupPage): < 90 KB gzipped

### Performance Targets

| Metric                    | Target     |
|---------------------------|------------|
| First Contentful Paint    | < 1.2s     |
| Largest Contentful Paint  | < 2.0s     |
| Time to Interactive       | < 2.5s     |
| Cumulative Layout Shift   | < 0.05     |
| Lighthouse Performance    | 95+        |
| Lighthouse Accessibility  | 100        |
| Lighthouse Best Practices | 100        |

### Optimization Techniques

1. **Vite tree-shaking:** Only import used Supabase modules (`createClient`, `realtime`)
2. **Font loading:** `Inter` loaded via `<link rel="preload">` with `font-display: swap`
3. **Image optimization:** ASI 360 logo served as optimized SVG (< 5 KB), with PNG fallback
4. **CSS:** Tailwind purges unused classes in production build
5. **html2canvas:** Dynamically imported only when Export PNG is clicked (not in main bundle)
6. **React Query deduplication:** Multiple components reading same query key share a single request

---

## 4.9 Error Handling

### Error Categories & User Messages

| Error Type               | User Message                                          | Action                           |
|--------------------------|--------------------------------------------------------|----------------------------------|
| Invalid project number   | "Project not found. Please check your project number." | Stay on lookup, highlight input  |
| Invalid PIN              | "Invalid PIN. Please try again."                       | Clear PIN boxes, refocus first   |
| Too many PIN attempts    | "Too many attempts. Please try again in {N} minutes."  | Show countdown timer, disable input |
| Session expired          | "Your session has expired. Please log in again."       | Redirect to /, show toast        |
| Network offline          | "You appear to be offline. Reconnecting..."            | Banner at top of page, auto-retry|
| Network back online      | "You're back online."                                  | Dismiss banner, refetch data     |
| API 500 error            | "Something went wrong. Please try again later."        | Show in toast, log to console    |
| Edge Function timeout    | "Request timed out. Please try again."                 | Show in toast                    |
| PDF export failed        | "Could not generate PDF. Please try again."            | Show in toast                    |
| React rendering error    | ErrorBoundary fallback with refresh button              | Full-page fallback               |

### Network Offline Detection

```jsx
// hooks/useOnlineStatus.js
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

// In AppShell:
{!isOnline && (
  <div className="bg-accent-600 text-white text-center text-sm py-2 font-medium" role="alert">
    You appear to be offline. Some features may be unavailable.
  </div>
)}
```

### Lockout Timer (PIN attempts)

```jsx
// hooks/useCountdown.js
function useCountdown(targetTime) {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (!targetTime) return
    const interval = setInterval(() => {
      const diff = Math.max(0, targetTime - Date.now())
      setRemaining(Math.ceil(diff / 1000))
      if (diff <= 0) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [targetTime])

  return remaining  // seconds
}

// Lockout tracked in sessionStorage:
// Key: 'asi360_lockout_until'
// Value: ISO timestamp when lockout expires
// After 5 failed attempts: set lockout for 15 minutes
```

---

## 4.10 Animations & Micro-interactions

### Page Transitions

```
Route changes: Wrapped in AnimatePresence (framer-motion NOT used — pure CSS transitions)

Implementation via CSS classes toggled on mount/unmount:
  Enter: animate-fade-in (opacity 0→1 over 300ms)
  No exit animation (instant unmount for snappiness)

Alternative (if richer transitions desired): use react-transition-group with:
  Enter: opacity 0 + translateY(8px) → opacity 1 + translateY(0) over 300ms ease-out
```

### Component-Level Animations

| Component         | Animation                                          | Trigger              | Duration |
|--------------------|----------------------------------------------------|----------------------|----------|
| ProgressRing       | SVG dashoffset from 0 to target                   | Mount                | 1000ms   |
| PhaseProgressBar   | Width 0% to target%, staggered per phase           | Mount (200ms delay)  | 700ms    |
| PinInput box       | Scale 0.95→1.0 on focus                            | Focus                | 150ms    |
| PinInput valid     | Border color transition to primary-700             | Digit entered        | 150ms    |
| PinInput error     | Shake (translateX -4→4→-4→4→0px)                  | Error prop           | 300ms    |
| StatusBadge        | Dot pulses (opacity 1→0.7→1) for "In Progress"    | Continuous           | 2000ms   |
| ActivityItem       | Slide up + fade in                                 | New item added       | 400ms    |
| MilestoneItem      | Check icon scales in (0→1)                         | Completed            | 200ms    |
| GanttTaskBar       | ScaleX 0→1 from left                              | Mount                | 600ms    |
| Toast              | Slide in from right, fade out on dismiss           | Show/hide            | 300ms    |
| Success checkmark  | Draw SVG path (stroke-dashoffset animation)        | Login success        | 600ms    |
| ProjectHeader      | Fade in                                            | Mount                | 300ms    |

### Shake Animation (CSS)

```css
/* styles/animations.css */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
  20%, 40%, 60%, 80% { transform: translateX(4px); }
}

.animate-shake {
  animation: shake 0.3s ease-in-out;
}
```

### Success Checkmark (Login)

```
After valid PIN, before redirect:
  1. PIN boxes all get green borders (150ms transition)
  2. A green circle with animated checkmark draws in the center (600ms)
  3. 400ms pause
  4. Redirect to /status

SVG checkmark: stroke-dasharray + stroke-dashoffset transition from fully hidden to fully drawn.
```

### Gantt Bar Entrance

```css
/* styles/gantt.css */
.gantt-bar {
  animation: barGrow 0.6s ease-out forwards;
  transform-origin: left;
}

@keyframes barGrow {
  0% { transform: scaleX(0); opacity: 0; }
  100% { transform: scaleX(1); opacity: 1; }
}

/* Stagger per row */
.gantt-bar:nth-child(1) { animation-delay: 0ms; }
.gantt-bar:nth-child(2) { animation-delay: 100ms; }
.gantt-bar:nth-child(3) { animation-delay: 200ms; }
/* etc. */
```

---

## 4.11 Hooks Reference

### `useAuth()`

```
Returns: AuthContext values (see 4.4)

Usage:
  const { isAuthenticated, login, logout, projectData } = useAuth()
```

### `useProject(projectId)`

```
Returns:
  - data: ProjectData | undefined
  - isLoading: boolean
  - error: Error | null
  - refetch: () => void

Implementation:
  Wraps useQuery(['project', projectId], () => api.getProject(projectId))
```

### `useProjectStatus(projectId)`

```
Returns:
  - phases: Phase[]
  - overallProgress: number (0-100)
  - currentPhase: number
  - milestones: Milestone[]
  - nextSteps: NextStep[]
  - activities: Activity[]

Implementation:
  Derives from useProject data. Computes overall progress as weighted average of phase completions.
```

### `useRealtimeUpdates(projectId)`

```
Returns: void (side-effect only)

Implementation:
  Sets up Supabase Realtime subscription on project_tasks table filtered by project_id.
  On INSERT/UPDATE: invalidates React Query cache for ['project', projectId, 'tasks']
  and ['project', projectId, 'activity'].
  Calls addToast with update message.

  useEffect(() => {
    const channel = supabase
      .channel(`project-${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_tasks',
        filter: `project_id=eq.${projectId}`,
      }, (payload) => {
        queryClient.invalidateQueries(['project', projectId])
        addToast('info', `Task updated: ${payload.new.task_name}`)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [projectId])
```

### `useTimeline(projectId)`

```
Returns:
  - timelineData: GanttData (formatted for GanttChart component)
  - isLoading: boolean

Implementation:
  Wraps useQuery. Transforms raw project data into the Gantt-specific shape:
  computes bar_start/bar_end indices, assigns phase colors, generates day labels
  from project start/end dates.
```

### `useToast()`

```
Returns: { addToast, removeToast, toasts }
From ToastContext.
```

### `useCountdown(targetTimestamp)`

```
Returns: remainingSeconds: number
Decrements every second until 0.
Used for PIN lockout timer display.
```

---

## 4.12 Library Dependencies

| Package                | Version  | Purpose                     | Bundle Impact |
|------------------------|----------|-----------------------------|---------------|
| `react`                | ^18.3    | UI framework                | ~6 KB gz      |
| `react-dom`            | ^18.3    | DOM rendering               | ~37 KB gz     |
| `react-router-dom`     | ^6.26    | Client-side routing         | ~12 KB gz     |
| `@tanstack/react-query`| ^5.56    | Server state management     | ~12 KB gz     |
| `@supabase/supabase-js`| ^2.45    | Supabase client (auth + RT) | ~18 KB gz     |
| `html2canvas`          | ^1.4.1   | PNG export (lazy loaded)    | ~40 KB gz *   |

\* html2canvas loaded on-demand only when user clicks Export PNG.

**Dev dependencies:**
| Package             | Purpose                    |
|---------------------|----------------------------|
| `vite`              | Build tool                 |
| `tailwindcss`       | Utility CSS                |
| `postcss`           | CSS processing             |
| `autoprefixer`      | Browser prefixes           |
| `eslint`            | Linting                    |
| `prettier`          | Code formatting            |

---

## 4.13 CSS Files to Port

### `styles/gantt.css`

Ported from the `timeline.html` template. Key adaptations:

1. **Table → CSS Grid:** Replace `<table>` with `display: grid`. Column widths use `grid-template-columns` with CSS custom property `--total-days`.
2. **Print styles removed:** The `@page` rules and `print-color-adjust` are not needed in the web portal. PDF export is handled server-side.
3. **Font sizes scaled up:** Original template uses 6-8px text (designed for print). Web version uses 11-14px (readable on screen).
4. **Colors preserved:** Phase colors, header backgrounds, and bar colors match the original exactly.
5. **Sticky columns added:** Phase and detail columns get `position: sticky; left: 0; z-index: 10` for mobile horizontal scroll.
6. **Hover states added:** Task bars get `cursor: pointer; opacity transition` for tooltip interaction.
7. **Writing-mode for end column:** Preserved `writing-mode: vertical-rl` for the "PROJECT END" column header.

### `styles/animations.css`

Contains:
- `@keyframes shake` (PIN error)
- `@keyframes checkDraw` (success checkmark SVG)
- `@keyframes barGrow` (Gantt bar entrance)
- Utility classes: `.animate-shake`, `.animate-check-draw`
- Print media query: `@media print { .animate-* { animation: none !important; } }`

---

## 4.14 Data Shape Reference

### Project Data (from Supabase / Edge Function)

```typescript
interface ProjectData {
  id: string
  projectNo: string              // "PROJ-202603-1234"
  title: string                  // "Goldman Law Firm — Access Control Upgrade"
  client: string                 // "Goldman Law Firm"
  status: 'initiated' | 'in_progress' | 'on_hold' | 'completed' | 'delivered'
  startDate: string              // "2026-03-09"
  targetCloseDate: string        // "2026-03-20"
  contractValue: number          // 7115.00
  quoteNo: string                // "QUO202366 / QUO202368"
  manager: {
    name: string                 // "Don Bucknor"
    phone: string                // "(510) 288-0994"
    email: string                // "don@asi360.co"
  }
  phases: Phase[]
  milestones: Milestone[]
  nextSteps: NextStep[]
  activities: Activity[]
  notes: Note[]
}

interface Phase {
  number: number                 // 1-5
  name: string                   // "Site Survey & Data Harvest"
  status: 'not_started' | 'in_progress' | 'completed'
  percentage: number             // 0-100
  color: string                  // "#0B5394"
  tasks: Task[]
}

interface Task {
  id: string
  name: string                   // "Door hardware audit & photos"
  status: 'open' | 'in_progress' | 'completed' | 'blocked'
  barStart: number               // 0-based day index
  barEnd: number                 // 0-based day index
  barLabel: string               // "Door Audit"
  barColor: string               // inherited from phase or custom
  assignedTo: string | null
}

interface Milestone {
  id: string
  label: string                  // "Contract Signed"
  targetDate: string | null
  completedDate: string | null
  isComplete: boolean
}

interface NextStep {
  id: string
  description: string            // "Provide network closet access"
  dueDate: string | null
  isUrgent: boolean
}

interface Activity {
  id: string
  timestamp: string              // ISO datetime
  message: string                // "Task 2.1 started"
  type: 'task_started' | 'task_completed' | 'phase_completed' | 'project_created' | 'note_added'
}

interface Note {
  title: string                  // "Delivery Strategy"
  color: string                  // "#0B5394"
  bulletItems: string[]          // HTML strings with <span class='highlight'>
  content: string | null         // alternative to bulletItems
}

// Gantt-specific derived data
interface GanttData {
  title: string
  client: string
  manager: string
  date: string
  quoteNo: string
  contractValue: number
  periods: { label: string, span: number }[]
  dayLabels: string[]            // ["MON", "TUE", ...]
  phases: GanttPhase[]
  notes: Note[]
}

interface GanttPhase {
  number: number
  name: string
  color: string
  isMilestone: boolean
  isBuffer: boolean
  tasks: GanttTask[]
}

interface GanttTask {
  name: string
  barStart: number
  barEnd: number
  barLabel: string
  barColor: string
  isPhaseRow: boolean            // true for the first task (shows phase name style)
}
```

---

## 4.15 Environment & Build Configuration

### Vite Config

```js
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3100,
    host: true,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
})
```

### Environment Variables

```
# .env (gitignored — bootstrap only)
VITE_SUPABASE_URL=https://gtfffxwfgcxiiauliynd.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
```

**Note:** The portal uses the Supabase **anon key** (not service key) since it's a client-side app. RLS policies on the database control data access. The anon key is safe to expose in client-side code — it only grants access that RLS allows.

### `lib/supabase.js`

```js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### `lib/api.js`

```js
import { supabase } from './supabase'

export const api = {
  async validateProject(projectNumber) {
    const { data, error } = await supabase.functions.invoke('validate-project', {
      body: { projectNumber },
    })
    if (error) throw error
    return data  // { valid: boolean, projectId?: string }
  },

  async authenticate(projectNumber, pin) {
    const { data, error } = await supabase.functions.invoke('authenticate-portal', {
      body: { projectNumber, pin },
    })
    if (error) throw error
    return data  // { jwt: string, project: ProjectData }
  },

  async getProject(projectId, jwt) {
    const { data, error } = await supabase.functions.invoke('get-project-status', {
      body: { projectId },
      headers: { Authorization: `Bearer ${jwt}` },
    })
    if (error) throw error
    return data  // ProjectData
  },

  async requestAccess({ name, email, projectNumber }) {
    const { data, error } = await supabase.functions.invoke('request-portal-access', {
      body: { name, email, projectNumber },
    })
    if (error) throw error
    return data
  },

  async exportTimelinePdf(projectId, jwt) {
    const { data, error } = await supabase.functions.invoke('export-timeline-pdf', {
      body: { projectId },
      headers: { Authorization: `Bearer ${jwt}` },
    })
    if (error) throw error
    return data  // { pdfUrl: string } or blob
  },

  async requestUpdate(projectId, message, jwt) {
    const { data, error } = await supabase.functions.invoke('request-project-update', {
      body: { projectId, message },
      headers: { Authorization: `Bearer ${jwt}` },
    })
    if (error) throw error
    return data
  },
}
```

### `lib/utils.js`

```js
export function formatDate(isoDate) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(isoDate))
}

export function formatRelativeTime(isoTimestamp) {
  const diff = Date.now() - new Date(isoTimestamp).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(isoTimestamp)
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
  }).format(amount)
}

export function computeOverallProgress(phases) {
  if (!phases.length) return 0
  const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0)
  const completedTasks = phases.reduce((sum, p) =>
    sum + p.tasks.filter(t => t.status === 'completed').length, 0)
  return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
}
```

### `lib/constants.js`

```js
export const PHASE_COLORS = {
  1: { bar: '#0B5394', bg: '#EBF4FB' },
  2: { bar: '#78909C', bg: '#ECEFF1' },
  3: { bar: '#E65100', bg: '#FFF3E0' },
  4: { bar: '#45818E', bg: '#D4EAEE' },
  5: { bar: '#38761D', bg: '#D9EED0' },
}

export const STATUS_CONFIG = {
  initiated:   { bg: 'bg-neutral-100',   text: 'text-neutral-700',  dot: 'bg-neutral-400',            label: 'Initiated' },
  in_progress: { bg: 'bg-primary-100',   text: 'text-primary-700',  dot: 'bg-primary-600 animate-pulse-soft', label: 'In Progress' },
  on_hold:     { bg: 'bg-accent-100',    text: 'text-accent-700',   dot: 'bg-accent-600',             label: 'On Hold' },
  completed:   { bg: 'bg-success-100',   text: 'text-success-700',  dot: 'bg-success-600',            label: 'Completed' },
  delivered:   { bg: 'bg-secondary-100', text: 'text-secondary-700',dot: 'bg-secondary-600',           label: 'Delivered' },
}

export const PIN_LENGTH = 6
export const MAX_PIN_ATTEMPTS = 5
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000  // 15 minutes
export const JWT_WARNING_BEFORE_EXPIRY_MS = 30 * 60 * 1000  // 30 minutes
export const TOAST_DURATION_MS = 5000
export const MAX_VISIBLE_TOASTS = 3
export const MAX_ACTIVITY_ITEMS = 5
```

---

## 4.16 Deployment

### Build & Deploy

```bash
# Development
npm run dev    # Vite dev server on port 3100

# Production build
npm run build  # Outputs to dist/

# Preview production build locally
npm run preview
```

### Hosting Target

Static files deployed to SiteGround or Vercel at `projects.asi360.co`. Since this is a Vite SPA, the hosting must:
- Serve `index.html` for all routes (SPA fallback)
- Set proper cache headers for hashed assets
- Enforce HTTPS

### SiteGround Deployment (if used)

```
Upload dist/ contents to projects.asi360.co/public_html/
Add .htaccess for SPA routing:

  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
```

---

## 4.17 Testing Strategy (Overview)

| Layer            | Tool                    | Coverage Target |
|------------------|-------------------------|-----------------|
| Component unit   | Vitest + Testing Library| 80%+            |
| Integration      | Vitest                  | Key flows       |
| E2E              | Playwright              | Login → Dashboard → Timeline |
| Accessibility    | axe-core + Lighthouse   | 100 score       |
| Visual           | Manual + screenshots    | All breakpoints |

### Key E2E Scenarios

1. **Happy path:** Enter valid project number → enter valid PIN → see dashboard → navigate to timeline → export PDF
2. **Invalid project:** Enter bad project number → see error → retry
3. **Invalid PIN:** Enter wrong PIN 5 times → see lockout → wait → retry
4. **Session expiry:** Authenticate → wait/simulate JWT expiry → attempt navigation → redirect to login
5. **Mobile:** Full flow on 375px viewport
6. **Realtime:** Simulate task update via Supabase → verify toast + UI update

---

*End of Module 4: React Portal Frontend*
