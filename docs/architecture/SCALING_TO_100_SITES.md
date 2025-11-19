# ASI 360 - Scaling to 100+ Websites

**Target:** Host 100+ client websites (internal + external)
**Strategy:** Enterprise SaaS platform with Kubernetes orchestration
**Timeline:** 3-6 months phased rollout

---

## Phase 1: Infrastructure (Month 1-2)

### Kubernetes Cluster Setup

**Digital Ocean Kubernetes (DOKS) Specifications:**
- 3 worker nodes (16GB RAM, 4 vCPUs each) - $336/mo
- Managed control plane (free)
- Auto-scaling enabled (scale to 5 nodes during traffic spikes)
- Multi-zone deployment for redundancy

**Initial Setup:**
```bash
# Install doctl (Digital Ocean CLI)
brew install doctl

# Authenticate
doctl auth init

# Create cluster
doctl kubernetes cluster create asi360-production \
  --region nyc1 \
  --version 1.28.2-do.0 \
  --node-pool "name=wordpress-workers;size=s-4vcpu-16gb;count=3;auto-scale=true;min-nodes=3;max-nodes=5"

# Get kubeconfig
doctl kubernetes cluster kubeconfig save asi360-production
```

### Install Core Components

```bash
# Install Helm (package manager)
brew install helm

# Add repos
helm repo add traefik https://traefik.github.io/charts
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Install Traefik Ingress (SSL + routing)
helm install traefik traefik/traefik \
  --namespace traefik \
  --create-namespace \
  --set additionalArguments="{--certificatesresolvers.letsencrypt.acme.email=admin@asi360.com}"

# Install cert-manager (SSL automation)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
```

---

## Phase 2: Database Architecture (Month 1-2)

### Option A: Managed Database (RECOMMENDED)
**Digital Ocean Managed MySQL** - $120/mo for 3-node cluster
- Automatic backups
- Point-in-time recovery
- Automatic failover
- Zero maintenance

```bash
# Create managed MySQL cluster
doctl databases create asi360-mysql \
  --engine mysql \
  --version 8 \
  --size db-s-4vcpu-8gb \
  --num-nodes 3 \
  --region nyc1
```

### Option B: Self-Managed MySQL (Advanced)
**Vitess Cluster** - Free but requires expertise
- Horizontal sharding (distribute 100 databases across nodes)
- MySQL-compatible
- Production-ready at scale

### Database-per-Client Strategy

**Schema:**
```sql
-- Centralized metadata database
CREATE DATABASE asi360_control;

USE asi360_control;

CREATE TABLE clients (
  id INT PRIMARY KEY AUTO_INCREMENT,
  client_name VARCHAR(100) UNIQUE,
  domain VARCHAR(255) UNIQUE,
  db_name VARCHAR(100),
  db_host VARCHAR(255),
  db_user VARCHAR(100),
  db_password VARCHAR(255) ENCRYPTED,
  tier VARCHAR(20), -- 'internal', 'basic', 'premium'
  status VARCHAR(20), -- 'active', 'suspended', 'archived'
  created_at TIMESTAMP,
  monthly_cost DECIMAL(10,2),
  storage_used_mb INT,
  bandwidth_used_gb DECIMAL(10,2)
);

CREATE TABLE deployments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  client_id INT REFERENCES clients(id),
  deployment_type VARCHAR(50), -- 'initial', 'update', 'migration'
  status VARCHAR(20),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_log TEXT
);

CREATE TABLE billing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  client_id INT REFERENCES clients(id),
  billing_cycle DATE,
  amount DECIMAL(10,2),
  status VARCHAR(20), -- 'pending', 'paid', 'overdue'
  invoice_url VARCHAR(255)
);
```

---

## Phase 3: WordPress Deployment Automation (Month 2-3)

### Helm Chart for WordPress (Standardized Deployment)

