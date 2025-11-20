# ASI 360 Agency Portal

Web-based dashboard for managing multi-client WordPress hosting infrastructure.

## Features

- **Client Management** - Add, view, and manage client sites
- **Real-time Monitoring** - View container status and uptime
- **AI Content Generation** - Generate WordPress content using Claude AI
- **Supabase Integration** - Store and sync client data
- **Docker Integration** - Monitor and manage WordPress containers

## Technology Stack

- **Node.js 18** - Runtime environment
- **Express** - Web framework
- **EJS** - Templating engine
- **Supabase** - Database and real-time features
- **Anthropic Claude** - AI content generation
- **Docker** - Containerization

## Environment Variables

Required environment variables (set in `.env`):

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
ANTHROPIC_API_KEY=sk-ant-api03-your-key
PORT=3000
NODE_ENV=production
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run in production mode
npm start
```

## Docker Build

```bash
# Build image
docker build -t asi360-agency-portal .

# Run container
docker run -p 3000:3000 \
  -e SUPABASE_URL=your-url \
  -e SUPABASE_KEY=your-key \
  -e ANTHROPIC_API_KEY=your-key \
  asi360-agency-portal
```

## API Endpoints

- `GET /` - Dashboard view
- `GET /api/health` - Health check
- `GET /api/clients` - List all clients
- `POST /api/clients` - Create new client
- `POST /api/generate-content` - Generate AI content
- `GET /api/containers` - List Docker containers

## Supabase Schema

The portal expects a `clients` table in Supabase:

```sql
CREATE TABLE clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Production Deployment

The portal is automatically deployed via docker-compose.yml:

```bash
cd infrastructure/docker
docker-compose up -d agency_portal
```

Access at: `https://portal.asi360.com` (configure DNS and Traefik labels)

## Security

- Environment variables stored in `.env` (gitignored)
- CORS enabled for API access
- Health checks for container monitoring
- Production-ready error handling

## License

Proprietary - ASI 360 Agency
