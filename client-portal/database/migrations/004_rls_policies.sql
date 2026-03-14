-- Phase J: Client Portal — Migration 004: RLS Policies
-- CRITICAL: anon bypass ensures internal dashboard keeps working
-- Uses SECURITY DEFINER functions to avoid infinite recursion on client_profiles

-- ═══════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS (SECURITY DEFINER — bypass RLS in policy checks)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_portal_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM client_profiles WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.portal_user_project_ids()
RETURNS SETOF integer
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT cpa.project_id
  FROM client_project_access cpa
  JOIN client_profiles cp ON cp.id = cpa.client_id
  WHERE cp.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.portal_user_client_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT id FROM client_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ═══════════════════════════════════════════════════════════════
-- EXISTING TABLES: Add RLS with anon bypass (dashboard = anon key)
-- ═══════════════════════════════════════════════════════════════

-- asi360_projects
ALTER TABLE asi360_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_full_access_projects" ON asi360_projects
  FOR ALL USING (auth.role() = 'anon');
CREATE POLICY "clients_view_assigned_projects" ON asi360_projects
  FOR SELECT USING (auth.role() = 'authenticated' AND id IN (SELECT public.portal_user_project_ids()));
CREATE POLICY "admin_full_access_projects" ON asi360_projects
  FOR ALL USING (auth.role() = 'authenticated' AND public.is_portal_admin());

-- asi360_project_tasks
ALTER TABLE asi360_project_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_full_access_tasks" ON asi360_project_tasks
  FOR ALL USING (auth.role() = 'anon');
CREATE POLICY "clients_view_assigned_tasks" ON asi360_project_tasks
  FOR SELECT USING (auth.role() = 'authenticated' AND project_id IN (SELECT public.portal_user_project_ids()));
CREATE POLICY "admin_full_access_tasks" ON asi360_project_tasks
  FOR ALL USING (auth.role() = 'authenticated' AND public.is_portal_admin());

-- project_events (uses project_no text, not project_id)
ALTER TABLE project_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_full_access_events" ON project_events
  FOR ALL USING (auth.role() = 'anon');
CREATE POLICY "clients_view_assigned_events" ON project_events
  FOR SELECT USING (
    auth.role() = 'authenticated' AND project_no IN (
      SELECT p.project_no FROM asi360_projects p WHERE p.id IN (SELECT public.portal_user_project_ids())
    )
  );
CREATE POLICY "admin_full_access_events" ON project_events
  FOR ALL USING (auth.role() = 'authenticated' AND public.is_portal_admin());

-- ═══════════════════════════════════════════════════════════════
-- NEW TABLES: Standard RLS
-- ═══════════════════════════════════════════════════════════════

-- client_profiles
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_profile" ON client_profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users_update_own_profile" ON client_profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "admin_manage_profiles" ON client_profiles FOR ALL USING (public.is_portal_admin());
CREATE POLICY "service_role_profiles" ON client_profiles FOR ALL USING (auth.role() = 'service_role');

-- client_project_access
ALTER TABLE client_project_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_read_own_access" ON client_project_access
  FOR SELECT USING (client_id = public.portal_user_client_id());
CREATE POLICY "admin_manage_access" ON client_project_access
  FOR ALL USING (public.is_portal_admin());
CREATE POLICY "service_role_access" ON client_project_access
  FOR ALL USING (auth.role() = 'service_role');

-- vtiger_cases_cache
ALTER TABLE vtiger_cases_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_own_cases" ON vtiger_cases_cache
  FOR SELECT USING (client_id = public.portal_user_client_id());
CREATE POLICY "clients_create_cases" ON vtiger_cases_cache
  FOR INSERT WITH CHECK (client_id = public.portal_user_client_id());
CREATE POLICY "admin_all_cases" ON vtiger_cases_cache FOR ALL USING (public.is_portal_admin());
CREATE POLICY "service_role_cases" ON vtiger_cases_cache FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "anon_full_access_cases" ON vtiger_cases_cache FOR ALL USING (auth.role() = 'anon');

-- vtiger_tickets_ref
ALTER TABLE vtiger_tickets_ref ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_read_project_tickets" ON vtiger_tickets_ref
  FOR SELECT USING (project_id IN (SELECT public.portal_user_project_ids()));
CREATE POLICY "admin_all_tickets" ON vtiger_tickets_ref FOR ALL USING (public.is_portal_admin());
CREATE POLICY "anon_full_access_tickets" ON vtiger_tickets_ref FOR ALL USING (auth.role() = 'anon');

-- project_comments
ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_see_external_comments" ON project_comments
  FOR SELECT USING (visibility = 'external' AND project_id IN (SELECT public.portal_user_project_ids()));
CREATE POLICY "clients_create_comments" ON project_comments
  FOR INSERT WITH CHECK (author_id = auth.uid() AND visibility = 'external');
CREATE POLICY "admin_all_comments" ON project_comments FOR ALL USING (public.is_portal_admin());

-- client_notifications
ALTER TABLE client_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_own_notifications" ON client_notifications
  FOR SELECT USING (client_id = public.portal_user_client_id());
CREATE POLICY "clients_mark_read" ON client_notifications
  FOR UPDATE USING (client_id = public.portal_user_client_id());
CREATE POLICY "admin_all_notifications" ON client_notifications FOR ALL USING (public.is_portal_admin());
CREATE POLICY "service_role_notifications" ON client_notifications FOR ALL USING (auth.role() = 'service_role');

-- case_activity_log
ALTER TABLE case_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_see_external_activity" ON case_activity_log
  FOR SELECT USING (
    is_internal = false AND case_no IN (
      SELECT case_no FROM vtiger_cases_cache WHERE client_id = public.portal_user_client_id()
    )
  );
CREATE POLICY "admin_all_activity" ON case_activity_log FOR ALL USING (public.is_portal_admin());
CREATE POLICY "service_role_activity" ON case_activity_log FOR ALL USING (auth.role() = 'service_role');
