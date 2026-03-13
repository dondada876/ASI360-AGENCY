# MODULE 2: Timeline & Gantt Engine

> **Project:** ASI 360 Project Status Portal — `projects.asi360.co`
> **Stack:** React 18 + Vite + Tailwind CSS 3.4 + Supabase JS SDK v2
> **Depends on:** MODULE 4 (Design System, Layout Shell), MODULE 5 (Supabase tables)
> **Existing assets:** `templates/timeline/timeline.html` (Jinja2), `generate_timeline.py` (Playwright PDF), `example_project.json`

---

## 2.1 Overview

The Timeline & Gantt Engine provides visual project scheduling for ASI 360 security integration projects. Each project follows a **5-phase x 4-task = 20 standard task** structure:

| Phase | Name                        | Default Color |
|-------|-----------------------------|---------------|
| 1     | Initiation (Site Survey)    | `#0B5394`     |
| 2     | Design (Equipment Staging)  | `#45818E`     |
| 3     | Procurement (Installation)  | `#B85B22`     |
| 4     | Installation (Programming)  | `#38761D`     |
| 5     | Closeout (Training)         | `#351C75`     |

The engine has three delivery surfaces:

1. **Interactive React Gantt** — embedded in the project status portal (client-facing)
2. **PDF Export** — branded landscape US Letter via Playwright (proposal attachments, email)
3. **Embeddable Widget** — iframe snippet for client websites

---

## 2.2 Data Model

### 2.2.1 Existing Tables (from MODULE 5)

The Gantt engine reads from two existing Supabase tables:

```sql
-- asi360_projects (already exists — see MODULE 5)
-- Key fields for timeline:
--   project_no       TEXT PRIMARY KEY     -- "PROJ-202603-1234"
--   project_name     TEXT NOT NULL
--   client_name      TEXT NOT NULL
--   contact_name     TEXT
--   start_date       DATE
--   target_close_date DATE
--   status           TEXT                 -- initiated|in progress|on hold|completed|delivered
--   contract_value   NUMERIC(10,2)
--   current_phase    INT DEFAULT 1
--   completion_pct   INT DEFAULT 0

-- asi360_project_tasks (already exists — see MODULE 5)
-- Key fields for timeline:
--   id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
--   project_no       TEXT REFERENCES asi360_projects(project_no)
--   phase_no         INT CHECK (phase_no BETWEEN 1 AND 5)
--   task_no          TEXT NOT NULL         -- "1.1", "2.3", "4.2"
--   task_name        TEXT NOT NULL
--   status           TEXT DEFAULT 'open'
--     CHECK (status IN ('open','in_progress','waiting','completed','deferred','blocked','canceled'))
--   assigned_to      TEXT
--   hours_logged     NUMERIC(5,1) DEFAULT 0
--   notes            TEXT
--   created_at       TIMESTAMPTZ DEFAULT now()
--   updated_at       TIMESTAMPTZ DEFAULT now()
```

### 2.2.2 New Table: `project_timeline_config`

Stores per-project Gantt visualization configuration. If no config exists for a project, the engine generates a default layout from the project's task data.

```sql
CREATE TABLE project_timeline_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_no      TEXT NOT NULL REFERENCES asi360_projects(project_no) ON DELETE CASCADE,

  -- Period headers (top row of Gantt)
  -- e.g., [{"label":"WEEK 1","span":5},{"label":"WEEK 2","span":5}]
  periods         JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Day column labels
  -- e.g., ["MON","TUE","WED","THU","FRI","MON","TUE","WED","THU","FRI"]
  day_labels      JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Total number of day columns
  total_days      INT NOT NULL DEFAULT 10,

  -- Phase visualization overrides
  -- e.g., [{"phase_no":1,"bar_start":0,"bar_end":1,"color":"#0B5394"},...]
  phases          JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Task bar positions within the Gantt grid
  -- e.g., [{"task_no":"1.1","bar_start":0,"bar_end":0,"bar_label":"Door Audit","bar_color":"#0B5394"},...]
  task_bars       JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Payment/delivery milestones overlay
  -- e.g., [{"day":0,"label":"Deposit Due","color":"#38761D","type":"payment"},...]
  milestones      JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Note cards below the Gantt chart
  -- e.g., [{"title":"Delivery Strategy","color":"#0B5394","bullet_items":["Item 1","Item 2"]}]
  notes           JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Display mode for day labels
  -- "weekday" = MON/TUE/WED, "numbered" = Day 1/Day 2, "dated" = Mar 10/Mar 11
  day_label_mode  TEXT NOT NULL DEFAULT 'weekday'
    CHECK (day_label_mode IN ('weekday', 'numbered', 'dated')),

  -- Project start date (for "dated" mode and today-marker calculation)
  schedule_start  DATE,

  -- Holiday/blackout days (0-indexed day positions that are non-working)
  blackout_days   JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),

  UNIQUE(project_no)
);

-- Index for fast lookup by project
CREATE INDEX idx_timeline_config_project ON project_timeline_config(project_no);

-- Auto-update timestamp
CREATE TRIGGER set_timeline_config_updated
  BEFORE UPDATE ON project_timeline_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2.2.3 Task Status to Color Mapping

This is the canonical status-to-color mapping used throughout the Gantt engine:

```typescript
// src/lib/timeline-constants.ts

export const TASK_STATUS_COLORS = {
  open:        '#E0E0E0',  // Light gray — not started
  in_progress: '#45818E',  // Teal — actively working
  completed:   '#38761D',  // Green — done
  blocked:     '#CC0000',  // Red — blocked
  waiting:     '#B85B22',  // Orange — waiting on external
  deferred:    '#9E9E9E',  // Medium gray — postponed
  canceled:    '#757575',  // Dark gray — canceled
} as const;

export const TASK_STATUS_LABELS = {
  open:        'Not Started',
  in_progress: 'In Progress',
  completed:   'Completed',
  blocked:     'Blocked',
  waiting:     'Waiting',
  deferred:    'Deferred',
  canceled:    'Canceled',
} as const;

export const PHASE_COLORS = {
  1: '#0B5394',  // Dark blue — Initiation
  2: '#45818E',  // Teal — Design
  3: '#B85B22',  // Orange — Procurement
  4: '#38761D',  // Green — Installation
  5: '#351C75',  // Purple — Closeout
  0: '#434343',  // Gray — milestone/buffer
} as const;

export const PHASE_BG_COLORS = {
  1: '#EBF4FB',
  2: '#D4EAEE',
  3: '#FDE8D5',
  4: '#D9EED0',
  5: '#EDE7F6',
  0: '#F5F5F5',
} as const;

export const PHASE_NAMES = {
  1: 'Initiation',
  2: 'Design',
  3: 'Procurement',
  4: 'Installation',
  5: 'Closeout',
} as const;

export type TaskStatus = keyof typeof TASK_STATUS_COLORS;
export type PhaseNumber = 1 | 2 | 3 | 4 | 5;
```

### 2.2.4 Data Flow: Supabase Tables to Gantt Visualization

```
┌─────────────────────────┐     ┌──────────────────────────────┐
│  asi360_projects        │     │  project_timeline_config     │
│  (project metadata)     │────▶│  (visual layout overrides)   │
└─────────────────────────┘     └──────────────────────────────┘
           │                                  │
           │                                  │
           ▼                                  ▼
┌─────────────────────────┐     ┌──────────────────────────────┐
│  asi360_project_tasks   │     │  useGanttData() hook         │
│  (task statuses)        │────▶│  Merges tasks + config into  │
│                         │     │  renderable GanttData struct  │
└─────────────────────────┘     └──────────────────────────────┘
                                              │
                                              ▼
                                 ┌─────────────────────────┐
                                 │  <GanttChart />          │
                                 │  React component         │
                                 └─────────────────────────┘
```

When no `project_timeline_config` row exists, the engine auto-generates a default layout:
- 2-week span (10 business days)
- Tasks spread evenly across days based on phase ordering
- Weekday labels (MON-FRI)
- No milestones or notes

---

## 2.3 TypeScript Interfaces

```typescript
// src/types/timeline.ts

/** Raw project record from Supabase */
export interface Project {
  project_no: string;
  project_name: string;
  client_name: string;
  contact_name: string | null;
  start_date: string | null;        // ISO date
  target_close_date: string | null;  // ISO date
  status: string;
  contract_value: number | null;
  current_phase: number;
  completion_pct: number;
  quote_no: string | null;
  site_address: string | null;
}

