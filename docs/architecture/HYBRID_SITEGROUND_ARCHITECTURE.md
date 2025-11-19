# ASI 360 - Hybrid Multi-Cloud Architecture
**SiteGround (Production) + Digital Ocean (Backend/Testing) + Vast.ai (Content Production)**

---

## 🎯 Architecture Overview

This hybrid approach separates concerns across three platforms, each optimized for specific tasks:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PUBLIC-FACING LAYER                          │
│                     (SiteGround)                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Client 1    │  │  Client 2    │  │  Client 3    │         │
│  │  WordPress   │  │  WordPress   │  │  WordPress   │         │
│  │  Production  │  │  Production  │  │  Production  │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                 │                   │
│         └─────────────────┴─────────────────┘                   │
│                           │                                      │
│                  WordPress REST API                              │
└───────────────────────────┼──────────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────────────┐
│              BACKEND/INTELLIGENCE LAYER                          │
│              (Digital Ocean Droplet - 137.184.1.91)             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ Testing/Staging WordPress (Docker)                  │       │
│  │ • Test plugins/themes before production             │       │
│  │ • ACF forms development                             │       │
│  │ • Amelia booking plugin testing                     │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ Data & Intelligence Services                        │       │
│  │ • Supabase (PostgreSQL) - Client metadata          │       │
│  │ • Qdrant - Vector search for content                │       │
│  │ • Neo4j - Knowledge graph relationships             │       │
│  │ • N8N - Automation workflows                         │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ Admin & Control Interfaces                          │       │
│  │ • Streamlit dashboards (client management)          │       │
│  │ • Telegram bot (admin commands)                     │       │
│  │ • Python scripts (data parsing/sync)                │       │
│  │ • FTP deployment automation                         │       │
│  └─────────────────────────────────────────────────────┘       │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────────┐
│           CONTENT PRODUCTION LAYER                               │
│           (Vast.ai GPU Instance - On-demand)                    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ GPU-Accelerated Content Creation                    │       │
│  │ • Video editing (Premiere Pro, After Effects)       │       │
│  │ • Image generation (Stable Diffusion, DALL-E)       │       │
│  │ • Graphics design (Figma, Photopea automation)      │       │
│  │ • Cloud storage mount (edit files remotely)         │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
│  • Parsec remote desktop access                                 │
│  • Auto-shutdown when idle (cost savings)                       │
│  • Syncs to cloud storage (Google Drive, S3)                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 💰 Cost Breakdown

### SiteGround (Production Hosting)
**Plan:** GrowBig ($15/mo) or GoGeek ($25/mo)

**GrowBig Features ($14.99/mo):**
- Host unlimited websites
- 40GB storage
- Automatic daily backups ✅
- Free SSL certificates
- Email hosting included ✅
- Staging environment ✅
- Git integration
- SSH access
- 25,000 monthly visits

**GoGeek Features ($24.99/mo):**
- Everything in GrowBig +
- 80GB storage
- Priority support
- 100,000 monthly visits
- Server-level caching
- On-demand backups

**Why SiteGround:**
- ✅ Managed WordPress hosting (less maintenance)
- ✅ Built-in email (important for client sites)
- ✅ Automatic backups (7-30 days retention)
- ✅ 24/7 support
- ✅ WordPress optimized
- ✅ FTP/SFTP access for deployment
- ✅ No container management needed

### Digital Ocean Droplet (Backend)
**Plan:** $48/mo (8GB RAM, 4 vCPUs)

**Services Running:**
- Docker containers:
  - Testing WordPress instances
  - Supabase (self-hosted or connect to cloud)
  - Qdrant vector database
  - Neo4j graph database
  - N8N automation
- Streamlit dashboards
- Telegram bot
- Python deployment scripts

### Vast.ai (GPU Compute - On-Demand)
**Cost:** $0.30-0.50/hour (only when needed)
**Usage:** ~5-10 hours/week for content creation
**Monthly:** ~$10-20/mo

