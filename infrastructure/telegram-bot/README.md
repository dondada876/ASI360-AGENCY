# ASI 360 Telegram Bot

Mobile command center for ASI 360 business intelligence. Access all your business data on-the-go via Telegram.

## Features

- **10+ Commands** for quick data access
- **Natural Language Queries** powered by Claude AI
- **Real-time Data** from Supabase
- **Time Logging** directly from mobile
- **Secure** - authorized user only
- **Fast** - responses in <3 seconds

## Available Commands

### Dashboard & Overview
- `/start` - Welcome message and quick start
- `/help` - Full command list
- `/dashboard` - Complete CEO dashboard summary
- `/ventures` - Portfolio health across all ventures

### Sales & Revenue
- `/revenue [today|week|month|year]` - Revenue summary for period
- `/pipeline` - Current sales pipeline by stage
- `/leads [status]` - Lead list (new, contacted, qualified, etc.)
- `/clients [type]` - Client list (active, prospect, etc.)

### Tasks & Time
- `/tasks [P1|P2|P3]` - Task list by priority
- `/today` - Today's priorities
- `/log <minutes> <activity>` - Log time spent

### Analytics
- `/metrics [date]` - Daily metrics for specific date
- `/health` - Client health status

### Natural Language
Just ask questions:
- "How many leads today?"
- "Show me at-risk clients"
- "What's my revenue this week?"
- "Which tasks are overdue?"

## Installation

