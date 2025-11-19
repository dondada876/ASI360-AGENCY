-- ============================================
-- ASI 360 SUIS: Sales Pipeline Tables
-- Migration 002: Opportunities, Leads, Revenue, Marketing Campaigns
-- ============================================

-- ============================================
-- SALES PIPELINE
-- ============================================

CREATE TABLE opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

    -- Opportunity Details
    opportunity_name TEXT NOT NULL,
    description TEXT,

    -- Pipeline Stage
    stage TEXT NOT NULL CHECK (stage IN (
        'prospecting',
        'qualification',
        'proposal',
        'negotiation',
        'closed-won',
        'closed-lost'
    )),

    -- Value & Probability
    estimated_value DECIMAL(10,2) NOT NULL,
    probability INTEGER CHECK (probability >= 0 AND probability <= 100),
    weighted_value DECIMAL(10,2) GENERATED ALWAYS AS (estimated_value * probability / 100) STORED,

    -- Timeline
    expected_close_date DATE,
    actual_close_date DATE,

    -- Competition & Context
    competitors TEXT[],
    pain_points TEXT[],
    decision_criteria TEXT[],

    -- Ownership
    assigned_to TEXT NOT NULL,

    -- Integration
    vtiger_opportunity_id TEXT UNIQUE,

    -- Metadata
    tags TEXT[],
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    modified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_opportunities_client ON opportunities(client_id);
CREATE INDEX idx_opportunities_stage ON opportunities(stage);
CREATE INDEX idx_opportunities_close_date ON opportunities(expected_close_date);
CREATE INDEX idx_opportunities_assigned ON opportunities(assigned_to);

CREATE TRIGGER update_opportunities_modified
BEFORE UPDATE ON opportunities
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- ============================================
-- REVENUE TRACKING
-- ============================================

CREATE TABLE revenue_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Related Entities
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,

    -- Transaction Details
    transaction_date DATE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    transaction_type TEXT CHECK (transaction_type IN ('invoice', 'payment', 'refund', 'credit')),

    -- Revenue Classification
    revenue_type TEXT CHECK (revenue_type IN ('one-time', 'recurring', 'upsell', 'renewal')),
    service_line TEXT, -- 'wordpress-hosting', 'ai-services', 'cloud-infrastructure', 'events'

    -- Status
    payment_status TEXT CHECK (payment_status IN ('pending', 'paid', 'overdue', 'cancelled')),
    payment_method TEXT,

    -- Integration
    stripe_transaction_id TEXT,
    invoice_number TEXT,
    vtiger_invoice_id TEXT,

    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_revenue_client ON revenue_tracking(client_id);
CREATE INDEX idx_revenue_date ON revenue_tracking(transaction_date DESC);
CREATE INDEX idx_revenue_type ON revenue_tracking(revenue_type);
CREATE INDEX idx_revenue_status ON revenue_tracking(payment_status);
CREATE INDEX idx_revenue_service_line ON revenue_tracking(service_line);

-- ============================================
-- MARKETING CAMPAIGNS
-- ============================================

CREATE TABLE marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Campaign Details
    campaign_name TEXT NOT NULL,
    campaign_type TEXT, -- 'email', 'sms', 'ads', 'social', 'content', 'event'
    channel TEXT, -- 'google-ads', 'facebook', 'linkedin', 'email', 'sms'

    -- Status & Timeline
    status TEXT CHECK (status IN ('planning', 'active', 'paused', 'completed', 'cancelled')),
    start_date DATE,
    end_date DATE,

    -- Budget & Performance
    budget DECIMAL(10,2),
    actual_spend DECIMAL(10,2) DEFAULT 0,

    -- Goals & Metrics
    goal TEXT, -- 'leads', 'revenue', 'awareness', 'engagement'
    target_metric INTEGER,
    actual_metric INTEGER DEFAULT 0,

    -- Content
    message_content TEXT,
    creative_assets JSONB,
    landing_page_url TEXT,

    -- Targeting
    target_audience JSONB,
    geo_targeting TEXT[],

    -- Integration
    platform_campaign_id TEXT,
    utm_campaign TEXT,

    -- Metadata
    tags TEXT[],
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    modified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_status ON marketing_campaigns(status);
CREATE INDEX idx_campaigns_type ON marketing_campaigns(campaign_type);
CREATE INDEX idx_campaigns_dates ON marketing_campaigns(start_date, end_date);
CREATE INDEX idx_campaigns_utm ON marketing_campaigns(utm_campaign);

