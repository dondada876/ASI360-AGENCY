-- ============================================
-- ASI 360 SUIS: Row Level Security (RLS)
-- Migration 005: Security Policies for Multi-User Access
-- ============================================

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventures ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ceo_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE ceo_time_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategic_initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE executive_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CEO FULL ACCESS POLICIES
-- Replace 'ceo@asi360.com' with actual CEO email
-- ============================================

-- CEO has full access to all tables
CREATE POLICY "CEO full access to clients"
ON clients FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'ceo@asi360.com')
WITH CHECK (auth.jwt() ->> 'email' = 'ceo@asi360.com');

CREATE POLICY "CEO full access to contacts"
ON contacts FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'ceo@asi360.com')
WITH CHECK (auth.jwt() ->> 'email' = 'ceo@asi360.com');

CREATE POLICY "CEO full access to projects"
ON projects FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'ceo@asi360.com')
WITH CHECK (auth.jwt() ->> 'email' = 'ceo@asi360.com');

CREATE POLICY "CEO full access to communications"
ON communications FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'ceo@asi360.com')
WITH CHECK (auth.jwt() ->> 'email' = 'ceo@asi360.com');

CREATE POLICY "CEO full access to opportunities"
ON opportunities FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'ceo@asi360.com')
WITH CHECK (auth.jwt() ->> 'email' = 'ceo@asi360.com');

CREATE POLICY "CEO full access to revenue_tracking"
ON revenue_tracking FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'ceo@asi360.com')
WITH CHECK (auth.jwt() ->> 'email' = 'ceo@asi360.com');

CREATE POLICY "CEO full access to marketing_campaigns"
ON marketing_campaigns FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'ceo@asi360.com')
WITH CHECK (auth.jwt() ->> 'email' = 'ceo@asi360.com');

CREATE POLICY "CEO full access to leads"
ON leads FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'ceo@asi360.com')
WITH CHECK (auth.jwt() ->> 'email' = 'ceo@asi360.com');

CREATE POLICY "CEO full access to ventures"
ON ventures FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'ceo@asi360.com')
WITH CHECK (auth.jwt() ->> 'email' = 'ceo@asi360.com');

CREATE POLICY "CEO full access to master_tasks"
ON master_tasks FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'ceo@asi360.com')
WITH CHECK (auth.jwt() ->> 'email' = 'ceo@asi360.com');

CREATE POLICY "CEO full access to ceo_priorities"
ON ceo_priorities FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'ceo@asi360.com')
WITH CHECK (auth.jwt() ->> 'email' = 'ceo@asi360.com');

CREATE POLICY "CEO full access to ceo_time_log"
ON ceo_time_log FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'ceo@asi360.com')
WITH CHECK (auth.jwt() ->> 'email' = 'ceo@asi360.com');

CREATE POLICY "CEO full access to strategic_initiatives"
ON strategic_initiatives FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'ceo@asi360.com')
WITH CHECK (auth.jwt() ->> 'email' = 'ceo@asi360.com');

CREATE POLICY "CEO full access to executive_decisions"
ON executive_decisions FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'ceo@asi360.com')
WITH CHECK (auth.jwt() ->> 'email' = 'ceo@asi360.com');

CREATE POLICY "CEO full access to daily_metrics"
ON daily_metrics FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'ceo@asi360.com')
WITH CHECK (auth.jwt() ->> 'email' = 'ceo@asi360.com');

-- ============================================
-- TEAM MEMBER POLICIES (Sales, Operations, etc.)
-- ============================================

-- Team members can view clients they're assigned to
CREATE POLICY "Team member client access"
ON clients FOR SELECT
TO authenticated
USING (
    auth.jwt() ->> 'email' = 'ceo@asi360.com' OR
    EXISTS (
        SELECT 1 FROM opportunities
        WHERE opportunities.client_id = clients.id
        AND opportunities.assigned_to = auth.jwt() ->> 'email'
    ) OR
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.client_id = clients.id
        AND (
            projects.project_manager = auth.jwt() ->> 'email' OR
            auth.jwt() ->> 'email' = ANY(projects.assigned_team)
        )
    )
);

-- Team members can manage their own opportunities
CREATE POLICY "Team member opportunity access"
ON opportunities FOR ALL
TO authenticated
USING (
    auth.jwt() ->> 'email' = 'ceo@asi360.com' OR
    assigned_to = auth.jwt() ->> 'email'
)
WITH CHECK (
    auth.jwt() ->> 'email' = 'ceo@asi360.com' OR
    assigned_to = auth.jwt() ->> 'email'
);

-- Team members can manage their own leads
CREATE POLICY "Team member lead access"
ON leads FOR ALL
TO authenticated
USING (
    auth.jwt() ->> 'email' = 'ceo@asi360.com' OR
    assigned_to = auth.jwt() ->> 'email'
)
WITH CHECK (
    auth.jwt() ->> 'email' = 'ceo@asi360.com' OR
    assigned_to = auth.jwt() ->> 'email'
);

