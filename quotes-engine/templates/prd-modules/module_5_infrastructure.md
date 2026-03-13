# MODULE 5: Infrastructure & Deployment

> ASI 360 Project Status Portal — `projects.asi360.co`
> Last updated: 2026-03-10
> Droplet: 104.248.69.86 (DigitalOcean, 2 vCPU, 8GB RAM, 155GB disk — 25% used)
> Nginx: 1.28.0 (Ubuntu), HTTP/2, HTTP/3, gzip_static
> Node: v24.12.0, npm 11.6.2
> SSL: Let's Encrypt via certbot (auto-renewal active via systemd timer)
> Reference config: `gl-ops-dashboard` (React SPA on port 3200)

---

## 5.1 DNS Configuration

### A Record

| Type | Host               | Value            | TTL  |
|------|--------------------|------------------|------|
| A    | projects.asi360.co | 104.248.69.86    | 300  |

The `asi360.co` domain already has `api.asi360.co` pointing to the same droplet with a valid Let's Encrypt cert, so the DNS provider is already configured for this IP.

### Setup Commands

```bash
# Add the A record in your DNS provider (DigitalOcean Networking or Cloudflare)
# Then verify propagation:

# Quick check
dig +short projects.asi360.co
# Expected: 104.248.69.86

# Full check
dig projects.asi360.co A +noall +answer
# Expected:
# projects.asi360.co.  300  IN  A  104.248.69.86

# Alternative
nslookup projects.asi360.co
# Expected: Address: 104.248.69.86

# Check from external DNS (Google)
dig @8.8.8.8 projects.asi360.co +short
```

### Propagation Timeline

- **DigitalOcean DNS:** 30 seconds – 5 minutes (TTL 300)
- **Cloudflare:** Instant if proxied, 2–5 minutes if DNS-only
- **Generic registrars:** Up to 24–48 hours (rare; usually < 1 hour)

### If Using DigitalOcean DNS (doctl)

```bash
# List existing records for asi360.co
doctl compute domain records list asi360.co

# Create A record
doctl compute domain records create asi360.co \
  --record-type A \
  --record-name projects \
  --record-data 104.248.69.86 \
  --record-ttl 300
```

### If Using Cloudflare

```bash
# Via Cloudflare API (replace ZONE_ID and API_TOKEN)
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/dns_records" \
  -H "Authorization: Bearer API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "A",
    "name": "projects",
    "content": "104.248.69.86",
    "ttl": 300,
    "proxied": false
  }'
```

> **Note:** Set `proxied: false` initially so certbot HTTP-01 challenge works. After SSL is configured, you can optionally enable Cloudflare proxy for DDoS protection.

---

## 5.2 Nginx Configuration

### Server Block: `/etc/nginx/sites-available/projects-portal`

This follows the proven `gl-ops-dashboard` pattern with production hardening added.

```nginx
# =============================================================================
# ASI 360 PROJECT STATUS PORTAL
# Static React SPA — projects.asi360.co
# Supabase handles all API calls client-side (no backend proxy needed)
# =============================================================================

# Rate limiting zone (shared across all requests to this server)
limit_req_zone $binary_remote_addr zone=portal_limit:10m rate=100r/m;

server {
    listen 80;
    server_name projects.asi360.co;

    # Redirect all HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name projects.asi360.co;

    # --- SSL (managed by Certbot) ---
    ssl_certificate /etc/letsencrypt/live/projects.asi360.co/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/projects.asi360.co/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # --- Document Root ---
    root /var/www/projects-portal/current/dist;
    index index.html;

    # --- Security Headers ---
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://gtfffxwfgcxiiauliynd.supabase.co https://*.supabase.co wss://*.supabase.co; frame-ancestors 'self'" always;

    # --- Logging ---
    access_log /var/log/nginx/projects-portal.access.log combined;
    error_log /var/log/nginx/projects-portal.error.log warn;

    # --- Server Identity ---
    server_tokens off;

    # --- Request Limits ---
    client_max_body_size 1m;

    # --- SPA Fallback ---
    location / {
        limit_req zone=portal_limit burst=20 nodelay;
        try_files $uri $uri/ /index.html;
    }

    # --- Hashed Static Assets (Vite output) ---
    # Vite generates filenames like: assets/index-Bx7Kf9a2.js
    # These are content-hashed and safe to cache forever.
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options "nosniff" always;
        access_log off;
    }

    # --- index.html: Never Cache ---
    # SPA entry point must always be fresh so new deploys take effect.
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # --- Health Check Endpoint ---
    location = /health.json {
        add_header Cache-Control "no-cache";
        add_header Content-Type "application/json";
    }

    # --- Favicon / Static Files ---
    location = /favicon.ico {
        expires 30d;
        access_log off;
        log_not_found off;
    }

    location = /robots.txt {
        access_log off;
        log_not_found off;
    }

    # --- Block Suspicious Paths ---
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location ~* (wp-admin|wp-login|xmlrpc|\.php$) {
        return 444;
    }

    # --- Gzip Compression ---
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/x-javascript
        application/json
        application/xml
        application/xml+rss
        application/vnd.ms-fontobject
        application/x-font-ttf
        font/opentype
        image/svg+xml
        image/x-icon;

    # --- Custom Error Pages ---
    error_page 404 /index.html;
    error_page 502 503 504 /50x.html;
    location = /50x.html {
        root /var/www/projects-portal/shared;
        internal;
    }
}
```

### Enable the Site

```bash
# Create symlink
ln -sf /etc/nginx/sites-available/projects-portal /etc/nginx/sites-enabled/projects-portal

# Test config
nginx -t

# Reload (not restart — zero downtime)
systemctl reload nginx
```

