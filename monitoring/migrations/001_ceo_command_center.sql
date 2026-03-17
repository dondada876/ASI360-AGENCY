-- ═══════════════════════════════════════════════════════════════════
-- CEO Command Center — Unified Multi-Org Operational Intelligence
-- Migration 001: Core Tables
--
-- Purpose: Single source of truth for ALL business operations across
-- every organization (ASI 360, 500 Grand Live, ASEAGI, etc.)
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Organization Registry ───────────────────────────────────────
-- Every project, task, ticket, and dollar traces back to an org
CREATE TABLE IF NOT EXISTS ceo_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_code text NOT NULL UNIQUE,           -- 'ASI360', '500GL', 'ASEAGI', 'COACHSUSHI'
  org_name text NOT NULL,                  -- 'ASI 360 Security & Integration'
  org_type text NOT NULL CHECK (org_type IN (
    'security_integration',  -- ASI 360 core business
    'food_hall',             -- 500 Grand Live
    'legal_tech',            -- ASEAGI
    'restaurant',            -- Coach Sushi, vendor operations
    'software',              -- Internal dev / SaaS products
    'holding'                -- 500 Grand Live LLC (parent entity)
  )),
  timezone text DEFAULT 'America/Los_Angeles',
  team_count int DEFAULT 0,
  monthly_budget numeric(12,2) DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active','dormant','archived')),
  airtable_base_id text,                   -- Linked Airtable base
  supabase_project_id text,                -- Linked Supabase project
  vtiger_org_id text,                      -- VTiger Account record ID
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Seed the known organizations
INSERT INTO ceo_organizations (org_code, org_name, org_type, airtable_base_id) VALUES
  ('ASI360',     'ASI 360 Security & Integration',  'security_integration', 'appVJojlb8dXV07Sb'),
  ('500GL',      '500 Grand Live Food Hall',         'food_hall',            'appzvSjPs7r8k3iDU'),
  ('ASEAGI',     'ASEAGI Legal Intelligence',        'legal_tech',           NULL),
  ('COACHSUSHI', 'Coach Sushi',                      'restaurant',           NULL),
  ('500GL_LLC',  '500 Grand Live LLC',               'holding',              NULL)
ON CONFLICT (org_code) DO NOTHING;


-- ── 2. Intent/Impact Taxonomy ──────────────────────────────────────
-- Every project, task, and activity gets tagged for CEO prioritization
CREATE TABLE IF NOT EXISTS ceo_intent_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  color text,                              -- Hex color for dashboard rendering
  priority_weight int DEFAULT 1,           -- Higher = more important when scoring
  created_at timestamptz DEFAULT now()
);

INSERT INTO ceo_intent_categories (code, name, description, color, priority_weight) VALUES
  ('revenue',       'Revenue Generation',   'Directly produces income — contracts, upsells, new clients',    '#38761D', 10),
  ('cost_reduction','Cost Reduction',        'Reduces operational spend — automation, vendor renegotiation',  '#0B5394', 8),
  ('growth',        'Growth',               'Market expansion, new verticals, partnerships',                 '#6A329F', 9),
  ('infrastructure','Infrastructure',        'Builds capability — platforms, tooling, architecture',          '#B85B22', 6),
  ('compliance',    'Compliance',            'Legal, regulatory, licensing obligations (non-negotiable)',      '#CC0000', 7),
  ('maintenance',   'Maintenance',           'Keeping existing systems running — updates, renewals, fixes',   '#78909C', 3),
  ('rd',            'R&D',                  'Speculative/experimental — POCs, research, prototypes',          '#9900FF', 4)
ON CONFLICT (code) DO NOTHING;


-- ── 3. Team Members Registry ───────────────────────────────────────
-- All human resources across all organizations
CREATE TABLE IF NOT EXISTS ceo_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES ceo_organizations(id),
  name text NOT NULL,
  role text NOT NULL,                      -- 'ceo', 'developer', 'field_tech', 'designer', 'va'
  location text,                           -- 'Oakland, CA', 'Manila, PH', 'Cebu, PH'
  timezone text DEFAULT 'America/Los_Angeles',
  hourly_rate numeric(8,2),
  capacity_hours_per_week numeric(5,1) DEFAULT 40,
  billable_target_pct numeric(5,1) DEFAULT 70,  -- Target 70% billable
  skills text[],                           -- ['python', 'wordpress', 'security_install', 'design']
  availability_status text DEFAULT 'available' CHECK (availability_status IN (
    'available', 'busy', 'overloaded', 'on_leave', 'inactive'
  )),
  email text,
  telegram_id text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);


