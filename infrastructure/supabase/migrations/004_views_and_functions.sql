-- ============================================
-- ASI 360 SUIS: Views and Functions
-- Migration 004: Dashboard Views and Helper Functions
-- ============================================

-- ============================================
-- PORTFOLIO HEALTH VIEW
-- ============================================

CREATE VIEW v_portfolio_health AS
SELECT
    v.venture_name,
    v.venture_stage,
    v.strategic_priority,
    v.health_score,
    v.current_arr,
    v.employee_count,
    v.runway_months,
    COUNT(DISTINCT t.id) FILTER (WHERE t.priority_level IN ('P1', 'P2')) as critical_tasks,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'S1' AND t.due_date < CURRENT_DATE) as overdue_tasks,
    v.next_milestone,
    v.milestone_due_date,
    CASE
        WHEN v.health_score >= 80 THEN 'healthy'
        WHEN v.health_score >= 60 THEN 'caution'
        ELSE 'critical'
    END as health_status
FROM ventures v
LEFT JOIN master_tasks t ON v.id = t.venture_id
WHERE v.strategic_priority != 'shutdown'
GROUP BY v.id, v.venture_name, v.venture_stage, v.strategic_priority,
         v.health_score, v.current_arr, v.employee_count, v.runway_months,
         v.next_milestone, v.milestone_due_date
ORDER BY
    CASE v.strategic_priority
        WHEN 'core' THEN 1
        WHEN 'growth' THEN 2
        WHEN 'experimental' THEN 3
        ELSE 4
    END,
    v.health_score ASC;

-- ============================================
-- SALES PIPELINE VIEW
-- ============================================

CREATE VIEW v_sales_pipeline AS
SELECT
    o.stage,
    COUNT(*) as opportunity_count,
    SUM(o.estimated_value) as total_value,
    SUM(o.weighted_value) as weighted_value,
    AVG(o.probability) as avg_probability,
    MIN(o.expected_close_date) as earliest_close,
    MAX(o.expected_close_date) as latest_close
FROM opportunities o
WHERE o.stage NOT IN ('closed-won', 'closed-lost')
GROUP BY o.stage
ORDER BY
    CASE o.stage
        WHEN 'prospecting' THEN 1
        WHEN 'qualification' THEN 2
        WHEN 'proposal' THEN 3
        WHEN 'negotiation' THEN 4
        ELSE 5
    END;

-- ============================================
-- MONTHLY REVENUE TREND VIEW
-- ============================================

CREATE VIEW v_monthly_revenue AS
SELECT
    DATE_TRUNC('month', transaction_date) as month,
    revenue_type,
    service_line,
    SUM(amount) as total_revenue,
    COUNT(*) as transaction_count,
    AVG(amount) as avg_transaction_value
FROM revenue_tracking
WHERE payment_status = 'paid'
    AND transaction_type IN ('invoice', 'payment')
GROUP BY DATE_TRUNC('month', transaction_date), revenue_type, service_line
ORDER BY month DESC, total_revenue DESC;

-- ============================================
-- LEAD CONVERSION FUNNEL VIEW
-- ============================================

CREATE VIEW v_lead_funnel AS
SELECT
    lead_source,
    COUNT(*) as total_leads,
    COUNT(*) FILTER (WHERE lead_status = 'qualified') as qualified_leads,
    COUNT(*) FILTER (WHERE lead_status = 'converted') as converted_leads,
    ROUND(COUNT(*) FILTER (WHERE lead_status = 'qualified')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2) as qualification_rate,
    ROUND(COUNT(*) FILTER (WHERE lead_status = 'converted')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2) as conversion_rate,
    ROUND(AVG(lead_score), 2) as avg_lead_score
FROM leads
GROUP BY lead_source
ORDER BY total_leads DESC;

-- ============================================
-- CEO DAILY FOCUS VIEW
-- ============================================

CREATE VIEW v_ceo_daily_focus AS
SELECT
    cp.priority_rank,
    cp.priority_description,
    mt.task_identifier,
    mt.priority_level,
    mt.energy_level,
    mt.pomodoros_total,
    mt.estimated_minutes,
    v.venture_name,
    mt.department_code,
    cp.time_allocated_minutes,
    mt.task_description