**File: `helm/wordpress-client/values.yaml`**
```yaml
# Template values for client deployments
client:
  name: "client-name"
  domain: "client-domain.com"
  tier: "basic"  # internal, basic, premium

wordpress:
  image: wordpress:latest
  replicas: 1  # Scale to 2-3 for premium tier

  resources:
    requests:
      memory: "512Mi"
      cpu: "250m"
    limits:
      memory: "1Gi"
      cpu: "500m"

database:
  host: "managed-mysql-cluster"
  name: "client_db"
  user: "client_user"
  # Password from Kubernetes secret

ingress:
  enabled: true
  className: traefik
  hosts:
    - host: "{{ .Values.client.domain }}"
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: "{{ .Values.client.name }}-tls"
      hosts:
        - "{{ .Values.client.domain }}"

persistence:
  enabled: true
  storageClass: do-block-storage
  size: 10Gi  # 10GB per site (increase for premium)

astraPro:
  enabled: true
  licenseKey: "{{ .Values.astra.licenseKey }}"
  plugins:
    - spectra-pro
    - ultimate-elementor-addons
```

### Automated Client Onboarding Script

**File: `scripts/onboard-client.sh`**
```bash
#!/bin/bash
# ASI 360 - Automated client onboarding for Kubernetes

set -e

CLIENT_NAME=$1
DOMAIN=$2
TIER=${3:-basic}  # internal, basic, premium

if [ -z "$CLIENT_NAME" ] || [ -z "$DOMAIN" ]; then
    echo "Usage: ./onboard-client.sh <client-name> <domain> [tier]"
    exit 1
fi

echo "🚀 Onboarding: $CLIENT_NAME ($DOMAIN) - Tier: $TIER"

# 1. Generate secure credentials
DB_PASSWORD=$(openssl rand -base64 32)
WP_ADMIN_PASSWORD=$(openssl rand -base64 16)

# 2. Create database
mysql -h $MANAGED_MYSQL_HOST -u admin -p$MYSQL_ROOT_PASSWORD << EOF
CREATE DATABASE ${CLIENT_NAME}_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER '${CLIENT_NAME}_user'@'%' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON ${CLIENT_NAME}_db.* TO '${CLIENT_NAME}_user'@'%';
FLUSH PRIVILEGES;
EOF

# 3. Create Kubernetes secret
kubectl create secret generic ${CLIENT_NAME}-credentials \
  --from-literal=db-password=$DB_PASSWORD \
  --from-literal=wp-admin-password=$WP_ADMIN_PASSWORD \
  --namespace=asi360-clients

# 4. Deploy WordPress via Helm
helm install ${CLIENT_NAME} ./helm/wordpress-client \
  --namespace asi360-clients \
  --create-namespace \
  --set client.name=$CLIENT_NAME \
  --set client.domain=$DOMAIN \
  --set client.tier=$TIER \
  --set database.password=$DB_PASSWORD \
  --wait

# 5. Record in control database
mysql -h $MANAGED_MYSQL_HOST -u admin -p$MYSQL_ROOT_PASSWORD asi360_control << EOF
INSERT INTO clients (client_name, domain, db_name, db_host, db_user, tier, status, created_at)
VALUES ('$CLIENT_NAME', '$DOMAIN', '${CLIENT_NAME}_db', '$MANAGED_MYSQL_HOST', '${CLIENT_NAME}_user', '$TIER', 'active', NOW());
EOF

# 6. Configure DNS (optional automation via CloudFlare API)
echo ""
echo "✅ Client deployed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Domain: $DOMAIN"
echo "WordPress Admin: https://$DOMAIN/wp-admin"
echo "Username: admin"
echo "Password: $WP_ADMIN_PASSWORD"
echo ""
echo "📋 Next Steps:"
echo "1. Point DNS A record: $DOMAIN → $(kubectl get svc traefik -n traefik -o jsonpath='{.status.loadBalancer.ingress[0].ip}')"
echo "2. Wait 5-10 minutes for SSL certificate"
echo "3. Install Astra Pro theme + plugins"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

**Usage:**
```bash
# Onboard internal client
./scripts/onboard-client.sh jccix jccix.org internal

# Onboard external basic client
./scripts/onboard-client.sh acme acme.com basic

