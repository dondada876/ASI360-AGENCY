# ASI 360 Sales & Marketing Engine

Complete sales and marketing automation system built on N8N, SendGrid, and Twilio. This engine automates lead nurturing, qualification, and conversion through multi-channel campaigns (email + SMS).

## Overview

The Sales & Marketing Engine is the execution layer that sits on top of the Supabase SUIS (Unified Intelligence System). It automatically:

1. **Qualifies leads** using intelligent scoring algorithms
2. **Nurtures prospects** through automated email sequences
3. **Engages immediately** via SMS within 5 minutes
4. **Tracks everything** in your unified Supabase database
5. **Reports daily** on performance metrics

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Sales & Marketing Engine                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   N8N        │───▶│   SendGrid   │    │   Twilio     │      │
│  │  Workflows   │    │   (Email)    │    │    (SMS)     │      │
│  └──────┬───────┘    └──────────────┘    └──────────────┘      │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────┐      │
│  │         Supabase Unified Intelligence System          │      │
│  │  (leads, clients, communications, daily_metrics)      │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Query Interfaces      │
              ├────────────────────────┤
              │  • MCP Server          │
              │  • Telegram Bot        │
              │  • CEO Dashboard       │
              └────────────────────────┘
```

## Components

### 1. N8N Automation Workflows

Five core workflows power the engine:

| Workflow | File | Purpose |
|----------|------|---------|
| vTiger Sync | `../n8n-workflows/01_vtiger_supabase_sync.json` | Bidirectional CRM sync |
| Lead Enrichment | `../n8n-workflows/02_lead_enrichment_scoring.json` | Auto-score and qualify |
| Email Automation | `../n8n-workflows/03_email_automation_sequences.json` | Multi-touch nurture campaigns |
| SMS Response | `../n8n-workflows/04_sms_instant_response.json` | 5-minute SMS rule |
| Daily Metrics | `../n8n-workflows/05_daily_metrics_aggregation.json` | Performance tracking |

**See**: `../n8n-workflows/README.md` for detailed workflow documentation.

### 2. Email Campaign Templates

Pre-built, conversion-optimized email sequences:

**Restaurant Vertical** (7 emails / 21 days):
- Day 0: Welcome + case study
- Day 2: Social proof (testimonials)
- Day 5: Educational content
- Day 8: Value proposition
- Day 12: Objection handling
- Day 16: Success stories
- Day 21: Final CTA

**SMB Vertical** (5 emails / 14 days):
- Day 0: Welcome + quick wins
- Day 3: ROI calculator
- Day 7: Case study
- Day 10: Limited offer
- Day 14: Final CTA

**Template Files**:
- `email-templates/restaurant-day-0-welcome.html`
- `email-templates/restaurant-day-2-social-proof.html`
- `email-templates/restaurant-day-21-final-cta.html`
- `email-templates/smb-day-0-welcome.html`
- `email-templates/smb-day-14-final-cta.html`

### 3. SMS Message Templates

Industry-specific SMS templates with <300 characters:

**Industries Covered**:
- Restaurant (online ordering focus)
- SMB Tech/SaaS (automation focus)
- Professional Services (client acquisition)
- E-commerce (abandoned cart, reviews)
- Generic fallback (for unmatched industries)

**Template Categories**:
- Initial contact (5-minute rule)
- Qualified high-score leads (2-minute priority)
- Follow-up sequences (Day 3, 7, 14, 30)
- Event-triggered (form completions, no-shows, proposals)
- Re-engagement (inactive leads, past customers)
- Response handlers (YES, NO, MORE INFO)

**Template File**: `sms-templates/instant-response-templates.json`

## Lead Scoring Algorithm

Every lead is automatically scored 0-100 based on:

### Scoring Criteria

| Factor | Max Points | Criteria |
|--------|-----------|----------|
| **Contact Completeness** | 35 | Full name (10), Email (10), Phone (10), Company (5) |
| **Lead Source** | 25 | Referral (25), Inbound (20), Event (15), Outbound (10), Other (5) |
| **Industry Match** | 15 | Target industry (15), Adjacent (10), Other (0) |
| **Company Size** | 10 | 11-50 employees (10), 51-200 (8), 1-10 (5), 201+ (5) |
| **Budget/Timeline** | 25 | Budget + immediate timeline (25), Budget only (15), Timeline only (10), Neither (0) |

### Automatic Actions by Score

- **Score ≥ 70**: Create P1 task, send Telegram alert to CEO, accelerate nurture
- **Score 40-69**: Standard nurture sequence, mark as "contacted"
- **Score < 40**: Mark as "unqualified", light touch nurture or discard

### Implementation

See `../n8n-workflows/02_lead_enrichment_scoring.json` lines 47-67 for scoring function.

## Email Campaigns

### Personalization Variables

All email templates support these variables:

| Variable | Source | Example |
|----------|--------|---------|
| `{{firstName}}` | Lead/Contact name | "John" |
| `{{lastName}}` | Lead/Contact name | "Smith" |
| `{{companyName}}` | Lead/Client company | "Bay Area Bistro" |
| `{{senderName}}` | ENV or hardcoded | "Don Dada" |
| `{{senderEmail}}` | ENV | "ceo@asi360.com" |
| `{{senderPhone}}` | ENV | "(415) 555-1234" |
| `{{calendarLink}}` | Calendly/Cal.com | "https://calendly.com/..." |
| `{{estimatedMonthlyOrders}}` | Calculated | "10000" |
| `{{projectedSavings}}` | Calculated | "2500" |
| `{{unsubscribeLink}}` | SendGrid auto | Dynamic per recipient |

### SendGrid Setup

1. **Import Templates**:
   ```bash
   # Convert HTML to SendGrid dynamic templates
   # Upload via SendGrid UI: Marketing → Dynamic Templates
   ```

2. **Configure Sender**:
   - Verify domain: `asi360.com`
   - Create sender identity: `ceo@asi360.com`
   - Enable DKIM/SPF for deliverability

3. **Create Campaigns**:
   - Restaurant Sequence (7 templates)
   - SMB Sequence (5 templates)
   - Map template IDs in N8N workflow

4. **Tracking**:
   - Enable open tracking
   - Enable click tracking
   - Webhook for unsubscribes → N8N → Supabase

**N8N Integration**: See workflow `03_email_automation_sequences.json`

## SMS Campaigns

### 5-Minute Rule

**Principle**: Leads who receive contact within 5 minutes are 100x more likely to convert than those contacted after 30 minutes.

**Implementation**:
1. N8N checks for new leads every 2 minutes
2. Finds leads created in last 5 minutes
3. Filters out already-contacted leads
4. Selects industry-appropriate SMS template
5. Personalizes with lead data
6. Sends via Twilio API
7. Logs to `communications` table

**Workflow**: `04_sms_instant_response.json`

### Twilio Setup

1. **Get Twilio Account**:
   - Sign up: https://www.twilio.com/try-twilio
   - Get Account SID and Auth Token
   - Purchase phone number (or use trial number)

2. **Configure Messaging**:
   ```bash
   # In N8N credentials or .env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your-auth-token
   TWILIO_FROM_NUMBER=+14155551234
   ```

3. **Set Up Webhooks** (for inbound SMS):
   - Twilio Console → Phone Numbers → Your Number
   - Messaging → Webhook: `https://your-n8n.com/webhook/sms-inbound`
   - Method: POST
   - N8N workflow handles replies and logs to Supabase