-- ── 4. Unified Activity Stream ─────────────────────────────────────
-- THE BACKBONE: Every event across every org flows here.
-- This is your daily briefing, weekly scorecard, and risk detection system.
CREATE TABLE IF NOT EXISTS ceo_activity_stream (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES ceo_organizations(id),
  actor text NOT NULL,                     -- 'Don Bucknor', 'System', 'Gateway', team member name
  actor_location text,                     -- 'US', 'PH' — for follow-the-sun tracking
  action text NOT NULL CHECK (action IN (
    'created', 'updated', 'completed', 'escalated', 'assigned',
    'commented', 'invoiced', 'paid', 'deployed', 'failed',
    'approved', 'rejected', 'deferred', 'cancelled'
  )),
  entity_type text NOT NULL CHECK (entity_type IN (
    'project', 'task', 'ticket', 'case', 'invoice', 'payment',
    'quote', 'change_order', 'deployment', 'incident', 'meeting',
    'handoff', 'decision', 'milestone', 'communication'
  )),
  entity_id text,                          -- Cross-system reference (PROJ378, TT-987, CC-543, INV-001)
  entity_name text,                        -- Human-readable: "Goldman Law Firm Access Control"
  summary text NOT NULL,                   -- One-liner: "Completed Phase 3 installation"
  intent_category text REFERENCES ceo_intent_categories(code),
  impact_level text DEFAULT 'medium' CHECK (impact_level IN ('critical','high','medium','low')),
  time_horizon text DEFAULT 'immediate' CHECK (time_horizon IN ('immediate','short_term','long_term')),
  source_system text CHECK (source_system IN (
    'supabase', 'airtable', 'vtiger', 'gateway', 'grafana',
    'sentinel', 'github', 'manual', 'n8n', 'telegram'
  )),
  metadata jsonb DEFAULT '{}',             -- System-specific payload
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_activity_org ON ceo_activity_stream(org_id, created_at DESC);
CREATE INDEX idx_activity_type ON ceo_activity_stream(entity_type, created_at DESC);
CREATE INDEX idx_activity_intent ON ceo_activity_stream(intent_category, created_at DESC);
CREATE INDEX idx_activity_impact ON ceo_activity_stream(impact_level, created_at DESC);
CREATE INDEX idx_activity_actor ON ceo_activity_stream(actor, created_at DESC);
CREATE INDEX idx_activity_24h ON ceo_activity_stream(created_at DESC)
  WHERE created_at > now() - interval '24 hours';


-- ── 5. CEO Scorecard KPIs ──────────────────────────────────────────
-- Weekly metrics with targets — the EOS Scorecard pattern
CREATE TABLE IF NOT EXISTS ceo_scorecard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES ceo_organizations(id),  -- NULL = portfolio-wide
  metric_code text NOT NULL,               -- 'cash_on_hand', 'open_tickets_critical', 'dso'
  metric_name text NOT NULL,               -- 'Cash on Hand'
  category text CHECK (category IN (
    'financial', 'operations', 'delivery', 'team', 'risk', 'growth'
  )),
  current_value numeric(14,2),
  target_value numeric(14,2),
  unit text DEFAULT 'count',               -- 'count', 'dollars', 'percent', 'hours', 'days'
  status text GENERATED ALWAYS AS (
    CASE
      WHEN target_value IS NULL THEN 'no_target'
      WHEN unit IN ('dollars', 'count', 'percent') AND current_value >= target_value THEN 'on_track'
      WHEN unit IN ('days', 'hours') AND current_value <= target_value THEN 'on_track'
      ELSE 'off_track'
    END
  ) STORED,
  trend text DEFAULT 'flat' CHECK (trend IN ('up','down','flat')),
  period_start date,
  period_end date,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_scorecard_org ON ceo_scorecard(org_id, metric_code);


-- ── 6. CEO Rocks (Quarterly Priorities — EOS) ──────────────────────
-- 3-7 priorities per quarter, the EOS "Rocks" pattern
CREATE TABLE IF NOT EXISTS ceo_rocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES ceo_organizations(id),  -- NULL = company-wide
  quarter text NOT NULL,                   -- '2026-Q1', '2026-Q2'
  title text NOT NULL,                     -- 'Launch Client Portal'
  description text,
  owner text NOT NULL,                     -- Team member name
  intent_category text REFERENCES ceo_intent_categories(code),
  impact_level text DEFAULT 'high',
  status text DEFAULT 'on_track' CHECK (status IN ('on_track','off_track','completed','dropped')),
  completion_pct numeric(5,1) DEFAULT 0,
  linked_projects text[],                  -- ['PROJ378', 'PROJ369']
  target_date date,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);