CREATE TRIGGER update_campaigns_modified
BEFORE UPDATE ON marketing_campaigns
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- ============================================
-- LEADS & LEAD SCORING
-- ============================================

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Lead Information
    first_name TEXT,
    last_name TEXT,
    full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    company_name TEXT,
    email TEXT NOT NULL,
    phone TEXT,

    -- Classification
    lead_status TEXT CHECK (lead_status IN ('new', 'contacted', 'qualified', 'unqualified', 'converted', 'dead')),
    lead_source TEXT, -- 'website', 'referral', 'google-ads', 'linkedin', 'event'
    lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),

    -- Campaign Attribution
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_term TEXT,
    utm_content TEXT,

    -- Qualification
    company_size TEXT,
    industry TEXT,
    pain_points TEXT[],
    budget_range TEXT,
    decision_timeline TEXT,

    -- Conversion
    converted_to_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    conversion_date DATE,

    -- Assignment
    assigned_to TEXT,
    last_contact_date DATE,
    next_follow_up_date DATE,

    -- Integration
    vtiger_lead_id TEXT UNIQUE,

    -- Metadata
    tags TEXT[],
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    modified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_status ON leads(lead_status);
CREATE INDEX idx_leads_score ON leads(lead_score DESC);
CREATE INDEX idx_leads_source ON leads(lead_source);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_campaign ON leads(campaign_id);
CREATE INDEX idx_leads_assigned ON leads(assigned_to);
CREATE INDEX idx_leads_follow_up ON leads(next_follow_up_date);

CREATE TRIGGER update_leads_modified
BEFORE UPDATE ON leads
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- ============================================
-- TRIGGER: Auto-update client LTV when revenue added
-- ============================================

CREATE OR REPLACE FUNCTION update_client_ltv()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.payment_status = 'paid' AND NEW.transaction_type IN ('invoice', 'payment') THEN
        UPDATE clients
        SET lifetime_value = COALESCE(lifetime_value, 0) + NEW.amount
        WHERE id = NEW.client_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ltv_on_payment
AFTER INSERT ON revenue_tracking
FOR EACH ROW
EXECUTE FUNCTION update_client_ltv();

-- ============================================
-- TRIGGER: Auto-create client from converted lead
-- ============================================

CREATE OR REPLACE FUNCTION convert_lead_to_client()
RETURNS TRIGGER AS $$
DECLARE
    new_client_id UUID;
BEGIN
    -- Only process if status changed to 'converted' and no client exists yet
    IF NEW.lead_status = 'converted' AND NEW.converted_to_client_id IS NULL THEN
        -- Create new client from lead data
        INSERT INTO clients (
            company_name,
            primary_contact_name,
            email,
            phone,
            industry,
            company_size,
            lead_source,
            client_type,
            acquisition_date,
            client_since,
            notes
        ) VALUES (
            COALESCE(NEW.company_name, NEW.full_name),
            NEW.full_name,
            NEW.email,
            NEW.phone,
            NEW.industry,
            NEW.company_size,
            NEW.lead_source,
            'prospect',
            NEW.created_at::DATE,
            CURRENT_DATE,
            'Converted from lead #' || NEW.id
        ) RETURNING id INTO new_client_id;

        -- Update lead with new client reference
        NEW.converted_to_client_id = new_client_id;
        NEW.conversion_date = CURRENT_DATE;

        -- Create a contact for this client
        INSERT INTO contacts (
            client_id,
            first_name,
            last_name,
            email,
            phone,
            is_primary_contact
        ) VALUES (
            new_client_id,
            NEW.first_name,
            NEW.last_name,
            NEW.email,
            NEW.phone,
            TRUE
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_convert_lead
BEFORE UPDATE ON leads
FOR EACH ROW
EXECUTE FUNCTION convert_lead_to_client();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE opportunities IS 'Sales opportunities with pipeline stage tracking';
COMMENT ON TABLE revenue_tracking IS 'All financial transactions (invoices, payments, refunds)';
COMMENT ON TABLE marketing_campaigns IS 'Marketing campaigns with budget and performance tracking';
COMMENT ON TABLE leads IS 'Inbound and outbound leads with scoring and attribution';

COMMENT ON COLUMN opportunities.weighted_value IS 'Automatically calculated: estimated_value * probability / 100';
COMMENT ON COLUMN revenue_tracking.service_line IS 'Maps to venture service lines for P&L by venture';
COMMENT ON COLUMN leads.lead_score IS '0-100 score based on qualification criteria';
COMMENT ON TRIGGER update_ltv_on_payment ON revenue_tracking IS 'Automatically updates client lifetime_value when payment received';
COMMENT ON TRIGGER auto_convert_lead ON leads IS 'Automatically creates client and contact when lead status = converted';
