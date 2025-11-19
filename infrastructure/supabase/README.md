# ASI 360 Supabase Unified Intelligence System (SUIS)

Complete database schema and infrastructure for ASI 360's multi-venture management system.

## Overview

The Supabase Unified Intelligence System (SUIS) is the central data layer for all ASI 360 operations, providing:

- **Single Source of Truth** for all business and personal data
- **Real-time Sync** with vTiger CRM, WordPress sites, and automation tools
- **Natural Language Queries** via MCP server and Telegram bot
- **Multi-Venture Portfolio Management** for CEO dashboard
- **Task and Time Tracking** across all ventures

## Directory Structure

```
infrastructure/supabase/
├── README.md                          # This file
├── migrations/                        # Database schema migrations
│   ├── 001_core_business_tables.sql   # Clients, contacts, projects, communications
│   ├── 002_sales_pipeline_tables.sql  # Opportunities, leads, revenue, campaigns
│   ├── 003_multi_venture_management.sql # Ventures, tasks, priorities, time tracking
│   ├── 004_views_and_functions.sql    # Dashboard views and helper functions
│   └── 005_row_level_security.sql     # RLS policies for multi-user access
├── seeds/                             # Sample data for testing
│   └── 001_sample_data.sql            # Demo data for all tables
└── functions/                         # Edge functions (future)
```

## Quick Start

### 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and API keys

### 2. Run Migrations

**Option A: Supabase Dashboard (Recommended for first-time setup)**

1. Open your Supabase project dashboard
2. Navigate to SQL Editor
3. Run each migration file in order (001 → 005)
4. Verify no errors

**Option B: Supabase CLI**

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize Supabase in this directory
supabase init

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run all migrations
supabase db push
```

### 3. Seed Sample Data (Optional)

Run the seed file to populate with sample data for testing:

```bash
# In Supabase SQL Editor, run:
infrastructure/supabase/seeds/001_sample_data.sql
```

### 4. Configure Environment Variables

Add to your `.env` file:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# CEO Access
CEO_EMAIL=your-email@asi360.com
```

### 5. Update RLS Policies

Replace `'ceo@asi360.com'` in `005_row_level_security.sql` with your actual CEO email:

```sql
-- Find and replace in SQL Editor
-- Before: auth.jwt() ->> 'email' = 'ceo@asi360.com'
-- After: auth.jwt() ->> 'email' = 'your-actual-email@asi360.com'
```

Then re-run the RLS policies.

## Database Schema

### Core Business Tables

- **clients** - Client companies with lifecycle tracking
- **contacts** - Individual contacts at client companies
- **projects** - Service engagements and deliverables
- **communications** - Unified log of all interactions (email, SMS, calls, meetings)

### Sales Pipeline Tables

- **opportunities** - Sales opportunities with stage tracking
- **leads** - Inbound and outbound leads with scoring
- **revenue_tracking** - All financial transactions
- **marketing_campaigns** - Campaign performance tracking

### Multi-Venture Management

- **ventures** - Portfolio of all business ventures
- **master_tasks** - Unified task management (personal + business)
- **ceo_priorities** - Daily/weekly/monthly priorities
- **ceo_time_log** - Time allocation tracking
- **strategic_initiatives** - Major cross-venture initiatives
- **executive_decisions** - Decision journal
- **daily_metrics** - Aggregated performance data

### Dashboard Views

- **v_portfolio_health** - Real-time venture health across portfolio
- **v_sales_pipeline** - Current pipeline by stage
- **v_monthly_revenue** - Revenue trends
- **v_lead_funnel** - Lead conversion metrics
- **v_ceo_daily_focus** - Today's priorities
- **v_client_health** - Client engagement scoring

## Key Features

### Automated Triggers

- **Auto-update LTV**: Client lifetime value updated when payments received
- **Auto-convert Leads**: Leads automatically create clients when marked "converted"
- **Auto-complete Tasks**: Tasks marked complete when all pomodoros done
- **Auto-calculate Duration**: Time log duration calculated from start/end times
- **Auto-update Timestamps**: Modified timestamps updated on all changes

### Helper Functions

```sql
-- Calculate health score for a venture
SELECT calculate_venture_health('venture-uuid');

-- Get CEO dashboard summary
SELECT * FROM get_ceo_dashboard_summary();

-- Get revenue summary for date range
SELECT * FROM get_revenue_summary('2025-11-01', '2025-11-30');

-- Get top clients by revenue
SELECT * FROM get_top_clients(10);

-- Update all venture health scores
SELECT update_all_venture_health_scores();
```

### Row Level Security (RLS)

- **CEO**: Full access to all data
- **Team Members**: Access to assigned clients, projects, tasks
- **Clients**: Read-only access to their own data
- **Public**: Can insert leads (for website forms)
- **Service Role**: Bypass all policies (for automation)

## Integration Points

### vTiger CRM Sync

All tables include `vtiger_*_id` fields for bidirectional sync:

- `clients.vtiger_account_id`
- `contacts.vtiger_contact_id`
- `projects.vtiger_project_id`
- `opportunities.vtiger_opportunity_id`
- `leads.vtiger_lead_id`

### WordPress Integration

- `clients.wordpress_user_id` - Links to WordPress user
- Project delivery tracked in `projects` table
- Content publishing automated via N8N workflows

### Stripe Payments

- `revenue_tracking.stripe_transaction_id`
- `clients.stripe_customer_id`
- Auto-update LTV on payment webhooks

