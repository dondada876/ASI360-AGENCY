# ASI 360 Agency - Deployment Testing Guide

Complete guide for testing your ASI360 Agency infrastructure deployment.

## Prerequisites Checklist

Before testing deployment, ensure you have:

- [ ] Digital Ocean Droplet (or VPS) with:
  - Minimum 4GB RAM, 2 vCPUs
  - Ubuntu 20.04+ or Debian 11+
  - Root or sudo access
- [ ] Domain name(s) with DNS access
- [ ] `.env` file configured with valid credentials
- [ ] Supabase account and project created
- [ ] Anthropic API key with credits
- [ ] SSH access to your droplet

## Phase 1: Local Testing

Test the infrastructure locally before deploying to production.

### 1.1 Validate Configuration

```bash
# Ensure you're in the project directory
cd ASI360-AGENCY

# Validate docker-compose configuration
docker-compose config

# Check for syntax errors (should output full config)
# If errors, review your .env file
```

### 1.2 Test Individual Services

```bash
# Test building agency portal
cd agency-portal
docker build -t asi360-portal-test .
cd ..

# Test building automation engine
cd automation-engine
docker build -t asi360-automation-test .
cd ..
```

### 1.3 Local Stack Test (Optional)

```bash
# Start all services locally (without SSL)
docker-compose up -d

# Check all containers are running
docker-compose ps

# Expected output: All services should show "Up" status
# - asi360_traefik
# - asi360_client1_wp
# - asi360_client1_db
# - asi360_jccix_wp
# - asi360_jccix_db
# - asi360_portal
# - asi360_automation
# - asi360_backup
# - asi360_monitoring

# View logs
docker-compose logs -f

# Stop when done testing
docker-compose down
```

## Phase 2: Production Deployment

### 2.1 Prepare Droplet

```bash
# SSH into your droplet
ssh root@YOUR_DROPLET_IP

# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y curl git ufw

# Configure firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8080/tcp
ufw --force enable

# Exit droplet
exit
```

### 2.2 Deploy Using Script

```bash
# From your local machine
cd ASI360-AGENCY

# Make scripts executable
chmod +x infrastructure/scripts/*.sh

# Deploy to droplet (replace with your IP)
./infrastructure/scripts/deploy-to-droplet.sh YOUR_DROPLET_IP

# Script will:
# 1. Install Docker if needed
# 2. Copy project files
# 3. Start all services
# 4. Configure SSL certificates
```

### 2.3 Verify Deployment

```bash
# SSH into droplet
ssh root@YOUR_DROPLET_IP

# Navigate to project
cd /root/ASI360-AGENCY

# Check all containers
docker-compose ps

# Verify all services are "Up"
docker-compose logs --tail=50
```

## Phase 3: Service Testing

### 3.1 Test Traefik (Reverse Proxy)

```bash
# Access Traefik dashboard
# Open browser: http://YOUR_DROPLET_IP:8080

# You should see:
# ✓ Traefik dashboard
# ✓ List of routers
# ✓ List of services
# ✓ SSL certificates (after DNS is configured)
```

### 3.2 Test Agency Portal

```bash
# Check portal health
curl http://YOUR_DROPLET_IP:3000/api/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "...",
#   "service": "agency-portal",
#   "version": "1.0.0"
# }

# Access portal (after DNS configured)
# https://portal.asi360.com
```

### 3.3 Test Automation Engine

```bash
# Check automation health
curl http://YOUR_DROPLET_IP:5000/health

# Expected response:
# {
#   "status": "healthy",
#   "service": "automation-engine",
#   "supabase_connected": true,
#   "anthropic_connected": true,
#   "docker_connected": true
# }

# View automation logs
docker-compose logs -f automation_engine
```

### 3.4 Test WordPress Sites

```bash
# Test Client 1 WordPress
curl http://YOUR_DROPLET_IP -H "Host: client1.asi360.com"

# Should return HTML of WordPress installation page

# Test JCCIX WordPress
curl http://YOUR_DROPLET_IP -H "Host: jccix.org"

# Should return HTML of WordPress installation page
```

### 3.5 Test Uptime Kuma (Monitoring)

```bash
# Access Uptime Kuma
# Open browser: http://YOUR_DROPLET_IP:3001

# First visit will prompt for admin account creation
# Create admin credentials and log in
```

## Phase 4: DNS Configuration

### 4.1 Configure DNS Records

In your domain registrar's DNS settings, add these A records:

| Hostname | Type | Value | TTL |
|----------|------|-------|-----|
| portal.asi360.com | A | YOUR_DROPLET_IP | 300 |
| monitor.asi360.com | A | YOUR_DROPLET_IP | 300 |
| client1.asi360.com | A | YOUR_DROPLET_IP | 300 |
| jccix.org | A | YOUR_DROPLET_IP | 300 |
| www.jccix.org | A | YOUR_DROPLET_IP | 300 |

### 4.2 Wait for DNS Propagation

```bash
# Check DNS propagation (wait 5-30 minutes)
nslookup portal.asi360.com
nslookup monitor.asi360.com

# Should return YOUR_DROPLET_IP
```

### 4.3 Verify SSL Certificates

```bash
# After DNS propagates, Traefik will auto-generate SSL certs
# Check Traefik logs
docker-compose logs traefik | grep -i "certificate"

# Access sites via HTTPS
curl -I https://portal.asi360.com
# Should show: HTTP/2 200 and valid SSL

# Check certificate details
openssl s_client -connect portal.asi360.com:443 -servername portal.asi360.com < /dev/null
```

## Phase 5: WordPress Setup

### 5.1 Complete WordPress Installation (Client 1)