FROM ceo_priorities cp
LEFT JOIN master_tasks mt ON cp.related_task_id = mt.id
LEFT JOIN ventures v ON cp.related_venture_id = v.id
WHERE cp.priority_date = CURRENT_DATE
    AND cp.priority_type = 'daily'
ORDER BY cp.priority_rank;

-- ============================================
-- RESOURCE ALLOCATION VIEW
-- ============================================

CREATE VIEW v_resource_allocation AS
SELECT
    v.venture_name,
    v.strategic_priority,
    COUNT(DISTINCT t.id) as total_tasks,
    SUM(t.estimated_minutes) as estimated_time_minutes,
    ROUND(SUM(t.estimated_minutes) / 60.0, 1) as estimated_time_hours,
    COUNT(DISTINCT t.assigned_to) as team_members_assigned,
    SUM(CASE WHEN t.priority_level IN ('P1', 'P2') THEN 1 ELSE 0 END) as high_priority_tasks,
    ROUND(AVG(CASE WHEN t.status = 'S4' THEN 1.0 ELSE 0.0 END) * 100, 2) as completion_rate
FROM ventures v
LEFT JOIN master_tasks t ON v.id = t.venture_id
WHERE t.status NOT IN ('S4', 'S5')
    AND v.strategic_priority IN ('core', 'growth')
GROUP BY v.id, v.venture_name, v.strategic_priority
ORDER BY high_priority_tasks DESC;

-- ============================================
-- WEEKLY TIME ALLOCATION VIEW
-- ============================================

CREATE VIEW v_weekly_time_allocation AS
SELECT
    DATE_TRUNC('week', ctl.log_date) as week_start,
    ctl.activity_type,
    v.venture_name,
    SUM(ctl.duration_minutes) as total_minutes,
    ROUND(SUM(ctl.duration_minutes)::DECIMAL / 60, 1) as total_hours,
    COUNT(*) as session_count,
    ROUND(AVG(ctl.productivity_rating)::DECIMAL, 2) as avg_productivity,
    ROUND(SUM(ctl.duration_minutes)::DECIMAL / NULLIF(SUM(SUM(ctl.duration_minutes)) OVER (PARTITION BY DATE_TRUNC('week', ctl.log_date)), 0) * 100, 1) as percentage_of_week
FROM ceo_time_log ctl
LEFT JOIN ventures v ON ctl.venture_id = v.id
WHERE ctl.log_date >= CURRENT_DATE - INTERVAL '12 weeks'
GROUP BY DATE_TRUNC('week', ctl.log_date), ctl.activity_type, v.venture_name
ORDER BY week_start DESC, total_minutes DESC;

-- ============================================
-- LIFE BALANCE METRICS VIEW
-- ============================================

CREATE VIEW v_life_balance_metrics AS
SELECT
    ctl.log_date,
    SUM(CASE WHEN ctl.department_code LIKE 'CH28%' OR ctl.department_code LIKE 'CH29%' THEN ctl.duration_minutes ELSE 0 END) as personal_minutes,
    SUM(CASE WHEN ctl.department_code NOT LIKE 'CH28%' AND ctl.department_code NOT LIKE 'CH29%' THEN ctl.duration_minutes ELSE 0 END) as business_minutes,
    SUM(CASE WHEN ctl.activity_type = 'family' THEN ctl.duration_minutes ELSE 0 END) as family_minutes,
    SUM(CASE WHEN ctl.activity_type = 'health' THEN ctl.duration_minutes ELSE 0 END) as health_minutes,
    SUM(CASE WHEN ctl.activity_type = 'legal' THEN ctl.duration_minutes ELSE 0 END) as legal_minutes,
    ROUND((SUM(CASE WHEN ctl.activity_type = 'family' THEN ctl.duration_minutes ELSE 0 END) / 60.0), 2) as family_hours
FROM ceo_time_log ctl
WHERE ctl.log_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY ctl.log_date
ORDER BY ctl.log_date DESC;

-- ============================================
-- CLIENT HEALTH VIEW
-- ============================================