4. **Compliance**:
   - Only SMS leads who provided phone number
   - Include sender name in every message
   - Honor STOP/UNSUBSCRIBE immediately
   - See `sms-templates/instant-response-templates.json` → best_practices → compliance

### Response Handling

Automated responses for common replies:

- **"YES"** → Send calendar link immediately
- **"NO"** → Polite acknowledgment, add to suppression list
- **"PRICING"** → Trigger email with pricing, log as high-intent
- **"STOP"** → Add to suppression list, never contact again
- **Complex question** → Flag for human follow-up, notify CEO

## Campaign Performance Metrics

### Key Performance Indicators (KPIs)

**Email**:
- Open rate (target: >25%)
- Click-through rate (target: >3%)
- Conversion rate (target: >10% email → meeting)
- Unsubscribe rate (target: <0.5%)

**SMS**:
- Response rate (target: >30%)
- Response time (average time to reply)
- Conversion rate (target: >15% SMS → call booked)
- Opt-out rate (target: <1%)

**Overall**:
- Lead velocity (new leads/day)
- Lead-to-opportunity conversion (target: >25%)
- Opportunity-to-close (target: >30%)
- Average sales cycle (target: <30 days)

### Tracking

All campaign activities logged to Supabase `communications` table:

```sql
CREATE TABLE communications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id),
    contact_id UUID REFERENCES contacts(id),
    lead_id UUID REFERENCES leads(id),
    communication_type VARCHAR(50), -- 'email', 'sms', 'call', 'meeting'
    direction VARCHAR(20), -- 'inbound', 'outbound'
    subject TEXT,
    content TEXT,
    sent_at TIMESTAMP,
    status VARCHAR(50), -- 'sent', 'delivered', 'opened', 'clicked', 'failed'
    campaign_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);
```

