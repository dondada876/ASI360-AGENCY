# ASI 360 Agency - Quick Start Guide

Get your multi-client WordPress hosting platform running in under 30 minutes.

## Prerequisites

- Digital Ocean Droplet (4GB+ RAM, $24/mo)
- Domain name with DNS access
- Supabase account (free tier: https://supabase.com)
- Anthropic API key (https://console.anthropic.com)

## Step 1: Clone Repository (2 minutes)

```bash
git clone https://github.com/dondada876/ASI360-AGENCY.git
cd ASI360-AGENCY
```

## Step 2: Configure Environment (5 minutes)

The `.env` file has been pre-created with secure database passwords. You need to add:

1. **Supabase credentials** (get from https://app.supabase.com/project/_/settings/api):
   ```bash
   nano .env
   # Replace YOUR_SUPABASE_ANON_KEY_HERE with your actual key
   ```

2. **Anthropic API key** (get from https://console.anthropic.com/account/keys):
   ```bash
   # Replace YOUR_ANTHROPIC_API_KEY_HERE with your actual key
   ```

3. **Update email**:
   ```bash
   # Replace admin@asi360.com with your actual email
   ```

Save and close (`Ctrl+X`, then `Y`, then `Enter`)

## Step 3: Deploy to Droplet (10 minutes)

```bash
# Make scripts executable
chmod +x infrastructure/scripts/*.sh

# Deploy (replace with your droplet IP)
./infrastructure/scripts/deploy-to-droplet.sh YOUR_DROPLET_IP
```

The script will:
- ✓ Install Docker
- ✓ Copy files to droplet
- ✓ Start all services
- ✓ Configure firewall

## Step 4: Configure DNS (5 minutes)

Add these A records in your domain registrar:

| Hostname | Value |
|----------|-------|
| portal.asi360.com | YOUR_DROPLET_IP |
| monitor.asi360.com | YOUR_DROPLET_IP |
| client1.asi360.com | YOUR_DROPLET_IP |

Wait 5-10 minutes for DNS propagation.

## Step 5: Create Supabase Tables (3 minutes)

1. Go to https://app.supabase.com
2. Open SQL Editor
3. Run this SQL:

```sql
CREATE TABLE clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE wordpress_queue (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  site_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  status TEXT DEFAULT 'pending',
  use_ai BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Step 6: Access Your Platform (5 minutes)

After DNS propagates:

- **Agency Portal**: https://portal.asi360.com
- **Monitoring**: https://monitor.asi360.com
- **Client Site**: https://client1.asi360.com

### First WordPress Setup

1. Visit https://client1.asi360.com
2. Complete 5-minute WordPress installation
3. Create admin user
4. Install Astra theme (Appearance → Themes → Add New)

## Step 7: Verify Everything Works

```bash
# SSH into droplet
ssh root@YOUR_DROPLET_IP

# Check all containers
cd /root/ASI360-AGENCY
docker-compose ps

# All should show "Up" status
```

## What You Have Now

✓ Multi-client WordPress hosting platform
✓ Automatic SSL certificates
✓ AI-powered content generation
✓ Automated backups
✓ Uptime monitoring
✓ Client management dashboard

## Add Another Client Site

```bash
# SSH into droplet
ssh root@YOUR_DROPLET_IP
cd /root/ASI360-AGENCY

# Add new client
./infrastructure/scripts/add-new-client.sh newclient newclient.com

# Add DNS record for newclient.com → YOUR_DROPLET_IP
# Access: https://newclient.com (after DNS propagates)
```

## Common Issues

**Containers won't start:**
```bash
docker-compose logs SERVICE_NAME
```

**SSL not working:**
- Wait 30 minutes for DNS propagation
- Check firewall: `ufw status`
- Verify ports 80/443 are open

**Can't connect to Supabase:**
- Verify credentials in .env
- Check API key in Supabase dashboard

## Next Steps

1. **Read Full Docs**: [docs/guides/GETTING_STARTED.md](docs/guides/GETTING_STARTED.md)
2. **Test Deployment**: [docs/guides/DEPLOYMENT_TESTING.md](docs/guides/DEPLOYMENT_TESTING.md)
3. **Review Architecture**: [docs/architecture/](docs/architecture/)
4. **Set Up Monitoring**: Configure alerts in Uptime Kuma
5. **Add Astra Pro**: See [astra-pro-plugins/README.md](astra-pro-plugins/README.md)

## Cost Breakdown

- Droplet (8GB): $48/month
- Domain: $12/year ($1/month)
- Backups: $5/month
- **Total: ~$54/month for 10-15 sites**

Compare to WP Engine: $300-450/month for 10-15 sites
**Your Savings: $246-396/month** 🎉

## Support

- **Documentation**: [README.md](README.md)
- **GitHub Issues**: https://github.com/dondada876/ASI360-AGENCY/issues
- **Email**: admin@asi360.com

---

**Ready to scale to 100+ sites?** See [docs/architecture/SCALING_TO_100_SITES.md](docs/architecture/SCALING_TO_100_SITES.md)