-- ── 7. Financial Pipeline ──────────────────────────────────────────
-- Track every dollar: Proposal → Contract → Work → Invoice → Payment
CREATE TABLE IF NOT EXISTS ceo_financial_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES ceo_organizations(id),
  reference_no text NOT NULL,              -- 'QUO202366', 'INV-2026-042', 'PROJ364'
  entity_type text CHECK (entity_type IN ('quote','contract','invoice','payment')),
  client_name text NOT NULL,
  amount numeric(12,2) NOT NULL,
  status text CHECK (status IN (
    'draft', 'sent', 'signed', 'in_progress', 'invoiced',
    'paid', 'overdue', 'cancelled', 'disputed'
  )),
  -- Pipeline timestamps (for velocity tracking)
  proposal_sent_at timestamptz,
  contract_signed_at timestamptz,
  work_started_at timestamptz,
  milestone_completed_at timestamptz,
  invoice_sent_at timestamptz,
  payment_received_at timestamptz,
  -- Computed velocity
  days_to_close int GENERATED ALWAYS AS (
    CASE WHEN contract_signed_at IS NOT NULL AND proposal_sent_at IS NOT NULL
      THEN EXTRACT(DAY FROM contract_signed_at - proposal_sent_at)::int
    END
  ) STORED,
  days_sales_outstanding int GENERATED ALWAYS AS (
    CASE WHEN payment_received_at IS NOT NULL AND invoice_sent_at IS NOT NULL
      THEN EXTRACT(DAY FROM payment_received_at - invoice_sent_at)::int
    END
  ) STORED,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_financial_org ON ceo_financial_pipeline(org_id, status);
CREATE INDEX idx_financial_overdue ON ceo_financial_pipeline(status)
  WHERE status = 'overdue';


-- ── 8. Daily Handoff Notes (Follow-the-Sun) ────────────────────────
-- Structured async communication between CEO and PH team
CREATE TABLE IF NOT EXISTS ceo_handoff_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author text NOT NULL,                    -- Team member name
  author_location text,                    -- 'PH', 'US'
  author_timezone text,                    -- 'Asia/Manila', 'America/Los_Angeles'
  handoff_date date NOT NULL DEFAULT CURRENT_DATE,
  -- Structured sections
  completed_today text[],                  -- What was done
  blocked_items text[],                    -- What's stuck and why
  decisions_needed text[],                 -- What requires CEO input
  planned_tomorrow text[],                 -- What's next
  hours_worked numeric(4,1),
  mood text CHECK (mood IN ('great','good','okay','struggling')),  -- Team health signal
  notes text,                              -- Free-form additional context
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_handoff_date ON ceo_handoff_notes(handoff_date DESC);


-- ── 9. Risk Register (Cross-Org) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS ceo_risk_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES ceo_organizations(id),
  risk_title text NOT NULL,
  risk_category text CHECK (risk_category IN (
    'key_person', 'client_concentration', 'cash_flow',
    'regulatory', 'technology_debt', 'vendor_dependency',
    'market', 'operational', 'security'
  )),
  likelihood text CHECK (likelihood IN ('low','medium','high')),
  impact text CHECK (impact IN ('low','medium','high','critical')),
  -- Risk score: auto-computed for sorting
  risk_score int GENERATED ALWAYS AS (
    (CASE likelihood WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END) *
    (CASE impact WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END)
  ) STORED,
  mitigation text,
  owner text,
  status text DEFAULT 'open' CHECK (status IN ('open','mitigated','accepted','closed')),
  review_date date,
  created_at timestamptz DEFAULT now()
);