Daily metrics aggregated by workflow `05_daily_metrics_aggregation.json`.

## Installation & Setup

### Prerequisites

1. **Supabase SUIS deployed** (see `../supabase/README.md`)
2. **N8N installed** (see `../n8n-workflows/README.md`)
3. **SendGrid account** (free tier works for testing)
4. **Twilio account** (free trial for testing)

### Step-by-Step Setup

#### 1. Configure SendGrid

```bash
# Get API key from SendGrid
# https://app.sendgrid.com/settings/api_keys

# Add to N8N credentials:
# Name: SendGrid - ASI360
# API Key: SG.your-key-here

# Verify sender email in SendGrid:
# Settings → Sender Authentication
```

#### 2. Configure Twilio

```bash
# Get credentials from Twilio Console
# https://www.twilio.com/console

# Add to N8N credentials:
# Name: Twilio - ASI360
# Account SID: ACxxxxx
# Auth Token: your-token

# Purchase phone number if not using trial
```

#### 3. Import Email Templates to SendGrid

1. Go to SendGrid → Marketing → Dynamic Templates
2. Create new template for each email
3. Copy HTML from `email-templates/*.html`
4. Paste into template editor
5. Note template IDs
6. Update N8N workflow with template IDs

#### 4. Import N8N Workflows

```bash
# See ../n8n-workflows/README.md for detailed instructions

# Quick version:
cd infrastructure/n8n-workflows
# Import each JSON file via N8N UI
# Configure credentials
# Activate workflows
```

#### 5. Test End-to-End

**Test Email Campaign**:
1. Create test lead in Supabase with industry = "restaurant"
2. Wait for hourly email workflow to run
3. Check lead's email for Day 0 welcome message
4. Verify logged in `communications` table

**Test SMS 5-Minute Rule**:
1. Create new lead with phone number
2. Wait 2 minutes (workflow runs every 2 min)
3. Check phone for SMS
4. Reply "YES"
5. Verify calendar link received
6. Check `communications` table for log

**Test Lead Scoring**:
1. Create lead with complete info, referral source, target industry
2. Wait 5 minutes (workflow runs every 5 min)
3. Check lead record - should have score ≥70
4. Verify P1 task created in `master_tasks`
5. Check Telegram for CEO alert

## Customization

### Adding New Email Sequences

1. **Create HTML template**:
   ```bash
   cp email-templates/restaurant-day-0-welcome.html \
      email-templates/new-vertical-day-0-welcome.html
   ```

2. **Edit content**: Update value propositions, case studies, CTAs

3. **Upload to SendGrid**: Create dynamic template, note ID

4. **Update N8N workflow**:
   ```json
   // In 03_email_automation_sequences.json
   // Add new condition for your vertical
   {
     "keyName": "industry",
     "value": "your-new-vertical",
     "condition": "equals"
   }
   // Map to SendGrid template ID
   ```

### Adding New SMS Templates

1. **Edit JSON**:
   ```bash
   nano sms-templates/instant-response-templates.json
   ```