# Onboard premium client (more resources)
./scripts/onboard-client.sh bigcorp bigcorp.com premium
```

---

## Phase 4: Client Portal (Month 3-4)

### Self-Service Client Dashboard

**Tech Stack:**
- **Frontend:** Next.js 14 (React)
- **Backend:** FastAPI (Python)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth

**Features:**
1. **Client Login** - Secure authentication
2. **Site Dashboard** - View site stats, uptime, storage
3. **Content Editor** - Inline WordPress editing
4. **Billing** - View invoices, payment history
5. **Support Tickets** - Automated ticket system
6. **Domain Management** - DNS configuration help
7. **Analytics** - Traffic, visitors, conversions

**File: `portal/docker-compose.yml`**
```yaml
version: '3.8'

services:
  # Client Portal Frontend
  portal-frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=https://api.asi360.com
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_KEY}

  # Client Portal Backend API
  portal-api:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=${SUPABASE_URL}
      - KUBERNETES_CONFIG=/root/.kube/config
      - MYSQL_CONTROL_HOST=${MANAGED_MYSQL_HOST}
    volumes:
      - ~/.kube/config:/root/.kube/config:ro
```

---

## Phase 5: AI-Powered Site Generation (Month 4-5)

### Automated WordPress Content Creation

**File: `automation/ai-site-builder.py`**
```python
"""
ASI 360 - AI-Powered WordPress Site Builder
Uses Claude API + Astra AI Builder to generate complete websites
"""

import anthropic
from wordpress_api import WordPressClient
import os

class AISiteBuilder:
    def __init__(self, client_name: str, domain: str):
        self.client = WordPressClient(domain)
        self.anthropic = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
        self.client_name = client_name

    def generate_site(self, business_description: str, industry: str):
        """
        Generate complete WordPress site from business description

        Steps:
        1. Generate site structure (pages, navigation)
        2. Create content for each page
        3. Select appropriate Astra template
        4. Generate images with DALL-E or Midjourney
        5. Deploy to WordPress
        """

        # 1. Generate site architecture
        architecture = self._generate_architecture(business_description, industry)

        # 2. Create pages
        for page in architecture['pages']:
            content = self._generate_page_content(page, business_description)
            self.client.create_page(
                title=page['title'],
                content=content,
                template=page['template']
            )

        # 3. Configure theme
        self._configure_astra_theme(architecture['color_scheme'], architecture['fonts'])

        # 4. Create navigation menus
        self._create_navigation(architecture['navigation'])

        return f"✅ Site generated: https://{self.client.domain}"

    def _generate_architecture(self, description: str, industry: str):
        """Use Claude to design site structure"""
        response = self.anthropic.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=2000,
            messages=[{
                "role": "user",
                "content": f"""Design a WordPress site architecture for:

Business: {description}
Industry: {industry}

Return JSON with:
- pages: [{{title, slug, template, purpose}}]
- navigation: [{{label, url}}]
- color_scheme: {{primary, secondary, accent}}
- fonts: {{heading, body}}
- recommended_plugins: []
"""
            }]
        )

        import json
        return json.loads(response.content[0].text)
```

**Usage:**
```python
# Generate site from description
builder = AISiteBuilder("JCCIX", "jccix.org")
builder.generate_site(
    business_description="Hurricane relief organization in Jamaica providing emergency aid",
    industry="nonprofit"
)
```

---

## Phase 6: Monitoring & Scaling (Month 5-6)

### Infrastructure Monitoring

**File: `monitoring/grafana-dashboard.json`**
```json
{
  "dashboard": {
    "title": "ASI 360 - 100 Sites Overview",
    "panels": [
      {
        "title": "Active Sites",
        "type": "stat",
        "query": "count(up{job='wordpress'})"
      },
      {
        "title": "Total Traffic (req/sec)",
        "type": "graph",
        "query": "sum(rate(http_requests_total[5m]))"
      },
      {
        "title": "Database Connections",
        "type": "graph",
        "query": "sum(mysql_global_status_threads_connected)"
      },
      {
        "title": "Storage Used",
        "type": "stat",
        "query": "sum(container_fs_usage_bytes) / 1024 / 1024 / 1024"
      },
      {
        "title": "Sites by Tier",
        "type": "pie",
        "query": "count by (tier) (wordpress_site_info)"
      }
    ]
  }
}
```

### Auto-Scaling Configuration

**File: `kubernetes/hpa.yaml`** (Horizontal Pod Autoscaler)
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: wordpress-autoscaler
  namespace: asi360-clients
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: wordpress
  minReplicas: 3  # Always 3 nodes minimum
  maxReplicas: 10  # Scale up to 10 during traffic spikes
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70  # Scale when CPU > 70%
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80  # Scale when RAM > 80%
```