-- ── 10. Utilization Tracking (Half-Day Blocks) ────────────────────
-- Track team utilization without over-instrumenting
CREATE TABLE IF NOT EXISTS ceo_utilization_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES ceo_team_members(id),
  org_id uuid REFERENCES ceo_organizations(id),
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  block text NOT NULL CHECK (block IN ('morning','afternoon')),  -- Half-day blocks
  hours numeric(4,1) DEFAULT 4,
  project_ref text,                        -- PROJ378, or 'internal', 'admin', 'training'
  intent_category text REFERENCES ceo_intent_categories(code),
  is_billable boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(member_id, log_date, block)
);

CREATE INDEX idx_utilization_member ON ceo_utilization_log(member_id, log_date DESC);
CREATE INDEX idx_utilization_org ON ceo_utilization_log(org_id, log_date DESC);


-- ── Views for Dashboard Queries ────────────────────────────────────

-- Daily CEO briefing: last 24h activity across all orgs
CREATE OR REPLACE VIEW ceo_daily_briefing AS
SELECT
  a.created_at,
  o.org_code,
  a.actor,
  a.action,
  a.entity_type,
  a.entity_id,
  a.summary,
  ic.name as intent_name,
  a.impact_level,
  a.source_system
FROM ceo_activity_stream a
LEFT JOIN ceo_organizations o ON o.id = a.org_id
LEFT JOIN ceo_intent_categories ic ON ic.code = a.intent_category
WHERE a.created_at > now() - interval '24 hours'
ORDER BY a.created_at DESC;

-- Portfolio health: open projects + compliance scores per org
CREATE OR REPLACE VIEW ceo_portfolio_health AS
SELECT
  o.org_code,
  o.org_name,
  COUNT(p.id) as project_count,
  COUNT(p.id) FILTER (WHERE p.project_status IN ('in_progress','in progress')) as active_projects,
  COUNT(p.id) FILTER (WHERE p.project_status = 'initiated') as initiated_projects,
  COUNT(p.id) FILTER (WHERE p.project_status = 'completed') as completed_projects
FROM ceo_organizations o
LEFT JOIN asi360_projects p ON TRUE  -- Will be joined by org mapping
WHERE o.status = 'active'
GROUP BY o.org_code, o.org_name;

-- Weekly scorecard: all KPIs with on/off track status
CREATE OR REPLACE VIEW ceo_weekly_scorecard AS
SELECT
  COALESCE(o.org_code, 'PORTFOLIO') as org,
  s.metric_name,
  s.category,
  s.current_value,
  s.target_value,
  s.unit,
  s.status,
  s.trend,
  s.updated_at
FROM ceo_scorecard s
LEFT JOIN ceo_organizations o ON o.id = s.org_id
ORDER BY
  CASE s.status WHEN 'off_track' THEN 0 ELSE 1 END,
  CASE s.category WHEN 'financial' THEN 0 WHEN 'operations' THEN 1 WHEN 'delivery' THEN 2 ELSE 3 END;

-- Utilization report: weekly team utilization rates
CREATE OR REPLACE VIEW ceo_utilization_report AS
SELECT
  m.name,
  m.role,
  m.location,
  o.org_code,
  u.log_date,
  SUM(u.hours) as total_hours,
  SUM(u.hours) FILTER (WHERE u.is_billable) as billable_hours,
  ROUND(
    (SUM(u.hours) FILTER (WHERE u.is_billable) / NULLIF(SUM(u.hours), 0)) * 100, 1
  ) as billable_pct,
  m.billable_target_pct as target_pct
FROM ceo_utilization_log u
JOIN ceo_team_members m ON m.id = u.member_id
LEFT JOIN ceo_organizations o ON o.id = u.org_id
GROUP BY m.name, m.role, m.location, o.org_code, u.log_date, m.billable_target_pct;

-- Financial velocity: cash conversion metrics
CREATE OR REPLACE VIEW ceo_financial_velocity AS
SELECT
  o.org_code,
  f.reference_no,
  f.client_name,
  f.amount,
  f.status,
  f.days_to_close,
  f.days_sales_outstanding,
  CASE
    WHEN f.status = 'overdue' THEN 'ACTION_REQUIRED'
    WHEN f.days_sales_outstanding > 30 THEN 'WARNING'
    ELSE 'OK'
  END as health
FROM ceo_financial_pipeline f
LEFT JOIN ceo_organizations o ON o.id = f.org_id
WHERE f.status NOT IN ('cancelled', 'paid')
ORDER BY
  CASE f.status WHEN 'overdue' THEN 0 WHEN 'invoiced' THEN 1 ELSE 2 END,
  f.amount DESC;
