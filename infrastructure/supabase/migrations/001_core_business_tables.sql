-- ============================================
-- ASI 360 SUIS: Core Business Tables
-- Migration 001: Clients, Contacts, Projects, Communications
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CLIENTS & CONTACTS
-- ============================================

CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    industry TEXT,
    client_type TEXT CHECK (client_type IN ('prospect', 'active', 'inactive', 'churned')),

    -- Contact Information
    primary_contact_name TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    country TEXT DEFAULT 'USA',

    -- Business Details
    company_size TEXT CHECK (company_size IN ('1-10', '11-50', '51-200', '201-1000', '1000+')),
    annual_revenue DECIMAL(12,2),

    -- Relationship
    lead_source TEXT,
    acquisition_date DATE,
    client_since DATE,
    last_contact_date DATE,
    next_follow_up_date DATE,

    -- Value Metrics
    lifetime_value DECIMAL(10,2) DEFAULT 0,
    monthly_recurring_revenue DECIMAL(10,2) DEFAULT 0,

    -- Integration
    vtiger_account_id TEXT UNIQUE,
    wordpress_user_id INTEGER,
    stripe_customer_id TEXT,

    -- Metadata
    tags TEXT[],
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    modified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clients_type ON clients(client_type);
CREATE INDEX idx_clients_vtiger ON clients(vtiger_account_id);
CREATE INDEX idx_clients_industry ON clients(industry);
CREATE INDEX idx_clients_email ON clients(email);

-- Auto-update modified_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.modified_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clients_modified
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- ============================================
-- CONTACTS (People associated with clients)
-- ============================================

CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

    -- Personal Information
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    title TEXT,
    email TEXT,
    phone TEXT,
    mobile TEXT,

    -- Role
    is_primary_contact BOOLEAN DEFAULT FALSE,
    is_billing_contact BOOLEAN DEFAULT FALSE,
    is_technical_contact BOOLEAN DEFAULT FALSE,

    -- Social
    linkedin_url TEXT,
    twitter_handle TEXT,

    -- Integration
    vtiger_contact_id TEXT UNIQUE,

    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    modified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contacts_client ON contacts(client_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_vtiger ON contacts(vtiger_contact_id);

CREATE TRIGGER update_contacts_modified
BEFORE UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- ============================================
-- PROJECTS & SERVICES
-- ============================================

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

    -- Project Details
    project_name TEXT NOT NULL,
    project_type TEXT, -- 'website', 'ai-integration', 'cloud-infrastructure', 'event-management'
    description TEXT,

    -- Status & Timeline
    status TEXT CHECK (status IN ('proposal', 'active', 'on-hold', 'completed', 'cancelled')),
    start_date DATE,
    target_completion_date DATE,
    actual_completion_date DATE,

    -- Financial
    project_value DECIMAL(10,2),
    budget DECIMAL(10,2),
    actual_cost DECIMAL(10,2),
    billing_type TEXT CHECK (billing_type IN ('fixed-price', 'hourly', 'monthly-retainer', 'percentage')),
    hourly_rate DECIMAL(6,2),

    -- Delivery
    deliverables JSONB,
    milestones JSONB,
    completion_percentage INTEGER DEFAULT 0,

    -- Team
    project_manager TEXT,
    assigned_team TEXT[],

    -- Integration
    vtiger_project_id TEXT UNIQUE,
    github_repo TEXT,
    notion_page_id TEXT,

    -- Metadata
    tags TEXT[],
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    modified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_client ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_type ON projects(project_type);

CREATE TRIGGER update_projects_modified
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- ============================================
-- COMMUNICATIONS (Unified Communication Log)
-- ============================================

CREATE TABLE communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Related Entities
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

    -- Communication Details
    communication_type TEXT NOT NULL CHECK (communication_type IN ('email', 'sms', 'call', 'meeting', 'note')),
    direction TEXT CHECK (direction IN ('inbound', 'outbound')),
    subject TEXT,
    body TEXT,

    -- Participants
    from_person TEXT,
    to_person TEXT,
    cc TEXT[],

    -- Metadata
    communication_date TIMESTAMPTZ DEFAULT NOW(),
    duration_minutes INTEGER, -- For calls and meetings

    -- Integration
    email_message_id TEXT,
    twilio_message_sid TEXT,
    calendar_event_id TEXT,

    -- Classification
    sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    is_important BOOLEAN DEFAULT FALSE,
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,

    -- Metadata
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_communications_client ON communications(client_id);
CREATE INDEX idx_communications_type ON communications(communication_type);
CREATE INDEX idx_communications_date ON communications(communication_date DESC);
CREATE INDEX idx_communications_follow_up ON communications(follow_up_required, follow_up_date);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE clients IS 'Core client/account records with lifecycle tracking';
COMMENT ON TABLE contacts IS 'Individual contacts associated with client companies';
COMMENT ON TABLE projects IS 'Client projects and service engagements';
COMMENT ON TABLE communications IS 'Unified log of all communications across channels';

COMMENT ON COLUMN clients.client_type IS 'prospect: potential client, active: current paying, inactive: paused, churned: lost';
COMMENT ON COLUMN clients.lifetime_value IS 'Total revenue received from client';
COMMENT ON COLUMN clients.monthly_recurring_revenue IS 'Current MRR from this client';
COMMENT ON COLUMN projects.completion_percentage IS '0-100, used for progress tracking';
COMMENT ON COLUMN communications.sentiment IS 'AI-detected or manually set sentiment';