CREATE VIEW v_client_health AS
SELECT
    c.id,
    c.company_name,
    c.client_type,
    c.monthly_recurring_revenue,
    c.lifetime_value,
    COALESCE(DATE_PART('day', CURRENT_DATE - c.last_contact_date), 999) as days_since_contact,
    COUNT(DISTINCT p.id) as active_projects,
    COUNT(DISTINCT o.id) FILTER (WHERE o.stage NOT IN ('closed-won', 'closed-lost')) as open_opportunities,
    CASE
        WHEN c.last_contact_date IS NULL THEN 'needs_attention'
        WHEN CURRENT_DATE - c.last_contact_date > 30 THEN 'at_risk'
        WHEN CURRENT_DATE - c.last_contact_date > 14 THEN 'check_in_needed'
        ELSE 'healthy'
    END as contact_health,
    CASE
        WHEN c.monthly_recurring_revenue > 5000 THEN 'high_value'
        WHEN c.monthly_recurring_revenue > 1000 THEN 'medium_value'
        ELSE 'low_value'
    END as value_tier
FROM clients c
LEFT JOIN projects p ON c.id = p.client_id AND p.status = 'active'
LEFT JOIN opportunities o ON c.id = o.client_id
WHERE c.client_type IN ('active', 'prospect')
GROUP BY c.id, c.company_name, c.client_type, c.monthly_recurring_revenue,
         c.lifetime_value, c.last_contact_date
ORDER BY c.monthly_recurring_revenue DESC NULLS LAST;

-- ============================================
-- FUNCTION: Calculate Venture Health Score
-- ============================================