### Custom 50x Error Page: `/var/www/projects-portal/shared/50x.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ASI 360 — Temporarily Unavailable</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #0f172a; color: #e2e8f0; }
    .box { text-align: center; max-width: 480px; padding: 2rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #94a3b8; line-height: 1.6; }
    a { color: #3b82f6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="box">
    <h1>ASI 360 Project Portal</h1>
    <p>The portal is temporarily unavailable. We are likely deploying an update. Please try again in a minute.</p>
    <p><a href="mailto:ops@asi360.co">ops@asi360.co</a> | (510) 288-0994</p>
  </div>
</body>
</html>
```

---

## 5.3 SSL/TLS

### Certificate Provisioning

The droplet already has certbot with auto-renewal via `certbot.timer` (systemd). The `api.asi360.co` cert proves the Let's Encrypt pipeline works.

```bash
# Step 1: Ensure DNS is resolving before running certbot
dig +short projects.asi360.co
# Must return 104.248.69.86

# Step 2: Obtain certificate
# The Nginx server block must be enabled (even the HTTP-only redirect block)
# so certbot's HTTP-01 challenge can reach port 80.
certbot --nginx -d projects.asi360.co \
  --non-interactive \
  --agree-tos \
  --email ops@asi360.co \
  --redirect

# Step 3: Verify
certbot certificates | grep -A5 "projects.asi360.co"
# Expected: Certificate Name: projects.asi360.co, VALID: 89 days

# Step 4: Test auto-renewal
certbot renew --dry-run
```

### Auto-Renewal Verification

Already active. Certbot systemd timer runs twice daily:

```bash
# Verify timer is active
systemctl is-active certbot.timer
# Expected: active

# Check next renewal time
systemctl list-timers certbot.timer
```

### SSL Testing

```bash
# Quick HTTPS check
curl -I https://projects.asi360.co

# SSL Labs grade (use web browser)
# https://www.ssllabs.com/ssltest/analyze.html?d=projects.asi360.co
# Target: A+ (HSTS preload header achieves this)

# OpenSSL check
openssl s_client -connect projects.asi360.co:443 -servername projects.asi360.co < /dev/null 2>/dev/null | openssl x509 -noout -dates -subject
```

### HSTS Preload

The Nginx config includes `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`. After confirming the site works on HTTPS, submit to the HSTS preload list:

```
https://hstspreload.org/?domain=projects.asi360.co
```

---

## 5.4 Deployment Pipeline

### Flow Overview

```
Developer workstation
  │
  ├─ git push origin feature/portal-auth
  │
  ├─ PR: feature/portal-auth → staging
  │     └─ GitHub Actions: lint + build + deploy to staging
  │
  ├─ QA verification on staging.projects.asi360.co
  │
  ├─ PR: staging → main
  │     └─ GitHub Actions: build + deploy to production
  │
  └─ Smoke test: curl https://projects.asi360.co → 200
```

### Deployment Script: `/var/www/projects-portal/deploy.sh`

```bash
#!/usr/bin/env bash
# =============================================================================
# ASI 360 Projects Portal — Zero-Downtime Deploy
# Usage: ./deploy.sh [staging|production]
# =============================================================================
set -euo pipefail

ENVIRONMENT="${1:-production}"
APP_DIR="/var/www/projects-portal"
REPO_DIR="/var/www/projects-portal/repo"
RELEASES_DIR="${APP_DIR}/releases"
SHARED_DIR="${APP_DIR}/shared"
KEEP_RELEASES=3

# Timestamp for release directory
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RELEASE_DIR="${RELEASES_DIR}/${TIMESTAMP}"

echo "=== ASI 360 Projects Portal Deploy ==="
echo "Environment: ${ENVIRONMENT}"
echo "Release: ${TIMESTAMP}"
echo ""

# --- Step 1: Pull latest code ---
echo "[1/6] Pulling latest code..."
cd "${REPO_DIR}"

if [ "${ENVIRONMENT}" = "staging" ]; then
    git fetch origin staging
    git checkout staging
    git reset --hard origin/staging
else
    git fetch origin main
    git checkout main
    git reset --hard origin/main
fi

echo "  Commit: $(git log --oneline -1)"

# --- Step 2: Install dependencies ---
echo "[2/6] Installing dependencies..."
npm ci --omit=dev 2>&1 | tail -1

# --- Step 3: Build ---
echo "[3/6] Building React app..."

# Copy env vars for build (Vite embeds VITE_* vars at build time)
cp "${SHARED_DIR}/.env" .env

npm run build 2>&1 | tail -3

if [ ! -d "dist" ]; then
    echo "ERROR: Build failed — dist/ directory not created"
    exit 1
fi

# --- Step 4: Create release ---
echo "[4/6] Creating release ${TIMESTAMP}..."
mkdir -p "${RELEASE_DIR}"
cp -r dist "${RELEASE_DIR}/"

# Write health check file
cat > "${RELEASE_DIR}/dist/health.json" <<EOF
{
  "status": "ok",
  "version": "$(git describe --tags --always 2>/dev/null || git rev-parse --short HEAD)",
  "commit": "$(git rev-parse --short HEAD)",
  "branch": "$(git rev-parse --abbrev-ref HEAD)",
  "built_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "${ENVIRONMENT}"
}
EOF

# --- Step 5: Atomic symlink swap ---
echo "[5/6] Swapping symlink (zero-downtime)..."
ln -sfn "${RELEASE_DIR}" "${APP_DIR}/current.new"
mv -Tf "${APP_DIR}/current.new" "${APP_DIR}/current"

echo "  Active: $(readlink ${APP_DIR}/current)"

# --- Step 6: Cleanup old releases ---
echo "[6/6] Cleaning up old releases (keeping ${KEEP_RELEASES})..."
cd "${RELEASES_DIR}"
ls -1dt */ | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf
echo "  Releases on disk: $(ls -1d */ | wc -l)"

echo ""
echo "=== Deploy Complete ==="
echo "URL: https://projects.asi360.co"
echo "Health: https://projects.asi360.co/health.json"

# --- Post-deploy verification ---
sleep 1
HTTP_CODE=$(curl -so /dev/null -w '%{http_code}' https://projects.asi360.co/health.json 2>/dev/null || echo "000")
if [ "${HTTP_CODE}" = "200" ]; then
    echo "Smoke test: PASS (HTTP ${HTTP_CODE})"
else
    echo "WARNING: Smoke test returned HTTP ${HTTP_CODE}"
    echo "  Check: curl -v https://projects.asi360.co/health.json"
fi
```

### Make Executable

```bash
chmod +x /var/www/projects-portal/deploy.sh
```

### Manual Deploy (Production)

```bash
ssh root@104.248.69.86 '/var/www/projects-portal/deploy.sh production'
```

### Rollback Procedure

```bash
#!/usr/bin/env bash
# rollback.sh — Switch to previous release
set -euo pipefail

APP_DIR="/var/www/projects-portal"
RELEASES_DIR="${APP_DIR}/releases"
CURRENT=$(readlink "${APP_DIR}/current")

echo "Current release: ${CURRENT}"

# Get the second-most-recent release
PREVIOUS=$(ls -1dt "${RELEASES_DIR}"/*/ | sed -n '2p')

if [ -z "${PREVIOUS}" ]; then
    echo "ERROR: No previous release found to roll back to"
    exit 1
fi

echo "Rolling back to: ${PREVIOUS}"
ln -sfn "${PREVIOUS}" "${APP_DIR}/current.new"
mv -Tf "${APP_DIR}/current.new" "${APP_DIR}/current"

echo "Rollback complete. Active: $(readlink ${APP_DIR}/current)"
echo "Verify: curl https://projects.asi360.co/health.json"
```

---

## 5.5 CI/CD (GitHub Actions)

### Workflow File: `.github/workflows/deploy.yml`

```yaml
name: Build & Deploy Projects Portal

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main, staging]

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: "20"
  DROPLET_HOST: "104.248.69.86"
  DROPLET_USER: "root"

jobs:
  # ─────────────────────────────────────────────────────
  # Job 1: Lint & Type Check
  # ─────────────────────────────────────────────────────
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck || true  # Non-blocking until types are stable

  # ─────────────────────────────────────────────────────
  # Job 2: Build
  # ─────────────────────────────────────────────────────
  build:
    name: Build
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - run: npm ci

      - name: Build React app
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
        run: npm run build

      - name: Write health.json
        run: |
          cat > dist/health.json <<EOF
          {
            "status": "ok",
            "version": "${{ github.sha }}",
            "commit": "${GITHUB_SHA::7}",
            "branch": "${{ github.ref_name }}",
            "built_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
            "environment": "${{ github.ref_name == 'main' && 'production' || 'staging' }}"
          }
          EOF

      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: portal-dist
          path: dist/
          retention-days: 7

  # ─────────────────────────────────────────────────────
  # Job 3: Deploy to Staging (on push to staging branch)
  # ─────────────────────────────────────────────────────
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/staging' && github.event_name == 'push'
    environment:
      name: staging
      url: https://staging.projects.asi360.co
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: portal-dist
          path: dist/

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ env.DROPLET_HOST }}
          username: ${{ env.DROPLET_USER }}
          key: ${{ secrets.DROPLET_SSH_KEY }}
          script: |
            TIMESTAMP=$(date +%Y%m%d-%H%M%S)
            RELEASE="/var/www/projects-portal-staging/releases/${TIMESTAMP}"
            mkdir -p "${RELEASE}/dist"

      - name: Copy dist to droplet
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ env.DROPLET_HOST }}
          username: ${{ env.DROPLET_USER }}
          key: ${{ secrets.DROPLET_SSH_KEY }}
          source: "dist/*"
          target: "/var/www/projects-portal-staging/releases/latest"
          strip_components: 0

      - name: Swap symlink
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ env.DROPLET_HOST }}
          username: ${{ env.DROPLET_USER }}
          key: ${{ secrets.DROPLET_SSH_KEY }}
          script: |
            APP="/var/www/projects-portal-staging"
            RELEASE=$(ls -1dt ${APP}/releases/*/ | head -1)
            ln -sfn "${RELEASE}" "${APP}/current.new"
            mv -Tf "${APP}/current.new" "${APP}/current"
            echo "Staging active: $(readlink ${APP}/current)"

      - name: Smoke test
        run: |
          sleep 3
          HTTP_CODE=$(curl -so /dev/null -w '%{http_code}' https://staging.projects.asi360.co/health.json || echo "000")
          if [ "${HTTP_CODE}" != "200" ]; then
            echo "::error::Staging smoke test failed (HTTP ${HTTP_CODE})"
            exit 1
          fi
          echo "Staging smoke test passed (HTTP ${HTTP_CODE})"

  # ─────────────────────────────────────────────────────
  # Job 4: Deploy to Production (on push to main branch)
  # ─────────────────────────────────────────────────────
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment:
      name: production
      url: https://projects.asi360.co
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: portal-dist
          path: dist/

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ env.DROPLET_HOST }}
          username: ${{ env.DROPLET_USER }}
          key: ${{ secrets.DROPLET_SSH_KEY }}
          script: /var/www/projects-portal/deploy.sh production

      - name: Smoke test
        run: |
          sleep 3
          HTTP_CODE=$(curl -so /dev/null -w '%{http_code}' https://projects.asi360.co/health.json || echo "000")
          if [ "${HTTP_CODE}" != "200" ]; then
            echo "::error::Production smoke test failed (HTTP ${HTTP_CODE})"
            exit 1
          fi
          echo "Production smoke test passed"
          echo "Version: $(curl -s https://projects.asi360.co/health.json | jq -r '.commit')"

      - name: Notify on success
        if: success()
        run: |
          # Telegram notification (optional — add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID secrets)
          if [ -n "${{ secrets.TELEGRAM_BOT_TOKEN }}" ]; then
            curl -s -X POST "https://api.telegram.org/bot${{ secrets.TELEGRAM_BOT_TOKEN }}/sendMessage" \
              -d "chat_id=${{ secrets.TELEGRAM_CHAT_ID }}" \
              -d "text=✅ Projects Portal deployed to production%0ACommit: ${GITHUB_SHA::7}%0ABy: ${{ github.actor }}%0AURL: https://projects.asi360.co" \
              -d "parse_mode=HTML"
          fi

      - name: Notify on failure
        if: failure()
        run: |
          if [ -n "${{ secrets.TELEGRAM_BOT_TOKEN }}" ]; then
            curl -s -X POST "https://api.telegram.org/bot${{ secrets.TELEGRAM_BOT_TOKEN }}/sendMessage" \
              -d "chat_id=${{ secrets.TELEGRAM_CHAT_ID }}" \
              -d "text=❌ Projects Portal deploy FAILED%0ACommit: ${GITHUB_SHA::7}%0ABy: ${{ github.actor }}%0ABranch: ${{ github.ref_name }}" \
              -d "parse_mode=HTML"
          fi

  # ─────────────────────────────────────────────────────
  # Job 5: PR Check (build verification only, no deploy)
  # ─────────────────────────────────────────────────────
  pr-check:
    name: PR Build Check
    runs-on: ubuntu-latest
    needs: lint
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - run: npm ci

      - name: Build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
        run: npm run build

      - name: Report build size
        run: |
          echo "### Build Output Size" >> $GITHUB_STEP_SUMMARY
          echo '```' >> $GITHUB_STEP_SUMMARY
          du -sh dist/ >> $GITHUB_STEP_SUMMARY
          du -sh dist/assets/* >> $GITHUB_STEP_SUMMARY
          echo '```' >> $GITHUB_STEP_SUMMARY
```

### Required GitHub Secrets

| Secret                   | Value                                           | Where to Set              |
|--------------------------|------------------------------------------------|---------------------------|
| `DROPLET_SSH_KEY`        | SSH private key for root@104.248.69.86          | Repo → Settings → Secrets |
| `VITE_SUPABASE_URL`      | `https://gtfffxwfgcxiiauliynd.supabase.co`     | Repo → Settings → Secrets |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key                        | Repo → Settings → Secrets |
| `TELEGRAM_BOT_TOKEN`     | (Optional) Telegram bot token for notifications | Repo → Settings → Secrets |
| `TELEGRAM_CHAT_ID`       | (Optional) Telegram chat ID for notifications   | Repo → Settings → Secrets |

### Branch Protection Rules

```
Repository → Settings → Branches → Add rule

Branch: main
  ☑ Require a pull request before merging
  ☑ Require approvals: 1
  ☑ Require status checks to pass: "Lint & Type Check", "Build"
  ☑ Require branches to be up to date before merging
  ☑ Do not allow bypassing the above settings

Branch: staging
  ☑ Require a pull request before merging
  ☑ Require status checks to pass: "Lint & Type Check", "Build"
```

---

## 5.6 Directory Structure on Droplet

### Production

```
/var/www/projects-portal/
├── current -> releases/20260310-143022   # Active release (symlink)
├── releases/
│   ├── 20260310-143022/
│   │   └── dist/                         # React build output
│   │       ├── index.html
│   │       ├── health.json               # Version + build metadata
│   │       ├── favicon.ico
│   │       └── assets/
│   │           ├── index-Bx7Kf9a2.js     # Hashed JS bundle
│   │           ├── index-dF3kL9m1.css    # Hashed CSS bundle
│   │           └── ...
│   ├── 20260309-091500/
│   │   └── dist/
│   └── 20260308-162000/
│       └── dist/
├── repo/                                  # Git clone of the project
│   ├── .git/
│   ├── src/
│   ├── package.json
│   └── ...
├── shared/
│   ├── .env                              # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
│   └── 50x.html                          # Custom error page
├── deploy.sh                             # Deploy script
└── rollback.sh                           # Rollback script
```

### Staging

```
/var/www/projects-portal-staging/
├── current -> releases/latest
├── releases/
│   └── latest/
│       └── dist/
└── shared/
    └── .env                              # Same structure, different Supabase branch/schema
```

### Initial Setup Commands

```bash
# Run on droplet as root
mkdir -p /var/www/projects-portal/{releases,shared}
mkdir -p /var/www/projects-portal-staging/{releases,shared}

# Clone the repo
git clone git@github.com:dondada876/projects-portal.git /var/www/projects-portal/repo

# Create shared .env for Vite build
cat > /var/www/projects-portal/shared/.env <<'EOF'
VITE_SUPABASE_URL=https://gtfffxwfgcxiiauliynd.supabase.co
VITE_SUPABASE_ANON_KEY=<your_anon_key_here>
EOF

# Create shared .env for staging (can use same Supabase or branch)
cp /var/www/projects-portal/shared/.env /var/www/projects-portal-staging/shared/.env

# Copy deploy and rollback scripts
# (created from section 5.4 above)

# Set permissions
chown -R root:root /var/www/projects-portal
chmod -R 755 /var/www/projects-portal
find /var/www/projects-portal -type f -exec chmod 644 {} \;
chmod +x /var/www/projects-portal/deploy.sh
chmod +x /var/www/projects-portal/rollback.sh
```

---

## 5.7 Monitoring & Health Checks

### Health Check Endpoint

The `health.json` file is generated during each deploy and served statically:

```json
{
  "status": "ok",
  "version": "v1.2.3",
  "commit": "a1b2c3d",
  "branch": "main",
  "built_at": "2026-03-10T14:30:22Z",
  "environment": "production"
}
```

**Check URL:** `GET https://projects.asi360.co/health.json`

### External Uptime Monitoring

#### Option A: Cron-based (Free, on Droplet)

```bash
# /usr/local/bin/check-portal-health.sh
#!/usr/bin/env bash
URL="https://projects.asi360.co/health.json"
HTTP_CODE=$(curl -so /dev/null -w '%{http_code}' --max-time 10 "${URL}" 2>/dev/null)

if [ "${HTTP_CODE}" != "200" ]; then
    # Send Telegram alert
    TOKEN="$(cat /root/.telegram_bot_token 2>/dev/null)"
    CHAT="$(cat /root/.telegram_chat_id 2>/dev/null)"
    if [ -n "${TOKEN}" ] && [ -n "${CHAT}" ]; then
        curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
            -d "chat_id=${CHAT}" \
            -d "text=⚠️ Projects Portal DOWN — HTTP ${HTTP_CODE} at $(date -u +%H:%M:%S) UTC"
    fi
fi
```

```bash
# Crontab entry: check every 5 minutes
chmod +x /usr/local/bin/check-portal-health.sh
echo "*/5 * * * * root /usr/local/bin/check-portal-health.sh" > /etc/cron.d/portal-health
```

#### Option B: External Service (Recommended for Production)

- **UptimeRobot** (free tier): 5-minute checks, email + Telegram webhook on downtime
- **Better Stack** (free tier): 3-minute checks, incident management
- Configure check: `GET https://projects.asi360.co/health.json` → expect HTTP 200 + JSON body contains `"status":"ok"`

### Nginx Log Analysis

```bash
# Top 20 URLs by request count (last 24h)
awk '{print $7}' /var/log/nginx/projects-portal.access.log | sort | uniq -c | sort -rn | head -20

# Error rate (4xx + 5xx)
awk '$9 ~ /^[45]/' /var/log/nginx/projects-portal.access.log | wc -l

# Response time distribution (if using $request_time in log format)
# Add to Nginx: log_format timed '$remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent" $request_time';

# Top IPs hitting the portal
awk '{print $1}' /var/log/nginx/projects-portal.access.log | sort | uniq -c | sort -rn | head -10
```

### Log Rotation

```bash
# /etc/logrotate.d/projects-portal
/var/log/nginx/projects-portal.access.log
/var/log/nginx/projects-portal.error.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ ! -f /var/run/nginx.pid ] || kill -USR1 `cat /var/run/nginx.pid`
    endscript
}
```

### Prometheus Metrics (Optional Extension)

If `500gl-exporter` can be extended, add a probe for the portal:

```yaml
# prometheus scrape config addition
- job_name: 'projects-portal'
  metrics_path: /probe
  params:
    module: [http_2xx]
    target: ['https://projects.asi360.co/health.json']
  static_configs:
    - targets: ['localhost:9115']  # blackbox_exporter
  relabel_configs:
    - source_labels: [__param_target]
      target_label: instance
```

### Grafana Dashboard Panels (if Grafana is deployed)

1. **Uptime:** `probe_success{instance="projects.asi360.co"}` — up/down indicator
2. **Response Time:** `probe_duration_seconds{instance="projects.asi360.co"}` — line chart
3. **SSL Expiry:** `probe_ssl_earliest_cert_expiry - time()` — countdown gauge
4. **Request Rate:** Parse Nginx access log with `mtail` or `grok_exporter`

---

## 5.8 Security Hardening

### Nginx Hardening (included in server block above)

| Control                    | Implementation                                                  |
|----------------------------|-----------------------------------------------------------------|
| Server tokens              | `server_tokens off;`                                            |
| Request body limit         | `client_max_body_size 1m;` (no uploads needed)                 |
| Dotfile blocking           | `location ~ /\. { deny all; }`                                 |
| PHP/WP blocking            | `location ~* (wp-admin|wp-login|xmlrpc|\.php$) { return 444; }` |
| X-Frame-Options            | `SAMEORIGIN`                                                    |
| X-Content-Type-Options     | `nosniff`                                                       |
| XSS Protection             | `1; mode=block`                                                 |
| Referrer Policy            | `strict-origin-when-cross-origin`                               |
| Permissions Policy         | Camera, mic, geolocation disabled                               |
| HSTS                       | `max-age=31536000; includeSubDomains; preload`                  |
| CSP                        | Self + Supabase domain only (see Nginx block)                   |
| Rate Limiting              | 100 req/min per IP, burst 20                                    |

### Content Security Policy Breakdown

```
default-src 'self';
script-src 'self' 'unsafe-inline';          # Vite may inline small scripts
style-src 'self' 'unsafe-inline'            # Tailwind/CSS-in-JS
    https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: https:;               # Allow external images (logos, avatars)
connect-src 'self'
    https://gtfffxwfgcxiiauliynd.supabase.co   # Supabase REST API
    https://*.supabase.co                       # Supabase Auth, Storage
    wss://*.supabase.co;                        # Supabase Realtime
frame-ancestors 'self';                     # Prevent clickjacking
```

> **Note:** If Supabase Edge Functions are on a different subdomain, add it to `connect-src`. The CSP can be tightened once the app is running and the browser console shows no CSP violations.

### CORS on Supabase Edge Functions

Edge Functions should only accept requests from the portal origin:

```typescript
// In each Edge Function
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://projects.asi360.co',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Handle preflight
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}
```

### Fail2ban Rule for Repeated 401s

```ini
# /etc/fail2ban/filter.d/nginx-portal-401.conf
[Definition]
failregex = ^<HOST> .* "(GET|POST|PUT|DELETE) .* HTTP/.*" 401
ignoreregex =

# /etc/fail2ban/jail.d/nginx-portal.conf
[nginx-portal-401]
enabled = true
port = http,https
filter = nginx-portal-401
logpath = /var/log/nginx/projects-portal.access.log
maxretry = 10
findtime = 300
bantime = 3600
action = iptables-multiport[name=portal, port="80,443"]
```

```bash
# Enable fail2ban
systemctl enable fail2ban
systemctl restart fail2ban

# Check status
fail2ban-client status nginx-portal-401
```

### File Permissions

```bash
# Set correct ownership and permissions
chown -R root:root /var/www/projects-portal
find /var/www/projects-portal -type d -exec chmod 755 {} \;
find /var/www/projects-portal -type f -exec chmod 644 {} \;
chmod +x /var/www/projects-portal/deploy.sh
chmod +x /var/www/projects-portal/rollback.sh
chmod 600 /var/www/projects-portal/shared/.env
```

---

## 5.9 Performance Optimization

### Nginx Performance Tuning

Already in the main `nginx.conf` (verify these exist):

```nginx
# /etc/nginx/nginx.conf — performance section
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 2048;
    multi_accept on;
    use epoll;
}

http {
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip (also per-server block, but global defaults help)
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;
}
```

### Cache-Control Strategy

| Path          | Header                                        | Rationale                                    |
|---------------|-----------------------------------------------|----------------------------------------------|
| `/index.html` | `no-cache, no-store, must-revalidate`         | Always fetch latest SPA shell                |
| `/assets/*`   | `public, immutable, max-age=31536000` (1 year) | Vite content-hashes filenames — safe forever |
| `/health.json`| `no-cache`                                    | Always return current version info           |
| `/favicon.ico`| `max-age=2592000` (30 days)                   | Rarely changes                               |

### Brotli Compression (Optional Upgrade)

Nginx 1.28.0 on the droplet does NOT include the brotli module by default. If needed later:

```bash
# Check if brotli module exists
nginx -V 2>&1 | grep -i brotli
# If not found, install:
apt install libnginx-mod-brotli

# Then add to nginx.conf http block:
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
```

> **Cost/benefit:** Brotli gives ~15-25% better compression than gzip for text assets. For a small SPA, the difference is negligible. Implement only if bundle size exceeds 500KB gzipped.

### Vite Build Optimization

In `vite.config.ts`:

```typescript
export default defineConfig({
  build: {
    // Split vendor chunk for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
    // Compress large chunks warning threshold
    chunkSizeWarningLimit: 500,
    // Enable source maps for debugging (won't be served by Nginx)
    sourcemap: true,
  },
});
```

### CDN Consideration (Cloudflare Free Tier)

If traffic warrants it, add Cloudflare as a CDN layer:

1. Point DNS through Cloudflare (change nameservers)
2. Set SSL mode to "Full (strict)" (since we have Let's Encrypt)
3. Page rules:
   - `projects.asi360.co/assets/*` → Cache Level: Cache Everything, Edge TTL: 1 month
   - `projects.asi360.co/` → Cache Level: Standard (respects Cache-Control headers)

> **Current recommendation:** Skip CDN. The droplet is in a US datacenter, the user base is Bay Area B2B. Nginx serves static files extremely fast. Add Cloudflare only if there's a need for DDoS protection or global distribution.

---

## 5.10 Backup & Disaster Recovery

### What Needs Backup

| Asset                  | Backup Location               | Backup Method                    |
|------------------------|-------------------------------|----------------------------------|
| Source code             | GitHub (git repo)             | Git push — already handled       |
| Nginx config            | Git repo + droplet            | Keep in repo under `infra/`     |
| Deploy script           | Git repo                      | Keep in repo under `infra/`     |
| `.env` (build vars)     | Supabase Vault                | Values stored as vault secrets   |
| Database                | Supabase PITR                 | Automatic — managed by Supabase  |
| SSL certificates        | Certbot auto-renewal          | Re-issue from Let's Encrypt     |
| Build artifacts         | GitHub Actions artifacts      | 7-day retention                  |

### Recovery Procedure: Full Rebuild from Scratch

If the droplet is destroyed or replaced:

```bash
# Estimated recovery time: 15–30 minutes

# 1. Provision new droplet (Ubuntu 24.04, 2GB+ RAM)
# 2. Install prerequisites
apt update && apt install -y nginx certbot python3-certbot-nginx nodejs npm git fail2ban

# 3. Clone repo
mkdir -p /var/www/projects-portal/{releases,shared}
git clone git@github.com:dondada876/projects-portal.git /var/www/projects-portal/repo

# 4. Restore .env from Vault
# Manually create shared/.env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
# (these are public keys, safe to paste)

# 5. Copy Nginx config
cp /var/www/projects-portal/repo/infra/nginx/projects-portal /etc/nginx/sites-available/
ln -sf /etc/nginx/sites-available/projects-portal /etc/nginx/sites-enabled/

# 6. Get SSL cert
certbot --nginx -d projects.asi360.co --non-interactive --agree-tos --email ops@asi360.co

# 7. Deploy
cd /var/www/projects-portal && ./deploy.sh production

# 8. Verify
curl https://projects.asi360.co/health.json
```

### Recovery Time Objectives

| Scenario                        | RTO          | RPO          |
|---------------------------------|-------------|-------------|
| Bad deploy (rollback)           | < 1 minute  | 0 (previous release intact) |
| Nginx config error              | < 5 minutes | 0 (git restore) |
| Droplet reboot                  | < 2 minutes | 0 (static files persist) |
| Droplet destroyed               | < 30 minutes | 0 (code in GitHub, data in Supabase) |
| Supabase outage                 | N/A (external) | Supabase PITR |

---

## 5.11 Scaling Considerations

### Current Capacity Assessment

| Resource    | Available | Portal Usage (Est.)        | Headroom      |
|-------------|-----------|----------------------------|---------------|
| CPU         | 2 vCPU    | ~0% (static files)         | Massive       |
| RAM         | 8 GB      | ~50MB (Nginx worker)       | Sufficient    |
| Disk        | 155 GB    | ~50MB (3 releases)         | Massive       |
| Bandwidth   | 1 Gbps    | ~10 KB/request (SPA)       | Massive       |
| Connections | 2048      | ~10 concurrent (B2B)       | Massive       |

### When to Scale

The projects portal is a B2B internal tool for ASI 360 clients and staff. Expected concurrent users: 5-20. The single droplet handles this easily alongside all other services.

**Scale triggers (unlikely but planned for):**

| Trigger                          | Threshold         | Action                          |
|----------------------------------|-------------------|---------------------------------|
| Sustained CPU > 80%              | 24h average       | Upgrade droplet (4 vCPU)        |
| RAM usage > 90%                  | Consistent        | Upgrade droplet (16 GB)         |
| Concurrent users > 500           | Daily peaks       | Move static hosting to Vercel   |
| Global user distribution         | Non-US users > 30%| Add Cloudflare CDN              |

### Horizontal Scaling Path (Future, If Needed)

1. **Static hosting migration:** Move React app to Vercel/Netlify (free tier handles most loads). Only requires changing DNS.
2. **API scaling:** Supabase Edge Functions auto-scale. No action needed.
3. **Database scaling:** Supabase compute add-ons if query volume increases.

### Vertical Scaling (Simpler)

```bash
# DigitalOcean droplet resize (requires brief downtime)
# Current: s-2vcpu-8gb ($56/mo)
# Next tier: s-4vcpu-16gb ($96/mo)
# Resize via DO dashboard → Droplet → Resize → CPU and RAM
```

---

## 5.12 Staging Environment

### Recommended: Option A — Separate Subdomain (staging.projects.asi360.co)

This provides the closest approximation to production and allows QA without touching the live site.

#### DNS Record

| Type | Host                       | Value            | TTL  |
|------|----------------------------|------------------|------|
| A    | staging.projects.asi360.co | 104.248.69.86    | 300  |

#### Nginx Server Block: `/etc/nginx/sites-available/projects-portal-staging`

```nginx
server {
    listen 80;
    server_name staging.projects.asi360.co;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name staging.projects.asi360.co;

    ssl_certificate /etc/letsencrypt/live/staging.projects.asi360.co/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/staging.projects.asi360.co/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/projects-portal-staging/current/dist;
    index index.html;

    # Basic auth — staging is not public
    auth_basic "ASI 360 Staging";
    auth_basic_user_file /etc/nginx/.htpasswd-staging;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    gzip on;
    gzip_types application/javascript text/css application/json;
    gzip_min_length 256;

    access_log /var/log/nginx/projects-portal-staging.access.log;
    error_log /var/log/nginx/projects-portal-staging.error.log warn;
}
```

#### Staging Setup Commands

```bash
# Create staging htpasswd
htpasswd -cb /etc/nginx/.htpasswd-staging staging ASI360staging!

# Enable staging site
ln -sf /etc/nginx/sites-available/projects-portal-staging /etc/nginx/sites-enabled/

# Get SSL cert for staging subdomain
certbot --nginx -d staging.projects.asi360.co --non-interactive --agree-tos --email ops@asi360.co

# Reload Nginx
nginx -t && systemctl reload nginx
```

#### Staging Database Strategy

**Option 1 (Simple):** Use the same Supabase project (`gtfffxwfgcxiiauliynd`) with a separate schema or RLS policy that scopes staging data by an `environment` column.

**Option 2 (Isolated):** Use Supabase branching (if on Pro plan) to create a `develop` branch for staging. The branch gets its own URL and anon key — set these in `/var/www/projects-portal-staging/shared/.env`.

**Option 3 (Minimal):** Use the same Supabase project and same data. Staging tests only UI/UX changes, not data changes. This is acceptable for a small B2B tool where the data model is stable.

**Recommended:** Option 3 for initial launch, move to Option 2 when the data model is changing frequently.

### Feature Flags (Optional)

For testing new features without deploying separately:

```typescript
// src/lib/features.ts
export const features = {
  newDashboard: import.meta.env.VITE_FF_NEW_DASHBOARD === 'true',
  pdfExport: import.meta.env.VITE_FF_PDF_EXPORT === 'true',
};

// Usage in components:
if (features.newDashboard) {
  return <NewDashboard />;
}
```

Set feature flags in the staging `.env`:

```bash
# /var/www/projects-portal-staging/shared/.env
VITE_SUPABASE_URL=https://gtfffxwfgcxiiauliynd.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
VITE_FF_NEW_DASHBOARD=true
VITE_FF_PDF_EXPORT=true
```

---

## 5.13 Complete Setup Checklist

Run these steps in order to go from zero to deployed.

### Pre-Deployment (One-Time)

```bash
# 1. DNS
# Add A record: projects.asi360.co → 104.248.69.86
# Add A record: staging.projects.asi360.co → 104.248.69.86
# Wait for propagation (dig +short projects.asi360.co)

# 2. Droplet directory structure
ssh root@104.248.69.86 << 'SETUP'
  # Production
  mkdir -p /var/www/projects-portal/{releases,shared}
  mkdir -p /var/www/projects-portal-staging/{releases,shared}

  # Clone repo (replace with actual repo name)
  git clone git@github.com:dondada876/projects-portal.git /var/www/projects-portal/repo

  # Create build .env
  cat > /var/www/projects-portal/shared/.env << 'ENV'
VITE_SUPABASE_URL=https://gtfffxwfgcxiiauliynd.supabase.co
VITE_SUPABASE_ANON_KEY=<YOUR_ANON_KEY>
ENV

  cp /var/www/projects-portal/shared/.env /var/www/projects-portal-staging/shared/.env

  # Create custom error page
  mkdir -p /var/www/projects-portal/shared
  # (paste 50x.html from section 5.2)

  # Set permissions
  chmod 600 /var/www/projects-portal/shared/.env
  chmod 600 /var/www/projects-portal-staging/shared/.env
SETUP

# 3. Nginx configs
# Copy server blocks from sections 5.2 and 5.12 to:
#   /etc/nginx/sites-available/projects-portal
#   /etc/nginx/sites-available/projects-portal-staging

# 4. Enable sites (without SSL lines initially)
ssh root@104.248.69.86 << 'NGINX'
  ln -sf /etc/nginx/sites-available/projects-portal /etc/nginx/sites-enabled/
  ln -sf /etc/nginx/sites-available/projects-portal-staging /etc/nginx/sites-enabled/
  nginx -t && systemctl reload nginx
NGINX

# 5. SSL certificates
ssh root@104.248.69.86 << 'SSL'
  certbot --nginx -d projects.asi360.co --non-interactive --agree-tos --email ops@asi360.co --redirect
  certbot --nginx -d staging.projects.asi360.co --non-interactive --agree-tos --email ops@asi360.co --redirect
  certbot renew --dry-run
SSL

# 6. Staging basic auth
ssh root@104.248.69.86 << 'AUTH'
  htpasswd -cb /etc/nginx/.htpasswd-staging staging ASI360staging!
  nginx -t && systemctl reload nginx
AUTH

# 7. Deploy scripts
# Copy deploy.sh and rollback.sh from section 5.4 to /var/www/projects-portal/
# chmod +x both

# 8. First deploy
ssh root@104.248.69.86 '/var/www/projects-portal/deploy.sh production'

# 9. Fail2ban
# Copy filter and jail configs from section 5.8
ssh root@104.248.69.86 'systemctl restart fail2ban'

# 10. Log rotation
# Copy logrotate config from section 5.7

# 11. Health check cron
# Copy check script from section 5.7
# Add cron entry

# 12. GitHub Actions
# Add secrets: DROPLET_SSH_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
# Copy workflow file from section 5.5 to .github/workflows/deploy.yml
# Set branch protection rules

# 13. Verify
curl -I https://projects.asi360.co
curl https://projects.asi360.co/health.json
```

### Post-Deployment Verification

```bash
# HTTPS working
curl -I https://projects.asi360.co
# Expected: HTTP/2 200, security headers present

# Health check
curl -s https://projects.asi360.co/health.json | jq .
# Expected: {"status":"ok","version":"...","commit":"..."}

# SPA routing works
curl -s -o /dev/null -w '%{http_code}' https://projects.asi360.co/projects/123
# Expected: 200 (falls through to index.html)

# SSL grade
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=projects.asi360.co
# Expected: A+

# Staging works
curl -u staging:ASI360staging! https://staging.projects.asi360.co/health.json
# Expected: 200

# Fail2ban active
ssh root@104.248.69.86 'fail2ban-client status'
# Expected: nginx-portal-401 jail listed

# Certbot auto-renewal
ssh root@104.248.69.86 'systemctl list-timers certbot.timer'
# Expected: timer active, next trigger shown
```

---

## 5.14 Runbook Quick Reference

| Task                          | Command                                                                    |
|-------------------------------|----------------------------------------------------------------------------|
| Deploy production             | `ssh root@104.248.69.86 '/var/www/projects-portal/deploy.sh production'`   |
| Deploy staging                | `ssh root@104.248.69.86 '/var/www/projects-portal/deploy.sh staging'`      |
| Rollback production           | `ssh root@104.248.69.86 '/var/www/projects-portal/rollback.sh'`            |
| Check current version         | `curl -s https://projects.asi360.co/health.json \| jq .commit`            |
| View Nginx errors             | `ssh root@104.248.69.86 'tail -50 /var/log/nginx/projects-portal.error.log'` |
| View access logs              | `ssh root@104.248.69.86 'tail -50 /var/log/nginx/projects-portal.access.log'` |
| Reload Nginx                  | `ssh root@104.248.69.86 'nginx -t && systemctl reload nginx'`              |
| Renew SSL (manual)            | `ssh root@104.248.69.86 'certbot renew'`                                   |
| Check disk usage              | `ssh root@104.248.69.86 'df -h / && du -sh /var/www/projects-portal/releases/*'` |
| Check fail2ban bans           | `ssh root@104.248.69.86 'fail2ban-client status nginx-portal-401'`         |
| Unban IP                      | `ssh root@104.248.69.86 'fail2ban-client set nginx-portal-401 unbanip <IP>'` |
| List releases                 | `ssh root@104.248.69.86 'ls -lt /var/www/projects-portal/releases/'`       |
| Current symlink target        | `ssh root@104.248.69.86 'readlink /var/www/projects-portal/current'`       |
