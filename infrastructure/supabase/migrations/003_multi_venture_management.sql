-- ============================================
-- ASI 360 SUIS: Multi-Venture Management
-- Migration 003: Ventures, Tasks, Priorities, Time Tracking
-- ============================================

-- ============================================
-- VENTURES (Multi-Business Management)
-- ============================================

CREATE TABLE ventures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venture_name TEXT NOT NULL,
    legal_entity TEXT,
    doing_business_as TEXT,
    industry TEXT,
    venture_stage TEXT CHECK (venture_stage IN ('ideation', 'launch', 'traction', 'growth', 'scale', 'mature')),
    launch_date DATE,
    current_arr DECIMAL(12,2) DEFAULT 0,
    employee_count INTEGER DEFAULT 0,
    active_departments TEXT[], -- Array of CH codes currently active
    parent_venture_id UUID REFERENCES ventures(id),
    ownership_percentage DECIMAL(5,2) DEFAULT 100.00,
    strategic_priority TEXT CHECK (strategic_priority IN ('core', 'growth', 'experimental', 'divest', 'shutdown')),
    health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100),

    -- Metrics
    monthly_revenue DECIMAL(10,2),
    monthly_expenses DECIMAL(10,2),
    cash_balance DECIMAL(10,2),
    runway_months DECIMAL(4,1),

    -- Strategic
    mission_statement TEXT,
    current_focus TEXT,
    major_risks TEXT,
    next_milestone TEXT,
    milestone_due_date DATE,

    -- Integration
    vtiger_account_id TEXT,
    notion_workspace_id TEXT,

    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    modified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ventures_stage ON ventures(venture_stage);
CREATE INDEX idx_ventures_priority ON ventures(strategic_priority);
CREATE INDEX idx_ventures_health ON ventures(health_score);
CREATE INDEX idx_ventures_milestone_date ON ventures(milestone_due_date);

CREATE TRIGGER update_ventures_modified
BEFORE UPDATE ON ventures
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- ============================================
-- MASTER TASKS (Personal & Business)
-- ============================================

CREATE TABLE master_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Naming Convention Components
    task_identifier TEXT NOT NULL, -- #STRAT22, #Fitness01, etc.
    priority_level TEXT NOT NULL CHECK (priority_level IN ('P1', 'P2', 'P3', 'P4', 'P5', 'P6')),
    status TEXT NOT NULL CHECK (status IN ('S1', 'S2', 'S3', 'S4', 'S5')),
    task_category TEXT NOT NULL,

    -- Pomodoro Tracking
    pomodoros_total INTEGER DEFAULT 1,
    pomodoros_completed INTEGER DEFAULT 0,
    estimated_minutes INTEGER,
    actual_minutes INTEGER,

    -- Energy & Scheduling
    energy_level TEXT CHECK (energy_level IN ('E1', 'E2', 'E3', 'E4', 'E5')),
    preferred_time_of_day TEXT, -- 'morning', 'afternoon', 'evening'

    -- Department & Venture
    department_code TEXT NOT NULL, -- CH01.1, CH28.4, etc.
    venture_id UUID REFERENCES ventures(id),

    -- Task Details
    task_description TEXT NOT NULL,
    detailed_notes TEXT,

    -- Relationships
    related_project_id UUID REFERENCES projects(id),
    related_client_id UUID REFERENCES clients(id),
    parent_task_id UUID REFERENCES master_tasks(id),

    -- Scheduling
    due_date DATE,
    due_time TIME,
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    recurrence_pattern TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,

    -- Integration
    todoist_id TEXT,
    notion_task_id TEXT,
    gcal_event_id TEXT,

    -- Delegation
    assigned_to TEXT,
    delegatable BOOLEAN DEFAULT FALSE,
    delegation_instructions TEXT,

    -- Tracking
    blocked_by TEXT,
    blocking_tasks UUID[],
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    modified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_master_tasks_priority ON master_tasks(priority_level);
CREATE INDEX idx_master_tasks_status ON master_tasks(status);
CREATE INDEX idx_master_tasks_due_date ON master_tasks(due_date);
CREATE INDEX idx_master_tasks_venture ON master_tasks(venture_id);
CREATE INDEX idx_master_tasks_department ON master_tasks(department_code);
CREATE INDEX idx_master_tasks_energy ON master_tasks(energy_level);
CREATE INDEX idx_master_tasks_assigned ON master_tasks(assigned_to);
CREATE INDEX idx_master_tasks_identifier ON master_tasks(task_identifier);