### Cloud Storage
**Google Drive Business:** $12/mo (2TB)
- Shared across all projects
- Mount to Vast.ai for editing
- WordPress media backups

---

## 🔄 Deployment Pipeline

### Stage 1: Development → Testing (Digital Ocean)

**Local Development:**
```bash
# Work on local Mac/PC
# Test plugins, themes, ACF forms locally
```

**Push to Testing Server:**
```bash
# Deploy to DO droplet staging WordPress
rsync -avz --exclude 'wp-config.php' \
  ./wordpress/ root@137.184.1.91:/var/www/staging-client1/

# Or use Git
git push staging main
```

**Testing Phase:**
- Test on staging.client1.asi360.com
- Verify ACF forms work
- Test Amelia booking plugin
- Check responsiveness
- Run automated tests

### Stage 2: Testing → Production (SiteGround)

**Automated FTP Deployment:**

**File: `scripts/deploy-to-siteground.py`**
```python
#!/usr/bin/env python3
"""
ASI 360 - Automated SiteGround Deployment
Syncs tested WordPress files from DO staging to SiteGround production
"""

import ftplib
import os
from pathlib import Path
import hashlib
from datetime import datetime

class SiteGroundDeployer:
    def __init__(self, client_name: str):
        self.client_name = client_name
        self.ftp_host = os.getenv(f'{client_name.upper()}_FTP_HOST')
        self.ftp_user = os.getenv(f'{client_name.upper()}_FTP_USER')
        self.ftp_pass = os.getenv(f'{client_name.upper()}_FTP_PASS')
        self.remote_path = f'/public_html/{client_name}/'

    def connect(self):
        """Connect to SiteGround FTP"""
        self.ftp = ftplib.FTP(self.ftp_host)
        self.ftp.login(self.ftp_user, self.ftp_pass)
        print(f"✓ Connected to {self.ftp_host}")

    def get_file_hash(self, filepath: str) -> str:
        """Calculate MD5 hash of file"""
        with open(filepath, 'rb') as f:
            return hashlib.md5(f.read()).hexdigest()

    def sync_directory(self, local_path: str, remote_path: str = None):
        """
        Sync local directory to SiteGround
        Only uploads changed files (checks MD5 hash)
        """
        if remote_path is None:
            remote_path = self.remote_path

        uploaded = 0
        skipped = 0

        for root, dirs, files in os.walk(local_path):
            # Skip certain directories
            if any(skip in root for skip in ['.git', 'node_modules', '.cache']):
                continue

            for filename in files:
                local_file = os.path.join(root, filename)
                relative_path = os.path.relpath(local_file, local_path)
                remote_file = f"{remote_path}/{relative_path}"

                # Check if file needs updating
                if self.should_upload(local_file, remote_file):
                    self.upload_file(local_file, remote_file)
                    uploaded += 1
                    print(f"  ↑ {relative_path}")
                else:
                    skipped += 1

        print(f"\n✓ Deployment complete: {uploaded} uploaded, {skipped} unchanged")

    def should_upload(self, local_file: str, remote_file: str) -> bool:
        """Check if local file is newer than remote"""
        try:
            # Get remote file size
            self.ftp.size(remote_file)

            # Compare file sizes (simple check)
            local_size = os.path.getsize(local_file)
            remote_size = self.ftp.size(remote_file)

            return local_size != remote_size
        except ftplib.error_perm:
            # File doesn't exist on remote, upload it
            return True

    def upload_file(self, local_path: str, remote_path: str):
        """Upload single file to SiteGround"""
        # Create remote directory if needed
        remote_dir = os.path.dirname(remote_path)
        self.mkdir_p(remote_dir)

        # Upload file
        with open(local_path, 'rb') as f:
            self.ftp.storbinary(f'STOR {remote_path}', f)

    def mkdir_p(self, remote_path: str):
        """Create remote directory recursively"""
        parts = remote_path.split('/')
        current = ''
        for part in parts:
            if not part:
                continue
            current += f'/{part}'
            try:
                self.ftp.mkd(current)
            except ftplib.error_perm:
                pass  # Directory already exists

    def backup_production(self):
        """Create backup of production site before deployment"""
        backup_dir = f'/backups/{self.client_name}_{datetime.now().strftime("%Y%m%d_%H%M%S")}'
        print(f"Creating backup at {backup_dir}...")
        # SiteGround has automatic backups, but we can trigger on-demand
        # via API or cPanel

    def deploy_theme(self, theme_name: str):
        """Deploy specific theme"""
        local_theme = f'/var/www/staging-{self.client_name}/wp-content/themes/{theme_name}'
        remote_theme = f'{self.remote_path}/wp-content/themes/{theme_name}'
        self.sync_directory(local_theme, remote_theme)

    def deploy_plugin(self, plugin_name: str):
        """Deploy specific plugin"""
        local_plugin = f'/var/www/staging-{self.client_name}/wp-content/plugins/{plugin_name}'
        remote_plugin = f'{self.remote_path}/wp-content/plugins/{plugin_name}'
        self.sync_directory(local_plugin, remote_plugin)

    def deploy_full_site(self):
        """Deploy entire WordPress site"""
        print(f"🚀 Deploying {self.client_name} to SiteGround...")

        # Backup first (SiteGround does this automatically)
        print("✓ SiteGround backup in progress (automatic)")

        # Sync WordPress files
        local_wp = f'/var/www/staging-{self.client_name}'

        # Exclude wp-config.php (different on production)
        # Exclude uploads (media handled separately)
        self.sync_directory(local_wp, self.remote_path)

        print(f"\n✅ {self.client_name} deployed successfully!")
        print(f"   Visit: https://{self.client_name}.com")

# Usage
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python deploy-to-siteground.py <client-name> [theme|plugin|full]")
        sys.exit(1)

    client = sys.argv[1]
    action = sys.argv[2] if len(sys.argv) > 2 else 'full'

    deployer = SiteGroundDeployer(client)
    deployer.connect()

    if action == 'full':
        deployer.deploy_full_site()
    elif action == 'theme':
        theme_name = sys.argv[3]
        deployer.deploy_theme(theme_name)
    elif action == 'plugin':
        plugin_name = sys.argv[3]
        deployer.deploy_plugin(plugin_name)

    deployer.ftp.quit()
```

