# ASI 360 N8N Automation Workflows

Five core automation workflows that power the ASI 360 intelligence system. These workflows handle CRM synchronization, lead qualification, email/SMS automation, and daily metrics aggregation.

## Overview

| Workflow | Trigger | Purpose | Frequency |
|----------|---------|---------|-----------|
| 01_vtiger_supabase_sync | Webhook | Bidirectional CRM sync | Real-time |
| 02_lead_enrichment_scoring | Schedule | Lead scoring & qualification | Every 5 min |
| 03_email_automation_sequences | Schedule | Email nurture campaigns | Hourly |
| 04_sms_instant_response | Schedule | 5-minute SMS rule | Every 2 min |
| 05_daily_metrics_aggregation | Schedule | Daily CEO briefing | Daily 1 AM |

## Prerequisites

### 1. N8N Installation

**Self-Hosted (Recommended):**
```bash
# Using Docker
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n

# Using npm
npm install -g n8n
n8n start
```

**N8N Cloud:**
- Sign up at https://n8n.io/cloud
- Create new workspace
- Note: Some features may require paid plan

### 2. Required Credentials

You'll need to configure these credentials in N8N:

**Supabase API**
- Name: `Supabase - ASI360`
- Type: Supabase
- Fields:
  - Host: `https://your-project.supabase.co`
  - Service Role Key: `your-service-role-key`

**SendGrid API**
- Name: `SendGrid - ASI360`
- Type: SendGrid
- Fields:
  - API Key: `SG.your-sendgrid-api-key`

**Twilio API**
- Name: `Twilio - ASI360`
- Type: Twilio
- Fields:
  - Account SID: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
  - Auth Token: `your-auth-token`

**vTiger API**
- Name: `vTiger CRM`
- Type: HTTP Request (with auth)
- Fields:
  - Base URL: `https://your-vtiger-instance.com/restapi/v1`
  - Session ID: Obtained via vTiger login

**Telegram Bot (for daily briefings)**
- Use environment variables:
  - `TELEGRAM_BOT_TOKEN`
  - `AUTHORIZED_USER_ID`

See `credentials-template.json` for exact configuration format.

## Installation

### Step 1: Import Workflows