/** Raw task record from Supabase */
export interface ProjectTask {
  id: string;
  project_no: string;
  phase_no: number;
  task_no: string;              // "1.1", "2.3"
  task_name: string;
  status: TaskStatus;
  assigned_to: string | null;
  hours_logged: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Timeline config from project_timeline_config table */
export interface TimelineConfig {
  project_no: string;
  periods: Period[];
  day_labels: string[];
  total_days: number;
  phases: PhaseConfig[];
  task_bars: TaskBarConfig[];
  milestones: Milestone[];
  notes: NoteCard[];
  day_label_mode: 'weekday' | 'numbered' | 'dated';
  schedule_start: string | null;
  blackout_days: number[];
}

/** Period header (top row grouping) */
export interface Period {
  label: string;    // "WEEK 1", "MARCH 10-14"
  span: number;     // How many day columns this period covers
}

/** Phase visualization override */
export interface PhaseConfig {
  phase_no: number;
  bar_start: number;   // 0-indexed day column where phase bar starts
  bar_end: number;     // 0-indexed day column where phase bar ends
  color?: string;      // Override default phase color
  is_buffer?: boolean; // Gray background for buffer/procurement phases
}

/** Individual task bar position */
export interface TaskBarConfig {
  task_no: string;       // "1.1", "3.2"
  bar_start: number;
  bar_end: number;
  bar_label: string;     // Short label shown inside bar
  bar_color?: string;    // Override — defaults to phase color
}

/** Milestone marker (diamond or labeled row) */
export interface Milestone {
  day: number;           // 0-indexed day position
  label: string;         // "Deposit Due", "Equipment Delivery"
  color: string;
  type: 'payment' | 'delivery' | 'approval' | 'custom';
}

/** Note card rendered below Gantt */
export interface NoteCard {
  title: string;
  color: string;            // Header background color
  bullet_items?: string[];  // Bulleted list (supports <span class='highlight'>)
  content?: string;         // Freeform HTML (alternative to bullets)
}

/** ── Computed types for rendering ── */

/** A single row in the rendered Gantt table */
export interface GanttRow {
  id: string;                  // Unique key for React
  phase_no: number;
  phase_rowspan: number;       // 0 = skip (covered by parent rowspan)
  phase_color: string;
  name: string;
  is_phase_row: boolean;       // true = bold phase header
  is_milestone: boolean;
  is_buffer: boolean;
  bar_start: number;           // -1 = no bar
  bar_end: number;
  bar_color: string;
  bar_label: string;
  status?: TaskStatus;         // From live task data
  completion_pct?: number;     // Percentage fill within bar
}

/** Complete data structure consumed by GanttChart component */
export interface GanttData {
  project: Project;
  rows: GanttRow[];
  periods: Period[];
  day_labels: string[];
  total_days: number;
  milestones: Milestone[];
  notes: NoteCard[];
  today_column: number | null;  // -1 if today is outside range
  phase_progress: PhaseProgressData[];
  overall_progress: number;
}

/** Progress data for a single phase */
export interface PhaseProgressData {
  phase_no: PhaseNumber;
  phase_name: string;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  blocked_tasks: number;
  completion_pct: number;
  status: 'on_track' | 'at_risk' | 'behind' | 'completed' | 'not_started';
  color: string;
}
```

---

## 2.4 Data Hooks

### 2.4.1 `useGanttData` — Main Data Assembly Hook

```typescript
// src/hooks/useGanttData.ts

import { useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import type {
  Project, ProjectTask, TimelineConfig, GanttData,
  GanttRow, PhaseProgressData, Period, PhaseNumber,
} from '@/types/timeline';
import {
  PHASE_COLORS, PHASE_NAMES, TASK_STATUS_COLORS,
} from '@/lib/timeline-constants';

/**
 * Fetch project + tasks + timeline config from Supabase,
 * then compute the full GanttData structure for rendering.
 */
export function useGanttData(projectNo: string) {
  // Fetch project metadata
  const projectQuery = useQuery({
    queryKey: ['project', projectNo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asi360_projects')
        .select('*')
        .eq('project_no', projectNo)
        .single();
      if (error) throw error;
      return data as Project;
    },
    enabled: !!projectNo,
  });

  // Fetch all tasks for this project
  const tasksQuery = useQuery({
    queryKey: ['project-tasks', projectNo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asi360_project_tasks')
        .select('*')
        .eq('project_no', projectNo)
        .order('phase_no', { ascending: true })
        .order('task_no', { ascending: true });
      if (error) throw error;
      return data as ProjectTask[];
    },
    enabled: !!projectNo,
  });

  // Fetch timeline visualization config (may not exist)
  const configQuery = useQuery({
    queryKey: ['timeline-config', projectNo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_timeline_config')
        .select('*')
        .eq('project_no', projectNo)
        .maybeSingle();
      if (error) throw error;
      return data as TimelineConfig | null;
    },
    enabled: !!projectNo,
  });

  // Assemble computed GanttData
  const ganttData = useMemo<GanttData | null>(() => {
    if (!projectQuery.data || !tasksQuery.data) return null;

    const project = projectQuery.data;
    const tasks = tasksQuery.data;
    const config = configQuery.data;

    return assembleGanttData(project, tasks, config);
  }, [projectQuery.data, tasksQuery.data, configQuery.data]);

  return {
    data: ganttData,
    isLoading: projectQuery.isLoading || tasksQuery.isLoading,
    error: projectQuery.error || tasksQuery.error,
    refetch: () => {
      projectQuery.refetch();
      tasksQuery.refetch();
      configQuery.refetch();
    },
  };
}


/**
 * Core assembly function: merges project, tasks, and config into GanttData.
 */
export function assembleGanttData(
  project: Project,
  tasks: ProjectTask[],
  config: TimelineConfig | null,
): GanttData {
  // Group tasks by phase
  const tasksByPhase = new Map<number, ProjectTask[]>();
  for (const task of tasks) {
    const group = tasksByPhase.get(task.phase_no) || [];
    group.push(task);
    tasksByPhase.set(task.phase_no, group);
  }

  // Use config if available, otherwise generate defaults
  const totalDays = config?.total_days ?? 10;
  const dayLabels = config?.day_labels ?? generateDefaultDayLabels(totalDays);
  const periods = config?.periods ?? generateDefaultPeriods(totalDays);
  const milestones = config?.milestones ?? [];
  const notes = config?.notes ?? [];

  // Build task bar lookup from config
  const taskBarMap = new Map<string, { bar_start: number; bar_end: number; bar_label: string; bar_color?: string }>();
  if (config?.task_bars) {
    for (const tb of config.task_bars) {
      taskBarMap.set(tb.task_no, tb);
    }
  }

  // Build rows
  const rows: GanttRow[] = [];

  for (let phaseNo = 1; phaseNo <= 5; phaseNo++) {
    const phaseTasks = tasksByPhase.get(phaseNo) || [];
    const phaseColor = PHASE_COLORS[phaseNo as PhaseNumber];
    const phaseName = PHASE_NAMES[phaseNo as PhaseNumber];
    const rowspan = 1 + phaseTasks.length;

    // Phase config override
    const phaseConfig = config?.phases?.find(p => p.phase_no === phaseNo);

    // Phase header row
    rows.push({
      id: `phase-${phaseNo}`,
      phase_no: phaseNo,
      phase_rowspan: rowspan,
      phase_color: phaseConfig?.color || phaseColor,
      name: phaseName,
      is_phase_row: true,
      is_milestone: false,
      is_buffer: phaseConfig?.is_buffer || false,
      bar_start: phaseConfig?.bar_start ?? -1,
      bar_end: phaseConfig?.bar_end ?? -1,
      bar_color: phaseConfig?.color || phaseColor,
      bar_label: '',
    });

    // Task sub-rows
    for (const task of phaseTasks) {
      const bar = taskBarMap.get(task.task_no);
      const barStart = bar?.bar_start ?? autoBarPosition(phaseNo, task.task_no, totalDays);
      const barEnd = bar?.bar_end ?? barStart;

      rows.push({
        id: `task-${task.task_no}`,
        phase_no: phaseNo,
        phase_rowspan: 0,
        phase_color: phaseColor,
        name: task.task_name,
        is_phase_row: false,
        is_milestone: false,
        is_buffer: phaseConfig?.is_buffer || false,
        bar_start: barStart,
        bar_end: barEnd,
        bar_color: bar?.bar_color || TASK_STATUS_COLORS[task.status] || phaseColor,
        bar_label: bar?.bar_label || task.task_name.substring(0, 16),
        status: task.status,
      });
    }
  }

  // Milestone row (PROJECT COMPLETE)
  const allCompleted = tasks.length > 0 && tasks.every(t => t.status === 'completed');
  if (allCompleted) {
    rows.push({
      id: 'milestone-complete',
      phase_no: 0,
      phase_rowspan: 1,
      phase_color: '#434343',
      name: 'PROJECT COMPLETE',
      is_phase_row: true,
      is_milestone: true,
      is_buffer: false,
      bar_start: totalDays - 1,
      bar_end: totalDays - 1,
      bar_color: '#38761D',
      bar_label: '✓ COMPLETE',
    });
  }

  // Calculate phase progress
  const phaseProgress = calculatePhaseProgress(tasks);

  // Calculate overall progress
  const totalTasks = tasks.filter(t => t.status !== 'canceled').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Calculate today column
  const todayColumn = calculateTodayColumn(config, totalDays);

  return {
    project,
    rows,
    periods,
    day_labels: dayLabels,
    total_days: totalDays,
    milestones,
    notes,
    today_column: todayColumn,
    phase_progress: phaseProgress,
    overall_progress: overallProgress,
  };
}


// ─── Helper Functions ───

function generateDefaultDayLabels(totalDays: number): string[] {
  const weekdays = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  const labels: string[] = [];
  for (let i = 0; i < totalDays; i++) {
    labels.push(weekdays[i % 5]);
  }
  return labels;
}

function generateDefaultPeriods(totalDays: number): Period[] {
  const periods: Period[] = [];
  const weeksCount = Math.ceil(totalDays / 5);
  for (let w = 0; w < weeksCount; w++) {
    const remaining = totalDays - w * 5;
    periods.push({
      label: `WEEK ${w + 1}`,
      span: Math.min(5, remaining),
    });
  }
  return periods;
}

/**
 * Auto-position a task bar when no config exists.
 * Spreads tasks evenly across the totalDays range based on phase.
 */
function autoBarPosition(phaseNo: number, taskNo: string, totalDays: number): number {
  const daysPerPhase = totalDays / 5;
  const phaseStart = Math.floor((phaseNo - 1) * daysPerPhase);
  // Extract sub-task index from "1.1" → 0, "1.2" → 1
  const subIndex = parseInt(taskNo.split('.')[1] || '1', 10) - 1;
  return Math.min(phaseStart + subIndex, totalDays - 1);
}

function calculateTodayColumn(
  config: TimelineConfig | null,
  totalDays: number,
): number | null {
  if (!config?.schedule_start) return null;

  const start = new Date(config.schedule_start);
  const today = new Date();
  const blackouts = new Set(config.blackout_days || []);

  // Count business days from start to today
  let businessDays = 0;
  const cursor = new Date(start);
  while (cursor <= today && businessDays < totalDays) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6 && !blackouts.has(businessDays)) {
      if (cursor.toDateString() === today.toDateString()) {
        return businessDays;
      }
      businessDays++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return null; // Today is outside the timeline range
}

function calculatePhaseProgress(tasks: ProjectTask[]): PhaseProgressData[] {
  const phases: PhaseProgressData[] = [];

  for (let phaseNo = 1; phaseNo <= 5; phaseNo++) {
    const phaseTasks = tasks.filter(
      t => t.phase_no === phaseNo && t.status !== 'canceled'
    );
    const total = phaseTasks.length;
    const completed = phaseTasks.filter(t => t.status === 'completed').length;
    const inProgress = phaseTasks.filter(t => t.status === 'in_progress').length;
    const blocked = phaseTasks.filter(t => t.status === 'blocked').length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Determine phase risk status
    let status: PhaseProgressData['status'] = 'not_started';
    if (pct === 100) {
      status = 'completed';
    } else if (blocked > 0) {
      status = 'behind';
    } else if (inProgress > 0 || completed > 0) {
      // Simple heuristic: if more than half tasks are open and we're past
      // the expected completion point, we're at risk
      const expectedPct = calculateExpectedProgress(phaseNo);
      if (pct < expectedPct * 0.7) {
        status = 'behind';
      } else if (pct < expectedPct) {
        status = 'at_risk';
      } else {
        status = 'on_track';
      }
    }

    phases.push({
      phase_no: phaseNo as PhaseNumber,
      phase_name: PHASE_NAMES[phaseNo as PhaseNumber],
      total_tasks: total,
      completed_tasks: completed,
      in_progress_tasks: inProgress,
      blocked_tasks: blocked,
      completion_pct: pct,
      status,
      color: PHASE_COLORS[phaseNo as PhaseNumber],
    });
  }

  return phases;
}

/**
 * Expected progress based on elapsed time within a typical project.
 * Returns 0-100 representing where this phase should be if on-track.
 */
function calculateExpectedProgress(phaseNo: number): number {
  // Simple linear model: each phase is 20% of timeline
  // Phase 1 should be done by 20%, phase 2 by 40%, etc.
  // This is a stub — real implementation would use schedule_start + target_close_date
  return phaseNo * 20;
}
```

### 2.4.2 `useRealtimeUpdates` — Live Task Status Subscription

```typescript
// src/hooks/useRealtimeUpdates.ts

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { ProjectTask } from '@/types/timeline';

interface RealtimeState {
  isConnected: boolean;
  lastUpdate: Date | null;
  reconnectAttempts: number;
}

/**
 * Subscribe to real-time changes on asi360_project_tasks for a given project.
 * Automatically invalidates React Query cache so GanttChart re-renders.
 */
export function useRealtimeUpdates(projectNo: string) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [state, setState] = useState<RealtimeState>({
    isConnected: false,
    lastUpdate: null,
    reconnectAttempts: 0,
  });

  const handleChange = useCallback(
    (payload: RealtimePostgresChangesPayload<ProjectTask>) => {
      console.log('[Realtime] Task update:', payload.eventType, payload.new);

      // Invalidate task query to trigger re-fetch and re-render
      queryClient.invalidateQueries({
        queryKey: ['project-tasks', projectNo],
      });

      // Also invalidate project query in case phase/status rolled up
      queryClient.invalidateQueries({
        queryKey: ['project', projectNo],
      });

      setState(prev => ({
        ...prev,
        lastUpdate: new Date(),
      }));
    },
    [projectNo, queryClient],
  );

  useEffect(() => {
    if (!projectNo) return;

    // Create channel with filter on project_no
    const channel = supabase
      .channel(`timeline-${projectNo}`)
      .on<ProjectTask>(
        'postgres_changes',
        {
          event: '*',  // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'asi360_project_tasks',
          filter: `project_no=eq.${projectNo}`,
        },
        handleChange,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setState(prev => ({
            ...prev,
            isConnected: true,
            reconnectAttempts: 0,
          }));
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setState(prev => ({
            ...prev,
            isConnected: false,
            reconnectAttempts: prev.reconnectAttempts + 1,
          }));
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount or projectNo change
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [projectNo, handleChange]);

  // Format "Updated X minutes ago" display
  const lastUpdateText = state.lastUpdate
    ? formatTimeAgo(state.lastUpdate)
    : null;

  return {
    isConnected: state.isConnected,
    lastUpdate: state.lastUpdate,
    lastUpdateText,
    reconnectAttempts: state.reconnectAttempts,
  };
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Updated just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `Updated ${hours}h ago`;
}
```

---

## 2.5 GanttChart React Component

This is the full port of `timeline.html` to React + Tailwind. The original template uses an HTML `<table>` with `<colgroup>`, `rowspan`, and `colspan` for Gantt bar layout. The React port preserves this table-based approach for pixel-accurate alignment and print fidelity.

### 2.5.1 Component Props

```typescript
// src/components/timeline/GanttChart.tsx

import type { GanttData, GanttRow, Milestone, Period } from '@/types/timeline';

export interface GanttChartProps {
  /** Complete assembled Gantt data */
  data: GanttData;

  /** Show the red "today" marker line */
  showToday?: boolean;

  /** Enable CSS transition animations on bar changes */
  animated?: boolean;

  /** Callback when a task bar is clicked */
  onTaskClick?: (taskNo: string) => void;

  /** Callback when a phase header is clicked */
  onPhaseClick?: (phaseNo: number) => void;

  /** Whether to render in compact/print mode */
  printMode?: boolean;

  /** Custom class name for outer wrapper */
  className?: string;
}
```

### 2.5.2 Full GanttChart Component

```tsx
// src/components/timeline/GanttChart.tsx

import { useState, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { GanttChartProps, GanttRow } from './types';
import { TASK_STATUS_LABELS } from '@/lib/timeline-constants';

export function GanttChart({
  data,
  showToday = true,
  animated = true,
  onTaskClick,
  onPhaseClick,
  printMode = false,
  className,
}: GanttChartProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const { rows, periods, day_labels, total_days, milestones, today_column } = data;

  // Calculate column widths
  const phaseColWidth = printMode ? '32px' : '48px';
  const detailColWidth = printMode ? '170px' : '220px';
  const endColWidth = printMode ? '22px' : '32px';

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <div
        className={cn(
          'border border-neutral-300 rounded-md overflow-hidden',
          'min-w-[800px]', // Force horizontal scroll on small screens
          printMode && 'border-neutral-400'
        )}
      >
        <table
          ref={tableRef}
          className="w-full border-collapse table-fixed"
          role="grid"
          aria-label={`Project timeline for ${data.project.project_name}`}
        >
          {/* ── Column Definitions ── */}
          <colgroup>
            <col style={{ width: phaseColWidth }} />
            <col style={{ width: detailColWidth }} />
            {day_labels.map((_, i) => (
              <col key={`day-${i}`} />
            ))}
            <col style={{ width: endColWidth }} />
          </colgroup>

          <thead>
            {/* ── Period Header Row (WEEK 1, WEEK 2, etc.) ── */}
            <tr>
              <th className="bg-neutral-700 p-0" />
              <th className="bg-neutral-700 p-0" />
              {periods.map((period, i) => (
                <th
                  key={`period-${i}`}
                  colSpan={period.span}
                  className={cn(
                    'bg-neutral-600 text-white text-center',
                    'text-[7px] font-bold uppercase tracking-wider',
                    'py-0.5 px-1 border-r border-neutral-500',
                    !printMode && 'text-xs py-1'
                  )}
                >
                  {period.label}
                </th>
              ))}
              <th className="bg-neutral-600 p-0" />
            </tr>

            {/* ── Day Label Header Row (MON, TUE, etc.) ── */}
            <tr>
              <th
                className={cn(
                  'bg-neutral-800 text-white text-center',
                  'text-[7px] font-bold uppercase tracking-wider',
                  'py-1 px-0.5 border-r border-neutral-600',
                  !printMode && 'text-xs py-2'
                )}
              >
                PHASE
              </th>
              <th
                className={cn(
                  'bg-neutral-800 text-white text-left',
                  'text-[7px] font-bold uppercase tracking-wider',
                  'py-1 pl-1.5 border-r border-neutral-600',
                  !printMode && 'text-xs py-2 pl-3'
                )}
              >
                DETAILS
              </th>
              {day_labels.map((label, i) => (
                <th
                  key={`day-header-${i}`}
                  className={cn(
                    'bg-neutral-700 text-white text-center',
                    'text-[7px] font-bold uppercase tracking-wider',
                    'py-1 px-0.5 border-r border-neutral-600',
                    !printMode && 'text-xs py-2',
                    // Highlight today column header
                    showToday && today_column === i && 'bg-red-700'
                  )}
                >
                  {label}
                </th>
              ))}
              <th
                className={cn(
                  'bg-neutral-700 text-white text-center',
                  'text-[6px] font-bold uppercase',
                  'py-1 px-0.5',
                  // Vertical text for "PROJECT END"
                  '[writing-mode:vertical-rl] [text-orientation:mixed]',
                  'tracking-[1.5px]',
                  !printMode && 'text-[8px]'
                )}
              >
                PROJECT END
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <GanttTableRow
                key={row.id}
                row={row}
                totalDays={total_days}
                todayColumn={showToday ? today_column : null}
                isHovered={hoveredRow === row.id}
                animated={animated}
                printMode={printMode}
                onMouseEnter={() => setHoveredRow(row.id)}
                onMouseLeave={() => setHoveredRow(null)}
                onClick={() => {
                  if (row.is_phase_row && onPhaseClick) {
                    onPhaseClick(row.phase_no);
                  } else if (!row.is_phase_row && row.status && onTaskClick) {
                    onTaskClick(row.id.replace('task-', ''));
                  }
                }}
              />
            ))}

            {/* ── Milestone Rows ── */}
            {milestones.map((ms, i) => (
              <MilestoneTableRow
                key={`ms-${i}`}
                milestone={ms}
                totalDays={total_days}
                printMode={printMode}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ─── Sub-Components ───

interface GanttTableRowProps {
  row: GanttRow;
  totalDays: number;
  todayColumn: number | null;
  isHovered: boolean;
  animated: boolean;
  printMode: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}

function GanttTableRow({
  row,
  totalDays,
  todayColumn,
  isHovered,
  animated,
  printMode,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: GanttTableRowProps) {
  // Build day cells, inserting bar where appropriate
  const dayCells: React.ReactNode[] = [];
  let skipUntil = -1;

  for (let d = 0; d < totalDays; d++) {
    if (d <= skipUntil) continue;

    const isBarStart = d === row.bar_start && row.bar_start >= 0;
    const isInsideBar = d >= row.bar_start && d <= row.bar_end && row.bar_start >= 0;
    const isToday = todayColumn === d;

    if (isBarStart) {
      const barSpan = row.bar_end - row.bar_start + 1;
      skipUntil = row.bar_end;

      dayCells.push(
        <td
          key={`bar-${d}`}
          colSpan={barSpan}
          className="p-[1px] relative"
        >
          <div
            className={cn(
              'flex items-center justify-center',
              'h-4 rounded-sm',
              'text-white text-[6.5px] font-semibold',
              'tracking-wide whitespace-nowrap overflow-hidden text-ellipsis',
              'px-1',
              !printMode && 'h-6 text-xs rounded',
              animated && 'transition-all duration-300 ease-in-out',
              // Hover effect
              isHovered && 'ring-2 ring-white/50 shadow-md',
              // Cursor for interactive rows
              !row.is_phase_row && 'cursor-pointer'
            )}
            style={{ backgroundColor: row.bar_color }}
            title={`${row.name}${row.status ? ` (${TASK_STATUS_LABELS[row.status]})` : ''}`}
          >
            {row.bar_label}
          </div>
          {/* Today marker line overlaying the bar */}
          {isToday && todayColumn !== null && todayColumn >= row.bar_start && todayColumn <= row.bar_end && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-600 z-10"
              style={{
                left: `${((todayColumn - row.bar_start) / barSpan) * 100}%`,
              }}
            />
          )}
        </td>
      );
    } else if (!isInsideBar) {
      dayCells.push(
        <td
          key={`day-${d}`}
          className={cn(
            'border-b border-r border-neutral-200',
            'h-[19px]',
            !printMode && 'h-8',
            row.is_buffer ? 'bg-amber-50' : 'bg-neutral-50',
            // Alternating row striping
            'even:bg-neutral-100',
            // Today column highlight
            isToday && 'bg-red-50 border-r-red-200',
            // Blackout day
            row.is_buffer && 'bg-amber-50/50'
          )}
        >
          {/* Today marker (vertical red line) */}
          {isToday && (
            <div className="w-full h-full flex justify-center">
              <div className="w-0.5 h-full bg-red-500 opacity-60" />
            </div>
          )}
        </td>
      );
    }
  }

  return (
    <tr
      className={cn(
        'group',
        row.is_milestone && 'bg-blue-50 border-b-2 border-primary-700',
        row.is_buffer && 'bg-amber-50/30',
        isHovered && !printMode && 'bg-primary-50/50',
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {/* Phase number cell (only rendered for first row via rowspan) */}
      {row.phase_rowspan > 0 && (
        <td
          rowSpan={row.phase_rowspan}
          className={cn(
            'text-center text-white font-extrabold',
            'border-r-2 border-white',
            'text-[11px]',
            !printMode && 'text-base',
          )}
          style={{ backgroundColor: row.phase_color }}
        >
          {row.phase_no > 0 ? row.phase_no : ''}
        </td>
      )}

      {/* Detail cell (task/phase name) */}
      <td
        className={cn(
          'px-1.5 border-r-2 border-neutral-300',
          'whitespace-nowrap overflow-hidden text-ellipsis',
          'border-b border-neutral-200',
          'h-[19px]',
          !printMode && 'px-3 h-8',
          row.is_phase_row
            ? cn('font-bold text-[8px] text-neutral-900', !printMode && 'text-sm')
            : cn('pl-3 text-[7.5px] text-neutral-600', !printMode && 'pl-6 text-sm'),
          row.is_milestone && 'font-bold text-primary-700 text-[8px]',
        )}
        title={row.name}
      >
        {!row.is_phase_row && !row.is_milestone && (
          <span className="text-neutral-400 mr-1">-</span>
        )}
        {row.name}
      </td>

      {/* Day cells (including bars) */}
      {dayCells}

      {/* End marker column */}
      <td
        className={cn(
          'bg-neutral-700 border-l-2 border-neutral-800',
          'h-[19px]',
          !printMode && 'h-8',
        )}
      />
    </tr>
  );
}


interface MilestoneTableRowProps {
  milestone: Milestone;
  totalDays: number;
  printMode: boolean;
}

function MilestoneTableRow({ milestone, totalDays, printMode }: MilestoneTableRowProps) {
  return (
    <tr className="bg-blue-50 border-b-2 border-primary-700">
      <td
        className={cn(
          'text-center text-white font-bold text-[9px]',
          !printMode && 'text-xs',
        )}
        style={{ backgroundColor: milestone.color }}
      >
        {milestone.type === 'payment' ? '$' : '◆'}
      </td>
      <td
        className={cn(
          'px-1.5 font-bold text-primary-700',
          'text-[8px] border-r-2 border-neutral-300',
          !printMode && 'px-3 text-sm',
        )}
      >
        {milestone.label}
      </td>
      {Array.from({ length: totalDays }).map((_, d) => (
        <td
          key={`ms-day-${d}`}
          className={cn(
            'bg-blue-50/50 border-r border-blue-200',
            'h-[19px]',
            !printMode && 'h-8',
          )}
        >
          {d === milestone.day && (
            <div className="flex items-center justify-center h-full">
              <div
                className={cn(
                  'w-3 h-3 rotate-45',
                  !printMode && 'w-4 h-4',
                )}
                style={{ backgroundColor: milestone.color }}
                title={milestone.label}
              />
            </div>
          )}
        </td>
      ))}
      <td className="bg-neutral-700" />
    </tr>
  );
}
```

### 2.5.3 CSS-to-Tailwind Mapping Reference

This table maps every significant CSS rule from `timeline.html` to its Tailwind equivalent used in the React component:

| Original CSS | Tailwind Class | Notes |
|---|---|---|
| `font-family: 'Helvetica Neue', Arial, sans-serif` | `font-sans` | Tailwind default stack is similar |
| `font-size: 8px` | `text-[8px]` | Arbitrary value |
| `-webkit-print-color-adjust: exact` | `print:[-webkit-print-color-adjust:exact]` | Print media query |
| `border-bottom: 2.5px solid #0B5394` | `border-b-[2.5px] border-primary-700` | Custom border width |
| `font-size: 18px; font-weight: 800` | `text-lg font-extrabold` | Header title |
| `background: #434343` | `bg-neutral-700` | Close match |
| `background: #333` | `bg-neutral-800` | Close match |
| `background: #555` | `bg-neutral-600` | Period headers |
| `writing-mode: vertical-rl` | `[writing-mode:vertical-rl]` | Arbitrary property |
| `height: 19px` | `h-[19px]` | Exact row height for print |
| `border-right: 2px solid #ccc` | `border-r-2 border-neutral-300` | Detail separator |
| `padding-left: 12px` | `pl-3` | Sub-task indent |
| `border-radius: 2px` | `rounded-sm` | Bar corners |
| `font-size: 6.5px` | `text-[6.5px]` | Bar label text |
| `background: #fafafa` | `bg-neutral-50` | Empty day cells |
| `background: #fff8e1` | `bg-amber-50` | Buffer row background |
| `background: #e8f0fe` | `bg-blue-50` | Milestone row |
| `grid-template-columns: 1fr 1fr 1fr` | `grid-cols-3` | Notes grid |
| `gap: 8px` | `gap-2` | Notes grid gap |

### 2.5.4 Responsive Behavior

```tsx
// Responsive wrapper applied around GanttChart

export function ResponsiveTimeline({ data, ...props }: GanttChartProps) {
  const [viewMode, setViewMode] = useState<'gantt' | 'list'>('gantt');

  return (
    <div>
      {/* Desktop: Full Gantt (>= 1024px) */}
      <div className="hidden lg:block">
        <GanttChart data={data} {...props} />
      </div>

      {/* Tablet: Condensed Gantt with fewer columns (768-1023px) */}
      <div className="hidden md:block lg:hidden">
        <GanttChart
          data={{
            ...data,
            // Collapse to phase-level bars only (hide individual task rows)
            rows: data.rows.filter(r => r.is_phase_row || r.is_milestone),
          }}
          {...props}
          className="text-[7px]"
        />
      </div>

      {/* Mobile: Vertical phase list (< 768px) */}
      <div className="block md:hidden">
        <MobilePhaseList data={data} onTaskClick={props.onTaskClick} />
      </div>
    </div>
  );
}

function MobilePhaseList({
  data,
  onTaskClick,
}: {
  data: GanttData;
  onTaskClick?: (taskNo: string) => void;
}) {
  return (
    <div className="space-y-3">
      {data.phase_progress.map((phase) => (
        <div
          key={phase.phase_no}
          className="border border-neutral-200 rounded-lg overflow-hidden"
        >
          {/* Phase header */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white"
            style={{ backgroundColor: phase.color }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold">{phase.phase_no}</span>
              <span className="text-sm font-semibold">{phase.phase_name}</span>
            </div>
            <span className="text-sm font-bold">{phase.completion_pct}%</span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-neutral-200">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${phase.completion_pct}%`,
                backgroundColor: phase.color,
              }}
            />
          </div>

          {/* Task list */}
          <div className="divide-y divide-neutral-100">
            {data.rows
              .filter(r => r.phase_no === phase.phase_no && !r.is_phase_row)
              .map((row) => (
                <button
                  key={row.id}
                  onClick={() => onTaskClick?.(row.id.replace('task-', ''))}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-neutral-50 text-left"
                >
                  <span className="text-sm text-neutral-700">{row.name}</span>
                  {row.status && (
                    <span
                      className="shrink-0 w-2.5 h-2.5 rounded-full ml-2"
                      style={{ backgroundColor: row.bar_color }}
                      title={TASK_STATUS_LABELS[row.status]}
                    />
                  )}
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 2.6 PhaseProgress Component

Displays 5 horizontal progress bars plus an overall progress ring.

```tsx
// src/components/timeline/PhaseProgress.tsx

import { cn } from '@/lib/utils';
import type { PhaseProgressData } from '@/types/timeline';

interface PhaseProgressProps {
  phases: PhaseProgressData[];
  overallProgress: number;
  className?: string;
}

const STATUS_BADGES = {
  on_track: { label: 'On Track', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  at_risk: { label: 'At Risk', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  behind: { label: 'Behind', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  completed: { label: 'Completed', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  not_started: { label: 'Not Started', bg: 'bg-neutral-100', text: 'text-neutral-600', border: 'border-neutral-200' },
} as const;

export function PhaseProgress({ phases, overallProgress, className }: PhaseProgressProps) {
  return (
    <div className={cn('flex gap-6', className)}>
      {/* ── Overall Progress Ring ── */}
      <div className="flex flex-col items-center justify-center shrink-0">
        <ProgressRing
          percentage={overallProgress}
          size={96}
          strokeWidth={8}
          color={
            overallProgress === 100 ? '#38761D' :
            overallProgress >= 60 ? '#45818E' :
            overallProgress >= 30 ? '#B85B22' :
            '#E0E0E0'
          }
        />
        <span className="text-xs font-medium text-neutral-500 mt-1">Overall</span>
      </div>

      {/* ── Phase Bars ── */}
      <div className="flex-1 space-y-3">
        {phases.map((phase) => {
          const badge = STATUS_BADGES[phase.status];

          return (
            <div key={phase.phase_no} className="group">
              {/* Label row */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold text-white"
                    style={{ backgroundColor: phase.color }}
                  >
                    {phase.phase_no}
                  </span>
                  <span className="text-sm font-medium text-neutral-700">
                    {phase.phase_name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Status badge */}
                  <span
                    className={cn(
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded border',
                      badge.bg, badge.text, badge.border,
                    )}
                  >
                    {badge.label}
                  </span>
                  {/* Fraction */}
                  <span className="text-xs text-neutral-500 tabular-nums w-12 text-right">
                    {phase.completed_tasks}/{phase.total_tasks}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${phase.completion_pct}%`,
                    backgroundColor: phase.color,
                  }}
                />
              </div>

              {/* Blocked indicator */}
              {phase.blocked_tasks > 0 && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                  <span className="text-[10px] text-red-600 font-medium">
                    {phase.blocked_tasks} blocked
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ─── SVG Progress Ring ───

interface ProgressRingProps {
  percentage: number;
  size: number;
  strokeWidth: number;
  color: string;
}

function ProgressRing({ percentage, size, strokeWidth, color }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-extrabold text-neutral-800">
          {percentage}%
        </span>
      </div>
    </div>
  );
}
```

---

## 2.7 NoteCards Component

Renders the 3-column note card grid below the Gantt chart (maps to `.notes-section` in timeline.html).

```tsx
// src/components/timeline/NoteCards.tsx

import { cn } from '@/lib/utils';
import type { NoteCard } from '@/types/timeline';

interface NoteCardsProps {
  notes: NoteCard[];
  className?: string;
}

export function NoteCards({ notes, className }: NoteCardsProps) {
  if (notes.length === 0) return null;

  return (
    <div className={cn('mt-4 print:break-inside-avoid', className)}>
      <div
        className={cn(
          'grid gap-3',
          notes.length === 1 && 'grid-cols-1',
          notes.length === 2 && 'grid-cols-2',
          notes.length >= 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        )}
      >
        {notes.map((note, i) => (
          <div
            key={i}
            className="border border-neutral-200 rounded overflow-hidden"
          >
            {/* Header */}
            <div
              className="px-2 py-1 text-[7px] font-bold uppercase tracking-wider text-white print:text-[7px] text-xs"
              style={{ backgroundColor: note.color }}
            >
              {note.title}
            </div>

            {/* Body */}
            <div className="px-2 py-1.5 text-[7px] leading-snug text-neutral-600 print:text-[7px] text-sm">
              {note.bullet_items ? (
                <ul className="list-none p-0 space-y-0.5">
                  {note.bullet_items.map((item, j) => (
                    <li key={j} className="pl-2.5 relative">
                      <span className="absolute left-0 text-neutral-400">
                        ▸
                      </span>
                      <span
                        dangerouslySetInnerHTML={{ __html: sanitizeBullet(item) }}
                      />
                    </li>
                  ))}
                </ul>
              ) : note.content ? (
                <div dangerouslySetInnerHTML={{ __html: sanitizeBullet(note.content) }} />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Allow only <span class='highlight'> tags through.
 * Strip everything else to prevent XSS.
 */
function sanitizeBullet(html: string): string {
  return html.replace(
    /<(?!\/?(span)\b)[^>]*>/gi,
    ''
  );
}
```

---

## 2.8 PDF Export

### 2.8.1 Architecture

PDF export reuses the existing `timeline.html` Jinja2 template and `generate_timeline.py` Python script. The React portal triggers PDF generation via a Supabase Edge Function that:

1. Fetches project + tasks + timeline_config from Supabase
2. Assembles template data (same logic as Python `build_template_data`)
3. Renders HTML via Jinja2
4. Converts to PDF via Playwright (headless Chromium)
5. Returns the PDF as a binary response

Since Supabase Edge Functions run Deno (no Playwright), the Edge Function delegates to the droplet's Python generator via an HTTP call.

```
Client Browser
    │
    ▼
Supabase Edge Function (GET /timeline/pdf?project_no=xxx)
    │
    ▼ HTTP POST to droplet
Droplet: generate_timeline.py --source supabase PROJ-xxx
    │
    ▼ Playwright (Chromium headless)
PDF binary
    │
    ▼ Returned to Edge Function
    │
    ▼ Streamed to client
application/pdf download
```

### 2.8.2 Supabase Edge Function

```typescript
// supabase/functions/timeline-pdf/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const DROPLET_URL = 'http://104.248.69.86:3004';

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    });
  }

  // Auth check
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse query params
  const url = new URL(req.url);
  const projectNo = url.searchParams.get('project_no');

  if (!projectNo) {
    return new Response(
      JSON.stringify({ error: 'Missing project_no query parameter' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    // Delegate to droplet's timeline generator API
    const response = await fetch(`${DROPLET_URL}/api/timeline/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ project_no: projectNo }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `PDF generation failed: ${errorText}` }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Stream the PDF back
    const pdfBuffer = await response.arrayBuffer();
    const filename = `${projectNo}_Timeline.pdf`;

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Internal error: ${(err as Error).message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
```

### 2.8.3 Droplet API Endpoint

This Express route on the droplet (port 3004) wraps the existing Python generator:

```typescript
// /var/www/asi360-gateway/routes/timeline.ts

import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);
const router = Router();

const GENERATOR_PATH = '/root/360_Quotes_Engine/generate_timeline.py';
const OUTPUT_DIR = '/tmp/timeline_pdfs';

router.post('/api/timeline/pdf', async (req, res) => {
  const { project_no } = req.body;

  if (!project_no || !/^PROJ-\d{6}-\d+$/.test(project_no)) {
    return res.status(400).json({ error: 'Invalid project_no format' });
  }

  try {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Run Python generator with Supabase source
    const cmd = `cd /root/360_Quotes_Engine && python3 ${GENERATOR_PATH} --source supabase ${project_no}`;
    const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });

    // Parse output to find PDF path
    const pdfMatch = stdout.match(/PDF:\s+(.+\.pdf)/);
    if (!pdfMatch) {
      return res.status(500).json({
        error: 'PDF generation completed but output path not found',
        stdout,
        stderr,
      });
    }

    const pdfPath = pdfMatch[1].trim();

    if (!fs.existsSync(pdfPath)) {
      return res.status(500).json({ error: `PDF file not found at ${pdfPath}` });
    }

    // Stream PDF back
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(pdfPath)}"`);
    const stream = fs.createReadStream(pdfPath);
    stream.pipe(res);

    // Clean up after streaming
    stream.on('end', () => {
      fs.unlink(pdfPath, () => {}); // Best-effort cleanup
    });
  } catch (err) {
    res.status(500).json({
      error: `Generation failed: ${(err as Error).message}`,
    });
  }
});

export default router;
```

### 2.8.4 Client-Side Export Button

```tsx
// src/components/timeline/ExportBar.tsx

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ExportBarProps {
  projectNo: string;
}

export function ExportBar({ projectNo }: ExportBarProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'png' | 'svg'>('pdf');

  async function handlePDFExport() {
    setIsExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/timeline-pdf?project_no=${projectNo}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Export failed');
      }

      // Download the PDF
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectNo}_Timeline.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF export failed:', err);
      // TODO: Show toast notification
    } finally {
      setIsExporting(false);
    }
  }

  async function handlePNGExport() {
    // Use html2canvas to capture the Gantt table as PNG
    const { default: html2canvas } = await import('html2canvas');
    const ganttEl = document.querySelector('[data-gantt-chart]');
    if (!ganttEl) return;

    setIsExporting(true);
    try {
      const canvas = await html2canvas(ganttEl as HTMLElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectNo}_Timeline.png`;
      a.click();
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePDFExport}
        disabled={isExporting}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded',
          'bg-primary-700 text-white text-sm font-medium',
          'hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors',
        )}
      >
        {isExporting ? (
          <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
        Export PDF
      </button>

      <button
        onClick={handlePNGExport}
        disabled={isExporting}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
      >
        PNG
      </button>
    </div>
  );
}
```

---

## 2.9 Timeline Configuration

### 2.9.1 Day Label Modes

The `day_label_mode` field controls how column headers are generated:

| Mode | Example | Use Case |
|---|---|---|
| `weekday` | MON, TUE, WED | Default for short projects (1-3 weeks) |
| `numbered` | Day 1, Day 2 | When specific calendar dates are not yet set |
| `dated` | Mar 10, Mar 11 | When `schedule_start` is set and dates are confirmed |

```typescript
// src/lib/day-labels.ts

import { format, addBusinessDays, isWeekend } from 'date-fns';

export function generateDayLabels(
  mode: 'weekday' | 'numbered' | 'dated',
  totalDays: number,
  scheduleStart?: string | null,
  blackoutDays?: number[],
): string[] {
  switch (mode) {
    case 'weekday': {
      const weekdays = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
      return Array.from({ length: totalDays }, (_, i) => weekdays[i % 5]);
    }

    case 'numbered': {
      return Array.from({ length: totalDays }, (_, i) => `Day ${i + 1}`);
    }

    case 'dated': {
      if (!scheduleStart) {
        // Fallback to weekday if no start date
        return generateDayLabels('weekday', totalDays);
      }
      const blackouts = new Set(blackoutDays || []);
      const labels: string[] = [];
      let cursor = new Date(scheduleStart);
      let dayIndex = 0;

      while (labels.length < totalDays) {
        if (!isWeekend(cursor) && !blackouts.has(dayIndex)) {
          labels.push(format(cursor, 'MMM d').toUpperCase());
          dayIndex++;
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      return labels;
    }
  }
}
```

### 2.9.2 Admin Configuration Panel

For internal use (admin panel, not client-facing). Allows project managers to configure timeline layout, milestones, and notes.

```tsx
// src/components/admin/TimelineConfigEditor.tsx

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { TimelineConfig, NoteCard, Milestone } from '@/types/timeline';

interface TimelineConfigEditorProps {
  projectNo: string;
  config: TimelineConfig | null;
  onSave: () => void;
}

export function TimelineConfigEditor({
  projectNo,
  config,
  onSave,
}: TimelineConfigEditorProps) {
  const [totalDays, setTotalDays] = useState(config?.total_days ?? 10);
  const [dayLabelMode, setDayLabelMode] = useState(config?.day_label_mode ?? 'weekday');
  const [scheduleStart, setScheduleStart] = useState(config?.schedule_start ?? '');
  const [notes, setNotes] = useState<NoteCard[]>(config?.notes ?? []);
  const [milestones, setMilestones] = useState<Milestone[]>(config?.milestones ?? []);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        project_no: projectNo,
        total_days: totalDays,
        day_label_mode: dayLabelMode,
        schedule_start: scheduleStart || null,
        periods: generateDefaultPeriods(totalDays),
        day_labels: generateDayLabels(dayLabelMode as any, totalDays, scheduleStart),
        notes,
        milestones,
        updated_at: new Date().toISOString(),
      };

      if (config) {
        // Update existing
        await supabase
          .from('project_timeline_config')
          .update(payload)
          .eq('project_no', projectNo);
      } else {
        // Insert new
        await supabase
          .from('project_timeline_config')
          .insert(payload);
      }

      onSave();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg border border-neutral-200">
      <h3 className="text-lg font-bold text-neutral-800">Timeline Configuration</h3>

      {/* Total days */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Total Days
        </label>
        <input
          type="number"
          min={5}
          max={60}
          value={totalDays}
          onChange={(e) => setTotalDays(parseInt(e.target.value, 10))}
          className="w-24 px-3 py-1.5 border border-neutral-300 rounded text-sm"
        />
      </div>

      {/* Day label mode */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Day Labels
        </label>
        <select
          value={dayLabelMode}
          onChange={(e) => setDayLabelMode(e.target.value)}
          className="px-3 py-1.5 border border-neutral-300 rounded text-sm"
        >
          <option value="weekday">Weekday (MON/TUE/WED)</option>
          <option value="numbered">Numbered (Day 1/Day 2)</option>
          <option value="dated">Calendar Dates (Mar 10/Mar 11)</option>
        </select>
      </div>

      {/* Schedule start (for dated mode) */}
      {dayLabelMode === 'dated' && (
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Project Start Date
          </label>
          <input
            type="date"
            value={scheduleStart}
            onChange={(e) => setScheduleStart(e.target.value)}
            className="px-3 py-1.5 border border-neutral-300 rounded text-sm"
          />
        </div>
      )}

      {/* Notes editor (simplified — full version would have add/remove/reorder) */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Note Cards ({notes.length})
        </label>
        <p className="text-xs text-neutral-500 mb-2">
          Note cards appear below the Gantt chart (Delivery Strategy, Payment Milestones, Scope Summary).
        </p>
        <button
          onClick={() => setNotes([...notes, { title: 'New Note', color: '#0B5394', bullet_items: ['Item 1'] }])}
          className="text-sm text-primary-700 hover:underline"
        >
          + Add Note Card
        </button>
      </div>

      {/* Milestones editor */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Milestones ({milestones.length})
        </label>
        <button
          onClick={() => setMilestones([...milestones, { day: 0, label: 'New Milestone', color: '#38761D', type: 'payment' }])}
          className="text-sm text-primary-700 hover:underline"
        >
          + Add Milestone
        </button>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-primary-700 text-white rounded font-medium text-sm hover:bg-primary-800 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Configuration'}
      </button>
    </div>
  );
}

// Import helpers
function generateDefaultPeriods(totalDays: number) {
  const periods = [];
  const weeks = Math.ceil(totalDays / 5);
  for (let w = 0; w < weeks; w++) {
    periods.push({ label: `WEEK ${w + 1}`, span: Math.min(5, totalDays - w * 5) });
  }
  return periods;
}

function generateDayLabels(mode: string, totalDays: number, scheduleStart?: string) {
  const weekdays = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  if (mode === 'numbered') return Array.from({ length: totalDays }, (_, i) => `Day ${i + 1}`);
  return Array.from({ length: totalDays }, (_, i) => weekdays[i % 5]);
}
```

---

## 2.10 Interactive Features

### 2.10.1 Hover Tooltips

```tsx
// src/components/timeline/TaskTooltip.tsx

import { useState, useRef, useEffect } from 'react';
import type { GanttRow } from '@/types/timeline';
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '@/lib/timeline-constants';

interface TaskTooltipProps {
  row: GanttRow;
  anchorEl: HTMLElement | null;
}

export function TaskTooltip({ row, anchorEl }: TaskTooltipProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    setPosition({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  }, [anchorEl]);

  if (!anchorEl) return null;

  return (
    <div
      ref={tooltipRef}
      className="fixed z-50 -translate-x-1/2 -translate-y-full pointer-events-none"
      style={{ top: position.top, left: position.left }}
    >
      <div className="bg-neutral-800 text-white rounded-lg px-3 py-2 shadow-lg text-sm max-w-xs">
        <div className="font-semibold mb-1">{row.name}</div>
        {row.status && (
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: TASK_STATUS_COLORS[row.status] }}
            />
            <span className="text-neutral-300 text-xs">
              {TASK_STATUS_LABELS[row.status]}
            </span>
          </div>
        )}
        {row.bar_start >= 0 && (
          <div className="text-xs text-neutral-400">
            Day {row.bar_start + 1}
            {row.bar_end !== row.bar_start && ` - Day ${row.bar_end + 1}`}
          </div>
        )}
      </div>
      {/* Arrow */}
      <div className="flex justify-center">
        <div className="w-2 h-2 bg-neutral-800 rotate-45 -mt-1" />
      </div>
    </div>
  );
}
```

### 2.10.2 Click-to-Expand Task Details

```tsx
// src/components/timeline/PhaseDetails.tsx

import { useState } from 'react';
import type { ProjectTask } from '@/types/timeline';
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from '@/lib/timeline-constants';
import { cn } from '@/lib/utils';

interface PhaseDetailsProps {
  phaseNo: number;
  phaseName: string;
  tasks: ProjectTask[];
  isOpen: boolean;
  onToggle: () => void;
}

export function PhaseDetails({
  phaseNo,
  phaseName,
  tasks,
  isOpen,
  onToggle,
}: PhaseDetailsProps) {
  return (
    <div className="border border-neutral-200 rounded-lg overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 hover:bg-neutral-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg font-extrabold text-primary-700">
            Phase {phaseNo}
          </span>
          <span className="text-sm font-semibold text-neutral-700">
            {phaseName}
          </span>
        </div>
        <svg
          className={cn(
            'w-5 h-5 text-neutral-400 transition-transform',
            isOpen && 'rotate-180',
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Task list */}
      {isOpen && (
        <div className="divide-y divide-neutral-100">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-neutral-400 w-8">
                  {task.task_no}
                </span>
                <span className="text-sm text-neutral-700">
                  {task.task_name}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {task.assigned_to && (
                  <span className="text-xs text-neutral-500">
                    {task.assigned_to}
                  </span>
                )}
                {task.hours_logged > 0 && (
                  <span className="text-xs text-neutral-400">
                    {task.hours_logged}h
                  </span>
                )}
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                  )}
                  style={{
                    backgroundColor: `${TASK_STATUS_COLORS[task.status]}20`,
                    color: TASK_STATUS_COLORS[task.status],
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: TASK_STATUS_COLORS[task.status] }}
                  />
                  {TASK_STATUS_LABELS[task.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 2.10.3 Embed Code Generation

```tsx
// src/components/timeline/EmbedCodeGenerator.tsx

interface EmbedCodeGeneratorProps {
  projectNo: string;
  portalUrl: string; // "https://projects.asi360.co"
}

export function EmbedCodeGenerator({ projectNo, portalUrl }: EmbedCodeGeneratorProps) {
  const embedUrl = `${portalUrl}/embed/timeline/${projectNo}`;
  const iframeCode = `<iframe
  src="${embedUrl}"
  width="100%"
  height="500"
  frameborder="0"
  style="border: 1px solid #e5e7eb; border-radius: 8px;"
  title="Project Timeline"
></iframe>`;

  function copyToClipboard() {
    navigator.clipboard.writeText(iframeCode);
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-neutral-700">
        Embed Code
      </label>
      <p className="text-xs text-neutral-500">
        Copy this snippet to embed the timeline on a client website.
      </p>
      <div className="relative">
        <pre className="bg-neutral-900 text-green-400 rounded-lg p-3 text-xs overflow-x-auto">
          {iframeCode}
        </pre>
        <button
          onClick={copyToClipboard}
          className="absolute top-2 right-2 px-2 py-1 bg-neutral-700 text-white rounded text-xs hover:bg-neutral-600"
        >
          Copy
        </button>
      </div>
    </div>
  );
}
```

---

## 2.11 Component Tree

```
TimelinePage
├── ProjectHeader
│   ├── project_name, client_name, date, quote_no
│   ├── MetaGrid (4-column: title, client, manager, date)
│   └── RealtimeIndicator (green dot + "Updated Xm ago")
│
├── PhaseProgress
│   ├── ProgressRing (overall %)
│   └── PhaseBar x5
│       ├── PhaseLabel (number + name)
│       ├── ProgressBar (filled %)
│       ├── StatusBadge (On Track / At Risk / Behind / Completed)
│       └── BlockedIndicator (if blocked > 0)
│
├── ResponsiveTimeline
│   ├── [Desktop] GanttChart
│   │   ├── <colgroup> (phase + detail + day cols + end)
│   │   ├── <thead>
│   │   │   ├── PeriodHeaderRow (WEEK 1, WEEK 2, ...)
│   │   │   └── DayHeaderRow (MON, TUE, ... + PHASE + DETAILS + PROJECT END)
│   │   └── <tbody>
│   │       ├── GanttTableRow x (5 phases x (1 header + N tasks))
│   │       │   ├── PhaseNumCell (rowspan, colored)
│   │       │   ├── DetailCell (phase name or "- task name")
│   │       │   ├── DayCell x totalDays (empty or bar)
│   │       │   │   └── GanttBar (colored div with label)
│   │       │   │       └── TodayMarker (red vertical line)
│   │       │   └── EndMarkerCell
│   │       └── MilestoneTableRow x N
│   │           └── MilestoneDiamond
│   │
│   ├── [Tablet] GanttChart (phase-level only, no sub-tasks)
│   │
│   └── [Mobile] MobilePhaseList
│       └── PhaseCard x5
│           ├── PhaseHeader (number + name + %)
│           ├── ProgressBar
│           └── TaskItem x N (name + status dot)
│
├── PhaseDetails (expandable panel, shown on phase click)
│   └── TaskRow x N
│       ├── task_no + task_name
│       ├── assigned_to
│       ├── hours_logged
│       └── StatusBadge
│
├── NoteCards
│   └── NoteCard x N (3-column grid)
│       ├── NoteCardHeader (colored)
│       └── NoteCardBody (bullet list or freeform)
│
├── ExportBar
│   ├── ExportPDFButton
│   ├── ExportPNGButton
│   └── EmbedCodeGenerator
│
└── TaskTooltip (floating, shown on bar hover)
    ├── task name
    ├── status dot + label
    └── day range
```

### Component Props Interface Summary

| Component | Key Props | Data Source |
|---|---|---|
| `TimelinePage` | `projectNo: string` | URL param |
| `ProjectHeader` | `project: Project` | `useGanttData` |
| `PhaseProgress` | `phases: PhaseProgressData[], overallProgress: number` | `useGanttData` |
| `GanttChart` | `data: GanttData, showToday?, animated?, onTaskClick?, onPhaseClick?` | `useGanttData` |
| `GanttTableRow` | `row: GanttRow, totalDays, todayColumn, ...handlers` | Parent |
| `MilestoneTableRow` | `milestone: Milestone, totalDays` | Parent |
| `MobilePhaseList` | `data: GanttData, onTaskClick?` | Parent |
| `PhaseDetails` | `phaseNo, phaseName, tasks: ProjectTask[], isOpen, onToggle` | `useGanttData` |
| `NoteCards` | `notes: NoteCard[]` | `useGanttData` |
| `ExportBar` | `projectNo: string` | URL param |
| `EmbedCodeGenerator` | `projectNo, portalUrl` | Config |
| `TaskTooltip` | `row: GanttRow, anchorEl` | Hover state |
| `RealtimeIndicator` | (internal to header) | `useRealtimeUpdates` |
| `ProgressRing` | `percentage, size, strokeWidth, color` | Parent |
| `TimelineConfigEditor` | `projectNo, config, onSave` | Admin route |

---

## 2.12 Print Styles

The GanttChart component supports a `printMode` prop that switches to compact sizing matching the original `timeline.html` dimensions. Additionally, these global print styles are added:

```css
/* src/styles/print.css — imported in main.css */

@media print {
  /* Force color rendering in print */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }

  /* Hide non-printable UI */
  nav, .export-bar, .realtime-indicator, .phase-details-panel,
  button, [data-no-print] {
    display: none !important;
  }

  /* Landscape US Letter */
  @page {
    size: landscape;
    margin: 0.25in 0.25in 0.3in 0.25in;
  }

  /* Compact font sizes matching timeline.html */
  body { font-size: 8px; }

  /* Prevent page breaks inside components */
  .gantt-wrapper,
  .notes-section,
  .phase-progress { page-break-inside: avoid; }
}
```

---

## 2.13 Animation Specifications

When `animated={true}` (default in web mode):

| Element | Trigger | Animation |
|---|---|---|
| Gantt bars | Initial render | Slide in from left, 300ms ease-out, staggered 50ms per row |
| Progress bars | Value change | Width transition 500ms ease-out |
| Progress ring | Value change | Stroke-dashoffset transition 700ms ease-out |
| Status badges | Status change | Background color fade 200ms |
| Today marker | Appears | Fade in 400ms |
| Phase expand | Click | Height auto with 200ms ease-in-out |
| Tooltip | Hover | Opacity 0→1 in 150ms, translateY 4px→0 |
| Bar hover | Mouse enter | ring-2 + shadow-md, 150ms |

Implementation uses Tailwind's `transition-*` utilities plus `animate-*` for staggered entry:

```css
/* src/styles/gantt-animations.css */

@keyframes gantt-bar-enter {
  from {
    opacity: 0;
    transform: scaleX(0);
    transform-origin: left;
  }
  to {
    opacity: 1;
    transform: scaleX(1);
  }
}

.gantt-bar-animated {
  animation: gantt-bar-enter 300ms ease-out forwards;
}

/* Stagger delay per row */
.gantt-bar-animated:nth-child(1) { animation-delay: 0ms; }
.gantt-bar-animated:nth-child(2) { animation-delay: 50ms; }
.gantt-bar-animated:nth-child(3) { animation-delay: 100ms; }
.gantt-bar-animated:nth-child(4) { animation-delay: 150ms; }
.gantt-bar-animated:nth-child(5) { animation-delay: 200ms; }
/* ... up to 20 tasks */
```

---

## 2.14 Embedded Timeline Route

For the iframe embed feature, a dedicated route renders only the Gantt chart without the full portal chrome:

```tsx
// src/pages/EmbedTimelinePage.tsx

import { useParams } from 'react-router-dom';
import { useGanttData } from '@/hooks/useGanttData';
import { GanttChart } from '@/components/timeline/GanttChart';
import { NoteCards } from '@/components/timeline/NoteCards';

export function EmbedTimelinePage() {
  const { projectNo } = useParams<{ projectNo: string }>();
  const { data, isLoading, error } = useGanttData(projectNo || '');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-screen bg-white text-neutral-500">
        Timeline not available
      </div>
    );
  }

  return (
    <div className="p-4 bg-white min-h-screen">
      {/* Minimal header */}
      <div className="flex justify-between items-center mb-3 pb-2 border-b-2 border-primary-700">
        <div>
          <div className="text-lg font-extrabold text-primary-700">PROJECT TIMELINE</div>
          <div className="text-sm text-neutral-500 italic">{data.project.project_name}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-primary-700">ASI 360</div>
        </div>
      </div>

      {/* Gantt chart (no interactivity in embed) */}
      <GanttChart data={data} showToday animated={false} />

      {/* Notes */}
      <NoteCards notes={data.notes} />

      {/* Footer */}
      <div className="mt-3 pt-2 border-t border-neutral-200 flex justify-between text-xs text-neutral-400">
        <span>Allied Systems Integrations 360 | (510) 288-0994 | ops@asi360.co</span>
        <span>Powered by ASI 360</span>
      </div>
    </div>
  );
}
```

Route registration:

```tsx
// In src/router.tsx
{ path: '/embed/timeline/:projectNo', element: <EmbedTimelinePage /> },
```

---

## 2.15 Testing Plan

### Unit Tests

| Test | File | Description |
|---|---|---|
| `assembleGanttData` | `useGanttData.test.ts` | Verify row count, rowspan calculation, bar positioning with various task counts |
| `calculatePhaseProgress` | `useGanttData.test.ts` | Verify completion %, blocked detection, status assignment |
| `calculateTodayColumn` | `useGanttData.test.ts` | Verify business day calculation, blackout day skipping |
| `generateDayLabels` | `day-labels.test.ts` | Verify all 3 modes produce correct labels |
| `autoBarPosition` | `useGanttData.test.ts` | Verify even distribution across totalDays |
| `sanitizeBullet` | `NoteCards.test.ts` | Verify XSS prevention, `<span class='highlight'>` allowed |

### Integration Tests

| Test | Description |
|---|---|
| Gantt renders 5 phases | Mount `GanttChart` with Goldman demo data, assert 5 phase numbers visible |
| Task status colors | Set task to each status, verify bar color matches `TASK_STATUS_COLORS` |
| Today marker visibility | Set `schedule_start` to today-3, verify red line appears at correct column |
| Milestone row | Add milestone to config, verify diamond renders at correct day |
| Mobile view | Set viewport to 375px, verify `MobilePhaseList` renders instead of table |
| PDF export | Call Edge Function with valid project_no, verify 200 response + PDF content-type |
| Realtime update | Update task status via Supabase, verify Gantt re-renders within 2s |

### E2E Tests (Playwright)

```typescript
test('Timeline renders and exports PDF', async ({ page }) => {
  // Navigate to project timeline
  await page.goto('/project/PROJ-202603-1234');

  // Verify Gantt chart is visible
  await expect(page.locator('table.gantt, [data-gantt-chart]')).toBeVisible();

  // Verify all 5 phases are rendered
  for (let i = 1; i <= 5; i++) {
    await expect(page.getByText(`${i}`, { exact: true }).first()).toBeVisible();
  }

  // Verify phase progress bars
  await expect(page.getByText('Overall')).toBeVisible();

  // Export PDF
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText('Export PDF').click(),
  ]);
  expect(download.suggestedFilename()).toContain('Timeline.pdf');
});
```

---

## 2.16 Performance Considerations

| Concern | Mitigation |
|---|---|
| Large task count (50+ tasks) | Virtual scrolling not needed — max 25 rows (5 phases x 5 tasks). Table renders in < 16ms. |
| Realtime subscription memory | Single channel per project. Cleanup on unmount via `supabase.removeChannel()`. |
| PDF generation latency | Playwright cold start ~3s on droplet. Subsequent renders ~1s. Consider keeping browser instance warm. |
| Timeline config fetch | Cached via React Query with 5-minute stale time. Config changes are rare. |
| Print rendering | `printMode` prop disables animations and hover states, reducing paint complexity. |
| Multiple day columns (30+) | Table-fixed layout ensures consistent column widths. Horizontal scroll on narrow viewports. |

---

## 2.17 Future Enhancements

1. **Drag-to-reschedule** — Allow project managers to drag task bars to new day positions, persisting to `project_timeline_config.task_bars`.
2. **Resource allocation view** — Show which technician is assigned to which tasks across multiple concurrent projects.
3. **Gantt dependencies** — Draw arrows between dependent tasks (finish-to-start, start-to-start).
4. **Baseline comparison** — Overlay original schedule vs. current schedule to visualize slippage.
5. **Auto-schedule from VTiger** — When a project is created via Gateway, auto-generate timeline_config based on project type and estimated duration.
6. **Email timeline digest** — Weekly email with Gantt PNG snapshot sent to project stakeholders.