```bash
# Access: https://client1.asi360.com
# Follow WordPress 5-minute installation:
# 1. Select language
# 2. Create admin user
# 3. Set site title and description
```

### 5.2 Install Astra Theme

```bash
# After WordPress setup, log into admin
# https://client1.asi360.com/wp-admin

# If Astra Pro plugins are in astra-pro-plugins/:
# 1. Go to Appearance → Themes
# 2. Astra should be available
# 3. Activate and configure

# Otherwise, install free Astra:
# 1. Appearance → Themes → Add New
# 2. Search "Astra"
# 3. Install and activate
```

### 5.3 Repeat for JCCIX Site

```bash
# Access: https://jccix.org
# Follow same WordPress installation steps
```

## Phase 6: Supabase Integration Testing

### 6.1 Create Required Tables

```sql
-- In Supabase SQL Editor (https://app.supabase.com)

-- Clients table
CREATE TABLE clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WordPress queue table
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

-- Automation reports table
CREATE TABLE automation_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_syncs INTEGER,
  last_sync TIMESTAMP WITH TIME ZONE,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 6.2 Test Portal → Supabase Connection

```bash
# Access portal: https://portal.asi360.com

# Use browser console or API:
curl -X POST https://portal.asi360.com/api/clients \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Client",
    "domain": "test.example.com",
    "contact_email": "test@example.com"
  }'

# Check Supabase to verify client was created
```

### 6.3 Test AI Content Generation

```bash
# Via portal UI or API:
curl -X POST https://portal.asi360.com/api/generate-content \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a welcome message for a new business website"
  }'

# Should return AI-generated content
```

## Phase 7: Backup Testing

### 7.1 Test Backup Creation

```bash
# SSH into droplet
ssh root@YOUR_DROPLET_IP
cd /root/ASI360-AGENCY

# Trigger manual backup
docker-compose exec backup_service backup-now

# Check backup directory
ls -lh backups/

# Should see timestamped backup files
```

### 7.2 Test Backup Restoration

```bash
# Stop WordPress container
docker-compose stop client1_wordpress

# Restore from backup
docker run --rm \
  -v asi360_client1_wp_data:/data \
  -v $(pwd)/backups:/backup \
  ubuntu bash -c "cd /data && tar xvf /backup/latest_backup.tar"

# Restart container
docker-compose start client1_wordpress

# Verify WordPress site still works
curl -I https://client1.asi360.com
```

## Phase 8: Monitoring Setup

### 8.1 Configure Uptime Kuma

```bash
# Access: https://monitor.asi360.com

# Add monitors for:
# 1. Client 1 WordPress (https://client1.asi360.com)
# 2. JCCIX WordPress (https://jccix.org)
# 3. Agency Portal (https://portal.asi360.com)
# 4. Automation Engine (http://automation_engine:5000/health)

# Set check intervals: 60 seconds
# Configure notifications (email, Slack, etc.)
```

## Phase 9: Load Testing (Optional)

### 9.1 Basic Load Test

```bash
# Install Apache Bench
apt install apache2-utils

# Test portal
ab -n 1000 -c 10 https://portal.asi360.com/

# Test WordPress site
ab -n 1000 -c 10 https://client1.asi360.com/

# Review results for:
# - Requests per second
# - Time per request
# - Failed requests (should be 0)
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs SERVICE_NAME

# Common issues:
# 1. Port conflicts: Check if ports 80/443 are in use
# 2. Memory: Ensure droplet has enough RAM
# 3. Environment variables: Verify .env file
```

### SSL Certificate Issues

```bash
# Check Traefik logs
docker-compose logs traefik | grep -i error

# Common issues:
# 1. DNS not propagated yet (wait 30 minutes)
# 2. Port 80/443 not accessible (check firewall)
# 3. Invalid email in LETSENCRYPT_EMAIL
```

### Database Connection Errors

```bash
# Check MySQL logs
docker-compose logs client1_mysql

# Verify environment variables
docker-compose exec client1_wordpress env | grep WORDPRESS_DB

# Test connection
docker-compose exec client1_wordpress ping client1_mysql
```

### Supabase Connection Errors

```bash
# Verify credentials in .env
cat .env | grep SUPABASE

# Test from portal container
docker-compose exec agency_portal curl $SUPABASE_URL

# Check API key validity in Supabase dashboard
```

## Success Criteria

Your deployment is successful when:

- [ ] All containers show "Up" status
- [ ] Traefik dashboard accessible
- [ ] SSL certificates auto-generated
- [ ] WordPress sites accessible via HTTPS
- [ ] Agency portal functional
- [ ] Automation engine running
- [ ] Uptime Kuma monitoring active
- [ ] Backups being created
- [ ] Supabase integration working
- [ ] AI content generation functional

## Next Steps

After successful testing:

1. **Add More Clients** - Use `add-new-client.sh` script
2. **Configure Monitoring** - Set up alerts in Uptime Kuma
3. **Automate Workflows** - Create N8N or automation workflows
4. **Scale Resources** - Upgrade droplet as needed
5. **Documentation** - Document your specific setup

## Support

If issues persist:

1. Check main [README.md](../../README.md)
2. Review [Getting Started Guide](GETTING_STARTED.md)
3. Check [Architecture Documentation](../architecture/)
4. Review Docker logs: `docker-compose logs`

## Maintenance Schedule

**Daily:**
- Monitor Uptime Kuma dashboard
- Check automation engine logs

**Weekly:**
- Review backup status
- Check disk space: `df -h`
- Update containers: `docker-compose pull && docker-compose up -d`

**Monthly:**
- Review client sites
- Update WordPress core and plugins
- Audit security logs

---

**Last Updated:** November 20, 2025
**Version:** 1.0.0
**Status:** Production Ready