CREATE TRIGGER update_tasks_modified
BEFORE UPDATE ON master_tasks
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- ============================================
-- CEO PRIORITIES (Daily/Weekly Focus)
-- ============================================

CREATE TABLE ceo_priorities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    priority_date DATE NOT NULL,
    priority_type TEXT CHECK (priority_type IN ('daily', 'weekly', 'monthly', 'quarterly')),
    priority_rank INTEGER, -- 1 = highest
    related_task_id UUID REFERENCES master_tasks(id),
    related_venture_id UUID REFERENCES ventures(id),
    priority_description TEXT NOT NULL,
    time_allocated_minutes INTEGER,
    actual_time_spent_minutes INTEGER,
    completion_percentage INTEGER DEFAULT 0,
    outcome_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_ceo_priorities_date ON ceo_priorities(priority_date);
CREATE INDEX idx_ceo_priorities_type ON ceo_priorities(priority_type);
CREATE INDEX idx_ceo_priorities_rank ON ceo_priorities(priority_rank);

-- ============================================
-- TIME ALLOCATION TRACKING
-- ============================================

CREATE TABLE ceo_time_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_date DATE NOT NULL,
    time_block_start TIME NOT NULL,
    time_block_end TIME NOT NULL,
    duration_minutes INTEGER,
    activity_type TEXT, -- 'deep_work', 'meetings', 'admin', 'family', 'health', 'legal'
    department_code TEXT,
    venture_id UUID REFERENCES ventures(id),
    related_task_id UUID REFERENCES master_tasks(id),
    energy_level_actual TEXT,
    productivity_rating INTEGER CHECK (productivity_rating >= 1 AND productivity_rating <= 5),
    activity_description TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_time_log_date ON ceo_time_log(log_date);
CREATE INDEX idx_time_log_type ON ceo_time_log(activity_type);
CREATE INDEX idx_time_log_venture ON ceo_time_log(venture_id);
CREATE INDEX idx_time_log_department ON ceo_time_log(department_code);

-- ============================================
-- STRATEGIC INITIATIVES (Cross-Venture)
-- ============================================

CREATE TABLE strategic_initiatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    initiative_name TEXT NOT NULL,
    initiative_type TEXT, -- 'growth', 'efficiency', 'innovation', 'transformation'
    strategic_pillar TEXT, -- 'revenue', 'operations', 'talent', 'technology', 'personal'
    ventures_involved UUID[], -- Array of venture IDs
    departments_involved TEXT[], -- Array of CH codes

    -- Timeline
    start_date DATE,
    target_completion DATE,
    actual_completion DATE,
    status TEXT CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),

    -- Metrics
    success_metrics JSONB,
    current_progress INTEGER DEFAULT 0, -- Percentage
    budget DECIMAL(10,2),
    actual_spend DECIMAL(10,2),
    roi_target DECIMAL(5,2), -- Percentage
    roi_actual DECIMAL(5,2),

    -- Ownership
    executive_sponsor TEXT, -- Usually CEO
    project_lead TEXT,
    team_members TEXT[],

    -- Details
    business_case TEXT,
    key_milestones JSONB,
    risks_and_mitigation TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    modified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_initiatives_status ON strategic_initiatives(status);
CREATE INDEX idx_initiatives_pillar ON strategic_initiatives(strategic_pillar);
CREATE INDEX idx_initiatives_completion_date ON strategic_initiatives(target_completion);

CREATE TRIGGER update_initiatives_modified
BEFORE UPDATE ON strategic_initiatives
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- ============================================
-- EXECUTIVE DECISIONS (Decision Log)
-- ============================================

