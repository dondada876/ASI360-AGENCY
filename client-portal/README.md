# ASI 360 Client Portal

Self-service portal for ASI 360 project clients. View project status, create support cases, leave comments, and receive notifications.

**Live URL:** https://portal.asi360.co (port 3210 on droplet)
**VTiger Project:** PROJ369

## Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Auth:** Supabase Auth (cookie-based SSR)
- **Database:** Supabase (`gtfffxwfgcxiiauliynd`) — shared with internal dashboard
- **Cases:** VTiger HelpDesk via Gateway API (`104.248.69.86:8443`)
- **UI:** Tailwind CSS v4 with dark/light theme (next-themes)
- **Deploy:** PM2 + Nginx on DigitalOcean droplet

## Quick Start

```bash
cd client-portal
npm install
cp .env.local.example .env.local  # Add your Supabase keys
npm run dev                        # http://localhost:3000
```

### Environment Variables (.env.local)

Only two bootstrap vars needed — all other secrets come from Supabase Vault at runtime:

```
NEXT_PUBLIC_SUPABASE_URL=https://gtfffxwfgcxiiauliynd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_KEY=<service_role_key>
GATEWAY_URL=http://104.248.69.86:8443
NEXT_PUBLIC_PORTAL_URL=https://portal.asi360.co
```

## Architecture

```
Browser → Next.js (SSR + API routes) → Supabase (auth + data)
                                     → Gateway → VTiger (cases)
```

- **Reads:** All from Supabase (fast, RLS-filtered by client)
- **Writes:** API routes use service_role client (bypasses RLS, validates permissions in code)
- **Cases:** Portal → Gateway → VTiger creates CC-XXX → writes back to Supabase cache
- **Fallback:** If VTiger is down, cases save with `sync_status='pending_sync'`

## Routes

### Client Routes (`/portal/*`)
| Route | Page |
|-------|------|
| `/login` | Client login |
| `/portal` | Project list (home) |
| `/portal/projects/[slug]` | Project detail (tasks, phases, comments) |
| `/portal/cases` | Support case list |
| `/portal/cases/new` | Create new case |
| `/portal/cases/[case_no]` | Case detail + activity log |
| `/portal/settings` | Profile + notification preferences |

### Admin Routes (`/admin/*`)
| Route | Page |
|-------|------|
| `/admin` | Admin overview (client count, open cases) |
| `/admin/clients` | Manage clients + project access |
| `/admin/invite` | Invite new client (creates auth user + profile) |
| `/admin/cases` | All cases (assign, resolve, sync to VTiger) |

### API Routes
| Route | Purpose |
|-------|---------|
| `POST /api/cases` | Create case → Gateway → VTiger |
| `POST /api/cases/reply` | Add reply to case activity log |
| `POST /api/projects/comment` | Post project comment |
| `POST /api/admin/invite` | Create client account + assign projects |
| `GET /api/admin/projects` | List projects for admin UI |

## Database Tables (7 new)

| Table | Purpose |
|-------|---------|
| `client_profiles` | Links Supabase Auth user to portal identity |
| `client_project_access` | Many-to-many project access control |
| `vtiger_cases_cache` | Mirrors VTiger Cases for fast reads |
| `vtiger_tickets_ref` | Internal ticket references (count + title only) |
| `project_comments` | Threaded project discussion |
| `client_notifications` | Multi-channel notification queue |
| `case_activity_log` | Audit trail for case changes |

## RLS Strategy

- **Existing tables** (asi360_projects, etc.): `anon` role has full access (internal dashboard), `authenticated` role filtered by `client_project_access`
- **New tables**: Standard RLS — clients see only their own data
- **Writes**: API routes use service_role (bypasses RLS), validates permissions in application code
- **Defense-in-depth**: RLS INSERT/UPDATE policies on case tables as backup

## Deployment

### Droplet (104.248.69.86)

```bash
# Update code
cd /var/www/client-portal-repo && git pull origin feature/client-portal
cd client-portal && npm install && npx next build

# Restart
pm2 restart client-portal
```

### Nginx
Config at `/etc/nginx/sites-enabled/client-portal` — proxies `portal.asi360.co` to `localhost:3210`.

### SSL
```bash
# After DNS A record points to 104.248.69.86:
certbot --nginx -d portal.asi360.co
```

## Admin Workflows

### Invite a Client
1. Go to `/admin/invite`
2. Fill in email, name, company, role
3. Select project(s) to assign
4. Submit — creates auth user, profile, project access
5. Temp password shown on screen + sent via email (Gateway /comm/notify)
6. Client logs in at `/login`, sees welcome notification

### Create a Case (Client)
1. Go to `/portal/cases/new`
2. Fill in title, description, category, priority, project
3. Submit → Gateway → VTiger creates CC-XXX
4. Case appears in list and detail view
5. Admins receive notification

### Reply to a Case
1. Go to `/portal/cases/CC-XXX`
2. Type reply in form, submit
3. Activity log entry created
4. Admins receive notification

## DNS Requirement

`portal.asi360.co` A record must point to `104.248.69.86`. Currently points to `35.215.108.153` — update needed before SSL can be provisioned.