2. **Add new industry section**:
   ```json
   "your_industry": {
     "initial_contact": {
       "template": "Hi {{firstName}}! ...",
       "char_count": 200,
       "variables": ["firstName", "companyName"],
       "trigger": "New lead created, industry = 'your-industry'",
       "send_within": "5 minutes"
     }
   }
   ```

3. **Update N8N workflow** (`04_sms_instant_response.json`):
   - Add industry matching logic
   - Map to new template

### Adjusting Lead Scoring

Edit `02_lead_enrichment_scoring.json`, lines 47-67:

```javascript
let score = 0;

// Contact info (max 35)
if (lead.company_name) score += 5;
if (lead.email) score += 10;
if (lead.phone) score += 10;
if (lead.first_name && lead.last_name) score += 10;

// Lead source (max 25)
if (lead.lead_source === 'referral') score += 25;
else if (lead.lead_source === 'inbound') score += 20;
else if (lead.lead_source === 'event') score += 15;

// Industry match (max 15) - CUSTOMIZE THIS
if (['restaurant', 'food-service'].includes(lead.industry)) score += 15;
else if (['retail', 'ecommerce'].includes(lead.industry)) score += 10;

// Budget/timeline (max 25)
if (lead.has_budget && lead.timeline === 'immediate') score += 25;
// ... etc
```

## Troubleshooting

### Email Not Sending

**Check**:
1. SendGrid API key is valid (test in Postman)
2. Sender email is verified in SendGrid
3. Template IDs in N8N match SendGrid templates
4. Lead has valid email address
5. N8N workflow `03_email_automation` is active

**Debug**:
```bash
# Check N8N execution logs
# N8N UI → Executions → 03_email_automation_sequences
# Look for errors in SendGrid node

# Check Supabase communications table
SELECT * FROM communications
WHERE communication_type = 'email'
ORDER BY created_at DESC LIMIT 10;
```

### SMS Not Sending

**Check**:
1. Twilio credentials are correct
2. FROM number is valid Twilio number
3. Lead phone number is valid (E.164 format: +1XXXXXXXXXX)
4. N8N workflow `04_sms_instant_response` is active
5. Not hitting Twilio rate limits (free tier: limited sends)

**Debug**:
```bash
# Check Twilio logs
# https://www.twilio.com/console/sms/logs

# Check N8N execution
# Look for Twilio API errors

# Test Twilio directly
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$ACCOUNT_SID/Messages.json" \
  -d "From=$FROM_NUMBER" \
  -d "To=+1XXXXXXXXXX" \
  -d "Body=Test message" \
  -u "$ACCOUNT_SID:$AUTH_TOKEN"
```

### Lead Scoring Not Working

**Check**:
1. Workflow `02_lead_enrichment_scoring` is active
2. Workflow schedule is correct (every 5 minutes)
3. Leads exist in `leads` table
4. Leads were created recently (scoring runs on leads without scores)

**Debug**:
```sql
-- Check leads without scores
SELECT * FROM leads
WHERE lead_score IS NULL
ORDER BY created_at DESC;

-- Check workflow execution in N8N UI
```

### Campaign Metrics Missing

**Check**:
1. Workflow `05_daily_metrics_aggregation` is active
2. Schedule is correct (daily at 1 AM)
3. Supabase connection is working
4. `daily_metrics` table exists

**Manual Trigger**:
```bash
# In N8N UI:
# Open workflow 05_daily_metrics_aggregation
# Click "Execute Workflow" button (test)
# Check if data inserted into daily_metrics table
```

## Security & Compliance

### Email Compliance (CAN-SPAM)

- ✅ Include sender name and address
- ✅ Provide clear unsubscribe link in every email
- ✅ Honor unsubscribe requests within 10 days (we do it immediately)
- ✅ Don't use deceptive subject lines
- ✅ Include physical address in footer (optional but recommended)

### SMS Compliance (TCPA)

- ✅ Obtain prior express written consent (lead provides phone number)
- ✅ Include sender identification in every message
- ✅ Provide opt-out instructions (STOP keyword)
- ✅ Honor opt-out immediately (added to suppression list)
- ✅ Don't use auto-dialers for SMS (we use Twilio API, which is compliant)

