// ── Client Portal Types ──────────────────────────────────────

export interface ClientProfile {
  id: string
  user_id: string
  display_name: string
  email: string
  phone: string | null
  company_name: string | null
  avatar_url: string | null
  vtiger_contact_id: string | null
  role: "client" | "admin" | "viewer"
  is_active: boolean
  notification_preferences: NotificationPreferences
  telegram_chat_id: string | null
  timezone: string
  created_at: string
}

export interface NotificationPreferences {
  email: boolean
  sms: boolean
  telegram: boolean
  in_app: boolean
}

export interface ClientProjectAccess {
  id: string
  client_id: string
  project_id: number
  access_level: "viewer" | "commenter" | "admin"
  invited_by: string | null
  invited_at: string
}

// ── Project Types (from existing asi360_projects) ────────────

export interface Project {
  id: number
  project_no: string
  project_name: string
  slug: string
  client_name: string | null
  project_status: string
  current_phase: number
  start_date: string | null
  target_close_date: string | null
  contract_value: number | null
  business_type: string | null
  health_score: number | null
}

export interface ProjectTask {
  id: number
  project_id: number
  task_no: string
  task_name: string
  phase_no: number
  phase_name: string
  vtiger_task_name: string
  status: string
  priority: string | null
  assigned_to: string | null
  start_date: string | null
  due_date: string | null
  end_date: string | null
  completed_date: string | null
  is_milestone: boolean
  hours: number | null
}

// ── Case Types (CC-XXX — client-facing) ──────────────────────

export interface VtigerCase {
  id: string
  case_no: string // CC-XXX (canonical)
  vtiger_id: string | null
  project_id: number | null
  client_id: string | null
  contact_name: string | null
  organization_name: string | null
  title: string
  description: string
  category: CaseCategory
  priority: CasePriority
  status: CaseStatus
  resolution: string | null
  // Internal fields — stripped before sending to client
  assigned_to?: string
  is_billable?: boolean
  service_type?: string
  resolution_due?: string
  sync_status: "synced" | "pending_sync" | "sync_failed"
  last_synced_at: string
  created_at: string
  modified_at: string
  resolved_at: string | null
}

export type CaseCategory =
  | "general"
  | "change_request"
  | "bug_report"
  | "billing"
  | "scheduling"
  | "access"

export type CasePriority = "Low" | "Normal" | "Medium" | "High" | "Urgent"

export type CaseStatus =
  | "Open"
  | "In Progress"
  | "Wait for customer"
  | "Wait for 3rd party"
  | "Assigned"
  | "Closed"
  | "Resolved"

// Client-safe case view (internal fields stripped)
export interface CaseClientView {
  id: string
  case_no: string
  project_id: number | null
  title: string
  description: string
  category: CaseCategory
  priority: CasePriority
  status: CaseStatus
  resolution: string | null
  created_at: string
  modified_at: string
  resolved_at: string | null
}

// ── Internal Ticket Reference (TT-XXX — badge only) ─────────

export interface TicketRef {
  id: string
  ticket_no: string // TT-XXX
  project_id: number | null
  title: string
  status: string
  priority: string
  created_at: string
}

// ── Comment Types ────────────────────────────────────────────

export interface ProjectComment {
  id: string
  project_id: number
  task_id: number | null
  author_id: string
  author_name: string
  author_role: "client" | "admin" | "system"
  parent_id: string | null
  content: string
  visibility: "internal" | "external"
  attachments: unknown[]
  is_edited: boolean
  created_at: string
  replies?: ProjectComment[]
}

// ── Notification Types ───────────────────────────────────────

export interface ClientNotification {
  id: string
  client_id: string
  project_id: number | null
  case_no: string | null
  type: NotificationType
  title: string
  message: string
  action_url: string | null
  priority: string
  read: boolean
  read_at: string | null
  delivery_channels: string[]
  delivery_status: Record<string, unknown>
  created_at: string
}

export type NotificationType =
  | "project_update"
  | "task_completed"
  | "phase_advanced"
  | "comment_reply"
  | "case_update"
  | "document_ready"
  | "system_alert"
  | "welcome"

// ── Case Activity Log ────────────────────────────────────────

export interface CaseActivity {
  id: string
  case_no: string
  author_name: string
  author_role: "client" | "admin" | "system"
  action: "comment" | "status_change" | "assignment" | "resolution"
  content: string | null
  is_internal: boolean
  created_at: string
}

// ── Utility Types ────────────────────────────────────────────

export function stripInternalFields(c: VtigerCase): CaseClientView {
  return {
    id: c.id,
    case_no: c.case_no,
    project_id: c.project_id,
    title: c.title,
    description: c.description,
    category: c.category,
    priority: c.priority,
    status: c.status,
    resolution: c.resolution,
    created_at: c.created_at,
    modified_at: c.modified_at,
    resolved_at: c.resolved_at,
  }
}
