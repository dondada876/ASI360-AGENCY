# ASI 360 Supabase MCP Server

Model Context Protocol (MCP) server that enables Claude Desktop to query ASI 360 business data using natural language.

## Features

- **10 Query Tools** for comprehensive business data access
- **Real-time Queries** to Supabase database
- **Natural Language Interface** via Claude Desktop
- **Type-Safe** TypeScript implementation
- **Secure** uses Supabase service role key

## Available Tools

### 1. `get_dashboard_summary`
Get CEO dashboard summary with all key metrics.

**Example queries:**
- "Show me my dashboard summary"
- "What's the current state of the business?"
- "How many P1 tasks do I have?"

### 2. `query_clients`
Query client data with optional filters.

**Parameters:**
- `client_type`: prospect, active, inactive, churned
- `industry`: Filter by industry
- `min_mrr`: Minimum monthly recurring revenue
- `limit`: Max results (default: 10)

**Example queries:**
- "Show me all active clients"
- "List clients with MRR over $2000"
- "Who are my restaurant clients?"

### 3. `query_revenue`
Get revenue data and trends for a date range.

**Parameters:**
- `start_date`: Start date (YYYY-MM-DD)
- `end_date`: End date (YYYY-MM-DD)
- `group_by`: day, week, month, service_line, client

**Example queries:**
- "What's my revenue this month?"
- "Show me revenue for the last 30 days"
- "Revenue breakdown by service line"

### 4. `query_pipeline`
Get sales pipeline status and opportunities.

**Parameters:**
- `stage`: prospecting, qualification, proposal, negotiation, closed-won, closed-lost
- `min_value`: Minimum opportunity value
- `assigned_to`: Filter by assigned user email

**Example queries:**
- "What's in my sales pipeline?"
- "Show me opportunities in proposal stage"
- "What deals are closing this week?"

### 5. `query_leads`
Get leads with optional filters.

**Parameters:**
- `lead_status`: new, contacted, qualified, unqualified, converted, dead
- `lead_source`: website, referral, google-ads, linkedin, etc.
- `min_score`: Minimum lead score (0-100)
- `limit`: Max results (default: 20)

**Example queries:**
- "Show me new leads today"
- "List qualified leads with score over 70"
- "Where are my leads coming from?"

### 6. `query_tasks`
Get tasks with filters.

**Parameters:**
- `priority`: P1, P2, P3, P4, P5, P6
- `status`: S1, S2, S3, S4, S5
- `venture_id`: Filter by venture UUID
- `department_code`: Filter by department (e.g., CH01.1)
- `due_date`: Filter by due date
- `limit`: Max results (default: 20)

**Example queries:**
- "What are my P1 tasks?"
- "Show overdue tasks"
- "What's due today?"

### 7. `query_ventures`
Get venture portfolio health and metrics.

**Parameters:**
- `strategic_priority`: core, growth, experimental, divest, shutdown
- `min_health_score`: Minimum health score (0-100)

**Example queries:**
- "How are my ventures doing?"
- "Show me ventures that need attention"
- "What's the health of Tesla EV Rentals?"

### 8. `log_time`
Log time spent on an activity.

**Parameters:**
- `duration_minutes`: Duration in minutes (required)
- `activity_type`: deep_work, meetings, admin, family, health, legal (required)
- `description`: Activity description (required)
- `venture_id`: Related venture UUID (optional)
- `department_code`: Department code (optional)
- `productivity_rating`: 1-5 (optional)

**Example queries:**
- "Log 90 minutes of deep work on Sales Engine development"
- "I spent 2 hours with Ashé playing games"
- "Log 30 minutes of admin work"

### 9. `get_client_health`
Get client health status including engagement and value metrics.

**Parameters:**
- `limit`: Max results (default: 10)
- `health_status`: healthy, check_in_needed, at_risk, needs_attention

**Example queries:**
- "Which clients need attention?"
- "Show me at-risk clients"
- "Who should I follow up with?"

### 10. `get_daily_metrics`
Get daily aggregated metrics for a specific date.

**Parameters:**
- `date`: Date (YYYY-MM-DD), defaults to yesterday

