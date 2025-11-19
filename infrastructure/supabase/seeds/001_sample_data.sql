-- ============================================
-- ASI 360 SUIS: Sample Seed Data
-- Seeds 001: Sample data for testing and demonstration
-- ============================================

-- ============================================
-- VENTURES (ASI 360 Portfolio)
-- ============================================

INSERT INTO ventures (id, venture_name, legal_entity, venture_stage, strategic_priority, health_score, monthly_revenue, monthly_expenses, cash_balance, runway_months, active_departments, current_focus, next_milestone, milestone_due_date) VALUES
('11111111-1111-1111-1111-111111111111', 'ASI 360 Core Services', 'ASI 360 Agency LLC', 'traction', 'core', 75, 15000.00, 8000.00, 25000.00, 3.6, ARRAY['CH01.1', 'CH02.1', 'CH03.1', 'CH05.1', 'CH08.2', 'CH10.1'], 'Generate $25K/month through Sales & Marketing Engine', '10 active clients under contract', '2025-12-31'),
('22222222-2222-2222-2222-222222222222', 'Tesla EV Rentals', 'ASI 360 Agency LLC', 'launch', 'growth', 60, 3500.00, 2000.00, 8000.00, 5.7, ARRAY['CH01.1', 'CH03.1', 'CH11.1', 'CH12.2'], 'Systematize booking and fleet management', '80% utilization rate sustained for 30 days', '2026-01-15'),
('33333333-3333-3333-3333-333333333333', 'Lake Merritt Parking', 'ASI 360 Agency LLC', 'traction', 'growth', 70, 8000.00, 3500.00, 12000.00, 4.0, ARRAY['CH01.1', 'CH11.1', 'CH16.1'], 'Launch weekend vendor markets for $8-15K/month', '4 consecutive profitable weekends', '2025-12-15'),
('44444444-4444-4444-4444-444444444444', 'JCCI Event Management', 'JCCI', 'launch', 'growth', 65, 5000.00, 3000.00, 10000.00, 5.0, ARRAY['CH01.1', 'CH05.1', 'CH29.3'], 'Ticket sales and event promotion automation', '500+ tickets sold for next major event', '2026-01-30');

-- ============================================
-- CLIENTS (Sample Clients)
-- ============================================

INSERT INTO clients (id, company_name, industry, client_type, email, phone, website, city, state, company_size, lead_source, client_since, monthly_recurring_revenue, lifetime_value, vtiger_account_id) VALUES
('c1111111-1111-1111-1111-111111111111', 'Oaktown Eats', 'Restaurant', 'active', 'info@oaktowneats.com', '510-555-0101', 'https://oaktowneats.com', 'Oakland', 'CA', '11-50', 'referral', '2025-10-01', 1500.00, 6000.00, 'VTIGER001'),
('c2222222-2222-2222-2222-222222222222', 'Bay Area Tech Solutions', 'Technology', 'active', 'contact@bayareatechsolutions.com', '415-555-0202', 'https://bayareatechsolutions.com', 'San Francisco', 'CA', '51-200', 'google-ads', '2025-09-15', 3000.00, 12000.00, 'VTIGER002'),
('c3333333-3333-3333-3333-333333333333', 'Golden Gate Events', 'Event Management', 'prospect', 'events@goldengateevents.com', '415-555-0303', 'https://goldengateevents.com', 'San Francisco', 'CA', '11-50', 'linkedin', NULL, 0, 0, 'VTIGER003'),
('c4444444-4444-4444-4444-444444444444', 'SF Property Management Co', 'Real Estate', 'active', 'admin@sfpropertymanagement.com', '415-555-0404', 'https://sfpropertymanagement.com', 'San Francisco', 'CA', '11-50', 'referral', '2025-11-01', 2000.00, 4000.00, 'VTIGER004');

-- ============================================
-- CONTACTS (Sample Contacts)
-- ============================================