**Usage:**
```bash
# Deploy entire site
python3 scripts/deploy-to-siteground.py client1 full

# Deploy just theme
python3 scripts/deploy-to-siteground.py client1 theme astra

# Deploy specific plugin
python3 scripts/deploy-to-siteground.py client1 plugin amelia
```

---

## 📊 Data Flow Architecture

### Supabase → WordPress Content Sync

**Use Case:** Hurricane relief updates from Supabase → JCCIX website

**File: `automation/supabase-to-wordpress.py`**
```python
#!/usr/bin/env python3
"""
Sync Supabase data to WordPress via REST API
Example: Legal case updates, relief coordination, client projects
"""

from supabase import create_client
import requests
import os
from datetime import datetime

class SupabaseWordPressSync:
    def __init__(self, wp_site_url: str):
        self.supabase = create_client(
            os.getenv('SUPABASE_URL'),
            os.getenv('SUPABASE_KEY')
        )
        self.wp_url = wp_site_url
        self.wp_user = os.getenv('WP_API_USER')
        self.wp_app_password = os.getenv('WP_API_PASSWORD')

    def sync_relief_updates(self):
        """
        Sync relief coordination updates to JCCIX website
        """
        # Get latest updates from Supabase
        updates = self.supabase.table('relief_updates')\
            .select('*')\
            .gte('created_at', datetime.now().isoformat())\
            .order('created_at', desc=True)\
            .execute()

        for update in updates.data:
            # Check if already posted
            existing = self.get_wp_post_by_meta('supabase_id', update['id'])

            if existing:
                # Update existing post
                self.update_wp_post(existing['id'], update)
            else:
                # Create new post
                self.create_wp_post(update)

    def create_wp_post(self, data: dict):
        """Create WordPress post via REST API"""
        response = requests.post(
            f"{self.wp_url}/wp-json/wp/v2/posts",
            auth=(self.wp_user, self.wp_app_password),
            json={
                'title': data['title'],
                'content': data['content'],
                'status': 'publish',
                'categories': [self.get_category_id('Relief Updates')],
                'meta': {
                    'supabase_id': data['id'],
                    'sync_timestamp': datetime.now().isoformat()
                }
            }
        )

        if response.status_code == 201:
            print(f"✓ Created: {data['title']}")
        else:
            print(f"✗ Error creating post: {response.status_code}")

    def sync_acf_forms_data(self, form_id: int):
        """
        Sync ACF form submissions from Supabase to WordPress
        """
        # Get form submissions
        submissions = self.supabase.table('form_submissions')\
            .select('*')\
            .eq('form_id', form_id)\
            .eq('synced_to_wp', False)\
            .execute()

        for submission in submissions.data:
            # Create WordPress entry
            self.create_acf_entry(form_id, submission)

            # Mark as synced
            self.supabase.table('form_submissions')\
                .update({'synced_to_wp': True})\
                .eq('id', submission['id'])\
                .execute()

# Usage
if __name__ == "__main__":
    # Sync JCCIX relief updates
    jccix_sync = SupabaseWordPressSync('https://jccix.org')
    jccix_sync.sync_relief_updates()

    # Sync legal case updates to ASE-F.org
    asef_sync = SupabaseWordPressSync('https://ase-f.org')
    asef_sync.sync_legal_updates()
```