-- Team members can view and manage their assigned tasks
CREATE POLICY "Team member task access"
ON master_tasks FOR ALL
TO authenticated
USING (
    auth.jwt() ->> 'email' = 'ceo@asi360.com' OR
    assigned_to = auth.jwt() ->> 'email'
)
WITH CHECK (
    auth.jwt() ->> 'email' = 'ceo@asi360.com' OR
    assigned_to = auth.jwt() ->> 'email'
);

-- Team members can view projects they're assigned to
CREATE POLICY "Team member project access"
ON projects FOR SELECT
TO authenticated
USING (
    auth.jwt() ->> 'email' = 'ceo@asi360.com' OR
    project_manager = auth.jwt() ->> 'email' OR
    auth.jwt() ->> 'email' = ANY(assigned_team)
);

-- Team members can insert communications for their clients/projects
CREATE POLICY "Team member communication access"
ON communications FOR ALL
TO authenticated
USING (
    auth.jwt() ->> 'email' = 'ceo@asi360.com' OR
    EXISTS (
        SELECT 1 FROM opportunities
        WHERE opportunities.client_id = communications.client_id
        AND opportunities.assigned_to = auth.jwt() ->> 'email'
    )
)
WITH CHECK (
    auth.jwt() ->> 'email' = 'ceo@asi360.com' OR
    from_person = auth.jwt() ->> 'email'
);

-- ============================================
-- CLIENT PORTAL POLICIES (For external clients)
-- ============================================

-- Clients can view their own client record
CREATE POLICY "Client self access"
ON clients FOR SELECT
TO authenticated
USING (
    email = auth.jwt() ->> 'email' OR
    EXISTS (
        SELECT 1 FROM contacts
        WHERE contacts.client_id = clients.id
        AND contacts.email = auth.jwt() ->> 'email'
    )
);

-- Clients can view their own projects
CREATE POLICY "Client project access"
ON projects FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM clients
        WHERE clients.id = projects.client_id
        AND (
            clients.email = auth.jwt() ->> 'email' OR
            EXISTS (
                SELECT 1 FROM contacts
                WHERE contacts.client_id = clients.id
                AND contacts.email = auth.jwt() ->> 'email'
            )
        )
    )
);

-- Clients can view their own communications
CREATE POLICY "Client communication access"
ON communications FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM clients
        WHERE clients.id = communications.client_id
        AND (
            clients.email = auth.jwt() ->> 'email' OR
            EXISTS (
                SELECT 1 FROM contacts
                WHERE contacts.client_id = clients.id
                AND contacts.email = auth.jwt() ->> 'email'
            )
        )
    )
);

-- ============================================
-- SERVICE ROLE BYPASS (For API and automated processes)
-- ============================================

-- Service role can do anything (used by MCP server, N8N, etc.)
CREATE POLICY "Service role bypass all"
ON clients FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role bypass opportunities"
ON opportunities FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role bypass leads"
ON leads FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role bypass revenue"
ON revenue_tracking FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role bypass campaigns"
ON marketing_campaigns FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role bypass ventures"
ON ventures FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role bypass tasks"
ON master_tasks FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role bypass time_log"
ON ceo_time_log FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role bypass daily_metrics"
ON daily_metrics FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- ANONYMOUS PUBLIC ACCESS (For lead forms)
-- ============================================

-- Allow anonymous users to insert leads (for website forms)
CREATE POLICY "Public lead insertion"
ON leads FOR INSERT
TO anon
WITH CHECK (true);

-- ============================================
-- HELPER FUNCTION: Check if user is CEO
-- ============================================

CREATE OR REPLACE FUNCTION is_ceo()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth.jwt() ->> 'email' = 'ceo@asi360.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON POLICY "CEO full access to clients" ON clients IS 'CEO has unrestricted access to all client data';
COMMENT ON POLICY "Team member client access" ON clients IS 'Team members can view clients they work with';
COMMENT ON POLICY "Client self access" ON clients IS 'Clients can view their own company data';
COMMENT ON POLICY "Public lead insertion" ON leads IS 'Allow website forms to create leads anonymously';
COMMENT ON FUNCTION is_ceo IS 'Helper function to check if current user is CEO';

-- ============================================
-- USAGE NOTES
-- ============================================

-- To update CEO email after initial setup:
-- UPDATE auth.users SET email = 'newemail@asi360.com' WHERE email = 'ceo@asi360.com';
-- Then update all policies referencing 'ceo@asi360.com'

-- To grant team member access:
-- 1. Create user in Supabase Auth
-- 2. Assign them to opportunities/projects
-- 3. Policies will automatically grant access

-- To grant client portal access:
-- 1. Create user with client's email in Supabase Auth
-- 2. Ensure client.email or contact.email matches
-- 3. Policies will automatically grant read-only access