INSERT INTO contacts (client_id, first_name, last_name, title, email, phone, is_primary_contact, linkedin_url) VALUES
('c1111111-1111-1111-1111-111111111111', 'Maria', 'Rodriguez', 'Owner', 'maria@oaktowneats.com', '510-555-0101', TRUE, 'https://linkedin.com/in/mariarodriguez'),
('c2222222-2222-2222-2222-222222222222', 'David', 'Chen', 'CTO', 'david@bayareatechsolutions.com', '415-555-0202', TRUE, 'https://linkedin.com/in/davidchen'),
('c2222222-2222-2222-2222-222222222222', 'Sarah', 'Johnson', 'COO', 'sarah@bayareatechsolutions.com', '415-555-0203', FALSE, 'https://linkedin.com/in/sarahjohnson'),
('c3333333-3333-3333-3333-333333333333', 'James', 'Williams', 'CEO', 'james@goldengateevents.com', '415-555-0303', TRUE, 'https://linkedin.com/in/jameswilliams'),
('c4444444-4444-4444-4444-444444444444', 'Lisa', 'Brown', 'Property Manager', 'lisa@sfpropertymanagement.com', '415-555-0404', TRUE, NULL);

-- ============================================
-- PROJECTS (Sample Projects)
-- ============================================

INSERT INTO projects (client_id, project_name, project_type, status, start_date, target_completion_date, project_value, billing_type, project_manager, completion_percentage, venture_id) VALUES
('c1111111-1111-1111-1111-111111111111', 'Toast POS Integration', 'website', 'active', '2025-10-15', '2025-12-15', 5000.00, 'fixed-price', 'ceo@asi360.com', 60, '11111111-1111-1111-1111-111111111111'),
('c2222222-2222-2222-2222-222222222222', 'Cloud Infrastructure Migration', 'cloud-infrastructure', 'active', '2025-09-20', '2025-12-31', 15000.00, 'monthly-retainer', 'ceo@asi360.com', 40, '11111111-1111-1111-1111-111111111111'),
('c4444444-4444-4444-4444-444444444444', 'Security Camera System', 'cloud-infrastructure', 'proposal', NULL, NULL, 8000.00, 'fixed-price', 'ceo@asi360.com', 0, '11111111-1111-1111-1111-111111111111');

-- ============================================
-- OPPORTUNITIES (Sample Sales Pipeline)
-- ============================================

INSERT INTO opportunities (client_id, opportunity_name, stage, estimated_value, probability, expected_close_date, assigned_to) VALUES
('c3333333-3333-3333-3333-333333333333', 'Event Marketing Automation Platform', 'proposal', 12000.00, 70, '2025-12-30', 'ceo@asi360.com'),
('c1111111-1111-1111-1111-111111111111', 'ChowBus Integration Upgrade', 'qualification', 3000.00, 50, '2026-01-15', 'ceo@asi360.com');

-- ============================================
-- LEADS (Sample Leads)
-- ============================================

INSERT INTO leads (first_name, last_name, company_name, email, phone, lead_status, lead_source, lead_score, assigned_to, utm_source, utm_campaign) VALUES
('Robert', 'Taylor', 'Bay Area Bistro', 'robert@bayareabistro.com', '510-555-0505', 'new', 'google-ads', 75, 'ceo@asi360.com', 'google', 'restaurant-tech-november'),
('Emily', 'Davis', 'TechStart SF', 'emily@techstartsf.com', '415-555-0606', 'contacted', 'linkedin', 60, 'ceo@asi360.com', 'linkedin', 'smb-cloud-services'),
('Michael', 'Anderson', 'Oakland Events Co', 'michael@oaklandevents.com', '510-555-0707', 'qualified', 'referral', 85, 'ceo@asi360.com', 'referral', NULL),
('Jennifer', 'Martinez', 'SF Restaurant Group', 'jennifer@sfrestaurantgroup.com', '415-555-0808', 'new', 'website', 70, 'ceo@asi360.com', 'organic', NULL);

-- ============================================
-- REVENUE TRACKING (Sample Transactions)
-- ============================================

