# ASI 360 - Allied Systems Integrations
**Multi-Client WordPress Hosting Platform with AI Automation**

---

## 🎯 What This Does

Automated web development platform for your agency that:
- Hosts multiple client websites in isolated Docker containers
- Auto-generates WordPress content from Supabase data
- Uses Astra Pro + AI for rapid site deployment
- Includes client portal, monitoring, and automated backups

---

## 📦 What's Included

### Services
- **Traefik** - Reverse proxy with automatic SSL (Let's Encrypt)
- **WordPress Containers** - One per client, fully isolated
- **MySQL Databases** - Dedicated database per client
- **Agency Portal** - Client management dashboard
- **Automation Engine** - Supabase → WordPress sync
- **Uptime Kuma** - Monitoring for all client sites
- **Backup Service** - Automated daily backups to S3

### Clients Pre-configured
1. **Client 1** (Template) - Example configuration
2. **JCCIX** (Hurricane Relief) - Jamaica Crisis Council site

---

## 🚀 Quick Start (30 Minutes)

### Step 1: Create Digital Ocean Droplet

1. Go to: https://cloud.digitalocean.com/droplets/new
2. **Choose Image:** "Docker" (under One-click Apps)
3. **Choose Size:**
   - **Recommended:** $48/mo (8GB RAM, 4 vCPUs)
   - Can host 10-15 client websites
   - Upgrade as you add more clients
4. **Choose Datacenter:** Closest to your clients
5. **Authentication:** Use SSH keys
6. Click "Create Droplet"
7. **Note the IP address** (e.g., 167.99.123.45)

### Step 2: Configure Environment

```bash
cd /Users/dbucknor/Downloads/proj344-dashboards/asi360-agency

# Copy environment template
cp .env.example .env

# Edit with your credentials
nano .env
```

Fill in:
- Database passwords (use strong random passwords)
- Supabase URL/key (already have this)
- Anthropic API key (for AI site generation)
- AWS credentials (optional, for backups)

### Step 3: Deploy to Droplet

```bash
./deploy-to-droplet.sh
```

The script will:
1. Copy files to your droplet
2. Install Docker (if needed)
3. Start all services
4. Configure firewall
5. Show you the URLs to access everything

---

## 🌐 DNS Configuration

After deployment, point your domains to the droplet IP:

### A Records to Create

| Domain | Type | Value | TTL |
|--------|------|-------|-----|
| portal.asi360.com | A | YOUR_DROPLET_IP | 300 |
| monitor.asi360.com | A | YOUR_DROPLET_IP | 300 |
| client1.asi360.com | A | YOUR_DROPLET_IP | 300 |
| jccix.org | A | YOUR_DROPLET_IP | 300 |
| www.jccix.org | A | YOUR_DROPLET_IP | 300 |

Wait 5-30 minutes for DNS propagation, then visit your sites!

---

## 📝 Adding a New Client

### Method 1: Using Docker Compose (Manual)

1. Edit `docker-compose.yml`
2. Copy the `client1` services block
3. Rename to your new client (e.g., `client3`)
4. Update environment variables
5. Update Traefik labels with correct domain
6. Add to `.env` file:
   ```bash
   CLIENT3_DB_PASSWORD=secure_password
   CLIENT3_ROOT_PASSWORD=secure_password
   ```
7. Deploy:
   ```bash
   docker-compose up -d
   ```

### Method 2: Using Automation Script (Coming Soon)

```bash
./add-new-client.sh client-name client-domain.com
```

---

## 🎨 Installing Astra Pro

After WordPress is running:

1. Access WordPress admin: `https://your-domain.com/wp-admin`
2. Default login: `admin` / (check Docker logs for password)
3. Install Astra Theme:
   - Go to Appearance → Themes → Add New
   - Upload `astra.zip` (from your Astra Pro purchase)
4. Install Astra Pro Addon:
   - Plugins → Add New → Upload
   - Upload `astra-addon.zip`
   - Activate and enter license key
5. Install Additional Plugins:
   - **Spectra Pro** - Page builder
   - **Ultimate Elementor Addons** - Design widgets
   - **SureFeedback** - Client feedback tool

---

## 🤖 Automation Features

### Supabase → WordPress Sync

The automation engine can:
- Pull data from your Supabase tables
- Generate WordPress posts automatically
- Update content on schedule
- Trigger on data changes

**Example: Case Updates for ASE-F.org**

```python
# Runs daily at 9 AM
# Checks legal_violations table
# Generates "Day X Update" post
# Publishes to WordPress
```

### AI Page Generation

Uses Claude API + Astra AI Builder to:
- Generate entire pages from prompts
- Create consistent layouts
- Match brand guidelines
- Include dynamic content

---

## 📊 Monitoring & Maintenance

### Access Points

- **Traefik Dashboard:** `http://YOUR_IP:8080`
  - View routing rules
  - Check SSL certificates
  - Monitor traffic

- **Uptime Kuma:** `https://monitor.asi360.com`
  - Monitor all client sites
  - Get alerts on downtime
  - Track response times

- **Agency Portal:** `https://portal.asi360.com`
  - Manage all clients
  - View automation logs
  - Trigger manual syncs

### Useful Commands

```bash
# SSH into droplet
ssh root@YOUR_DROPLET_IP

# View all containers
cd /root/asi360-agency
docker-compose ps

# View logs
docker-compose logs -f
docker-compose logs -f client1_wordpress  # Specific service

# Restart a service
docker-compose restart client1_wordpress

# Stop all services
docker-compose down

# Start all services
docker-compose up -d

# Update Docker images
docker-compose pull
docker-compose up -d
```

---

## 💾 Backups

### Automatic Backups

- Run daily at 2 AM
- Retention: 30 days
- Location: `./backups/` (and S3 if configured)
- Includes:
  - WordPress files
  - MySQL databases

### Manual Backup

```bash
# Backup specific client
docker-compose exec backup_service backup-now

# Download backups
scp -r root@YOUR_IP:/root/asi360-agency/backups ./local-backups/
```

### Restore from Backup

```bash
# Stop services
docker-compose down

# Restore volumes
docker run --rm -v asi360_client1_wp_data:/data -v $(pwd)/backups:/backup ubuntu bash -c "cd /data && tar xvf /backup/client1_wp_YYYY-MM-DD.tar"

# Start services
docker-compose up -d
```

---

## 💰 Cost Breakdown

### Digital Ocean Droplet
- **$24/mo** - 4GB RAM (5-7 sites)
- **$48/mo** - 8GB RAM (10-15 sites) ← **Recommended**
- **$96/mo** - 16GB RAM (20-30 sites)

### Per-Client Costs
- WordPress + MySQL: ~300-500MB RAM each
- SSL certificates: Free (Let's Encrypt)
- Bandwidth: 4-5TB included

### External Services
- **Astra Pro:** $244/year (covers unlimited sites)
- **Domain names:** ~$12/year each
- **Backups (S3):** ~$5-10/month for all clients
- **Claude API:** ~$0.02 per AI-generated page

### Example: 10 Clients
- Droplet: $48/mo
- Astra Pro: $20/mo (amortized)
- Domains: $10/mo (amortized)
- **Total: ~$78/mo** to host 10 client sites

**Compare to:**
- WP Engine: $30/mo per site = $300/mo for 10 sites
- **You save: $222/month** (73% savings)

---

## 🛡️ Security Features

- ✅ Automatic SSL certificates (Let's Encrypt)
- ✅ Firewall configured (UFW)
- ✅ Isolated containers per client
- ✅ Separate databases per client
- ✅ Automatic security updates (Docker base images)
- ✅ Daily backups with retention
- ✅ Monitoring and alerting
- ✅ Strong password requirements

---

## 🐛 Troubleshooting

### WordPress won't start
```bash
# Check logs
docker-compose logs client1_wordpress

# Common fix: Database connection
# Make sure MySQL container is running first
docker-compose up -d client1_mysql
sleep 10
docker-compose up -d client1_wordpress
```

### SSL certificate not working
```bash
# Check Traefik logs
docker-compose logs traefik

# Verify DNS is pointing to droplet
dig +short your-domain.com

# Force certificate renewal
docker-compose restart traefik
```

### Site is slow
```bash
# Check resource usage
docker stats

# If RAM is maxed out, upgrade droplet size
# Or reduce number of clients per droplet
```

### Can't access WordPress admin
```bash
# Reset WordPress password
docker-compose exec client1_wordpress wp user update admin --user_pass=NewPassword123 --allow-root
```

---

## 📚 Next Steps

1. ✅ Deploy infrastructure
2. ⬜ Set up DNS for all domains
3. ⬜ Install Astra Pro on each site
4. ⬜ Configure automation engine
5. ⬜ Test backup/restore process
6. ⬜ Add client sites as needed

---

## 🆘 Support

**Issues?** Check:
1. Digital Ocean droplet is running
2. DNS records are correct (use `dig` to verify)
3. Docker services are up (`docker-compose ps`)
4. Firewall allows ports 80, 443, 8080
5. SSL certificates generated (check Traefik dashboard)

**Still stuck?** Review logs:
```bash
docker-compose logs -f --tail=100
```

---

## 📞 Contact

**ASI 360 - Allied Systems Integrations**
Automated web consulting for the modern agency

---

**Status:** Production-ready
**Last Updated:** November 11, 2025
**Version:** 1.0.0
