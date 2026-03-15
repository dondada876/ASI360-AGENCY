-- Phase J: Client Portal — Migration 003: Comments + Notifications
-- NOTE: asi360_projects.id is INTEGER, asi360_project_tasks.id is INTEGER

-- Project comments — lightweight threaded discussion (NOT cases)
CREATE TABLE IF NOT EXISTS project_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id integer NOT NULL REFERENCES asi360_projects(id),
  task_id integer REFERENCES asi360_project_tasks(id) ON DELETE SET NULL,
  author_id uuid NOT NULL REFERENCES auth.users(id),
  author_name text NOT NULL,
  author_role text DEFAULT 'client' CHECK (author_role IN ('client', 'admin', 'system')),
  parent_id uuid REFERENCES project_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  visibility text DEFAULT 'external' CHECK (visibility IN ('internal', 'external')),
  attachments jsonb DEFAULT '[]',
  is_edited boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_project ON project_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON project_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON project_comments(author_id);

-- Client notifications — multi-channel notification queue
CREATE TABLE IF NOT EXISTS client_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES client_profiles(id),
  project_id integer REFERENCES asi360_projects(id),
  case_no text,
  type text NOT NULL CHECK (type IN (
    'project_update', 'task_completed', 'phase_advanced',
    'comment_reply', 'case_update', 'document_ready', 'system_alert', 'welcome'
  )),
  title text NOT NULL,
  message text NOT NULL,
  action_url text,
  priority text DEFAULT 'normal',
  read boolean DEFAULT false,
  read_at timestamptz,
  delivery_channels jsonb DEFAULT '[]',
  delivery_status jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_client ON client_notifications(client_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON client_notifications(client_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_project ON client_notifications(project_id);