CREATE TABLE executive_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_date DATE NOT NULL,
    decision_title TEXT NOT NULL,
    decision_type TEXT, -- 'strategic', 'financial', 'personnel', 'operational', 'personal'
    ventures_affected UUID[],
    departments_affected TEXT[],
    decision_context TEXT,
    options_considered JSONB,
    decision_made TEXT,
    reasoning TEXT,
    expected_outcome TEXT,
    actual_outcome TEXT,
    decision_quality_score INTEGER CHECK (decision_quality_score >= 1 AND decision_quality_score <= 5),
    revisit_date DATE,
    status TEXT CHECK (status IN ('pending', 'executed', 'monitoring', 'successful', 'failed', 'reversed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX idx_decisions_date ON executive_decisions(decision_date);
CREATE INDEX idx_decisions_type ON executive_decisions(decision_type);
CREATE INDEX idx_decisions_status ON executive_decisions(status);

-- ============================================
-- DAILY METRICS (Aggregated Performance Data)
-- ============================================

CREATE TABLE daily_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_date DATE NOT NULL UNIQUE,
    venture_id UUID REFERENCES ventures(id),

    -- Sales & Revenue
    new_leads INTEGER DEFAULT 0,
    qualified_leads INTEGER DEFAULT 0,
    meetings_scheduled INTEGER DEFAULT 0,
    meetings_held INTEGER DEFAULT 0,
    proposals_sent INTEGER DEFAULT 0,
    deals_closed INTEGER DEFAULT 0,
    revenue_closed DECIMAL(10,2) DEFAULT 0,

    -- Pipeline
    pipeline_value DECIMAL(10,2),
    pipeline_count INTEGER,

    -- Marketing
    website_visitors INTEGER DEFAULT 0,
    form_submissions INTEGER DEFAULT 0,
    email_opens INTEGER DEFAULT 0,
    email_clicks INTEGER DEFAULT 0,
    ad_spend DECIMAL(8,2) DEFAULT 0,
    ad_impressions INTEGER DEFAULT 0,
    ad_clicks INTEGER DEFAULT 0,

    -- Operations
    tasks_completed INTEGER DEFAULT 0,
    pomodoros_completed INTEGER DEFAULT 0,
    ceo_productive_hours DECIMAL(4,1) DEFAULT 0,

    -- Personal
    family_time_minutes INTEGER DEFAULT 0,
    health_activities_minutes INTEGER DEFAULT 0,
    sleep_hours DECIMAL(3,1),

    -- Financial
    daily_expenses DECIMAL(10,2) DEFAULT 0,
    daily_revenue DECIMAL(10,2) DEFAULT 0,
    legal_fund_balance DECIMAL(10,2),

    -- Metadata
    data_quality_score INTEGER CHECK (data_quality_score >= 0 AND data_quality_score <= 100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_daily_metrics_date ON daily_metrics(metric_date DESC);
CREATE INDEX idx_daily_metrics_venture ON daily_metrics(venture_id);

-- ============================================
-- TRIGGER: Auto-complete task when all pomodoros done
-- ============================================

CREATE OR REPLACE FUNCTION auto_complete_task()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.pomodoros_completed >= NEW.pomodoros_total AND NEW.status != 'S4' THEN
        NEW.status = 'S4';
        NEW.completed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_task_completion
BEFORE UPDATE ON master_tasks
FOR EACH ROW
EXECUTE FUNCTION auto_complete_task();

-- ============================================
-- TRIGGER: Auto-calculate time duration
-- ============================================

CREATE OR REPLACE FUNCTION calculate_time_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.time_block_start IS NOT NULL AND NEW.time_block_end IS NOT NULL THEN
        NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.time_block_end::time - NEW.time_block_start::time)) / 60;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_calculate_duration
BEFORE INSERT OR UPDATE ON ceo_time_log
FOR EACH ROW
EXECUTE FUNCTION calculate_time_duration();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE ventures IS 'Multi-venture portfolio management for CEO dashboard';
COMMENT ON TABLE master_tasks IS 'Unified task management across all ventures and personal life';
COMMENT ON TABLE ceo_priorities IS 'CEO daily/weekly/monthly focus priorities';
COMMENT ON TABLE ceo_time_log IS 'Time tracking for CEO activities across ventures';
COMMENT ON TABLE strategic_initiatives IS 'Major strategic initiatives spanning multiple ventures';
COMMENT ON TABLE executive_decisions IS 'Decision journal for tracking CEO decisions and outcomes';
COMMENT ON TABLE daily_metrics IS 'Aggregated daily metrics for dashboard and reporting';

COMMENT ON COLUMN ventures.health_score IS '0-100 score based on revenue, task completion, runway';
COMMENT ON COLUMN master_tasks.task_identifier IS 'Human-readable ID like #STRAT22, #Fitness01';
COMMENT ON COLUMN master_tasks.department_code IS 'Maps to ASI 360 department taxonomy (CH codes)';
COMMENT ON COLUMN ceo_time_log.productivity_rating IS '1-5 scale for actual productivity during time block';