---

## 🤖 N8N Automation Workflows

### Workflow 1: Staging → Production Deployment

**Trigger:** Approval in Telegram bot
**Actions:**
1. Run tests on staging site
2. If tests pass, sync files to SiteGround via FTP
3. Clear SiteGround cache
4. Notify in Telegram: "✅ Client X deployed"

### Workflow 2: Content Generation → WordPress

**Trigger:** New entry in Supabase
**Actions:**
1. Generate AI content with Claude API
2. Create draft post in staging WordPress
3. Notify admin in Telegram for review
4. On approval, publish to production SiteGround site

### Workflow 3: Media Pipeline (Vast.ai → WordPress)

**Trigger:** Video rendering complete on Vast.ai
**Actions:**
1. Download rendered video from Vast.ai Docker
2. Upload to Google Drive
3. Sync to WordPress media library (SiteGround)
4. Update post with video embed
5. Shutdown Vast.ai instance (save cost)

---

## 🎨 Vast.ai Content Production Workflow

### Setup: Mount Cloud Storage in Docker

**File: `vastai/mount-storage.sh`**
```bash
#!/bin/bash
# Mount Google Drive in Vast.ai Docker container

# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure rclone (interactive first time)
rclone config

# Mount Google Drive
mkdir -p ~/gdrive
rclone mount gdrive: ~/gdrive --daemon

# Now edit files directly:
# - Premiere Pro projects
# - Figma exports
# - Photopea PSDs
# All changes auto-sync to cloud
```

### Editing Workflow:

1. **Spin up Vast.ai GPU instance**
   ```bash
   # From Mac or Surface Pro
   vastai create instance 123456 \
     --image nvidia/cuda:11.8.0-runtime-ubuntu22.04 \
     --disk 50
   ```

2. **Connect via Parsec** - Remote desktop from any device

3. **Open projects from mounted Google Drive**
   - Premiere Pro: `~/gdrive/asi360-clients/client1/video-project.prproj`
   - Figma via browser (cloud-based)
   - Photopea: `~/gdrive/asi360-clients/client1/graphics/`