### Data Privacy (GDPR/CCPA)

- ✅ Store only necessary data
- ✅ Provide data export (via MCP Server or Telegram Bot)
- ✅ Honor deletion requests (delete from Supabase)
- ✅ Secure API keys (N8N credential encryption)
- ✅ Log all communications (audit trail in `communications` table)

## Performance & Scaling

### Current Capacity

**Free/Starter Tiers**:
- SendGrid Free: 100 emails/day
- Twilio Trial: Limited SMS (need verified numbers)
- N8N Self-hosted: Unlimited workflows
- Supabase Free: 500MB DB, 2GB bandwidth

**Recommended for Production**:
- SendGrid Essentials: $19.95/mo (50K emails/month)
- Twilio Pay-as-you-go: $0.0079/SMS (U.S.)
- N8N Cloud Starter: $20/mo (unlimited workflows)
- Supabase Pro: $25/mo (8GB DB, 100GB bandwidth)

### Scaling Strategies

**High-Volume Email** (>10K/day):
1. Batch sends in N8N (group by 100s)
2. Add delays between batches
3. Use SendGrid sending IPs (warm up gradually)
4. Monitor bounce/complaint rates

**High-Volume SMS** (>1K/day):
1. Use Twilio Messaging Service (not individual number)
2. Implement queuing in N8N
3. Respect rate limits (100 SMS/sec for most)
4. A2P 10DLC registration for high throughput

**Workflow Performance**:
1. Run N8N on dedicated server (not shared hosting)
2. Use N8N workers for parallel processing
3. Optimize database queries (add indexes)
4. Cache frequently accessed data (Redis)

## Maintenance

### Weekly Tasks

- Review N8N execution logs for errors
- Check SendGrid delivery rates (>95%)
- Monitor SMS opt-out rate (<1%)
- Review lead scoring accuracy (manual spot-checks)

### Monthly Tasks

- Analyze campaign performance (open rates, CTR, conversions)
- Update email templates based on A/B test results
- Rotate API credentials (SendGrid, Twilio)
- Review and optimize lead scoring criteria
- Check Supabase database size and clean old data if needed

### Quarterly Tasks

- Audit all workflows for efficiency
- Review compliance (CAN-SPAM, TCPA, GDPR)
- Update SMS templates based on response rates
- Create new email sequences for emerging verticals
- Conduct full end-to-end test of all campaigns

## Resources

### Documentation

- **N8N Workflows**: `../n8n-workflows/README.md`
- **Supabase Database**: `../supabase/README.md`
- **Email Templates**: `email-templates/` (HTML files)
- **SMS Templates**: `sms-templates/instant-response-templates.json`

### External References

- **SendGrid Docs**: https://docs.sendgrid.com/
- **Twilio SMS Docs**: https://www.twilio.com/docs/sms
- **N8N Docs**: https://docs.n8n.io/
- **Supabase Docs**: https://supabase.com/docs

### Related Systems

- **MCP Server**: `../mcp-server/README.md` (query interface)
- **Telegram Bot**: `../telegram-bot/README.md` (mobile access)
- **PRD-001**: `../../PRDS/Sales_and_Marketing_Engine.md` (requirements)

## Support

For issues with the Sales & Marketing Engine:

1. Check workflow execution logs in N8N
2. Verify API credentials (SendGrid, Twilio)
3. Test individual components (email, SMS) separately
4. Review Supabase logs for database errors
5. Consult troubleshooting section above

## Changelog

### Version 1.0.0 (2025-11-19)

Initial release:
- 5 N8N automation workflows
- 5 email campaign templates (Restaurant + SMB sequences)
- 15+ SMS message templates across 6 industries
- Lead scoring algorithm (0-100 scale)
- Full SendGrid and Twilio integration
- Daily metrics aggregation and reporting
- Comprehensive documentation

---

**Status**: ✅ Production Ready
**Maintained by**: ASI 360 Development Team
**Related PRDs**: PRD-001 (Sales Engine), PRD-003 (Supabase SUIS)
