# ASI 360 Automation Engine

Python-based automation service that handles Supabase → WordPress synchronization and workflow automation.

## Features

- **Supabase Integration** - Monitor and sync data from Supabase tables
- **WordPress Automation** - Auto-publish content to client WordPress sites
- **AI Content Enhancement** - Use Claude AI to enhance and generate content
- **Container Health Monitoring** - Monitor and manage Docker containers
- **Scheduled Tasks** - Automated workflows running on schedule
- **Daily Reporting** - Generate and store automation reports

## Technology Stack

- **Python 3.11** - Runtime environment
- **Flask** - Health check API
- **Supabase Python SDK** - Database integration
- **Anthropic SDK** - AI content generation
- **Docker SDK** - Container management
- **Schedule** - Task scheduling

## Environment Variables

Required environment variables (set in `.env`):

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-service-key
ANTHROPIC_API_KEY=sk-ant-api03-your-key
```

## Supabase Tables

The engine expects these tables:

### wordpress_queue
```sql
CREATE TABLE wordpress_queue (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  site_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  status TEXT DEFAULT 'pending',
  use_ai BOOLEAN DEFAULT false,
  ai_prompt TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### automation_reports
```sql
CREATE TABLE automation_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_syncs INTEGER,
  last_sync TIMESTAMP WITH TIME ZONE,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Scheduled Tasks

- **Every 5 minutes** - Sync Supabase → WordPress
- **Every hour** - Check container health
- **Every day** - Generate daily reports

## Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run engine
python engine.py
```

## Docker Build

```bash
# Build image
docker build -t asi360-automation-engine .

# Run container
docker run -p 5000:5000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e SUPABASE_URL=your-url \
  -e SUPABASE_KEY=your-key \
  -e ANTHROPIC_API_KEY=your-key \
  asi360-automation-engine
```

## API Endpoints

- `GET /health` - Health check
- `GET /stats` - Automation statistics

## Workflow

1. **Monitor Supabase** - Check `wordpress_queue` table for pending items
2. **AI Enhancement** - If `use_ai` is true, enhance content with Claude
3. **WordPress Publish** - Push content to target WordPress site
4. **Update Status** - Mark item as completed or failed in Supabase
5. **Health Monitoring** - Check all containers every hour
6. **Daily Reports** - Store daily statistics in Supabase

## Logging

Logs are written to:
- `/app/logs/automation.log` (inside container)
- Console output with color-coded messages

## Production Deployment

The engine is automatically deployed via docker-compose.yml:

```bash
cd infrastructure/docker
docker-compose up -d automation_engine
```

## Security

- Service key required for Supabase (not anonymous key)
- Docker socket access for container management
- Environment variables stored securely
- Error handling and logging

## License

Proprietary - ASI 360 Agency