**Example queries:**
- "What were yesterday's metrics?"
- "Show me performance for November 15"
- "How many leads did I get yesterday?"

## Installation

### 1. Install Dependencies

```bash
cd infrastructure/mcp-server
npm install
```

### 2. Build TypeScript

```bash
npm run build
```

### 3. Configure Environment

Create `.env` file in `infrastructure/mcp-server/`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Security Note**: Service role key bypasses RLS. Keep it secret!

### 4. Configure Claude Desktop

Add to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "asi360-supabase": {
      "command": "node",
      "args": ["/absolute/path/to/ASI360-AGENCY/infrastructure/mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key"
      }
    }
  }
}
```

**Important**: Use absolute paths, not relative paths!

### 5. Restart Claude Desktop

Quit Claude Desktop completely and restart it.

## Testing

### Test with MCP Inspector

```bash
npm run inspector
```

This launches an interactive inspector to test all tools.

### Test in Claude Desktop

Try these queries:

```
"Show me my dashboard summary"
"What are my P1 tasks?"
"How many leads did I get yesterday?"
"What's my revenue this month?"
"Which clients need attention?"
```

## Usage Examples

### Morning Briefing

```
You: "Give me my morning briefing"

Claude will use:
- get_dashboard_summary (overview)
- query_tasks (today's P1/P2 tasks)
- get_client_health (clients needing follow-up)
- get_daily_metrics (yesterday's performance)
```

### Sales Pipeline Review

```
You: "Review my sales pipeline"

Claude will use:
- query_pipeline (all opportunities)
- query_leads (new leads to qualify)
- query_revenue (recent closed deals)
```

### End of Day Logging

```
You: "Log my time today: 3 hours on development, 1 hour meetings, 2 hours with Ashé"

Claude will use:
- log_time (multiple times for each activity)
```

### Client Check-in

```
You: "Which clients should I reach out to this week?"

Claude will use:
- get_client_health (at_risk or needs_attention)
- query_communications (last contact dates)
```

## Development

### Watch Mode

```bash
npm run dev
```

This rebuilds on file changes.

### Project Structure

```
mcp-server/
├── src/
│   ├── index.ts           # Main server implementation
│   ├── tools/             # Future: separate tool implementations
│   └── utils/             # Future: helper utilities
├── dist/                  # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

### Error: "SUPABASE_URL not set"

**Solution**: Add environment variables to `.env` file or Claude Desktop config.

### Error: "Tool not found"

**Solution**: Restart Claude Desktop after config changes.

### Error: "RLS policy violation"

**Solution**: Ensure using `SUPABASE_SERVICE_ROLE_KEY`, not `SUPABASE_ANON_KEY`.

### Error: "Cannot find module"

**Solution**: Run `npm run build` to compile TypeScript.

### Claude Desktop doesn't show tools

**Solution**:
1. Check config file path is correct
2. Use absolute paths (not `~` or relative)
3. Restart Claude Desktop completely
4. Check Claude Desktop logs: `~/Library/Logs/Claude/mcp*.log`

## Security Best Practices

1. **Never commit `.env` file** - already in .gitignore
2. **Use service role key only in trusted environments** - MCP server runs locally
3. **Rotate keys if exposed** - generate new service role key in Supabase
4. **Limit tool access if needed** - modify `tools` array in `index.ts`

## Performance

- **Query speed**: <2 seconds for most queries
- **Dashboard summary**: ~1 second
- **Large result sets**: Use `limit` parameter to avoid slowdowns

## Future Enhancements

- [ ] Add caching for frequently accessed data
- [ ] Implement batch operations
- [ ] Add data visualization tools
- [ ] Natural language to SQL translation
- [ ] Automated insights and recommendations
- [ ] Integration with external APIs (Stripe, SendGrid)

## Support

For issues:
1. Check MCP server logs: `~/Library/Logs/Claude/mcp*.log`
2. Test with inspector: `npm run inspector`
3. Verify Supabase connection: check credentials
4. Review this README for configuration

## Version History

- **1.0.0** (2025-11-19): Initial release with 10 query tools

---

**Status**: ✅ Ready for use
**Maintained by**: ASI 360 Development Team
**Documentation**: PRD-003 Supabase Unified Intelligence System
