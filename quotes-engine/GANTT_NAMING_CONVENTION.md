# ASI 360 — Project Task Naming Convention
**Reference for Gantt HUD, VTiger Sync, Airtable Sync**

---

## Canonical Format (enforced from PROJ369 onwards)

```
task_name  =  {PROJ_NO}-{phase_no}.{seq}  {Descriptive Task Name}
task_no    =  {phase_no}.{seq}
```

### Examples
| task_no | task_name | Status |
|---------|-----------|--------|
| `1.1` | `PROJ369-1.1 Feature Brief` | ✅ Correct |
| `2.3` | `PROJ369-2.3 Integration Testing` | ✅ Correct |
| `3.1` | `PROJ369-3.1 Merge & Deploy` | ✅ Correct |

### Rules
1. **task_no** = `{phase_no}.{seq}` — numeric only, dot-separated (e.g. `1.1`, `2.4`, `5.1`)
2. **task_name** = starts with `{PROJ_NO}-{task_no} ` followed by a plain English descriptive name
3. The descriptive name portion is **title case**, concise (3–6 words)
4. Milestones follow the same format — `is_milestone = true` in DB
5. Pre-start tasks use `phase_no = 0`, `task_no = T{PROJ_NO}-{seq}` (e.g. `T364-001`)

---

## Broken / Legacy Formats (do NOT create new tasks in these formats)

| Pattern | Example | Problem |
|---------|---------|---------|
| Number at end | `Feature Brief 1.1` | task_no is suffix, not prefix |
| J-prefix | `J.4a Notification Pipeline 2.5` | wrong project identifier |
| No number | `Internal Audit — CEO Dashboard` | no task_no in name at all |
| Template-only | `Project Charter 1.1` | generic template name, no project binding |

The **GanttHUD strips these patterns automatically** for display:
- Strips `PROJ###-#.# ` prefix from task_name (canonical prefix)
- Strips trailing ` #.#` suffix (old convention)
- Strips leading `J.##[letter] ` prefix (legacy junk)

The `task_no` field is **always displayed first** in the Gantt label column, independent of what is embedded in `task_name`.

---

## Sync Rules (Supabase ↔ Airtable ↔ VTiger)

All three systems share the same task identity. Changes in any system propagate to the others via sync jobs:

| Field | VTiger source | Airtable source | Supabase (truth) |
|-------|--------------|-----------------|------------------|
| `task_name` | `Task Name` | `Name` field | `task_name` |
| `task_no` | `Task Number` custom field | `Task No` field | `task_no` |
| `status` | `Status` picklist | `Status` select | `status` |
| `start_date` | `Start Date` | `Start Date` | `start_date` |
| `due_date` | `Due Date` | `Due Date` | `due_date` |
| `assigned_to` | `Assigned To` | `Assigned To` | `assigned_to` |
| `modified_source` | set to `vtiger` on sync | set to `airtable` on sync | tracked per row |

### Status picklist values (normalized)
All systems must use these exact values (Supabase stores with underscore, display normalizes spaces):

| DB value | Display | VTiger picklist | Airtable option |
|----------|---------|-----------------|-----------------|
| `open` | Open | Open | 🔵 Open |
| `in_progress` | In Progress | In Progress | 🟡 In Progress |
| `waiting` | Waiting | Waiting/Blocked | ⏸ Waiting |
| `completed` | Completed | Closed | ✅ Completed |
| `deferred` | Deferred | Deferred | 🟠 Deferred |
| `cancelled` | Cancelled | Cancelled | ❌ Cancelled |

### Enforcement
- The **Gantt HUD** (`GanttHUD.tsx`) uses `normalizeStatus()` which maps `in_progress` → `in progress` for display logic. Do NOT change status values in the DB to use spaces — keep underscores.
- When VTiger or Airtable sync writes a new task, `modified_source` must be set to `vtiger` or `airtable` respectively. The Gantt shows a source badge (VT / AT) for these tasks.
- `vtiger_task_id` and `airtable_record_id` are populated by their respective sync jobs and are used by the Gantt HUD to create direct deep-links.

---

## VTiger Task Deep Link
```
https://allsysinc.od1.vtiger.com/index.php?module=ProjectTask&action=DetailView&record={vtiger_task_id}
```

## Reference Files
- Timeline HTML templates: `quotes-engine/PROJ356_Mad_Oak_Bar_and_Yard_Timeline.html`
- Gantt HUD component: `client-portal/src/components/admin/GanttHUD.tsx`
- Gantt HUD page: `client-portal/src/app/(admin)/admin/vtiger-crm-optimization-HUD/page.tsx`
