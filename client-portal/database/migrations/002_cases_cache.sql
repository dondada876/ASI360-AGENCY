-- Phase J: Client Portal — Migration 002: VTiger Cases Cache + Tickets Ref + Activity Log
-- NOTE: asi360_projects.id is INTEGER, not UUID

-- VTiger Cases cache — mirrors CC-XXX cases for fast portal reads
CREATE TABLE IF NOT EXISTS vtiger_cases_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_no text NOT NULL UNIQUE,
  vtiger_id text,
  project_id integer REFERENCES asi360_projects(id),
  client_id uuid REFERENCES client_profiles(id),
  contact_name text,
  organization_name text,
  -- Client-visible fields
  title text NOT NULL,
  description text NOT NULL,
  category text DEFAULT 'general' CHECK (category IN (
    'general', 'change_request', 'bug_report', 'billing', 'scheduling', 'access'
  )),
  priority text DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'Medium', 'High', 'Urgent')),
  status text DEFAULT 'Open' CHECK (status IN (
    'Open', 'In Progress', 'Wait for customer', 'Wait for 3rd party', 'Assigned', 'Closed', 'Resolved'
  )),
  resolution text,
  -- Internal-only fields (hidden from client by app-level filtering)
  assigned_to text,
  is_billable boolean DEFAULT false,
  service_type text,
  resolution_due timestamptz,
  -- Sync metadata
  sync_status text DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending_sync', 'sync_failed')),
  last_synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  modified_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_cases_client ON vtiger_cases_cache(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_project ON vtiger_cases_cache(project_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON vtiger_cases_cache(status);
CREATE INDEX IF NOT EXISTS idx_cases_case_no ON vtiger_cases_cache(case_no);

-- Internal ticket references — count + title only, for badge display
CREATE TABLE IF NOT EXISTS vtiger_tickets_ref (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_no text NOT NULL UNIQUE,
  vtiger_id text,
  project_id integer REFERENCES asi360_projects(id),
  title text NOT NULL,
  status text DEFAULT 'Open',
  priority text DEFAULT 'Normal',
  created_at timestamptz DEFAULT now(),
  modified_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_project ON vtiger_tickets_ref(project_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON vtiger_tickets_ref(status);

-- Case activity log — audit trail for case changes
CREATE TABLE IF NOT EXISTS case_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_no text NOT NULL,
  author_name text NOT NULL,
  author_role text CHECK (author_role IN ('client', 'admin', 'system')),
  action text NOT NULL CHECK (action IN ('comment', 'status_change', 'assignment', 'resolution')),
  content text,
  is_internal boolean DEFAULT false,
  vtiger_modcomment_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_activity ON case_activity_log(case_no, created_at);
