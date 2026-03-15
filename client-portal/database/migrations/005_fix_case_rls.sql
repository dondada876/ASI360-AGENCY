-- Phase J: Client Portal — Migration 005: Fix Case RLS Gaps
-- Adds INSERT policy for clients on case_activity_log
-- Adds UPDATE policy for clients on vtiger_cases_cache (own cases only)
-- These are defense-in-depth — API routes use service_role for writes,
-- but these policies protect against direct Supabase client misuse.

-- Allow clients to insert activity entries on their own cases (external only)
CREATE POLICY "clients_create_activity" ON case_activity_log
  FOR INSERT WITH CHECK (
    author_role = 'client'
    AND is_internal = false
    AND case_no IN (
      SELECT case_no FROM vtiger_cases_cache
      WHERE client_id = public.portal_user_client_id()
    )
  );

-- Allow clients to update their own cases (e.g., modified_at timestamp)
CREATE POLICY "clients_update_own_cases" ON vtiger_cases_cache
  FOR UPDATE USING (client_id = public.portal_user_client_id());
