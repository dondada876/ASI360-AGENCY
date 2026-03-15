-- Phase J: Client Portal — Migration 001: Client Tables
-- Creates client_profiles and client_project_access tables
-- NOTE: asi360_projects.id is INTEGER, not UUID

-- Client profiles — links Supabase Auth user to portal access
CREATE TABLE IF NOT EXISTS client_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  display_name text NOT NULL,
  email text NOT NULL,
  phone text,
  company_name text,
  avatar_url text,
  vtiger_contact_id text,
  role text NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'admin', 'viewer')),
  is_active boolean DEFAULT true,
  notification_preferences jsonb DEFAULT '{"email":true,"sms":false,"telegram":false,"in_app":true}',
  telegram_chat_id text,
  created_at timestamptz DEFAULT now()
);

-- Many-to-many: which client can see which project
CREATE TABLE IF NOT EXISTS client_project_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  project_id integer NOT NULL REFERENCES asi360_projects(id) ON DELETE CASCADE,
  access_level text DEFAULT 'viewer' CHECK (access_level IN ('viewer', 'commenter', 'admin')),
  invited_by text,
  invited_at timestamptz DEFAULT now(),
  UNIQUE(client_id, project_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_profiles_user ON client_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_client_access_client ON client_project_access(client_id);
CREATE INDEX IF NOT EXISTS idx_client_access_project ON client_project_access(project_id);