4. **Export and deploy**
   ```bash
   # Export video
   premiere-cli render project.prproj output.mp4

   # Upload to WordPress via API
   python3 ~/scripts/upload-to-wordpress.py client1 output.mp4

   # Shutdown Vast.ai to save money
   vastai destroy instance $INSTANCE_ID
   ```

---

## 🗄️ Database Strategy

### Neo4j (Knowledge Graph)
**Hosted on:** Digital Ocean droplet
**Use Case:** Map relationships between:
- Clients ↔ Projects ↔ Content
- Content ↔ Topics ↔ SEO keywords
- Employees ↔ Skills ↔ Projects

**Example Query:**
```cypher
// Find all projects using "Amelia booking plugin"
MATCH (c:Client)-[:HAS_PROJECT]->(p:Project)-[:USES_PLUGIN]->(plugin:Plugin {name: 'Amelia'})
RETURN c.name, p.name, plugin.version
```

### Qdrant (Vector Search)
**Hosted on:** Digital Ocean droplet
**Use Case:**
- Semantic search across all client content
- Find similar pages/posts
- AI-powered content recommendations

**Example:**
```python
from qdrant_client import QdrantClient

client = QdrantClient(host="137.184.1.91", port=6333)

# Search for content similar to query
results = client.search(
    collection_name="wordpress_content",
    query_vector=get_embedding("hurricane relief Jamaica"),
    limit=10
)
```

### Supabase (Metadata & Control)
**Hosted on:** Supabase Cloud (or self-hosted on DO)
**Use Case:**
- Client metadata (FTP credentials, API keys)
- Deployment logs
- Form submissions (ACF forms)
- Analytics aggregation
- Billing data

---

## 📋 Amelia Booking Plugin Integration

**Scenario:** Client needs booking system (appointments, classes, events)

### Setup on Testing (DO Staging):
```bash
# Install Amelia plugin
wp plugin install ameliabooking --activate

# Configure via Telegram bot
/amelia_setup client1 --services="Consultation,Workshop"
```

### Test Booking Flow:
1. Create test booking on staging.client1.asi360.com
2. Verify email notifications work
3. Check calendar sync
4. Test payment gateway (PayPal/Stripe sandbox)

### Deploy to Production (SiteGround):
```bash
# Deploy plugin + settings
python3 scripts/deploy-to-siteground.py client1 plugin ameliabooking

# Export/import Amelia settings
wp amelia export settings > /tmp/amelia-settings.json
# Upload to SiteGround and import
```

---

## 🎯 ACF (Advanced Custom Fields) Forms

### Development Workflow:

**Stage 1: Build on DO Staging**
```bash
# Install ACF Pro
wp plugin install advanced-custom-fields-pro --activate

# Create form via ACF UI or code
```

**Stage 2: Store Submissions in Supabase**

**File: `wp-content/mu-plugins/acf-to-supabase.php`**
```php
<?php
/**
 * Plugin Name: ACF to Supabase Sync
 * Description: Sends ACF form submissions to Supabase database
 */

add_action('acf/save_post', 'save_acf_to_supabase', 20);

function save_acf_to_supabase($post_id) {
    // Only for specific forms
    if (get_post_type($post_id) !== 'acf_form_submission') {
        return;
    }

    $fields = get_fields($post_id);

    // Send to Supabase via REST API
    $supabase_url = getenv('SUPABASE_URL');
    $supabase_key = getenv('SUPABASE_KEY');

    wp_remote_post("$supabase_url/rest/v1/form_submissions", [
        'headers' => [
            'apikey' => $supabase_key,
            'Authorization' => "Bearer $supabase_key",
            'Content-Type' => 'application/json'
        ],
        'body' => json_encode([
            'form_id' => $fields['form_id'],
            'submission_data' => $fields,
            'submitted_at' => current_time('mysql'),
            'synced_to_wp' => false
        ])
    ]);
}
```

**Stage 3: Deploy to SiteGround**
```bash
# Deploy mu-plugin
python3 scripts/deploy-to-siteground.py client1 plugin mu-plugins
```