### N8N Automation

All tables accessible via Supabase REST API:

```javascript
// Example: Insert lead from webhook
POST https://your-project.supabase.co/rest/v1/leads
Authorization: Bearer YOUR_SERVICE_ROLE_KEY
Content-Type: application/json

{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "lead_source": "website",
  "lead_status": "new"
}
```

## Common Queries

### Get today's CEO priorities

```sql
SELECT * FROM v_ceo_daily_focus;
```

### Get sales pipeline value by stage

```sql
SELECT * FROM v_sales_pipeline;
```

### Get revenue for current month

```sql
SELECT * FROM get_revenue_summary(
  DATE_TRUNC('month', CURRENT_DATE)::DATE,
  CURRENT_DATE
);
```

### Get overdue tasks

```sql
SELECT * FROM master_tasks
WHERE due_date < CURRENT_DATE
AND status NOT IN ('S4', 'S5')
ORDER BY priority_level, due_date;
```

### Get clients needing follow-up

```sql
SELECT * FROM v_client_health
WHERE contact_health IN ('at_risk', 'needs_attention')
ORDER BY value_tier DESC, days_since_contact DESC;
```

### Get venture health summary

```sql
SELECT * FROM v_portfolio_health;
```

## Maintenance

### Daily (Automated via N8N)

```sql
-- Update all venture health scores
SELECT update_all_venture_health_scores();

-- Aggregate daily metrics
INSERT INTO daily_metrics (metric_date, new_leads, ...)
SELECT CURRENT_DATE - 1, COUNT(*) FILTER ..., ...
FROM leads, ...;
```

### Weekly

```sql
-- Check for orphaned records
SELECT 'Orphaned contacts' as issue, COUNT(*) as count
FROM contacts c
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE id = c.client_id);

-- Check data integrity
SELECT * FROM revenue_tracking
WHERE payment_status = 'paid'
GROUP BY client_id
HAVING SUM(amount) != (
  SELECT lifetime_value FROM clients WHERE id = client_id
);
```

### Monthly

```sql
-- Archive old communications (optional)
-- Backup daily_metrics older than 90 days
-- Review and optimize slow queries
```

## Backup & Recovery

### Automatic Backups

Supabase provides automatic daily backups with 7-day retention (free tier) or 30-day retention (pro tier).

### Manual Backup

```bash
# Export entire database
pg_dump -h db.your-project.supabase.co \
  -U postgres \
  -d postgres \
  -f asi360_backup_$(date +%Y%m%d).sql

# Export specific table
pg_dump -h db.your-project.supabase.co \
  -U postgres \
  -d postgres \
  -t clients \
  -f clients_backup_$(date +%Y%m%d).sql
```

### Restore from Backup

```bash
# Restore entire database
psql -h db.your-project.supabase.co \
  -U postgres \
  -d postgres \
  -f asi360_backup_20251119.sql
```

## Troubleshooting

### Issue: Migrations fail with permission errors

**Solution**: Ensure you're running migrations as superuser or with sufficient privileges. Use Supabase dashboard SQL editor which runs as superuser.

### Issue: RLS policies blocking access

**Solution**:
1. Check if user email matches policy conditions
2. Verify user is authenticated: `SELECT auth.jwt();`
3. Test without RLS temporarily: `ALTER TABLE clients DISABLE ROW LEVEL SECURITY;`

### Issue: Slow queries

**Solution**:
1. Check query plan: `EXPLAIN ANALYZE SELECT ...;`
2. Add missing indexes: `CREATE INDEX ...`
3. Review `pg_stat_statements` for slow queries

### Issue: Triggers not firing

**Solution**:
1. Verify trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_name';`
2. Check trigger function: `SELECT prosrc FROM pg_proc WHERE proname = 'function_name';`
3. Review PostgreSQL logs in Supabase dashboard

## Security Best Practices

1. **Never commit API keys**: Use environment variables
2. **Use service role key only server-side**: Never expose in client code
3. **Enable RLS on all tables**: Always use Row Level Security
4. **Rotate keys periodically**: Especially if exposed
5. **Monitor access logs**: Review Supabase logs regularly
6. **Use prepared statements**: Prevent SQL injection in dynamic queries
7. **Validate input**: Always validate data before insertion

## Performance Optimization

1. **Use indexes**: All foreign keys and frequently queried columns indexed
2. **Use views for complex queries**: Pre-computed aggregations
3. **Enable connection pooling**: For high-traffic applications
4. **Use real-time subscriptions wisely**: Don't subscribe to entire tables
5. **Batch operations**: Use bulk inserts instead of individual inserts
6. **Cache frequently accessed data**: Use Redis or similar for hot data

## Next Steps

After setting up Supabase:

1. **Deploy MCP Server** - Enable Claude Desktop queries
2. **Set up N8N Workflows** - Automate data sync
3. **Build Telegram Bot** - Mobile data access
4. **Create Dashboard** - Web interface for visualization
5. **Implement Sales Engine** - Execute PRD-001
6. **Build CEO Dashboard** - Execute PRD-002

## Support

For issues or questions:

1. Check Supabase logs: Dashboard → Logs
2. Review migration files for schema reference
3. Consult PRD-003 for detailed specifications
4. Check PostgreSQL documentation for advanced features

---

**Document Version**: 1.0
**Last Updated**: November 19, 2025
**Maintained By**: ASI 360 Development Team