INSERT INTO revenue_tracking (client_id, transaction_date, amount, transaction_type, revenue_type, service_line, payment_status, invoice_number) VALUES
('c1111111-1111-1111-1111-111111111111', '2025-11-01', 1500.00, 'payment', 'recurring', 'website-management', 'paid', 'INV-2025-001'),
('c2222222-2222-2222-2222-222222222222', '2025-11-01', 3000.00, 'payment', 'recurring', 'cloud-infrastructure', 'paid', 'INV-2025-002'),
('c4444444-4444-4444-4444-444444444444', '2025-11-05', 2000.00, 'payment', 'one-time', 'security-systems', 'paid', 'INV-2025-003'),
('c1111111-1111-1111-1111-111111111111', '2025-10-01', 2500.00, 'payment', 'one-time', 'website-development', 'paid', 'INV-2025-004'),
('c2222222-2222-2222-2222-222222222222', '2025-10-15', 5000.00, 'payment', 'one-time', 'cloud-migration', 'paid', 'INV-2025-005');

-- ============================================
-- MARKETING CAMPAIGNS (Sample Campaigns)
-- ============================================

INSERT INTO marketing_campaigns (campaign_name, campaign_type, channel, status, start_date, end_date, budget, actual_spend, utm_campaign) VALUES
('Restaurant Tech Services - November', 'ads', 'google-ads', 'active', '2025-11-01', '2025-11-30', 800.00, 450.00, 'restaurant-tech-november'),
('SMB Cloud Services - LinkedIn', 'ads', 'linkedin', 'active', '2025-11-01', '2025-12-31', 500.00, 200.00, 'smb-cloud-services'),
('Holiday Website Refresh', 'email', 'email', 'planning', '2025-12-01', '2025-12-15', 100.00, 0, 'holiday-website-refresh');

-- ============================================
-- COMMUNICATIONS (Sample Communication Log)
-- ============================================

INSERT INTO communications (client_id, communication_type, direction, subject, body, communication_date, from_person, to_person) VALUES
('c1111111-1111-1111-1111-111111111111', 'email', 'outbound', 'Toast Integration Project Update', 'Hi Maria, wanted to update you on the Toast POS integration progress. We are 60% complete and on track for the December 15 deadline.', '2025-11-15 10:30:00', 'ceo@asi360.com', 'maria@oaktowneats.com'),
('c2222222-2222-2222-2222-222222222222', 'call', 'outbound', 'Cloud Migration Check-in', 'Called David to discuss cloud migration progress. He confirmed satisfaction with current progress and wants to schedule a demo next week.', '2025-11-18 14:00:00', 'ceo@asi360.com', 'david@bayareatechsolutions.com'),
('c3333333-3333-3333-3333-333333333333', 'email', 'inbound', 'Questions about Event Marketing Platform', 'Hi, I reviewed your proposal and have a few questions about the automated email sequences and social media integration. Can we schedule a call?', '2025-11-19 09:15:00', 'james@goldengateevents.com', 'ceo@asi360.com');

-- ============================================
-- MASTER TASKS (Sample Tasks)
-- ============================================

INSERT INTO master_tasks (task_identifier, priority_level, status, task_category, department_code, venture_id, task_description, energy_level, pomodoros_total, estimated_minutes, due_date, assigned_to) VALUES
('#SALES01', 'P1', 'S1', 'Sales Call', 'CH03.1', '11111111-1111-1111-1111-111111111111', 'Call Golden Gate Events to answer proposal questions', 'E4', 1, 25, CURRENT_DATE, 'ceo@asi360.com'),
('#MKT01', 'P2', 'S2', 'Marketing', 'CH05.1', '11111111-1111-1111-1111-111111111111', 'Create Google Ads campaign for December', 'E3', 2, 50, CURRENT_DATE + 2, 'ceo@asi360.com'),
('#DEV01', 'P1', 'S2', 'Development', 'CH08.2', '11111111-1111-1111-1111-111111111111', 'Complete Toast POS integration testing', 'E5', 4, 100, CURRENT_DATE + 3, 'ceo@asi360.com'),
('#ADMIN01', 'P3', 'S1', 'Administration', 'CH20.1', NULL, 'Process monthly invoices and update accounting', 'E2', 2, 50, CURRENT_DATE + 5, 'ceo@asi360.com'),
('#FAMILY01', 'P1', 'S4', 'Family Time', 'CH28.1', NULL, 'Evening time with Ashé - reading and games', 'E1', 4, 120, CURRENT_DATE - 1, 'ceo@asi360.com');

-- ============================================
-- CEO PRIORITIES (Sample Daily Priorities)
-- ============================================