CREATE OR REPLACE FUNCTION calculate_venture_health(venture_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    health_score INTEGER := 0;
    revenue_score INTEGER;
    task_score INTEGER;
    runway_score INTEGER;
BEGIN
    -- Revenue health (40 points max)
    SELECT CASE
        WHEN monthly_revenue > monthly_expenses * 1.5 THEN 40
        WHEN monthly_revenue > monthly_expenses THEN 30
        WHEN monthly_revenue > monthly_expenses * 0.75 THEN 20
        ELSE 10
    END INTO revenue_score
    FROM ventures
    WHERE id = venture_uuid;

    -- Task completion health (30 points max)
    SELECT CASE
        WHEN completion_rate >= 0.80 THEN 30
        WHEN completion_rate >= 0.60 THEN 20
        WHEN completion_rate >= 0.40 THEN 10
        ELSE 5
    END INTO task_score
    FROM (
        SELECT AVG(CASE WHEN status = 'S4' THEN 1.0 ELSE 0.0 END) as completion_rate
        FROM master_tasks
        WHERE venture_id = venture_uuid
            AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    ) t;

    -- Runway health (30 points max)
    SELECT CASE
        WHEN runway_months >= 12 THEN 30
        WHEN runway_months >= 6 THEN 20
        WHEN runway_months >= 3 THEN 10
        ELSE 5
    END INTO runway_score
    FROM ventures
    WHERE id = venture_uuid;

    health_score := COALESCE(revenue_score, 0) + COALESCE(task_score, 0) + COALESCE(runway_score, 0);

    RETURN health_score;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Get CEO Dashboard Summary
-- ============================================

CREATE OR REPLACE FUNCTION get_ceo_dashboard_summary()
RETURNS TABLE (
    total_ventures BIGINT,
    healthy_ventures BIGINT,
    critical_ventures BIGINT,
    total_p1_tasks BIGINT,
    overdue_tasks BIGINT,
    today_priorities BIGINT,
    weekly_revenue DECIMAL(10,2),
    ashe_time_today INTEGER,
    ashe_time_week INTEGER,
    legal_fund DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM ventures WHERE strategic_priority != 'shutdown')::BIGINT,
        (SELECT COUNT(*) FROM ventures WHERE health_score >= 70 AND strategic_priority != 'shutdown')::BIGINT,
        (SELECT COUNT(*) FROM ventures WHERE health_score < 50 AND strategic_priority != 'shutdown')::BIGINT,
        (SELECT COUNT(*) FROM master_tasks WHERE priority_level = 'P1' AND status IN ('S1', 'S2'))::BIGINT,
        (SELECT COUNT(*) FROM master_tasks WHERE due_date < CURRENT_DATE AND status NOT IN ('S4', 'S5'))::BIGINT,
        (SELECT COUNT(*) FROM ceo_priorities WHERE priority_date = CURRENT_DATE)::BIGINT,
        (SELECT COALESCE(SUM(amount), 0) FROM revenue_tracking WHERE transaction_date >= CURRENT_DATE - INTERVAL '7 days' AND payment_status = 'paid'),
        (SELECT COALESCE(SUM(duration_minutes), 0)::INTEGER FROM ceo_time_log WHERE log_date = CURRENT_DATE AND activity_type = 'family'),
        (SELECT COALESCE(SUM(duration_minutes), 0)::INTEGER FROM ceo_time_log WHERE log_date >= DATE_TRUNC('week', CURRENT_DATE) AND activity_type = 'family'),
        (SELECT COALESCE(legal_fund_balance, 0) FROM daily_metrics ORDER BY metric_date DESC LIMIT 1);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Get Revenue Summary
-- ============================================

CREATE OR REPLACE FUNCTION get_revenue_summary(
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    period TEXT,
    total_revenue DECIMAL(10,2),
    recurring_revenue DECIMAL(10,2),
    one_time_revenue DECIMAL(10,2),
    transaction_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        'specified_period' as period,
        SUM(amount) as total_revenue,
        SUM(CASE WHEN revenue_type = 'recurring' THEN amount ELSE 0 END) as recurring_revenue,
        SUM(CASE WHEN revenue_type = 'one-time' THEN amount ELSE 0 END) as one_time_revenue,
        COUNT(*)::BIGINT as transaction_count
    FROM revenue_tracking
    WHERE transaction_date BETWEEN start_date AND end_date
        AND payment_status = 'paid'
        AND transaction_type IN ('invoice', 'payment');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Update All Venture Health Scores
-- ============================================

CREATE OR REPLACE FUNCTION update_all_venture_health_scores()
RETURNS void AS $$
DECLARE
    venture_record RECORD;
BEGIN
    FOR venture_record IN SELECT id FROM ventures WHERE strategic_priority != 'shutdown'
    LOOP
        UPDATE ventures
        SET health_score = calculate_venture_health(venture_record.id)
        WHERE id = venture_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Get Top Clients by Revenue
-- ============================================

CREATE OR REPLACE FUNCTION get_top_clients(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    company_name TEXT,
    monthly_recurring_revenue DECIMAL(10,2),
    lifetime_value DECIMAL(10,2),
    active_projects BIGINT,
    last_contact_days_ago INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.company_name,
        c.monthly_recurring_revenue,
        c.lifetime_value,
        COUNT(DISTINCT p.id)::BIGINT as active_projects,
        COALESCE(DATE_PART('day', CURRENT_DATE - c.last_contact_date)::INTEGER, 999) as last_contact_days_ago
    FROM clients c
    LEFT JOIN projects p ON c.id = p.client_id AND p.status = 'active'
    WHERE c.client_type = 'active'
    GROUP BY c.id, c.company_name, c.monthly_recurring_revenue, c.lifetime_value, c.last_contact_date
    ORDER BY c.monthly_recurring_revenue DESC NULLS LAST
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON VIEW v_portfolio_health IS 'Real-time portfolio health across all ventures';
COMMENT ON VIEW v_sales_pipeline IS 'Current sales pipeline by stage with values';
COMMENT ON VIEW v_monthly_revenue IS 'Revenue trends by month, type, and service line';
COMMENT ON VIEW v_lead_funnel IS 'Lead conversion funnel metrics by source';
COMMENT ON VIEW v_ceo_daily_focus IS 'CEO daily priorities and tasks';
COMMENT ON VIEW v_client_health IS 'Client health scoring based on engagement and value';

COMMENT ON FUNCTION calculate_venture_health IS 'Calculates 0-100 health score for a venture';
COMMENT ON FUNCTION get_ceo_dashboard_summary IS 'Returns all key metrics for CEO dashboard';
COMMENT ON FUNCTION get_revenue_summary IS 'Revenue summary for specified date range';
COMMENT ON FUNCTION update_all_venture_health_scores IS 'Batch update health scores for all ventures (run nightly)';