---

## 🔐 Secrets Management

**File: `.env` (on DO droplet only, never commit)**
```bash
# SiteGround FTP Credentials (per client)
CLIENT1_FTP_HOST=ftp.client1.com
CLIENT1_FTP_USER=client1@asi360.com
CLIENT1_FTP_PASS=secure_password

CLIENT2_FTP_HOST=ftp.client2.com
CLIENT2_FTP_USER=client2@asi360.com
CLIENT2_FTP_PASS=secure_password

# WordPress API Credentials (for REST API access)
CLIENT1_WP_API_USER=admin
CLIENT1_WP_API_PASSWORD=app_password_here

# Supabase
SUPABASE_URL=https://jvjlhxodmbkodzmggwpu.supabase.co
SUPABASE_KEY=your_key_here

# Qdrant
QDRANT_HOST=137.184.1.91
QDRANT_PORT=6333

# Neo4j
NEO4J_URI=bolt://137.184.1.91:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=secure_password

# Vast.ai
VASTAI_API_KEY=your_vastai_key
```

---

## 💡 Why This Hybrid Architecture Works

### SiteGround Advantages:
1. **Email hosting included** - Critical for client sites
2. **Automatic backups** - Daily backups for 30 days
3. **Managed security** - Firewall, malware scanning
4. **WordPress optimized** - Built-in caching, updates
5. **Support** - 24/7 phone/chat if issues arise
6. **Staging environment** - Built-in staging (GoGeek plan)
7. **No container management** - Less DevOps overhead

### Digital Ocean Droplet Advantages:
1. **Testing environment** - Safe sandbox for development
2. **Backend services** - Run Supabase, Qdrant, Neo4j, N8N
3. **Admin dashboards** - Streamlit dashboards for management
4. **Automation** - Python scripts, Telegram bot
5. **Full control** - Root access, custom software

### Vast.ai Advantages:
1. **GPU power** - Video editing, AI content generation
2. **On-demand pricing** - Only pay when using (~$0.40/hr)
3. **Remote access** - Work from Mac Mini, Surface Pro, or laptop
4. **Cloud storage mount** - Edit files directly from Google Drive
5. **No upfront investment** - No need to buy GPU hardware

---

## 📈 Cost Summary

| Service | Monthly Cost | Purpose |
|---------|-------------|---------|
| SiteGround GoGeek | $25/mo | Production WordPress hosting (all clients) |
| Digital Ocean Droplet | $48/mo | Testing, databases, automation, dashboards |
| Vast.ai GPU | ~$15/mo | Content production (10 hrs @ $0.40/hr) |
| Google Drive Business | $12/mo | Cloud storage (2TB) |
| **TOTAL** | **$100/mo** | **Infrastructure for 100 sites** |

**Compare to:**
- WP Engine (100 sites): $3,000/mo
- **Savings: $2,900/month (97%)**

**Per-site cost: $1.00/mo** (infrastructure only)

---

## 🚀 Deployment Checklist

### Initial Setup (One-time):
- [ ] Purchase SiteGround GoGeek plan
- [ ] Set up FTP accounts for each client
- [ ] Install WordPress on SiteGround for each client
- [ ] Configure automatic backups
- [ ] Set up email accounts

### Per Client Setup:
- [ ] Create staging site on DO droplet
- [ ] Develop theme/plugins on staging
- [ ] Test ACF forms and Amelia bookings
- [ ] Deploy to SiteGround via FTP script
- [ ] Configure N8N workflow for auto-deployment
- [ ] Set up Telegram bot commands for client

### Ongoing Operations:
- [ ] Daily: Automated content sync (Supabase → WordPress)
- [ ] Weekly: Review Telegram bot logs
- [ ] Monthly: Check SiteGround backups
- [ ] Monthly: Review Vast.ai GPU usage costs

---

**Status:** Hybrid architecture designed
**Next Step:** Deploy first client to SiteGround + DO testing environment