INSERT INTO ceo_priorities (priority_date, priority_type, priority_rank, priority_description, time_allocated_minutes, related_venture_id) VALUES
(CURRENT_DATE, 'daily', 1, 'Call Golden Gate Events re: proposal questions', 30, '11111111-1111-1111-1111-111111111111'),
(CURRENT_DATE, 'daily', 2, 'Complete Toast POS integration testing', 120, '11111111-1111-1111-1111-111111111111'),
(CURRENT_DATE, 'daily', 3, 'Review Tesla rental bookings for weekend', 30, '22222222-2222-2222-2222-222222222222');

-- ============================================
-- CEO TIME LOG (Sample Time Tracking)
-- ============================================

INSERT INTO ceo_time_log (log_date, time_block_start, time_block_end, activity_type, department_code, venture_id, productivity_rating, activity_description) VALUES
(CURRENT_DATE - 1, '09:00', '10:30', 'deep_work', 'CH08.2', '11111111-1111-1111-1111-111111111111', 5, 'Development work on Toast integration'),
(CURRENT_DATE - 1, '10:30', '11:00', 'meetings', 'CH03.1', '11111111-1111-1111-1111-111111111111', 4, 'Client call with Bay Area Tech Solutions'),
(CURRENT_DATE - 1, '14:00', '16:00', 'deep_work', 'CH05.1', '11111111-1111-1111-1111-111111111111', 4, 'Marketing campaign setup for December'),
(CURRENT_DATE - 1, '18:00', '20:00', 'family', 'CH28.1', NULL, 5, 'Quality time with Ashé - reading and board games');

-- ============================================
-- DAILY METRICS (Sample Aggregated Data)
-- ============================================

INSERT INTO daily_metrics (metric_date, new_leads, qualified_leads, meetings_held, proposals_sent, deals_closed, revenue_closed, pipeline_value, pipeline_count, tasks_completed, pomodoros_completed, ceo_productive_hours, family_time_minutes, daily_revenue) VALUES
(CURRENT_DATE - 1, 4, 2, 2, 1, 0, 0, 35000.00, 5, 8, 12, 6.5, 120, 6500.00),
(CURRENT_DATE - 2, 3, 1, 1, 0, 1, 5000.00, 40000.00, 6, 10, 15, 7.0, 90, 5000.00),
(CURRENT_DATE - 3, 5, 3, 3, 2, 0, 0, 35000.00, 7, 6, 10, 5.5, 150, 4500.00);

-- ============================================
-- STRATEGIC INITIATIVES (Sample Initiatives)
-- ============================================

INSERT INTO strategic_initiatives (initiative_name, initiative_type, strategic_pillar, ventures_involved, status, start_date, target_completion, current_progress, executive_sponsor) VALUES
('Sales & Marketing Engine Launch', 'growth', 'revenue', ARRAY['11111111-1111-1111-1111-111111111111'::UUID], 'active', '2025-11-01', '2026-01-31', 40, 'ceo@asi360.com'),
('Multi-Venture Dashboard Implementation', 'transformation', 'technology', ARRAY['11111111-1111-1111-1111-111111111111'::UUID, '22222222-2222-2222-2222-222222222222'::UUID], 'planning', '2025-12-01', '2026-02-15', 10, 'ceo@asi360.com');

-- ============================================
-- UPDATE TIMESTAMPS AND DERIVED VALUES
-- ============================================

-- Update client last_contact_date based on communications
UPDATE clients c
SET last_contact_date = (
    SELECT MAX(communication_date)::DATE
    FROM communications
    WHERE client_id = c.id
);

-- Update venture health scores
SELECT update_all_venture_health_scores();

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify data was inserted correctly
DO $$
DECLARE
    client_count INTEGER;
    task_count INTEGER;
    venture_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO client_count FROM clients;
    SELECT COUNT(*) INTO task_count FROM master_tasks;
    SELECT COUNT(*) INTO venture_count FROM ventures;

    RAISE NOTICE 'Seed data inserted successfully:';
    RAISE NOTICE '- Clients: %', client_count;
    RAISE NOTICE '- Tasks: %', task_count;
    RAISE NOTICE '- Ventures: %', venture_count;
END $$;
