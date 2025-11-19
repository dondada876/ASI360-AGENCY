# ASI 360 AGENCY

**Allied Systems Integrations - Enterprise Omnichannel Platform**

> Multi-client WordPress hosting, AI automation, and sales/marketing infrastructure for modern agencies

[![Status](https://img.shields.io/badge/Status-Production%20Ready-success)]()
[![Version](https://img.shields.io/badge/Version-1.0.0-blue)]()
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

---

## 🎯 What is ASI 360 AGENCY?

ASI 360 AGENCY is a comprehensive cloud infrastructure and automation platform that combines:

- **Multi-Client WordPress Hosting** - Dockerized, isolated environments for unlimited clients
- **AI-Powered Automation** - Supabase integration with intelligent workflow automation
- **Omnichannel Sales & Marketing Engine** - Automated lead generation, nurturing, and conversion
- **Vast.ai GPU Services** - On-demand rendering, AI processing, and compute infrastructure
- **Enterprise CRM Integration** - vTiger-centric intelligence and automation system

### Core Value Proposition

Replace expensive SaaS subscriptions and fragmented tools with a unified, self-hosted platform that:
- Hosts 10-30 client websites for $48-96/month (vs. $3,000-9,000/month with traditional hosting)
- Automates 80%+ of marketing and sales workflows
- Provides on-demand GPU compute for AI/rendering at 60-80% cost savings
- Centralizes all client data and operations in one integrated system

---

## 📁 Repository Structure

```
ASI360-AGENCY/
├── docs/                           # Documentation
│   ├── architecture/               # System architecture documents
│   │   ├── ARCHITECTURE_COMPARISON.md
│   │   ├── HYBRID_SITEGROUND_ARCHITECTURE.md
│   │   ├── SCALING_TO_100_SITES.md
│   │   └── VASTAI_HOTSWAP_ARCHITECTURE.md
│   ├── guides/                     # Setup and usage guides
│   │   └── GETTING_STARTED.md
│   ├── prds/                       # Product requirement documents
│   │   ├── Omnichannel_Sales_And_Marketing_Engine_PRD.md
│   │   ├── Parent_Company_Sales_Engine_PRD.md
│   │   └── Supabase_Unified_Intelligence_System.md
│   └── ASI360_Infrastructure_Project_VTiger_Import.csv
│
├── infrastructure/                 # Infrastructure as code
│   ├── docker/                     # Docker configurations
│   │   └── docker-compose.yml      # Main service orchestration
│   └── scripts/                    # Deployment & automation scripts
│       ├── deploy-to-droplet.sh    # One-command deployment
│       └── add-new-client.sh       # Client onboarding automation
│
├── vastai-images/                  # Vast.ai GPU service templates
│   ├── ai-services/                # AI processing services
│   ├── render-farm/                # Blender rendering farm
│   ├── video-editor/               # Video processing
│   ├── desktop-editor/             # Remote desktop services
│   └── scripts/                    # Deployment automation
│
├── .env.example                    # Environment template
├── .gitignore                      # Git ignore rules
├── docker-compose.yml              # Symlink to infrastructure/docker/
└── README.md                       # This file
```

---

## 🚀 Quick Start

### Prerequisites

- **Digital Ocean Droplet** (or similar VPS)
  - Minimum: 4GB RAM, 2 vCPUs ($24/month)
  - Recommended: 8GB RAM, 4 vCPUs ($48/month)
  - For 20+ sites: 16GB RAM, 8 vCPUs ($96/month)
- **Domain name(s)** with DNS access
- **Supabase account** (free tier works)
- **API keys**: Anthropic Claude, Twilio (optional), SendGrid (optional)

### 1. Clone & Configure

```bash
git clone https://github.com/dondada876/ASI360-AGENCY.git
cd ASI360-AGENCY
cp .env.example .env
nano .env  # Fill in your credentials
```

### 2. Deploy Infrastructure

```bash
# One-command deployment to your droplet
./infrastructure/scripts/deploy-to-droplet.sh YOUR_DROPLET_IP
```

The script will:
- Install Docker if needed
- Copy configuration files
- Start all services
- Configure firewall
- Set up SSL certificates

### 3. Configure DNS

Point your domains to your droplet IP:

| Domain | Type | Value | Purpose |
|--------|------|-------|---------|
| portal.asi360agency.com | A | YOUR_IP | Agency dashboard |
| monitor.asi360agency.com | A | YOUR_IP | Uptime monitoring |
| client1.yourdomain.com | A | YOUR_IP | Client site |

### 4. Access Services

- **Traefik Dashboard**: `http://YOUR_IP:8080` (routing & SSL)
- **Uptime Kuma**: `https://monitor.asi360agency.com` (monitoring)
- **Agency Portal**: `https://portal.asi360agency.com` (management)
- **Client Sites**: `https://client1.yourdomain.com`

---

## 💼 Core Features

### 1. Multi-Client WordPress Hosting

- **Isolated Containers**: Each client gets dedicated WordPress + MySQL
- **Automatic SSL**: Let's Encrypt certificates via Traefik
- **Scalable**: Add clients with one script command
- **Astra Pro Ready**: Optimized for Astra theme + Spectra Pro
- **Automated Backups**: Daily backups with 30-day retention

### 2. AI Automation Engine

- **Supabase Integration**: Real-time data sync
- **Content Generation**: Auto-generate WordPress posts from data
- **N8N Workflows**: Complex automation without code
- **Claude AI Integration**: Intelligent content and decision-making

### 3. Sales & Marketing Automation

- **Lead Capture**: Multi-channel (web, ads, social, referrals)
- **Email Sequences**: Automated nurturing campaigns
- **SMS Marketing**: Twilio integration for instant follow-up
- **CRM Integration**: vTiger-centric intelligence system
- **Analytics Dashboard**: Real-time performance metrics

### 4. Vast.ai GPU Services

- **AI Services**: Image generation, text processing, AI APIs
- **Render Farm**: Blender automation for 3D rendering
- **Video Editing**: Automated video processing pipeline
- **Desktop Services**: Remote Windows/Linux workstations
- **Cost Optimization**: 60-80% cheaper than cloud GPUs

---

## 📊 Architecture Overview

### Infrastructure Stack

```
┌─────────────────────────────────────────────────────┐
│                   Internet Traffic                   │
└────────────────────────┬─────────────────────────────┘
                         │
                    ┌────▼────┐
                    │ Traefik │ (Reverse Proxy + SSL)
                    └────┬────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼───┐      ┌─────▼────┐    ┌─────▼────┐
   │Client 1│      │ Client 2 │    │ Client N │
   │WordPress│      │WordPress │    │WordPress │
   └────┬───┘      └─────┬────┘    └─────┬────┘
        │                │                │
   ┌────▼───┐      ┌─────▼────┐    ┌─────▼────┐
   │MySQL 1 │      │ MySQL 2  │    │ MySQL N  │
   └────────┘      └──────────┘    └──────────┘
```

### Automation Flow

```
Supabase Database → N8N Workflows → WordPress/CRM/Notifications
                         ↕
                    Claude AI API
                         ↕
              Twilio/SendGrid/Slack
```

---

## 🛠️ Management & Operations

### Adding a New Client

```bash
./infrastructure/scripts/add-new-client.sh client-name domain.com
```

This automatically:
1. Creates WordPress + MySQL containers
2. Configures Traefik routing
3. Generates SSL certificate
4. Sets up database
5. Updates docker-compose.yml

### Monitoring & Logs

```bash
# View all services
cd infrastructure/docker
docker-compose ps

# View logs
docker-compose logs -f client1_wordpress

# Restart a service
docker-compose restart client1_wordpress

# Update all images
docker-compose pull && docker-compose up -d
```

### Backups

**Automatic**: Daily at 2 AM, stored in `./backups/`

**Manual Backup**:
```bash
docker-compose exec backup_service backup-now
```

**Restore**:
```bash
docker-compose down
docker run --rm -v asi360_client1_wp_data:/data \
  -v $(pwd)/backups:/backup ubuntu \
  bash -c "cd /data && tar xvf /backup/client1_wp_DATE.tar"
docker-compose up -d
```

---

## 📈 Cost Analysis

### Infrastructure Costs

| Item | Cost | Capacity | Cost per Client |
|------|------|----------|-----------------|
| Digital Ocean Droplet (8GB) | $48/mo | 10-15 sites | $3.20-4.80 |
| Domain Names | $12/year | 1 site | $1/mo |
| SSL Certificates | Free | Unlimited | $0 |
| Backups (S3) | $5-10/mo | All sites | $0.50-1.00 |
| **Total per Client** | - | - | **$4.70-6.80/mo** |

**Compare to**:
- WP Engine: $30/month per site
- Kinsta: $35/month per site
- **Your Savings: 84-89% per client**

### ROI Example: 10 Clients

- **Traditional Hosting**: $300-350/month
- **ASI 360 Platform**: $48-68/month
- **Monthly Savings**: $232-302
- **Annual Savings**: $2,784-3,624

---

## 🔒 Security Features

- ✅ Automatic SSL certificates (Let's Encrypt)
- ✅ Container isolation (Docker security)
- ✅ Separate databases per client
- ✅ UFW firewall configuration
- ✅ Automatic security updates
- ✅ Daily backup with encryption
- ✅ Environment variable protection
- ✅ Strong password enforcement

---

## 📚 Documentation

### Essential Reading

1. **[Getting Started Guide](docs/guides/GETTING_STARTED.md)** - Step-by-step setup
2. **[Architecture Comparison](docs/architecture/ARCHITECTURE_COMPARISON.md)** - Design decisions
3. **[Scaling to 100 Sites](docs/architecture/SCALING_TO_100_SITES.md)** - Growth planning

### Product Requirements

- **[Omnichannel Sales Engine PRD](docs/prds/Omnichannel_Sales_And_Marketing_Engine_PRD.md)** - Complete sales automation specification
- **[Parent Company Sales Engine](docs/prds/Parent_Company_Sales_Engine_PRD.md)** - Enterprise sales infrastructure
- **[Supabase Intelligence System](docs/prds/Supabase_Unified_Intelligence_System.md)** - Data integration architecture

### Architecture Documents

- **[Hybrid SiteGround Architecture](docs/architecture/HYBRID_SITEGROUND_ARCHITECTURE.md)** - Managed hosting integration
- **[Vast.ai Hotswap Architecture](docs/architecture/VASTAI_HOTSWAP_ARCHITECTURE.md)** - GPU compute strategy

---

## 🎯 Use Cases

### Agency Hosting

Host all your client websites on one platform:
- White-label WordPress instances
- Automated content updates from your CRM
- Centralized monitoring and backups
- Client portal for self-service

### SaaS Platform

Build multi-tenant applications:
- Isolated environments per customer
- Automated provisioning
- Usage-based scaling
- Integrated billing and analytics

### AI/ML Workloads

Run compute-intensive tasks on Vast.ai:
- Blender rendering farms
- AI model training and inference
- Video processing pipelines
- Data analysis workflows

### Marketing Automation

Complete lead-to-close automation:
- Multi-channel lead capture
- Intelligent lead scoring
- Automated email/SMS sequences
- CRM integration and analytics

---

## 🚀 Roadmap

### Q1 2025
- [x] Core infrastructure deployment
- [x] Multi-client WordPress hosting
- [x] Basic automation workflows
- [ ] vTiger MCP server completion
- [ ] Advanced analytics dashboard

### Q2 2025
- [ ] White-label client portal
- [ ] Automated client onboarding
- [ ] Advanced AI content generation
- [ ] Mobile app for management

### Q3 2025
- [ ] Marketplace for templates
- [ ] Advanced GPU orchestration
- [ ] Multi-region deployment
- [ ] Enterprise features (SSO, RBAC)

---

## 🤝 Contributing

This is a proprietary project for ASI 360 Agency operations. For collaboration inquiries, please contact the project owner.

---

## 📞 Support & Contact

**ASI 360 - Allied Systems Integrations**

- **Website**: [asi360agency.com](https://asi360agency.com)
- **GitHub**: [@dondada876](https://github.com/dondada876)
- **Project**: [ASI360-AGENCY](https://github.com/dondada876/ASI360-AGENCY)

---

## 📄 License

Proprietary - All Rights Reserved © 2025 ASI 360 Agency

---

## 🎬 Getting Started Checklist

- [ ] Clone repository
- [ ] Configure `.env` file
- [ ] Provision Digital Ocean droplet
- [ ] Run deployment script
- [ ] Configure DNS records
- [ ] Access Traefik dashboard
- [ ] Set up first client site
- [ ] Configure Uptime Kuma monitoring
- [ ] Test backup/restore process
- [ ] Review architecture documentation
- [ ] Set up automation workflows

**Ready to deploy?** Start with the [Getting Started Guide](docs/guides/GETTING_STARTED.md)

---

**Status**: Production Ready | **Version**: 1.0.0 | **Last Updated**: November 18, 2025