---

## Cost Breakdown by Client Tier

### Tier 1: Internal Sites (ASI 360 projects)
- **Sites:** 20 sites
- **Resources:** 256MB RAM, 0.1 CPU per site
- **Cost:** $0/mo (internal overhead)
- **Examples:** JCCIX, ASE-F.org, internal tools

### Tier 2: Basic External Clients
- **Sites:** 50 sites
- **Resources:** 512MB RAM, 0.25 CPU per site
- **Pricing:** $15/mo per client
- **Revenue:** $750/mo
- **Infrastructure cost:** ~$250/mo
- **Profit margin:** 67%

### Tier 3: Premium External Clients
- **Sites:** 30 sites
- **Resources:** 1GB RAM, 0.5 CPU, dedicated support
- **Pricing:** $50/mo per client
- **Revenue:** $1,500/mo
- **Infrastructure cost:** ~$308/mo
- **Profit margin:** 79%

### Total Revenue Model (100 Sites)
```
Revenue:
├─ 20 internal sites: $0/mo (cost center)
├─ 50 basic clients: $750/mo
└─ 30 premium clients: $1,500/mo
─────────────────────────────────────
   Total Revenue: $2,250/mo

Costs:
├─ Infrastructure: $558/mo
├─ Astra Pro license: $20/mo (amortized)
├─ Claude API (automation): $50/mo
└─ Support staff (1 person): $3,000/mo
─────────────────────────────────────
   Total Cost: $3,628/mo

Net Profit: -$1,378/mo at 100 sites

BREAK-EVEN: ~160 paying clients
PROFIT AT 200 CLIENTS: ~$7,872/mo
```

**Revenue optimization:**
- Increase to 100 paying clients (not including internal): **$3,250/mo revenue**
- Net profit: $-378/mo (nearly break-even)
- At 120 paying clients: **$1,122/mo profit**

---

## Migration Path (3 Phases)

### Phase 1: Proof of Concept (Month 1)
- Deploy 5 internal sites on Kubernetes
- Test automation scripts
- Validate performance
- **Cost:** $200/mo (small cluster)

### Phase 2: Early Adopters (Month 2-3)
- Migrate 20 sites (10 internal + 10 paying clients)
- Launch client portal
- Refine onboarding process
- **Cost:** $400/mo
- **Revenue:** $150-300/mo

### Phase 3: Full Scale (Month 4-6)
- Migrate remaining 80 sites
- Open to new client acquisition
- Full automation operational
- **Cost:** $558/mo
- **Revenue:** $2,250/mo target

---

## Key Success Metrics

1. **Deployment Time:** < 5 minutes per new client
2. **Uptime:** 99.9% SLA (52 minutes downtime/year)
3. **Page Load Speed:** < 2 seconds (global average)
4. **Support Tickets:** < 10/month across 100 sites
5. **Profit Margin:** > 60% at scale

---

## Technology Alternatives (Trade-offs)

### Instead of Kubernetes:
1. **Docker Swarm** - Simpler but less features ($400/mo)
2. **Nomad (HashiCorp)** - Lightweight alternative ($350/mo)
3. **AWS ECS** - Vendor lock-in but easier ($600/mo)

### Instead of Self-Hosting:
1. **Cloudways** - $11/site managed WordPress (~$1,100/mo for 100)
2. **GridPane** - $50/mo + $30/server ($300/mo infrastructure)
3. **ServerPilot** - Similar to GridPane ($250/mo)

### Why K8s is Best for ASI 360:
- ✅ Complete control (no vendor restrictions)
- ✅ Future-proof (industry standard)
- ✅ Auto-scaling (handle traffic spikes)
- ✅ Multi-cloud capable (migrate to AWS/GCP easily)
- ✅ Open source (no licensing fees)

---

**Status:** Architecture designed, ready for implementation
**Timeline:** 6 months to full 100-site deployment
**Next Step:** Provision 3-node Kubernetes cluster on Digital Ocean