**Via N8N UI:**
1. Open N8N (http://localhost:5678)
2. Click "Workflows" → "Import from File"
3. Import each JSON file in order (01 → 05)
4. Activate each workflow after import

**Via N8N CLI:**
```bash
# Copy workflow files to N8N directory
cp *.json ~/.n8n/workflows/

# Restart N8N
docker restart n8n
# OR
pkill n8n && n8n start
```

### Step 2: Configure Credentials

1. Go to Settings → Credentials
2. Add each required credential (see Prerequisites)
3. Test connections
4. Map credentials to imported workflows

### Step 3: Set Environment Variables

Create `.env` file in N8N directory:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
AUTHORIZED_USER_ID=your-telegram-user-id

# SendGrid Configuration
SENDGRID_FROM_EMAIL=ceo@asi360.com
SENDGRID_FROM_NAME=ASI 360

# Twilio Configuration
TWILIO_FROM_NUMBER=+1234567890

# vTiger Configuration
VTIGER_BASE_URL=https://your-vtiger.com/restapi/v1
VTIGER_USERNAME=admin
VTIGER_ACCESS_KEY=your-access-key
```

### Step 4: Activate Workflows

1. Open each workflow in N8N
2. Click "Activate" toggle in top right
3. Verify trigger configuration
4. Test with sample data

## Workflow Details

### 01: vTiger ↔ Supabase Sync

**Purpose**: Keep vTiger CRM and Supabase database synchronized in real-time.

**Webhook URL**: `https://your-n8n-instance.com/webhook/vtiger-sync`

**vTiger Setup**:
1. Go to Settings → Workflows
2. Create new workflow for "Accounts" module
3. Trigger: "After Save"
4. Task: Webhook to N8N URL
5. Repeat for "Leads" module

**Data Mapping**:
- vTiger Accounts → Supabase `clients` table
- vTiger Leads → Supabase `leads` table

**Bidirectional Sync**: Yes (updates flow both directions)

### 02: Lead Enrichment & Scoring

**Purpose**: Automatically score and qualify leads, create high-priority tasks.

**Schedule**: Every 5 minutes

**Scoring Algorithm** (0-100 scale):
- Complete contact info: 35 points
- Referral source: 25 points
- Budget/timeline fit: 25 points
- Industry match: 15 points

**Actions**:
- Score ≥70: Create P1 task, send Telegram alert
- Score 40-69: Mark as "contacted", add to nurture campaign
- Score <40: Mark as "unqualified"

**Enrichment**:
- Cleans phone numbers (standardizes format)
- Validates email addresses
- Normalizes company names
- Sets lead source hierarchy

### 03: Email Automation Sequences

**Purpose**: Multi-touch email nurture campaigns by industry segment.

**Schedule**: Hourly (on the hour)

**Restaurant Sequence** (7 emails over 21 days):
- Day 0: Welcome + case study
- Day 2: Social proof (testimonials)
- Day 5: Educational content
- Day 8: Value proposition deep dive
- Day 12: Objection handling
- Day 16: Success stories
- Day 21: Final call-to-action

**SMB Sequence** (5 emails over 14 days):
- Day 0: Welcome + quick wins
- Day 3: ROI calculator
- Day 7: Case study
- Day 10: Limited-time offer
- Day 14: Final reminder

**Features**:
- Personalization (name, company, industry)
- Automatic unsubscribe handling
- SendGrid tracking integration
- All sends logged to `communications` table

**Campaign Templates**: See `../sales-marketing-engine/email-templates/`

### 04: SMS Instant Response (5-Minute Rule)

**Purpose**: Contact new leads via SMS within 5 minutes of creation.

**Schedule**: Every 2 minutes

**Logic**:
1. Find leads created in last 5 minutes
2. Check if already contacted
3. Send personalized SMS
4. Log to communications table

**Message Personalization**:
- Restaurant industry: Focus on online ordering
- Tech/SaaS: Focus on efficiency gains
- Professional services: Focus on client acquisition
- Generic: Focus on growth

**Twilio Configuration**:
- Uses short code or 10-digit number
- Enables replies (webhook for inbound SMS)
- Tracks delivery status

### 05: Daily Metrics Aggregation & CEO Briefing

**Purpose**: Aggregate yesterday's performance metrics, send morning briefing.

**Schedule**: Daily at 1:00 AM (cron: `0 1 * * *`)

**Metrics Collected**:
- New leads count (total + qualified)
- Deals closed count + revenue
- Daily revenue (all transactions)
- Tasks completed + pomodoros
- Family time minutes

**Aggregation Function**:
```javascript
{
  metric_date: "2025-11-18",
  new_leads: 12,
  qualified_leads: 7,
  deals_closed: 2,
  revenue_closed: 15000,
  daily_revenue: 8450,
  tasks_completed: 18,
  pomodoros_completed: 24,
  ceo_productive_hours: 10.0,
  family_time_minutes: 90
}
```

**Output**:
1. Inserts into `daily_metrics` table
2. Sends Telegram message to CEO
3. Available via `/metrics` command in Telegram bot

**Telegram Message Format**:
```
🌅 Good Morning! Yesterday's Metrics

📊 Business:
• New Leads: 12
• Qualified: 7
• Deals Closed: 2
• Revenue: $8,450

✅ Productivity:
• Tasks Completed: 18
• Pomodoros: 24
• Productive Hours: 10.0

👨‍👧 Family:
• Time with Ashé: 1h 30m

Use /dashboard for full details
```

## Workflow Connections

```
vTiger CRM ──────────┐
                     ├──► Supabase ◄──┬── N8N Workflows
Website Forms ───────┘                │
                                      ├── MCP Server (Claude Desktop)
                                      └── Telegram Bot
```

All workflows read/write to the same Supabase database, ensuring single source of truth.

## Monitoring & Logs

### N8N Execution Logs

View in N8N UI:
1. Click "Executions" in left sidebar
2. Filter by workflow
3. View detailed execution data

### Error Handling

All workflows include:
- Try-catch error nodes
- Supabase error logging
- Telegram notifications for critical failures

### Performance Metrics

Expected execution times:
- vTiger Sync: <2 seconds
- Lead Enrichment: 5-10 seconds (depends on lead count)
- Email Automation: 10-30 seconds (depends on recipients)
- SMS Instant Response: 3-5 seconds
- Daily Metrics: 15-20 seconds

## Troubleshooting

### Workflow Not Triggering

**Check**:
1. Workflow is activated (toggle in top right)
2. Trigger configuration is correct
3. For webhooks: URL is accessible
4. For schedules: Cron expression is valid

**Solution**:
```bash
# Test webhook manually
curl -X POST https://your-n8n-instance.com/webhook/vtiger-sync \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Check N8N logs
docker logs n8n
```

### Supabase Connection Errors

**Check**:
1. Service role key (not anon key)
2. Supabase URL is correct
3. Database migrations are applied
4. RLS policies allow service role access

**Solution**:
```sql
-- Verify service role access
SELECT * FROM clients LIMIT 1;
```

### SendGrid Emails Not Sending

**Check**:
1. SendGrid API key is valid
2. Sender email is verified in SendGrid
3. Templates exist in SendGrid
4. Daily send limit not exceeded

**Solution**:
```bash
# Test SendGrid API
curl -X POST https://api.sendgrid.com/v3/mail/send \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"personalizations":[{"to":[{"email":"test@example.com"}]}], ...}'
```

### Twilio SMS Failures

**Check**:
1. Twilio credentials are correct
2. Phone number is verified (for trial accounts)
3. SMS is enabled for your account
4. From number is valid Twilio number

### vTiger Webhook Not Working

**Check**:
1. N8N webhook URL is publicly accessible
2. vTiger workflow is active
3. Webhook task is configured correctly
4. SSL certificate is valid (vTiger requires HTTPS)

## Advanced Configuration

### Rate Limiting

To avoid API rate limits:

**SendGrid**:
- Free tier: 100 emails/day
- Add delay between sends if needed

**Twilio**:
- Free trial: Limited sends
- Production: Monitor throughput

**Supabase**:
- Free tier: 500MB database, 2GB bandwidth
- Monitor query performance

### Scaling

For high-volume operations:

1. **N8N Workers**: Run multiple N8N instances
2. **Queue System**: Add Redis queue for async processing
3. **Batch Processing**: Group operations (e.g., bulk email sends)
4. **Caching**: Cache frequently accessed data

### Custom Workflows

To create new workflows:

1. Clone existing workflow as template
2. Modify trigger and nodes
3. Test with sample data
4. Document in this README
5. Export JSON to repository

## Development

### Testing Workflows Locally

```bash
# Use N8N CLI to execute workflow
n8n execute --id workflow-id

# Or use webhook test mode
n8n webhook --tunnel
```

### Workflow Versioning

- All JSON files are version controlled
- Export workflow after changes
- Commit to repository
- Document changes in git commit

### Environment-Specific Configuration

Use N8N environment variables:

```javascript
// In workflow nodes
{{ $env.SUPABASE_URL }}
{{ $env.SENDGRID_API_KEY }}
```

## Security

**Best Practices**:
- Never commit credentials to repository
- Use N8N credential store (encrypted)
- Rotate API keys regularly
- Use webhook authentication tokens
- Enable N8N basic auth for web access
- Use HTTPS for all webhooks
- Implement IP whitelist for webhooks if possible

**Credential Rotation**:
```bash
# Update in N8N UI: Settings → Credentials
# Or update environment variables and restart N8N
```

## Maintenance

**Weekly**:
- Review execution logs for errors
- Check SendGrid delivery rates
- Monitor Supabase query performance

**Monthly**:
- Review workflow performance metrics
- Optimize slow-running workflows
- Update email/SMS templates
- Rotate API credentials

**Quarterly**:
- Review and update lead scoring criteria
- Optimize email sequences based on metrics
- Audit webhook endpoints

## Related Documentation

- **Supabase Schema**: `../supabase/README.md`
- **Email Templates**: `../sales-marketing-engine/email-templates/README.md`
- **SMS Templates**: `../sales-marketing-engine/sms-templates/README.md`
- **MCP Server**: `../mcp-server/README.md`
- **Telegram Bot**: `../telegram-bot/README.md`

## Support

For workflow issues:
1. Check N8N execution logs
2. Verify credentials are current
3. Test individual nodes
4. Review N8N community forum
5. Check workflow JSON for errors

## Version History

- **1.0.0** (2025-11-19): Initial 5 core workflows
  - vTiger sync
  - Lead enrichment
  - Email automation
  - SMS instant response
  - Daily metrics aggregation

---

**Status**: ✅ Production Ready
**Maintained by**: ASI 360 Development Team
**Related**: PRD-001 (Sales Engine), PRD-003 (Supabase SUIS)