### 1. Create Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot`
3. Follow prompts to name your bot
4. Save the bot token (looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Get Your User ID

1. Message [@userinfobot](https://t.me/userinfobot) on Telegram
2. It will reply with your User ID
3. Save this number (e.g., `123456789`)

### 3. Install Dependencies

```bash
cd infrastructure/telegram-bot
npm install
```

### 4. Configure Environment

Create `.env` file in `infrastructure/telegram-bot/`:

```bash
# Telegram Configuration
TELEGRAM_BOT_TOKEN=your-bot-token-here
AUTHORIZED_USER_ID=your-telegram-user-id

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Anthropic API (optional - for natural language)
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 5. Build and Start

```bash
npm run build
npm start
```

The bot will start and connect to Telegram.

### 6. Test

1. Open Telegram
2. Find your bot (search for the name you gave it)
3. Send `/start`
4. Try some commands!

## Deployment Options

### Option 1: Local Development

```bash
npm run dev
```

Runs locally, great for testing.

### Option 2: PM2 (Recommended for Production)

```bash
# Install PM2
npm install -g pm2

# Start bot with PM2
pm2 start dist/index.js --name asi360-bot

# Save PM2 config
pm2 save

# Set up auto-restart on reboot
pm2 startup
```

### Option 3: Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

CMD ["npm", "start"]
```

```bash
docker build -t asi360-telegram-bot .
docker run -d --env-file .env asi360-telegram-bot
```

### Option 4: VPS Deployment

```bash
# On your VPS (Ubuntu/Debian)
cd /opt
git clone https://github.com/dondada876/ASI360-AGENCY.git
cd ASI360-AGENCY/infrastructure/telegram-bot

# Install Node.js (if needed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Setup
npm install
npm run build

# Create .env file with your credentials
nano .env

# Start with PM2
npm install -g pm2
pm2 start dist/index.js --name asi360-bot
pm2 save
pm2 startup
```

## Usage Examples

### Morning Briefing

```
You: /dashboard

Bot: 📊 CEO Dashboard Summary

Portfolio:
• Ventures: 4 (3 healthy, 1 critical)

Tasks:
• P1 Tasks: 5
• Overdue: 2
• Today's Priorities: 3

Revenue:
• This Week: $12,450

...
```

### Quick Revenue Check

```
You: /revenue week

Bot: 💰 Revenue Summary (week)

Total Revenue: $12,450
• Recurring: $8,200
• One-time: $4,250

Transactions: 15
```

### Check Pipeline

```
You: /pipeline

Bot: 🎯 Sales Pipeline

prospecting
• Opportunities: 3
• Total Value: $35,000
• Weighted: $17,500
• Avg Probability: 50%

...
```

### Log Time

```
You: /log 120 Quality time with Ashé - reading and games

Bot: ✅ Logged 120 minutes of family: Quality time with Ashé - reading and games
```

### Natural Language

```
You: Which clients need follow-up?

Bot: Based on your client health data, these clients need attention:
• Bay Area Bistro - Last contact 45 days ago
• TechStart SF - Last contact 32 days ago

Use /health to see full client health report.
```

## Command Reference

### /dashboard
Shows complete CEO summary:
- Venture count and health
- P1 tasks and overdue tasks
- Weekly revenue
- Time with Ashé (today and this week)
- Legal fund balance

### /revenue [period]
Periods: `today`, `week`, `month`, `year`
Default: month

Shows:
- Total revenue
- Recurring vs one-time breakdown
- Transaction count

### /pipeline
Shows sales pipeline by stage:
- Opportunity count per stage
- Total and weighted values
- Average probability
- Total pipeline value

### /leads [status]
Status: `new`, `contacted`, `qualified`, `unqualified`, `converted`, `dead`
Default: new

Shows up to 10 leads with:
- Name and company
- Lead score
- Source
- Contact info

### /tasks [priority]
Priority: `P1`, `P2`, `P3`, `P4`, `P5`, `P6`
Default: P1

Shows up to 15 tasks with:
- Task identifier
- Description
- Due date
- Pomodoro progress

### /clients [type]
Type: `active`, `prospect`, `inactive`, `churned`
Default: active

Shows up to 10 clients with:
- Company name
- MRR and LTV
- Industry

### /ventures
Shows all active ventures with:
- Health score and status emoji
- Stage and ARR
- Critical and overdue tasks

### /log <minutes> <activity>
Log time spent on activities.

Examples:
```
/log 90 Deep work on Sales Engine
/log 120 Family time with Ashé
/log 30 Client meeting with Bay Area Tech
/log 45 Exercise and health
```

Activity type auto-detected from keywords:
- "ashé", "family" → family
- "health", "exercise" → health
- "meeting" → meetings
- "legal" → legal
- "dev", "code" → deep_work
- Otherwise → admin

## Troubleshooting

### Bot doesn't respond

**Check**:
1. Bot token is correct
2. Bot is running (`pm2 list` if using PM2)
3. Check logs: `pm2 logs asi360-bot`

### "Unauthorized" message

**Solution**: Your Telegram User ID doesn't match `AUTHORIZED_USER_ID` in `.env`.
Get your ID from @userinfobot and update `.env`.

### "Error fetching data"

**Check**:
1. Supabase credentials are correct
2. Supabase database is deployed with all migrations
3. Service role key (not anon key) is used

### Natural language doesn't work

**Solution**: Add `ANTHROPIC_API_KEY` to `.env`. Without it, bot suggests commands instead.

### Bot stops randomly

**Solution**: Use PM2 for auto-restart:
```bash
pm2 start dist/index.js --name asi360-bot
pm2 save
```

## Security

- **Authorization**: Only specified user ID can use bot
- **Service Role Key**: Required for Supabase access (keep secret!)
- **API Keys**: Never commit `.env` file
- **Telegram Token**: Don't share bot token

## Performance

- **Response Time**: <3 seconds for most queries
- **Rate Limits**: Telegram allows ~30 messages/second
- **Concurrent Users**: 1 (CEO only by design)

## Future Enhancements

- [ ] Voice message support
- [ ] Quick reply buttons
- [ ] Charts and graphs (as images)
- [ ] Scheduled reports (morning briefing)
- [ ] Push notifications for alerts
- [ ] Multi-user support with permissions

## Development

### Watch Mode

```bash
npm run watch
```

Rebuilds on file changes.

### Testing Locally

```bash
npm run dev
```

### Project Structure

```
telegram-bot/
├── src/
│   ├── index.ts              # Main bot implementation
│   ├── commands/             # Future: separate command handlers
│   └── utils/                # Future: helper utilities
├── dist/                     # Compiled JavaScript (generated)
├── .env                      # Environment variables (not committed)
├── .env.example              # Template
├── package.json
├── tsconfig.json
└── README.md
```

## Support

For issues:
1. Check bot is running: `pm2 list`
2. View logs: `pm2 logs asi360-bot`
3. Test Supabase connection independently
4. Verify bot token with @BotFather

## Version History

- **1.0.0** (2025-11-19): Initial release with 10+ commands

---

**Status**: ✅ Ready for deployment
**Maintained by**: ASI 360 Development Team
**Related**: PRD-003 Supabase SUIS, MCP Server
