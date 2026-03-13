# MODULE 3: Data Sync Architecture

## 360 Client Portal — PRD Module 3 of 5

**Version:** 1.0.0
**Date:** 2026-03-10
**Status:** Draft
**Owner:** ASI 360 Engineering
**Dependencies:** Module 2 (Timeline), Module 4 (Frontend), Module 5 (Infrastructure)

---

## Table of Contents

1. [Three-Tier Data Model](#1-three-tier-data-model)
2. [Sync Topology](#2-sync-topology)
3. [Edge Function API](#3-edge-function-api)
4. [Database Triggers](#4-database-triggers)
5. [Airtable Integration](#5-airtable-integration)
6. [VTiger Sync](#6-vtiger-sync)
7. [Migration SQL](#7-migration-sql)
8. [Monitoring](#8-monitoring)

---

## 1. Three-Tier Data Model

### 1.1 System Roles

| System | Role | Access Pattern | SLA |
|--------|------|----------------|-----|
| **Supabase** (gtfffxwfgcxiiauliynd) | Source of Truth | Real-time reads/writes | 99.9% uptime |
| **Airtable** (appP6u9YkqSb3XrFh) | Operational Hub | Team-facing CRUD | Best-effort sync |
| **VTiger CRM** (104.248.69.86:3004) | Archival / Billing | Write-only downstream | Eventual consistency |

### 1.2 Field Ownership Matrix — Projects

| Field | Supabase (Owner) | Airtable (Mirror) | VTiger (Archive) | Conflict Winner |
|-------|-------------------|--------------------|-------------------|-----------------|
| `project_no` | PK, immutable | Formula (linked) | `project_no` | Supabase |
| `project_name` | `project_name` | `Project Name` | `projectname` | Supabase |
| `client_name` | `client_name` | `Client Name` | `linktoaccountscontacts` | Supabase |
| `contact_name` | `contact_name` | `Contact Name` | Linked Contact | Supabase |
| `contact_phone` | `contact_phone` | `Phone` | Contact.phone | Supabase |
| `contact_email` | `contact_email` | `Email` | Contact.email | Supabase |
| `site_address` | `site_address` | `Site Address` | `cf_site_address` | Supabase |
| `status` | `status` | `Status` (select) | `projectstatus` | **Supabase** |
| `current_phase` | `current_phase` (1-5) | `Current Phase` (select) | `cf_project_phasestatus` | **Supabase** |
| `progress_pct` | `progress_pct` (numeric) | `Progress` (percent) | `cf_project_progress` | **Supabase** |
| `business_type` | `business_type` | `Business Type` | `cf_business_type` | Supabase |
| `contract_value` | `contract_value` | `Contract Value` (currency) | `cf_contract_value` | Supabase |
| `quote_no` | `quote_no` | `Quote No` | Linked Quote | Supabase |
| `team_lead` | -- | `Team Lead` (collab) | -- | **Airtable** |
| `daily_notes` | -- | `Daily Notes` (long text) | -- | **Airtable** |
| `client_comms_log` | -- | `Client Comms` (long text) | -- | **Airtable** |
| `next_action` | -- | `Next Action` (text) | -- | **Airtable** |
| `invoice_total` | -- | -- | `invoice_total` | **VTiger** |
| `payment_status` | -- | -- | `cf_payment_status` | **VTiger** |

### 1.3 Field Ownership Matrix — Tasks

| Field | Supabase (Owner) | Airtable (Mirror) | VTiger (Archive) | Conflict Winner |
|-------|-------------------|--------------------|-------------------|-----------------|
| `task_no` | `task_no` ("1.1") | `Task No` | `projecttaskname` prefix | Supabase |
| `task_name` | `task_name` | `Task Name` | `projecttaskname` | Supabase |
| `phase_no` | `phase_no` (1-5) | `Phase` (select) | milestone link | Supabase |
| `status` | `status` | `Status` (select) | `projecttaskstatus` | **Supabase** |
| `assigned_to` | `assigned_to` | `Assigned To` (collab) | `assigned_user_id` | **Airtable** |
| `hours` | `hours` (numeric) | `Hours` (number) | `projecttaskhours` | Supabase |
| `notes` | `notes` | `Notes` (long text) | -- | **Airtable** |
| `priority` | `priority` | `Priority` (select) | `projecttaskpriority` | Supabase |
| `due_date` | -- | `Due Date` (date) | `enddate` | **Airtable** |
| `blockers` | -- | `Blockers` (long text) | -- | **Airtable** |

### 1.4 Conflict Resolution Rules

```
RULE 1: Status/Phase conflicts → Supabase ALWAYS wins
  - If Airtable says "completed" but Supabase says "in_progress" → keep "in_progress"
  - Rationale: Supabase has trigger-validated state transitions

RULE 2: Assignment/Notes conflicts → Airtable ALWAYS wins
  - If Supabase has old assigned_to but Airtable was updated → take Airtable value
  - Rationale: Ops team lives in Airtable for daily assignments

RULE 3: VTiger is NEVER authoritative
  - VTiger receives writes but never overwrites Supabase or Airtable
  - Exception: invoice_total and payment_status originate in VTiger

RULE 4: Timestamps break ties
  - If ownership is ambiguous, most recent updated_at wins
  - sync_audit_log records every write for forensic resolution

RULE 5: Supabase is recovery source
  - If Airtable data lost → rebuild from Supabase
  - If VTiger data lost → rebuild from Supabase
  - Supabase has daily backups via Supabase platform
```

---

## 2. Sync Topology

### 2.1 Data Flow Diagram

```
                         +-----------------------+
                         |    CLIENT PORTAL      |
                         |   (Next.js Frontend)  |
                         +----------+------------+
                                    |
                            Supabase Realtime
                            (postgres_changes)
                                    |
                                    v
+------------------+     +-------------------+     +------------------+
|                  |     |                   |     |                  |
|    AIRTABLE      |<--->|    SUPABASE       |---->|    VTIGER CRM    |
|  (Operational)   |     | (Source of Truth) |     |   (Archival)     |
|                  |     |                   |     |                  |
| - Team views     |     | - asi360_projects |     | - Billing        |
| - Daily notes    |     | - asi360_project_ |     | - Invoices       |
| - Assignments    |     |   tasks           |     | - Quote links    |
| - Client comms   |     | - project_        |     | - Contact mgmt   |
|                  |     |   timeline_config |     |                  |
+--------+---------+     | - sync_audit_log  |     +--------+---------+
         |               +--------+----------+              ^
         |                        |                         |
         |     Airtable           |  Supabase               |  Gateway API
         |     Automation         |  postgres_changes        |  (write-only)
         |                        |                         |
         v                        v                         |
+--------+---------+     +--------+----------+     +--------+---------+
|                  |     |                   |     |                  |
|    N8N WORKFLOW  |<----|  EDGE FUNCTION    |---->|  ASI360 GATEWAY  |
|  (Orchestrator)  |     |  (project-status) |     | 104.248.69.86    |
|                  |     |                   |     |   :3004          |
| - Webhook recv   |     | - JWT verify      |     |                  |
| - Transform      |     | - CORS            |     | - update_project |
| - Route          |     | - Status API      |     |   _task          |
| - Error retry    |     | - Timeline API    |     | - advance_phase  |
|                  |     |                   |     | - vtiger_*       |
+------------------+     +-------------------+     +------------------+
```

### 2.2 Sync Flow: Status Change (Primary Path)

```
1. Ops team updates task status in Airtable
   │
2. Airtable Automation fires on "Status" field change
   │
3. Airtable sends webhook to N8N
   │  POST https://asi360live.app.n8n.cloud/webhook/airtable-task-update
   │  Body: { record_id, fields: { Status, Task No, ... } }
   │
4. N8N Workflow: "Airtable → Supabase Task Sync"
   │  a. Map Airtable fields → Supabase columns
   │  b. Call Gateway: update_project_task(project_no, task_no, status)
   │     └─ Gateway writes to Supabase + Airtable + VTiger
   │  c. Log result to sync_audit_log
   │
5. Supabase trigger fires: trg_task_status_change
   │  a. Inserts sync_audit_log entry
   │  b. Checks if all phase tasks completed
   │  c. If yes → auto-advances current_phase + updates progress_pct
   │  d. pg_notify('project_updates', payload)
   │
6. Supabase Realtime broadcasts to subscribed clients
   │  Channel: project:{project_no}
   │
7. Client Portal receives real-time update
   └─ Timeline component re-renders with new phase/progress
```

### 2.3 Sync Flow: Gateway-Originated (Secondary Path)

```
1. Gateway API call (e.g., from Claude Code or admin action)
   │  mcp__gateway-mcp__update_project_task
   │
2. Gateway writes to all 3 systems simultaneously:
   │  a. Supabase: UPDATE asi360_project_tasks SET status = ...
   │  b. Airtable: PATCH /v0/{base}/{table}/{record}
   │  c. VTiger: PUT /webservice/revise (Project Task)
   │
3. Supabase triggers fire (same as step 5 above)
   │
4. Real-time broadcast to portal clients
```

### 2.4 Sync Timing

| Event Type | Sync Mode | Latency Target | Mechanism |
|-----------|-----------|----------------|-----------|
| Task status change | Event-driven | < 3 seconds | Webhook → N8N → Gateway |
| Phase advancement | Event-driven | < 5 seconds | DB trigger → pg_notify |
| Assignment change | Event-driven | < 10 seconds | Airtable automation → N8N |
| Bulk task import | Batch (5-min) | < 5 minutes | N8N scheduled workflow |
| Timeline config update | Event-driven | < 3 seconds | Direct Supabase write |
| VTiger archive sync | Batch (15-min) | < 15 minutes | N8N scheduled workflow |
| Full reconciliation | Scheduled | Daily 2:00 AM PT | N8N cron workflow |

### 2.5 Consistency Model

**Eventual consistency** with the following guarantees:

- Supabase is always consistent with itself (ACID transactions)
- Airtable reflects Supabase state within 10 seconds for event-driven changes
- VTiger reflects Supabase state within 15 minutes
- If sync fails, sync_audit_log records the failure with full payload for retry
- Daily reconciliation job detects and repairs drift between all 3 systems
- Client portal reads ONLY from Supabase (never Airtable or VTiger)

---

## 3. Edge Function API

### 3.1 Function: `project-status`

**Deployment:** Supabase Edge Function
**Runtime:** Deno
**Auth:** JWT verification (Supabase anon key for public, service key for admin)
**Base URL:** `https://gtfffxwfgcxiiauliynd.supabase.co/functions/v1/project-status`

### 3.2 Full TypeScript Implementation

```typescript
// supabase/functions/project-status/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ─── Types ───────────────────────────────────────────────────────

interface ProjectTask {
  id: string;
  task_no: string;
  task_name: string;
  phase_no: number;
  status: string;
  assigned_to: string | null;
  hours: number | null;
  notes: string | null;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface Phase {
  phase_no: number;
  phase_name: string;
  tasks: ProjectTask[];
  total_tasks: number;
  completed_tasks: number;
  progress_pct: number;
}

interface ProjectFull {
  id: string;
  project_no: string;
  project_name: string;
  client_name: string;
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  site_address: string | null;
  status: string;
  current_phase: number;
  progress_pct: number;
  business_type: string | null;
  contract_value: number | null;
  quote_no: string | null;
  phases: Phase[];
  created_at: string;
  updated_at: string;
}

interface ProjectSummary {
  project_no: string;
  project_name: string;
  client_name: string;
  status: string;
  current_phase: number;
  progress_pct: number;
  phases: { name: string; phase_no: number; progress_pct: number }[];
}

interface TimelineConfig {
  id: string;
  project_id: string;
  periods: object;
  day_labels: object;
  phases: object;
  milestones: object;
  notes: object;
  created_at: string;
  updated_at: string;
}

interface UpdateRequest {
  client_name: string;
  contact_phone: string;
  message: string;
}

// ─── Constants ───────────────────────────────────────────────────

const PHASE_NAMES: Record<number, string> = {
  1: "Initiation",
  2: "Design",
  3: "Procurement",
  4: "Installation",
  5: "Closeout",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, X-Client-Token, apikey",
  "Access-Control-Max-Age": "86400",
};

// ─── Helpers ─────────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message, status }, status);
}

function parseRoute(
  url: URL
): { projectNo: string; action: string | null } | null {
  // Expected paths:
  //   /project-status/PROJ-202603-5336
  //   /project-status/PROJ-202603-5336/summary
  //   /project-status/PROJ-202603-5336/timeline-config
  //   /project-status/PROJ-202603-5336/request-update
  const pathname = url.pathname;
  const segments = pathname.split("/").filter(Boolean);

  // segments: ["project-status", "PROJ-202603-5336", ?action]
  if (segments.length < 2) return null;

  const projectNo = segments[1];
  if (!projectNo.startsWith("PROJ-")) return null;

  const action = segments[2] || null;
  return { projectNo, action };
}

// ─── Route Handlers ──────────────────────────────────────────────

async function handleGetFull(
  supabase: ReturnType<typeof createClient>,
  projectNo: string
): Promise<Response> {
  // Fetch project
  const { data: project, error: projErr } = await supabase
    .from("asi360_projects")
    .select("*")
    .eq("project_no", projectNo)
    .single();

  if (projErr || !project) {
    return errorResponse(
      `Project ${projectNo} not found`,
      404
    );
  }

  // Fetch all tasks for this project
  const { data: tasks, error: taskErr } = await supabase
    .from("asi360_project_tasks")
    .select("*")
    .eq("project_id", project.id)
    .order("task_no", { ascending: true });

  if (taskErr) {
    return errorResponse("Failed to fetch tasks", 500);
  }

  // Group tasks into phases
  const phases: Phase[] = [];
  for (let phaseNo = 1; phaseNo <= 5; phaseNo++) {
    const phaseTasks = (tasks || []).filter(
      (t: ProjectTask) => t.phase_no === phaseNo
    );
    const completedCount = phaseTasks.filter(
      (t: ProjectTask) => t.status === "completed"
    ).length;
    const totalCount = phaseTasks.length;

    phases.push({
      phase_no: phaseNo,
      phase_name: PHASE_NAMES[phaseNo],
      tasks: phaseTasks,
      total_tasks: totalCount,
      completed_tasks: completedCount,
      progress_pct:
        totalCount > 0
          ? Math.round((completedCount / totalCount) * 100)
          : 0,
    });
  }

  const result: ProjectFull = {
    id: project.id,
    project_no: project.project_no,
    project_name: project.project_name,
    client_name: project.client_name,
    contact_name: project.contact_name,
    contact_phone: project.contact_phone,
    contact_email: project.contact_email,
    site_address: project.site_address,
    status: project.status,
    current_phase: project.current_phase,
    progress_pct: project.progress_pct,
    business_type: project.business_type,
    contract_value: project.contract_value,
    quote_no: project.quote_no,
    phases,
    created_at: project.created_at,
    updated_at: project.updated_at,
  };

  return jsonResponse(result);
}

async function handleGetSummary(
  supabase: ReturnType<typeof createClient>,
  projectNo: string
): Promise<Response> {
  const { data: project, error: projErr } = await supabase
    .from("asi360_projects")
    .select(
      "project_no, project_name, client_name, status, current_phase, progress_pct, id"
    )
    .eq("project_no", projectNo)
    .single();

  if (projErr || !project) {
    return errorResponse(`Project ${projectNo} not found`, 404);
  }

  // Get task counts per phase
  const { data: tasks, error: taskErr } = await supabase
    .from("asi360_project_tasks")
    .select("phase_no, status")
    .eq("project_id", project.id);

  if (taskErr) {
    return errorResponse("Failed to fetch tasks", 500);
  }

  const phases = [];
  for (let phaseNo = 1; phaseNo <= 5; phaseNo++) {
    const phaseTasks = (tasks || []).filter(
      (t: { phase_no: number }) => t.phase_no === phaseNo
    );
    const completed = phaseTasks.filter(
      (t: { status: string }) => t.status === "completed"
    ).length;
    const total = phaseTasks.length;

    phases.push({
      phase_no: phaseNo,
      name: PHASE_NAMES[phaseNo],
      progress_pct:
        total > 0 ? Math.round((completed / total) * 100) : 0,
    });
  }

  const summary: ProjectSummary = {
    project_no: project.project_no,
    project_name: project.project_name,
    client_name: project.client_name,
    status: project.status,
    current_phase: project.current_phase,
    progress_pct: project.progress_pct,
    phases,
  };

  return jsonResponse(summary);
}

async function handleGetTimelineConfig(
  supabase: ReturnType<typeof createClient>,
  projectNo: string
): Promise<Response> {
  // Get project ID first
  const { data: project, error: projErr } = await supabase
    .from("asi360_projects")
    .select("id")
    .eq("project_no", projectNo)
    .single();

  if (projErr || !project) {
    return errorResponse(`Project ${projectNo} not found`, 404);
  }

  const { data: config, error: configErr } = await supabase
    .from("project_timeline_config")
    .select("*")
    .eq("project_id", project.id)
    .single();

  if (configErr || !config) {
    return errorResponse(
      `No timeline config found for ${projectNo}`,
      404
    );
  }

  return jsonResponse(config);
}

async function handleRequestUpdate(
  supabase: ReturnType<typeof createClient>,
  projectNo: string,
  body: UpdateRequest
): Promise<Response> {
  // Validate body
  if (!body.client_name || !body.contact_phone) {
    return errorResponse(
      "client_name and contact_phone are required",
      400
    );
  }

  // Verify project exists
  const { data: project, error: projErr } = await supabase
    .from("asi360_projects")
    .select("id, project_name, client_name")
    .eq("project_no", projectNo)
    .single();

  if (projErr || !project) {
    return errorResponse(`Project ${projectNo} not found`, 404);
  }

  // Insert into notification queue
  const { error: insertErr } = await supabase
    .from("notification_queue")
    .insert({
      project_id: project.id,
      project_no: projectNo,
      type: "callback_request",
      recipient_name: body.client_name,
      recipient_phone: body.contact_phone,
      message: body.message || "Client requested a project update callback",
      status: "pending",
      metadata: {
        project_name: project.project_name,
        requested_at: new Date().toISOString(),
      },
    });

  if (insertErr) {
    console.error("Failed to queue notification:", insertErr);
    return errorResponse("Failed to submit request", 500);
  }

  return jsonResponse(
    {
      success: true,
      message:
        "Update request received. Our team will contact you within 1 business day.",
    },
    201
  );
}

// ─── Main Handler ────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Parse URL
  const url = new URL(req.url);
  const route = parseRoute(url);

  if (!route) {
    return errorResponse(
      "Invalid route. Use /project-status/{PROJECT_NO}[/summary|timeline-config|request-update]",
      400
    );
  }

  const { projectNo, action } = route;

  // Initialize Supabase client
  // For public routes (GET summary, GET timeline-config), use anon key
  // For admin routes, verify service role
  const authHeader = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Client token auth for portal access
  const clientToken = req.headers.get("X-Client-Token");

  // Determine auth level
  let supabaseKey: string;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    // If it matches service key pattern, use elevated access
    if (token === supabaseServiceKey) {
      supabaseKey = supabaseServiceKey;
    } else {
      // JWT from anon client
      supabaseKey = supabaseAnonKey;
    }
  } else if (clientToken) {
    // Validate client token against project_access_tokens table
    const tempClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: tokenRecord } = await tempClient
      .from("project_access_tokens")
      .select("project_no, expires_at, revoked")
      .eq("token", clientToken)
      .eq("project_no", projectNo)
      .single();

    if (
      !tokenRecord ||
      tokenRecord.revoked ||
      new Date(tokenRecord.expires_at) < new Date()
    ) {
      return errorResponse("Invalid or expired client token", 401);
    }

    supabaseKey = supabaseServiceKey; // Token validated, use service key
  } else {
    // Public endpoints only: summary
    supabaseKey = supabaseAnonKey;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Route
  try {
    if (req.method === "GET") {
      switch (action) {
        case null:
          return await handleGetFull(supabase, projectNo);
        case "summary":
          return await handleGetSummary(supabase, projectNo);
        case "timeline-config":
          return await handleGetTimelineConfig(supabase, projectNo);
        default:
          return errorResponse(`Unknown action: ${action}`, 404);
      }
    }

    if (req.method === "POST") {
      if (action === "request-update") {
        const body = await req.json();
        return await handleRequestUpdate(supabase, projectNo, body);
      }
      return errorResponse("POST only supported for /request-update", 405);
    }

    return errorResponse(`Method ${req.method} not allowed`, 405);
  } catch (err) {
    console.error("Unhandled error:", err);
    return errorResponse("Internal server error", 500);
  }
});
```

### 3.3 API Endpoints Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/project-status/{PROJECT_NO}` | Client Token or JWT | Full project with all phases and tasks |
| `GET` | `/project-status/{PROJECT_NO}/summary` | Client Token or Public | Lightweight status summary |
| `GET` | `/project-status/{PROJECT_NO}/timeline-config` | Client Token or JWT | Timeline visualization config |
| `POST` | `/project-status/{PROJECT_NO}/request-update` | Client Token | Client requests callback |

### 3.4 Response Examples

**GET /project-status/PROJ-202603-5336/summary**

```json
{
  "project_no": "PROJ-202603-5336",
  "project_name": "Goldman Law Firm - Access Control Upgrade",
  "client_name": "Goldman Law Firm",
  "status": "in progress",
  "current_phase": 2,
  "progress_pct": 35,
  "phases": [
    { "phase_no": 1, "name": "Initiation", "progress_pct": 100 },
    { "phase_no": 2, "name": "Design", "progress_pct": 50 },
    { "phase_no": 3, "name": "Procurement", "progress_pct": 0 },
    { "phase_no": 4, "name": "Installation", "progress_pct": 0 },
    { "phase_no": 5, "name": "Closeout", "progress_pct": 0 }
  ]
}
```

**POST /project-status/PROJ-202603-5336/request-update**

Request:
```json
{
  "client_name": "Sarah Goldman",
  "contact_phone": "+15105551234",
  "message": "Would like an update on the camera placement design"
}
```

Response (201):
```json
{
  "success": true,
  "message": "Update request received. Our team will contact you within 1 business day."
}
```

---

## 4. Database Triggers

### 4.1 Sync Audit Log Trigger

```sql
-- Trigger function: log every task status change to sync_audit_log
CREATE OR REPLACE FUNCTION trg_fn_task_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire on actual status changes
  IF OLD.status IS DISTINCT FROM NEW.status
     OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to
     OR OLD.hours IS DISTINCT FROM NEW.hours
  THEN
    INSERT INTO sync_audit_log (
      source_system,
      target_system,
      record_type,
      record_id,
      action,
      payload,
      success,
      created_at
    ) VALUES (
      'supabase',
      'all',
      'project_task',
      NEW.id::text,
      'update',
      jsonb_build_object(
        'task_no', NEW.task_no,
        'project_id', NEW.project_id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'old_assigned_to', OLD.assigned_to,
        'new_assigned_to', NEW.assigned_to,
        'old_hours', OLD.hours,
        'new_hours', NEW.hours,
        'changed_fields', (
          SELECT jsonb_object_agg(key, value)
          FROM jsonb_each(to_jsonb(NEW))
          WHERE to_jsonb(NEW) -> key IS DISTINCT FROM to_jsonb(OLD) -> key
        )
      ),
      true,
      now()
    );
  END IF;

  -- Update the task's updated_at
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_task_status_change ON asi360_project_tasks;
CREATE TRIGGER trg_task_status_change
  BEFORE UPDATE ON asi360_project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_task_audit_log();
```

### 4.2 Auto Phase Advancement Trigger

```sql
-- Trigger function: auto-advance project phase when all phase tasks complete
CREATE OR REPLACE FUNCTION trg_fn_auto_advance_phase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_id uuid;
  v_phase_no int;
  v_total_tasks int;
  v_completed_tasks int;
  v_overall_total int;
  v_overall_completed int;
  v_new_progress numeric;
  v_current_phase int;
BEGIN
  -- Only process when status changes to 'completed'
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  v_project_id := NEW.project_id;
  v_phase_no := NEW.phase_no;

  -- Count tasks in this phase
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed')
  INTO v_total_tasks, v_completed_tasks
  FROM asi360_project_tasks
  WHERE project_id = v_project_id
    AND phase_no = v_phase_no;

  -- Get current project phase
  SELECT current_phase INTO v_current_phase
  FROM asi360_projects
  WHERE id = v_project_id;

  -- Calculate overall progress
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed')
  INTO v_overall_total, v_overall_completed
  FROM asi360_project_tasks
  WHERE project_id = v_project_id;

  IF v_overall_total > 0 THEN
    v_new_progress := ROUND((v_overall_completed::numeric / v_overall_total::numeric) * 100, 1);
  ELSE
    v_new_progress := 0;
  END IF;

  -- If ALL tasks in the current phase are completed, advance phase
  IF v_completed_tasks = v_total_tasks
     AND v_total_tasks > 0
     AND v_phase_no = v_current_phase
     AND v_current_phase < 5
  THEN
    UPDATE asi360_projects
    SET
      current_phase = v_current_phase + 1,
      progress_pct = v_new_progress,
      status = CASE
        WHEN v_current_phase + 1 = 5 AND v_new_progress = 100 THEN 'completed'
        ELSE status
      END,
      updated_at = now()
    WHERE id = v_project_id;

    -- Log the phase advancement
    INSERT INTO sync_audit_log (
      source_system, target_system, record_type, record_id,
      action, payload, success, created_at
    ) VALUES (
      'supabase', 'all', 'project', v_project_id::text,
      'phase_advance',
      jsonb_build_object(
        'old_phase', v_current_phase,
        'new_phase', v_current_phase + 1,
        'progress_pct', v_new_progress,
        'trigger', 'auto_advance',
        'completing_task', NEW.task_no
      ),
      true, now()
    );
  ELSE
    -- Just update progress even if phase doesn't advance
    UPDATE asi360_projects
    SET
      progress_pct = v_new_progress,
      updated_at = now()
    WHERE id = v_project_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger (fires AFTER so the task row is already updated)
DROP TRIGGER IF EXISTS trg_auto_advance_phase ON asi360_project_tasks;
CREATE TRIGGER trg_auto_advance_phase
  AFTER UPDATE ON asi360_project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_auto_advance_phase();
```

### 4.3 Real-Time Notification via pg_notify

```sql
-- Trigger function: broadcast project changes to pg_notify channel
CREATE OR REPLACE FUNCTION trg_fn_notify_project_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_no text;
  v_payload jsonb;
BEGIN
  -- Get the project_no
  SELECT project_no INTO v_project_no
  FROM asi360_projects
  WHERE id = NEW.id OR id = NEW.project_id;

  -- Build notification payload
  v_payload := jsonb_build_object(
    'event', TG_ARGV[0],  -- 'task_updated' or 'project_updated'
    'project_no', v_project_no,
    'table', TG_TABLE_NAME,
    'record_id', NEW.id,
    'timestamp', extract(epoch from now())
  );

  -- Add relevant fields based on table
  IF TG_TABLE_NAME = 'asi360_project_tasks' THEN
    v_payload := v_payload || jsonb_build_object(
      'task_no', NEW.task_no,
      'status', NEW.status,
      'phase_no', NEW.phase_no
    );
  ELSIF TG_TABLE_NAME = 'asi360_projects' THEN
    v_payload := v_payload || jsonb_build_object(
      'status', NEW.status,
      'current_phase', NEW.current_phase,
      'progress_pct', NEW.progress_pct
    );
  END IF;

  -- Broadcast
  PERFORM pg_notify('project_updates', v_payload::text);

  RETURN NEW;
END;
$$;

-- Trigger on project tasks
DROP TRIGGER IF EXISTS trg_notify_task_update ON asi360_project_tasks;
CREATE TRIGGER trg_notify_task_update
  AFTER UPDATE ON asi360_project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_notify_project_update('task_updated');

-- Trigger on projects
DROP TRIGGER IF EXISTS trg_notify_project_update ON asi360_projects;
CREATE TRIGGER trg_notify_project_update
  AFTER UPDATE ON asi360_projects
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_notify_project_update('project_updated');
```

### 4.4 Supabase Realtime Channel Subscription (Client-Side)

```typescript
// lib/realtime.ts — Client portal real-time subscription

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface RealtimeProjectEvent {
  eventType: "UPDATE" | "INSERT";
  table: string;
  record: Record<string, unknown>;
  old_record?: Record<string, unknown>;
}

/**
 * Subscribe to real-time updates for a specific project.
 * Returns an unsubscribe function.
 */
export function subscribeToProject(
  projectId: string,
  onTaskUpdate: (payload: RealtimeProjectEvent) => void,
  onProjectUpdate: (payload: RealtimeProjectEvent) => void
): () => void {
  const channel = supabase
    .channel(`project:${projectId}`)
    // Listen for task changes
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "asi360_project_tasks",
        filter: `project_id=eq.${projectId}`,
      },
      (payload) => {
        onTaskUpdate({
          eventType: "UPDATE",
          table: "asi360_project_tasks",
          record: payload.new as Record<string, unknown>,
          old_record: payload.old as Record<string, unknown>,
        });
      }
    )
    // Listen for project-level changes (phase advance, progress update)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "asi360_projects",
        filter: `id=eq.${projectId}`,
      },
      (payload) => {
        onProjectUpdate({
          eventType: "UPDATE",
          table: "asi360_projects",
          record: payload.new as Record<string, unknown>,
          old_record: payload.old as Record<string, unknown>,
        });
      }
    )
    .subscribe((status) => {
      console.log(`Realtime subscription status: ${status}`);
    });

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to all project updates (admin dashboard).
 */
export function subscribeToAllProjects(
  onUpdate: (payload: RealtimeProjectEvent) => void
): () => void {
  const channel = supabase
    .channel("all-projects")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "asi360_projects",
      },
      (payload) => {
        onUpdate({
          eventType: "UPDATE",
          table: "asi360_projects",
          record: payload.new as Record<string, unknown>,
          old_record: payload.old as Record<string, unknown>,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
```

---

## 5. Airtable Integration

### 5.1 Airtable Base Structure

**Base:** `appP6u9YkqSb3XrFh` (ASI 360 Projects)

| Table | Table ID | Purpose |
|-------|----------|---------|
| Projects | `tblOAv6lKlVWwbhAo` | Project records, linked to Supabase |
| Tasks | `tblyEKnsDVa90gwPv` | Task records, linked to Projects |
| Templates | (auto) | 5 templates by business type |
| Template Tasks | (auto) | 20 standard tasks per template |

### 5.2 Field Mapping: Airtable <-> Supabase

**Projects Table**

| Airtable Field | Airtable Type | Supabase Column | Sync Direction |
|----------------|---------------|-----------------|----------------|
| `Project No` | Single line text | `project_no` | Supabase -> Airtable |
| `Project Name` | Single line text | `project_name` | Supabase -> Airtable |
| `Client Name` | Single line text | `client_name` | Supabase -> Airtable |
| `Contact Name` | Single line text | `contact_name` | Supabase -> Airtable |
| `Phone` | Phone number | `contact_phone` | Supabase -> Airtable |
| `Email` | Email | `contact_email` | Supabase -> Airtable |
| `Site Address` | Single line text | `site_address` | Supabase -> Airtable |
| `Status` | Single select | `status` | Bidirectional (SB wins) |
| `Current Phase` | Single select | `current_phase` | Supabase -> Airtable |
| `Progress` | Percent | `progress_pct` | Supabase -> Airtable |
| `Business Type` | Single select | `business_type` | Supabase -> Airtable |
| `Contract Value` | Currency | `contract_value` | Supabase -> Airtable |
| `Quote No` | Single line text | `quote_no` | Supabase -> Airtable |
| `Team Lead` | Collaborator | -- | Airtable only |
| `Daily Notes` | Long text | -- | Airtable only |
| `Client Comms` | Long text | -- | Airtable only |
| `Next Action` | Single line text | -- | Airtable only |
| `Supabase ID` | Single line text | `id` | Supabase -> Airtable (key) |
| `VTiger ID` | Single line text | `vtiger_project_id` | Supabase -> Airtable |
| `Airtable Record ID` | Formula (RECORD_ID()) | `airtable_record_id` | Airtable -> Supabase |

**Tasks Table**

| Airtable Field | Airtable Type | Supabase Column | Sync Direction |
|----------------|---------------|-----------------|----------------|
| `Task No` | Single line text | `task_no` | Supabase -> Airtable |
| `Task Name` | Single line text | `task_name` | Supabase -> Airtable |
| `Project` | Link to Projects | `project_id` | Supabase -> Airtable |
| `Phase` | Single select (1-5) | `phase_no` | Supabase -> Airtable |
| `Status` | Single select | `status` | Bidirectional (SB wins) |
| `Assigned To` | Collaborator | `assigned_to` | Airtable -> Supabase |
| `Hours` | Number | `hours` | Bidirectional (SB wins) |
| `Notes` | Long text | `notes` | Airtable -> Supabase |
| `Priority` | Single select | `priority` | Supabase -> Airtable |
| `Due Date` | Date | -- | Airtable only |
| `Blockers` | Long text | -- | Airtable only |
| `Supabase ID` | Single line text | `id` | Supabase -> Airtable (key) |
| `VTiger Task ID` | Single line text | `vtiger_task_id` | Supabase -> Airtable |
| `Airtable Task ID` | Formula (RECORD_ID()) | `airtable_task_id` | Airtable -> Supabase |

### 5.3 Airtable Formula Fields

```
// Phase Progress (on Projects table)
// Rollup field: counts completed tasks / total tasks in linked Tasks
Phase 1 Progress =
  ROUND(
    COUNTALL(
      IF({Phase} = "1", IF({Status} = "completed", 1, 0))
    ) /
    MAX(
      COUNTALL(IF({Phase} = "1", 1, 0)),
      1
    ) * 100,
    0
  ) & "%"

// Overall Progress (formula, cross-check with Supabase)
Calc Progress =
  ROUND(
    COUNTALL(IF({Status} = "completed", 1, 0)) /
    MAX(COUNTALL(IF({Status} != "", 1, 0)), 1) * 100,
    0
  )

// Days Since Last Update
Days Stale =
  DATETIME_DIFF(NOW(), LAST_MODIFIED_TIME({Status}), 'days')

// Phase Name Lookup
Phase Name =
  SWITCH(
    {Phase},
    "1", "Initiation",
    "2", "Design",
    "3", "Procurement",
    "4", "Installation",
    "5", "Closeout",
    "Unknown"
  )
```

### 5.4 Airtable Automation: Task Status Update -> N8N

**Automation Name:** `Sync Task Status to Supabase`
**Trigger:** When record matches conditions — Tasks table, `Status` field is updated
**Action:** Send webhook

```
Trigger Configuration:
  Table: Tasks (tblyEKnsDVa90gwPv)
  Condition: When {Status} changes
  Watch fields: Status, Assigned To, Hours, Notes

Action: Send POST request
  URL: https://asi360live.app.n8n.cloud/webhook/airtable-task-update
  Headers:
    Content-Type: application/json
    X-Webhook-Secret: {{airtable_webhook_secret}}
  Body:
    {
      "source": "airtable",
      "event": "task_updated",
      "record_id": "{{record.id}}",
      "fields": {
        "task_no": "{{record.Task No}}",
        "status": "{{record.Status}}",
        "assigned_to": "{{record.Assigned To.name}}",
        "hours": "{{record.Hours}}",
        "notes": "{{record.Notes}}",
        "supabase_id": "{{record.Supabase ID}}",
        "project_no": "{{record.Project.Project No}}"
      },
      "timestamp": "{{now}}"
    }
```

### 5.5 Airtable Views

| View Name | Table | Filters | Sort | Purpose |
|-----------|-------|---------|------|---------|
| `Active Projects` | Projects | Status != "completed", != "delivered" | Current Phase ASC | Daily ops overview |
| `Goldman Tasks` | Tasks | Project = "Goldman Law Firm" | Phase ASC, Task No ASC | Per-client task board |
| `Phase 2 - Design` | Tasks | Phase = "2", Status != "completed" | Priority DESC | Current phase focus |
| `Blocked Tasks` | Tasks | Status = "blocked" | Days Stale DESC | Escalation view |
| `My Tasks` | Tasks | Assigned To = current user | Due Date ASC | Personal task list |
| `Weekly Report` | Tasks | Modified in last 7 days | Project ASC | Status reporting |
| `Stale Tasks` | Tasks | Days Stale > 3, Status != "completed" | Days Stale DESC | Follow-up queue |

### 5.6 N8N Workflow: Airtable Task Sync

```json
{
  "name": "Airtable → Supabase Task Sync",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "airtable-task-update",
        "authentication": "headerAuth",
        "options": {}
      },
      "id": "webhook-receiver",
      "name": "Webhook Receiver",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [250, 300]
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict"
          },
          "conditions": [
            {
              "id": "verify-source",
              "leftValue": "={{ $json.body.source }}",
              "rightValue": "airtable",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        }
      },
      "id": "validate-source",
      "name": "Validate Source",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [470, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://104.248.69.86:3004/tools/update_project_task",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ project_no: $json.body.fields.project_no, task_no: $json.body.fields.task_no, status: $json.body.fields.status, assigned_to: $json.body.fields.assigned_to, hours: $json.body.fields.hours, notes: $json.body.fields.notes }) }}"
      },
      "id": "call-gateway",
      "name": "Gateway: Update Task",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [690, 260]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://gtfffxwfgcxiiauliynd.supabase.co/rest/v1/sync_audit_log",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "apikey",
              "value": "={{ $env.SUPABASE_SERVICE_KEY }}"
            },
            {
              "name": "Authorization",
              "value": "=Bearer {{ $env.SUPABASE_SERVICE_KEY }}"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            },
            {
              "name": "Prefer",
              "value": "return=minimal"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ source_system: 'airtable', target_system: 'supabase', record_type: 'project_task', record_id: $json.body.fields.supabase_id, action: 'update', payload: $json.body.fields, success: $node['Gateway: Update Task'].json.success !== false, error_message: $node['Gateway: Update Task'].json.error || null }) }}"
      },
      "id": "log-sync",
      "name": "Log to Audit",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [910, 260]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://gtfffxwfgcxiiauliynd.supabase.co/rest/v1/sync_audit_log",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "apikey",
              "value": "={{ $env.SUPABASE_SERVICE_KEY }}"
            },
            {
              "name": "Authorization",
              "value": "=Bearer {{ $env.SUPABASE_SERVICE_KEY }}"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ source_system: 'airtable', target_system: 'supabase', record_type: 'project_task', record_id: $json.body.fields?.supabase_id || 'unknown', action: 'update', payload: $json.body, success: false, error_message: 'Source validation failed' }) }}"
      },
      "id": "log-rejection",
      "name": "Log Rejection",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [690, 440]
    }
  ],
  "connections": {
    "Webhook Receiver": {
      "main": [
        [{ "node": "Validate Source", "type": "main", "index": 0 }]
      ]
    },
    "Validate Source": {
      "main": [
        [{ "node": "Gateway: Update Task", "type": "main", "index": 0 }],
        [{ "node": "Log Rejection", "type": "main", "index": 0 }]
      ]
    },
    "Gateway: Update Task": {
      "main": [
        [{ "node": "Log to Audit", "type": "main", "index": 0 }]
      ]
    }
  },
  "settings": {
    "executionOrder": "v1",
    "saveManualExecutions": true,
    "callerPolicy": "workflowsFromSameOwner"
  }
}
```

---

## 6. VTiger Sync

### 6.1 Gateway Endpoints Used

All VTiger writes route through the ASI360 Gateway at `http://104.248.69.86:3004`.

| Gateway Tool | VTiger Operation | Trigger |
|-------------|-----------------|---------|
| `update_project_task` | `revise` ProjectTask | Task status change in Supabase |
| `advance_project_phase` | `revise` Project (`cf_project_phasestatus`) | Phase completion trigger |
| `get_project` | `retrieve` Project + related tasks | Portal full status fetch |
| `create_project_from_template` | `create` Project + Milestones + Tasks | New project onboarding |
| `vtiger_add_related` | `add_related` | Link HelpDesk ticket to Project |

### 6.2 VTiger Custom Fields

| VTiger Field | Module | Type | Maps From |
|-------------|--------|------|-----------|
| `cf_project_phasestatus` | Project | Picklist | `current_phase` (1-5 -> name) |
| `cf_project_progress` | Project | Integer (0-100) | `progress_pct` |
| `cf_business_type` | Project | Picklist | `business_type` |
| `cf_contract_value` | Project | Currency | `contract_value` |
| `cf_site_address` | Project | Text | `site_address` |
| `cf_supabase_project_id` | Project | Text | `id` (UUID) |
| `cf_project_no` | Project | Text | `project_no` |

### 6.3 VTiger Sync Flow

```
 Supabase Task Update
         │
         v
 ┌──────────────────┐
 │  DB Trigger fires │
 │  (trg_fn_auto_    │
 │   advance_phase)  │
 └────────┬─────────┘
          │
          v
 ┌──────────────────┐     ┌─────────────────────┐
 │  sync_audit_log  │     │  pg_notify           │
 │  INSERT          │     │  'project_updates'   │
 └────────┬─────────┘     └──────────┬──────────┘
          │                          │
          v                          v
 ┌──────────────────┐     ┌─────────────────────┐
 │  N8N Scheduled   │     │  Supabase Realtime   │
 │  Workflow (5min) │     │  → Client Portal     │
 │  "VTiger Sync"   │     └─────────────────────┘
 └────────┬─────────┘
          │
          v
 ┌──────────────────────────────────────┐
 │  For each unsynced audit_log entry:  │
 │                                      │
 │  1. Read payload from sync_audit_log │
 │  2. Map fields to VTiger format      │
 │  3. POST to Gateway:                 │
 │     - update_project_task            │
 │     - OR advance_project_phase       │
 │  4. Update audit_log: success=true   │
 │  5. On failure: retry_count++,       │
 │     alert if retry_count > 3         │
 └──────────────────────────────────────┘
```

### 6.4 VTiger Phase Status Mapping

```
Supabase current_phase  →  VTiger cf_project_phasestatus
─────────────────────────────────────────────────────────
1                       →  "Phase 1 - Initiation"
2                       →  "Phase 2 - Design"
3                       →  "Phase 3 - Procurement"
4                       →  "Phase 4 - Installation"
5                       →  "Phase 5 - Closeout"
```

### 6.5 VTiger Task Status Mapping

```
Supabase status    →  VTiger projecttaskstatus
────────────────────────────────────────────────
open               →  "Open"
in_progress        →  "In Progress"
waiting            →  "On Hold"
completed          →  "Completed"
deferred           →  "Deferred"
blocked            →  "On Hold"
canceled           →  "Cancelled"
```

### 6.6 Record Linking

```
VTiger Record Relationships:
─────────────────────────────

Project (31x)
  ├── Contact (4x) ──── via linktoaccountscontacts
  ├── Account (3x) ──── via linktoaccountscontacts
  ├── Quote (2x) ────── via cf_quote_no lookup
  ├── ProjectTask (32x) ── child records
  │   ├── Task 1.1
  │   ├── Task 1.2
  │   ├── ...
  │   └── Task 5.4
  ├── ProjectMilestone (33x) ── 5 phase milestones
  │   ├── Phase 1 - Initiation
  │   ├── Phase 2 - Design
  │   ├── Phase 3 - Procurement
  │   ├── Phase 4 - Installation
  │   └── Phase 5 - Closeout
  └── HelpDesk (9x) ── support tickets (via vtiger_add_related)
```

---

## 7. Migration SQL

### 7.1 New Tables

```sql
-- ============================================================
-- TABLE: project_timeline_config
-- Stores timeline visualization configuration per project.
-- Used by the client portal frontend to render the Gantt-style
-- timeline view (Module 2).
-- ============================================================

CREATE TABLE IF NOT EXISTS project_timeline_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES asi360_projects(id) ON DELETE CASCADE,

  -- Timeline periods (weeks/months shown on X-axis)
  -- Example: [{"label":"Week 1","start":"2026-03-10","end":"2026-03-16"}, ...]
  periods jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Day labels for granular day-view
  -- Example: {"2026-03-10":"Mon","2026-03-11":"Tue", ...}
  day_labels jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Phase bars configuration
  -- Example: [{"phase":1,"name":"Initiation","start_period":0,"end_period":1,"color":"#3B82F6","status":"completed"}, ...]
  phases jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Milestone markers
  -- Example: [{"label":"Site Survey","date":"2026-03-12","phase":1,"icon":"clipboard"}, ...]
  milestones jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Notes/annotations on timeline
  -- Example: [{"text":"Permit submitted","date":"2026-03-15","type":"info"}, ...]
  notes jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by project
CREATE INDEX IF NOT EXISTS idx_timeline_config_project
  ON project_timeline_config(project_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION trg_fn_update_timeline_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_timeline_config_updated ON project_timeline_config;
CREATE TRIGGER trg_timeline_config_updated
  BEFORE UPDATE ON project_timeline_config
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_update_timeline_timestamp();


-- ============================================================
-- TABLE: sync_audit_log
-- Records every cross-system sync operation for debugging,
-- reconciliation, and retry logic.
-- ============================================================

CREATE TABLE IF NOT EXISTS sync_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which system initiated the change
  source_system text NOT NULL CHECK (source_system IN ('supabase', 'airtable', 'vtiger', 'gateway', 'n8n', 'portal')),

  -- Which system(s) received the change
  target_system text NOT NULL CHECK (target_system IN ('supabase', 'airtable', 'vtiger', 'all', 'gateway')),

  -- What type of record was affected
  record_type text NOT NULL CHECK (record_type IN ('project', 'project_task', 'timeline_config', 'notification', 'token')),

  -- The UUID or identifier of the affected record
  record_id text NOT NULL,

  -- What happened
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'phase_advance', 'sync', 'reconcile', 'retry')),

  -- Full payload for replay/debugging
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Did the sync succeed?
  success boolean NOT NULL DEFAULT true,

  -- Error details if failed
  error_message text,

  -- Retry tracking
  retry_count int NOT NULL DEFAULT 0,
  last_retry_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_sync_log_created
  ON sync_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_log_record
  ON sync_audit_log(record_type, record_id);

CREATE INDEX IF NOT EXISTS idx_sync_log_failures
  ON sync_audit_log(success, created_at DESC)
  WHERE success = false;

CREATE INDEX IF NOT EXISTS idx_sync_log_source
  ON sync_audit_log(source_system, created_at DESC);

-- Partition hint: if log grows large, partition by month
-- ALTER TABLE sync_audit_log SET (autovacuum_vacuum_scale_factor = 0.1);


-- ============================================================
-- TABLE: notification_queue
-- Stores client callback requests and system notifications.
-- Processed by N8N workflow or Edge Function.
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES asi360_projects(id) ON DELETE SET NULL,
  project_no text,
  type text NOT NULL CHECK (type IN ('callback_request', 'status_update', 'phase_complete', 'alert')),
  recipient_name text,
  recipient_phone text,
  recipient_email text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'canceled')),
  metadata jsonb DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_pending
  ON notification_queue(status, created_at)
  WHERE status = 'pending';


-- ============================================================
-- TABLE: project_access_tokens
-- Client portal access tokens for secure, link-based access.
-- ============================================================

CREATE TABLE IF NOT EXISTS project_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES asi360_projects(id) ON DELETE CASCADE,
  project_no text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  client_name text NOT NULL,
  client_email text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  revoked boolean NOT NULL DEFAULT false,
  last_accessed_at timestamptz,
  access_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_tokens_lookup
  ON project_access_tokens(token, project_no)
  WHERE revoked = false;
```

### 7.2 RLS Policies

```sql
-- Enable RLS on new tables
ALTER TABLE project_timeline_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_access_tokens ENABLE ROW LEVEL SECURITY;

-- Timeline config: service role full access, anon can read
CREATE POLICY "Service role full access on timeline_config"
  ON project_timeline_config
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Anon can read timeline_config"
  ON project_timeline_config
  FOR SELECT
  USING (true);

-- Sync audit log: service role only
CREATE POLICY "Service role only on sync_audit_log"
  ON sync_audit_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- Notification queue: service role only
CREATE POLICY "Service role only on notification_queue"
  ON notification_queue
  FOR ALL
  USING (auth.role() = 'service_role');

-- Access tokens: service role only
CREATE POLICY "Service role only on access_tokens"
  ON project_access_tokens
  FOR ALL
  USING (auth.role() = 'service_role');
```

### 7.3 Enable Realtime

```sql
-- Enable Supabase Realtime on the tables the portal subscribes to
ALTER PUBLICATION supabase_realtime ADD TABLE asi360_projects;
ALTER PUBLICATION supabase_realtime ADD TABLE asi360_project_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE project_timeline_config;
```

### 7.4 Seed Data: Goldman Timeline Config

```sql
-- Seed timeline config for Goldman Law Firm project (PROJ-202603-5336)
INSERT INTO project_timeline_config (
  project_id,
  periods,
  day_labels,
  phases,
  milestones,
  notes
) VALUES (
  (SELECT id FROM asi360_projects WHERE project_no = 'PROJ-202603-5336'),

  -- periods: 8-week project timeline
  '[
    {"label": "Week 1", "start": "2026-03-09", "end": "2026-03-15"},
    {"label": "Week 2", "start": "2026-03-16", "end": "2026-03-22"},
    {"label": "Week 3", "start": "2026-03-23", "end": "2026-03-29"},
    {"label": "Week 4", "start": "2026-03-30", "end": "2026-04-05"},
    {"label": "Week 5", "start": "2026-04-06", "end": "2026-04-12"},
    {"label": "Week 6", "start": "2026-04-13", "end": "2026-04-19"},
    {"label": "Week 7", "start": "2026-04-20", "end": "2026-04-26"},
    {"label": "Week 8", "start": "2026-04-27", "end": "2026-05-03"}
  ]'::jsonb,

  -- day_labels: abbreviated day headers for each period
  '{
    "2026-03-10": "M", "2026-03-11": "T", "2026-03-12": "W",
    "2026-03-13": "T", "2026-03-14": "F",
    "2026-03-17": "M", "2026-03-18": "T", "2026-03-19": "W",
    "2026-03-20": "T", "2026-03-21": "F"
  }'::jsonb,

  -- phases: 5-phase bar chart configuration
  '[
    {
      "phase": 1, "name": "Initiation",
      "start_period": 0, "end_period": 1,
      "color": "#3B82F6", "status": "completed",
      "tasks_total": 4, "tasks_completed": 4
    },
    {
      "phase": 2, "name": "Design",
      "start_period": 1, "end_period": 3,
      "color": "#8B5CF6", "status": "in_progress",
      "tasks_total": 4, "tasks_completed": 2
    },
    {
      "phase": 3, "name": "Procurement",
      "start_period": 3, "end_period": 4,
      "color": "#F59E0B", "status": "upcoming",
      "tasks_total": 4, "tasks_completed": 0
    },
    {
      "phase": 4, "name": "Installation",
      "start_period": 4, "end_period": 6,
      "color": "#10B981", "status": "upcoming",
      "tasks_total": 4, "tasks_completed": 0
    },
    {
      "phase": 5, "name": "Closeout",
      "start_period": 6, "end_period": 7,
      "color": "#6366F1", "status": "upcoming",
      "tasks_total": 4, "tasks_completed": 0
    }
  ]'::jsonb,

  -- milestones
  '[
    {"label": "Contract Signed", "date": "2026-03-10", "phase": 1, "icon": "check-circle", "completed": true},
    {"label": "Site Survey", "date": "2026-03-12", "phase": 1, "icon": "clipboard", "completed": true},
    {"label": "Design Approved", "date": "2026-03-22", "phase": 2, "icon": "pencil", "completed": false},
    {"label": "Equipment Ordered", "date": "2026-03-30", "phase": 3, "icon": "truck", "completed": false},
    {"label": "Installation Start", "date": "2026-04-06", "phase": 4, "icon": "wrench", "completed": false},
    {"label": "Final Walkthrough", "date": "2026-04-27", "phase": 5, "icon": "flag", "completed": false},
    {"label": "Project Delivered", "date": "2026-05-01", "phase": 5, "icon": "star", "completed": false}
  ]'::jsonb,

  -- notes
  '[
    {"text": "Client prefers after-hours installation (6PM-10PM)", "date": "2026-03-10", "type": "info"},
    {"text": "Building management requires 48hr advance notice for access", "date": "2026-03-10", "type": "warning"},
    {"text": "Existing Keri PXL-500W controllers can be reused", "date": "2026-03-12", "type": "info"}
  ]'::jsonb
)
ON CONFLICT (project_id) DO UPDATE SET
  periods = EXCLUDED.periods,
  day_labels = EXCLUDED.day_labels,
  phases = EXCLUDED.phases,
  milestones = EXCLUDED.milestones,
  notes = EXCLUDED.notes,
  updated_at = now();
```

---

## 8. Monitoring

### 8.1 Prometheus Metrics

Exposed by the Gateway service at `http://104.248.69.86:3004/metrics`.

```
# ─── Sync Counters ────────────────────────────────────────

# Total sync operations attempted
# TYPE sync_operations_total counter
sync_operations_total{source="supabase",target="airtable",record_type="project_task"} 142
sync_operations_total{source="supabase",target="vtiger",record_type="project_task"} 142
sync_operations_total{source="airtable",target="supabase",record_type="project_task"} 87
sync_operations_total{source="gateway",target="all",record_type="project"} 23

# Failed sync operations
# TYPE sync_failures_total counter
sync_failures_total{source="supabase",target="airtable",reason="timeout"} 3
sync_failures_total{source="supabase",target="vtiger",reason="auth_expired"} 1
sync_failures_total{source="airtable",target="supabase",reason="validation"} 2

# ─── Sync Latency ─────────────────────────────────────────

# Sync duration in seconds (histogram)
# TYPE sync_duration_seconds histogram
sync_duration_seconds_bucket{target="airtable",le="0.5"} 120
sync_duration_seconds_bucket{target="airtable",le="1.0"} 138
sync_duration_seconds_bucket{target="airtable",le="2.0"} 141
sync_duration_seconds_bucket{target="airtable",le="5.0"} 142
sync_duration_seconds_bucket{target="airtable",le="+Inf"} 142
sync_duration_seconds_sum{target="airtable"} 89.4
sync_duration_seconds_count{target="airtable"} 142

sync_duration_seconds_bucket{target="vtiger",le="0.5"} 80
sync_duration_seconds_bucket{target="vtiger",le="1.0"} 130
sync_duration_seconds_bucket{target="vtiger",le="2.0"} 140
sync_duration_seconds_bucket{target="vtiger",le="5.0"} 142
sync_duration_seconds_bucket{target="vtiger",le="+Inf"} 142

# ─── Queue Metrics ─────────────────────────────────────────

# Pending items in notification queue
# TYPE notification_queue_pending gauge
notification_queue_pending 2

# Unsynced audit log entries (failures pending retry)
# TYPE sync_retry_queue_size gauge
sync_retry_queue_size 1

# ─── Drift Detection ──────────────────────────────────────

# Records where Supabase != Airtable (detected by reconciliation)
# TYPE sync_drift_records gauge
sync_drift_records{system="airtable",record_type="project"} 0
sync_drift_records{system="airtable",record_type="project_task"} 0
sync_drift_records{system="vtiger",record_type="project"} 0
```

### 8.2 Alert Rules

```yaml
# prometheus/alerts/sync_alerts.yml

groups:
  - name: data_sync_alerts
    rules:
      # Alert if sync failure rate exceeds 5% in 15 minutes
      - alert: SyncFailureRateHigh
        expr: |
          rate(sync_failures_total[15m]) /
          rate(sync_operations_total[15m]) > 0.05
        for: 5m
        labels:
          severity: warning
          team: engineering
        annotations:
          summary: "Data sync failure rate above 5%"
          description: >
            Sync failure rate is {{ $value | humanizePercentage }}
            for {{ $labels.source }} -> {{ $labels.target }}.

      # Alert if any sync takes more than 10 seconds
      - alert: SyncLatencyHigh
        expr: |
          histogram_quantile(0.99, rate(sync_duration_seconds_bucket[5m])) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Sync latency p99 above 10 seconds for {{ $labels.target }}"

      # Alert if retry queue grows beyond 10
      - alert: SyncRetryQueueBacklog
        expr: sync_retry_queue_size > 10
        for: 10m
        labels:
          severity: critical
          team: engineering
        annotations:
          summary: "{{ $value }} sync operations stuck in retry queue"
          description: >
            More than 10 failed sync operations are pending retry.
            Check sync_audit_log for error details.

      # Alert if drift detected during reconciliation
      - alert: DataDriftDetected
        expr: sync_drift_records > 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "{{ $value }} records drifted between {{ $labels.system }} and Supabase"
          description: >
            The daily reconciliation found records where
            {{ $labels.system }} data differs from Supabase.
            Record type: {{ $labels.record_type }}.

      # Alert if notification queue has pending items older than 1 hour
      - alert: NotificationQueueStale
        expr: notification_queue_pending > 0
        for: 60m
        labels:
          severity: warning
        annotations:
          summary: "{{ $value }} notifications pending for over 1 hour"
```

### 8.3 Health Check Endpoint

Added to the Gateway at `GET /health/sync`:

```typescript
// Gateway health check addition — GET /health/sync

interface SyncHealth {
  status: "healthy" | "degraded" | "unhealthy";
  checks: {
    supabase: { status: string; latency_ms: number };
    airtable: { status: string; latency_ms: number };
    vtiger: { status: string; latency_ms: number };
    audit_log: {
      total_24h: number;
      failures_24h: number;
      failure_rate: string;
      oldest_pending_retry: string | null;
    };
    notification_queue: {
      pending: number;
      oldest_pending: string | null;
    };
    drift: {
      last_reconciliation: string | null;
      records_drifted: number;
    };
  };
  timestamp: string;
}
```

**Sample response:**

```json
{
  "status": "healthy",
  "checks": {
    "supabase": { "status": "ok", "latency_ms": 45 },
    "airtable": { "status": "ok", "latency_ms": 230 },
    "vtiger": { "status": "ok", "latency_ms": 180 },
    "audit_log": {
      "total_24h": 87,
      "failures_24h": 1,
      "failure_rate": "1.1%",
      "oldest_pending_retry": null
    },
    "notification_queue": {
      "pending": 0,
      "oldest_pending": null
    },
    "drift": {
      "last_reconciliation": "2026-03-10T02:00:00Z",
      "records_drifted": 0
    }
  },
  "timestamp": "2026-03-10T14:30:00Z"
}
```

### 8.4 Audit Log Diagnostic Queries

```sql
-- ─── Recent failures (last 24h) ──────────────────────────
SELECT
  id,
  source_system,
  target_system,
  record_type,
  record_id,
  action,
  error_message,
  retry_count,
  created_at
FROM sync_audit_log
WHERE success = false
  AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC
LIMIT 50;

-- ─── Sync volume by source/target (last 24h) ─────────────
SELECT
  source_system,
  target_system,
  record_type,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE success = true) AS succeeded,
  COUNT(*) FILTER (WHERE success = false) AS failed,
  ROUND(
    COUNT(*) FILTER (WHERE success = false)::numeric /
    NULLIF(COUNT(*), 0) * 100, 1
  ) AS failure_pct
FROM sync_audit_log
WHERE created_at > now() - interval '24 hours'
GROUP BY source_system, target_system, record_type
ORDER BY total DESC;

-- ─── Stuck retries (failed 3+ times, not resolved) ───────
SELECT
  id,
  source_system,
  target_system,
  record_type,
  record_id,
  action,
  error_message,
  retry_count,
  last_retry_at,
  created_at
FROM sync_audit_log
WHERE success = false
  AND retry_count >= 3
ORDER BY created_at DESC;

-- ─── Phase advancement history ────────────────────────────
SELECT
  sal.created_at,
  sal.record_id AS project_id,
  p.project_no,
  p.project_name,
  sal.payload->>'old_phase' AS from_phase,
  sal.payload->>'new_phase' AS to_phase,
  sal.payload->>'progress_pct' AS progress,
  sal.payload->>'trigger' AS trigger_type,
  sal.payload->>'completing_task' AS completing_task
FROM sync_audit_log sal
JOIN asi360_projects p ON p.id = sal.record_id::uuid
WHERE sal.action = 'phase_advance'
ORDER BY sal.created_at DESC
LIMIT 20;

-- ─── Sync timeline for a specific project ─────────────────
SELECT
  sal.created_at,
  sal.source_system,
  sal.target_system,
  sal.action,
  sal.record_type,
  sal.payload->>'task_no' AS task_no,
  sal.payload->>'old_status' AS old_status,
  sal.payload->>'new_status' AS new_status,
  sal.success,
  sal.error_message
FROM sync_audit_log sal
WHERE sal.record_id IN (
  -- All task IDs for the given project
  SELECT id::text FROM asi360_project_tasks
  WHERE project_id = (
    SELECT id FROM asi360_projects WHERE project_no = 'PROJ-202603-5336'
  )
  UNION
  -- The project ID itself
  SELECT id::text FROM asi360_projects WHERE project_no = 'PROJ-202603-5336'
)
ORDER BY sal.created_at DESC
LIMIT 100;

-- ─── Daily reconciliation drift report ────────────────────
-- Run by N8N at 2:00 AM daily
-- Compares Supabase project status vs last known Airtable state
SELECT
  p.project_no,
  p.status AS supabase_status,
  p.current_phase AS supabase_phase,
  p.progress_pct AS supabase_progress,
  sal.payload->>'airtable_status' AS airtable_status,
  sal.payload->>'airtable_phase' AS airtable_phase,
  CASE
    WHEN p.status != sal.payload->>'airtable_status' THEN 'STATUS_DRIFT'
    WHEN p.current_phase::text != sal.payload->>'airtable_phase' THEN 'PHASE_DRIFT'
    ELSE 'OK'
  END AS drift_type
FROM asi360_projects p
LEFT JOIN LATERAL (
  SELECT payload
  FROM sync_audit_log
  WHERE record_id = p.id::text
    AND source_system = 'airtable'
    AND action = 'sync'
  ORDER BY created_at DESC
  LIMIT 1
) sal ON true
WHERE p.status NOT IN ('completed', 'delivered');
```

### 8.5 N8N Reconciliation Workflow (Daily 2:00 AM)

```json
{
  "name": "Daily Sync Reconciliation",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [{ "field": "cronExpression", "expression": "0 2 * * *" }]
        }
      },
      "id": "cron-trigger",
      "name": "Daily 2AM Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [250, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://gtfffxwfgcxiiauliynd.supabase.co/rest/v1/rpc/reconcile_all_projects",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "apikey", "value": "={{ $env.SUPABASE_SERVICE_KEY }}" },
            { "name": "Authorization", "value": "=Bearer {{ $env.SUPABASE_SERVICE_KEY }}" },
            { "name": "Content-Type", "value": "application/json" }
          ]
        }
      },
      "id": "run-reconciliation",
      "name": "Run Reconciliation RPC",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [470, 300]
    },
    {
      "parameters": {
        "conditions": {
          "conditions": [
            {
              "leftValue": "={{ $json.drift_count }}",
              "rightValue": 0,
              "operator": { "type": "number", "operation": "gt" }
            }
          ]
        }
      },
      "id": "check-drift",
      "name": "Drift Detected?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [690, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.telegram.org/bot{{ $env.TELEGRAM_BOT_TOKEN }}/sendMessage",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ chat_id: '-1001234567890', text: '⚠️ Data Sync Drift Detected\\n\\n' + $json.drift_count + ' records with mismatched data between systems.\\n\\nRun: SELECT * FROM sync_audit_log WHERE action = \\'reconcile\\' AND created_at > now() - interval \\'1 hour\\';', parse_mode: 'HTML' }) }}"
      },
      "id": "alert-telegram",
      "name": "Alert via Telegram",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [910, 260]
    }
  ],
  "connections": {
    "Daily 2AM Trigger": {
      "main": [[{ "node": "Run Reconciliation RPC", "type": "main", "index": 0 }]]
    },
    "Run Reconciliation RPC": {
      "main": [[{ "node": "Drift Detected?", "type": "main", "index": 0 }]]
    },
    "Drift Detected?": {
      "main": [
        [{ "node": "Alert via Telegram", "type": "main", "index": 0 }],
        []
      ]
    }
  }
}
```

---

## Appendix A: Cross-Reference to Other Modules

| Reference | Module | Section |
|-----------|--------|---------|
| Timeline visualization config schema | Module 2 | Timeline Data Model |
| Portal frontend Realtime hooks | Module 4 | React Hooks & State |
| Edge Function deployment | Module 5 | Supabase Infrastructure |
| Client token generation | Module 4 | Authentication Flow |
| Gateway API full reference | Module 5 | Service Architecture |
| Prometheus scrape config | Module 5 | Monitoring Stack |

## Appendix B: Glossary

| Term | Definition |
|------|-----------|
| **Source of Truth** | Supabase. All reads for the client portal come from here. |
| **Operational Hub** | Airtable. Where the ops team does daily work. |
| **Gateway** | ASI360 Gateway API at 104.248.69.86:3004. Orchestrates writes to all 3 systems. |
| **Phase Advance** | When all tasks in a phase are marked "completed", the project automatically moves to the next phase. |
| **Drift** | When data in Airtable or VTiger does not match Supabase. Detected by daily reconciliation. |
| **Audit Log** | The `sync_audit_log` table. Every cross-system write is recorded here. |
| **Client Token** | A 64-char hex token in `project_access_tokens` that grants portal access to a specific project. |

---

*End of Module 3 — Data Sync Architecture*
