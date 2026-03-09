# SiteGround WebDev Operations Manual

> **Version:** 1.0 | **Created:** 2026-03-09 | **Trigger:** TT909 shop.asi360.co mixed content failure
>
> Comprehensive knowledge base for preventing, diagnosing, and resolving all SiteGround hosting failures across ASI 360 and 500 Grand Live properties.

---

## Table of Contents

1. [Overview & Purpose](#1-overview--purpose)
2. [SiteGround Plan Quick Reference](#2-siteground-plan-quick-reference)
3. [Site Tools Inventory](#3-site-tools-inventory)
4. [Pre-Flight Checklist — New WordPress Installs](#4-pre-flight-checklist--new-wordpress-installs)
5. [Known Failure Points (SG-001 → SG-012)](#5-known-failure-points)
6. [Emergency Procedures](#6-emergency-procedures)
7. [SiteGround Support Playbook](#7-siteground-support-playbook)
8. [Porto Theme Integration Notes](#8-porto-theme-integration-notes)
9. [Astra/Spectra Integration Notes](#9-astraspectra-integration-notes)
10. [CDN & Caching Operations](#10-cdn--caching-operations)
11. [PHP Configuration Management](#11-php-configuration-management)
12. [SSL & HTTPS Management](#12-ssl--https-management)
13. [FTP/SSH Access Reference](#13-ftpssh-access-reference)
14. [Staging Environment Operations](#14-staging-environment-operations)
15. [FAQ](#15-faq)
16. [Cross-Reference Index](#16-cross-reference-index)

---

## 1. Overview & Purpose

This document is the **tactical runbook** for all SiteGround hosting operations. It complements:

- [HYBRID_SITEGROUND_ARCHITECTURE.md](../docs/architecture/HYBRID_SITEGROUND_ARCHITECTURE.md) — Strategic architecture (3-cloud stack, cost model, deployment pipeline)
- [astra-spectra-reference.md](astra-spectra-reference.md) — Section 11: Spectra/Astra troubleshooting on SiteGround
- [bugs-and-lessons.md](bugs-and-lessons.md) — BUG/WIN/SOP entries for SiteGround-specific issues
- [webdev-product-inventory.md](webdev-product-inventory.md) — Licensed themes/plugins and target site allocation
- [Site Factory config.py](../../site-factory/config.py) — FTP/SSH credentials, site targets, server paths

**Scope:** Every SiteGround-hosted WordPress property under 500 Grand Live LLC / ASI 360.

**Failure Code Convention:** `SG-XXX` (matches BUG/WIN/SOP pattern from bugs-and-lessons.md).

---

## 2. SiteGround Plan Quick Reference

| Feature | GrowBig ($14.99/mo) | GoGeek ($24.99/mo) |
|---------|---------------------|--------------------|
| Websites | Unlimited | Unlimited |
| Storage | 20 GB SSD | 40 GB SSD |
| Monthly Visits | ~100,000 | ~400,000 |
| Backups | Daily (30 days) | Daily (30 days) + on-demand |
| Staging | ✅ 1 copy | ✅ 1 copy |
| SSH Access | ✅ | ✅ |
| FTP/SFTP | ✅ | ✅ |
| Free CDN | ✅ (Cloudflare) | ✅ (Cloudflare) |
| PHP Workers | 30 | 60 |
| Git Integration | ❌ | ✅ |
| White-Label Access | ❌ | ✅ |
| Priority Support | ❌ | ✅ |
| Server Location | US (Iowa) | US (Iowa) |

**Current Plan:** GrowBig — sufficient for development + 5 properties. Upgrade to GoGeek when traffic exceeds 100K/mo or Git integration needed.

---

## 3. Site Tools Inventory

SiteGround's control panel (`my.siteground.com → Site Tools`) contains 15 critical tools:

| # | Tool | Path in Site Tools | Purpose | Gotchas |
|---|------|--------------------|---------|---------|
| 1 | **WordPress Install** | Site → WordPress → Install & Manage | Fresh WP installs | ⚠️ Always select HTTPS protocol — see SG-001 |
| 2 | **Search & Replace** | Site → WordPress → Search & Replace | Database-wide string replacement | ✅ The tool that fixed TT909. Replaces across ALL tables. |
| 3 | **Staging** | Site → WordPress → Staging | Create staging copies | ⚠️ URLs hardcoded to staging subdomain — see SG-009 |
| 4 | **PHP Manager** | Site → DevTools → PHP Manager | PHP version + settings | ⚠️ max_execution_time LOCKED at 120s — see SG-002 |
| 5 | **SSL Manager** | Security → SSL Manager | Let's Encrypt certificates | Auto-provisions for new subdomains within 24h |
| 6 | **HTTPS Enforce** | Security → HTTPS Enforce | Force HTTPS redirects | ✅ Enable IMMEDIATELY after WP install |
| 7 | **CDN** | Speed → CDN | Cloudflare CDN toggle | ⚠️ Aggressive caching — see SG-003 |
| 8 | **Caching** | Speed → Caching | SG dynamic + static cache | 3-layer model — see Section 10 |
| 9 | **FTP Accounts** | Site → FTP Accounts | FTP user management | Port 21 for FTP, 18765 for SFTP |
| 10 | **SSH Access** | Site → DevTools → SSH Keys | SSH key management | Port 18765, non-standard — see SG-005 |
| 11 | **File Manager** | Site → File Manager | Web-based file browser | Limited — use FTP for bulk operations |
| 12 | **MySQL** | Site → MySQL | Database management | phpMyAdmin access + remote DB access toggle |
| 13 | **DNS Zone Editor** | Domain → DNS Zone Editor | DNS record management | A records, CNAME, MX — managed by SiteGround nameservers |
| 14 | **Subdomains** | Domain → Subdomains | Create subdomains | Each subdomain gets its own `public_html` directory |
| 15 | **Backups** | Security → Backups | Restore from daily backups | 30-day retention, full-site restore only (no per-file) |

---

## 4. Pre-Flight Checklist — New WordPress Installs

Run this 5-phase, 32-item checklist for EVERY new WordPress installation. Skipping items caused TT909.

### Phase A: Domain & Infrastructure (Before WordPress)

- [ ] A1. Subdomain created in Site Tools → Domain → Subdomains (if not root domain)
- [ ] A2. DNS propagation confirmed (`dig +short subdomain.asi360.co` returns SiteGround IP)
- [ ] A3. SSL certificate provisioned in Site Tools → Security → SSL Manager
- [ ] A4. Wait 10-15 min for Let's Encrypt auto-provision on new subdomains
- [ ] A5. HTTPS Enforce ENABLED in Site Tools → Security → HTTPS Enforce
- [ ] A6. Verify `https://` loads (even if just SiteGround placeholder page)

### Phase B: WordPress Installation

- [ ] B1. Site Tools → WordPress → Install & Manage → Install
- [ ] B2. **CRITICAL:** Select `https://` protocol (NOT `http://`) — prevents SG-001
- [ ] B3. Select correct installation path (root vs subdirectory)
- [ ] B4. Set admin username: `webdevteam`
- [ ] B5. Generate strong admin password (save to Vault)
- [ ] B6. Set admin email: `ops@asi360.co`
- [ ] B7. Confirm language: English (US)
- [ ] B8. Wait for installation to complete (1-2 min)

### Phase C: Post-Install Verification

- [ ] C1. Visit `https://site.com/` — confirm it loads over HTTPS with no mixed content warnings
- [ ] C2. Visit `https://site.com/wp-admin/` — confirm login works
- [ ] C3. Check Settings → General: both WordPress Address AND Site Address use `https://`
- [ ] C4. If either shows `http://`, **STOP** — run SG-001 fix before proceeding
- [ ] C5. Generate Application Password: Users → webdevteam → Application Passwords
- [ ] C6. Save Application Password to config.py AND Supabase Vault
- [ ] C7. Test REST API: `curl -s -u "webdevteam:APP_PASS" "https://site.com/wp-json/wp/v2/pages" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))"`

### Phase D: Security & Performance Baseline

- [ ] D1. Delete default plugins (Hello Dolby, Akismet) unless needed
- [ ] D2. Delete default themes (Twenty Twenty-*) except one fallback
- [ ] D3. Set permalink structure: Settings → Permalinks → Post name (`/%postname%/`)
- [ ] D4. Disable XML-RPC if not needed (security hardening)
- [ ] D5. Verify SG Optimizer plugin is active (auto-installed by SiteGround)
- [ ] D6. Configure SG Optimizer: Environment → HTTPS enforce ON

### Phase E: Theme & Plugin Installation

- [ ] E1. Install theme BEFORE importing demo content
- [ ] E2. For Porto: Run Setup Wizard completely (all 6 steps) — see Section 8
- [ ] E3. For Astra: Follow dependency order from config.py `PLUGIN_STACK`
- [ ] E4. Verify all bundled/required plugins are installed and active
- [ ] E5. Import demo/starter template content
- [ ] E6. Verify frontend renders correctly over HTTPS (no console errors)
- [ ] E7. Update config.py with new site credentials
- [ ] E8. Push config changes to feature branch

---

## 5. Known Failure Points

### SG-001 — HTTP/HTTPS Mixed Content (CSS Not Loading)

**Severity:** 🔴 Critical
**First Occurrence:** 2026-03-09, shop.asi360.co TT909
**Resolved By:** SiteGround agent Preslav Peev, Ticket #5028674

**Symptom:**
- Site loads but appears completely broken — no CSS, no images, no JS
- Browser console shows: `Mixed Content: The page was loaded over HTTPS but requested an insecure resource`
- Theme demo content imported but layout looks destroyed

**Root Cause:**
WordPress installed with `http://` as Site URL. All content (theme demos, media URLs, stylesheet references) stored as `http://`. Browser blocks HTTP resources on HTTPS page per Mixed Content Security Policy.

**Chain of failure:**
```
WP Install (http://) → Demo Import (all URLs stored as http://)
→ Browser loads https://shop.asi360.co
→ CSS/JS/images requested as http://shop.asi360.co/...
→ Browser BLOCKS all http:// resources
→ Site appears broken (no styles applied)
```

**Fix:**
```
Site Tools → WordPress → Search & Replace
  Search:  http://shop.asi360.co
  Replace: https://shop.asi360.co
  ✅ Check all tables
  → Execute
```

**Prevention:**
1. Pre-Flight Checklist Phase A: Enable HTTPS Enforce BEFORE installing WordPress
2. Pre-Flight Checklist Phase B: ALWAYS select `https://` protocol during WP install
3. Pre-Flight Checklist Phase C: Verify both Site URL and WordPress URL show `https://`

**SG Support Template:**
```
Subject: Mixed Content — HTTP/HTTPS URL Mismatch After WordPress Install
Site: [site URL]
Issue: WordPress was installed with http:// protocol. All content URLs stored as http://
causing mixed content blocking on HTTPS page. CSS, JS, and images fail to load.
Request: Please run Search & Replace in Site Tools:
  Search: http://[domain]
  Replace: https://[domain]
  Check all tables.
```

---

### SG-002 — PHP max_execution_time Hard Cap (120s)

**Severity:** 🔴 Critical

**Symptom:**
- Theme demo imports fail partway through (partial content, missing pages)
- Plugin installations timeout
- Large REST API operations return 504/502 errors
- `Fatal error: Maximum execution time of 120 seconds exceeded`

**Root Cause:**
SiteGround enforces a **server-level** max_execution_time of 120 seconds. This CANNOT be overridden via:
- `php.ini` (ignored)
- `.htaccess` `php_value` directives (ignored)
- `set_time_limit()` in PHP code (ignored)
- WordPress `WP_MAX_EXECUTION_TIME` (ignored)

The cap is at the web server process level, not PHP configuration.

**Fix:**
1. For demo imports: Use "Alternative Mode" (splits import into smaller chunks)
2. For plugin installs: Install via FTP upload + wp-admin activation (no timeout on FTP)
3. For REST API: Break large operations into batches of 10-20 items
4. For migrations: Use WP-CLI via SSH (SSH sessions have 3600s timeout)

**Prevention:**
- Never rely on extending execution time on SiteGround
- Design all automation scripts with chunked processing (batch size ≤ 50)
- Use Porto's Alternative Import Mode for demo content
- Upload large plugins via FTP, not wp-admin upload

**SG Support Template:**
```
Subject: PHP Execution Timeout During [Theme/Plugin] Import
Site: [site URL]
Issue: [Theme name] demo import fails at ~120 seconds. Partial content imported.
Already tried: Alternative import mode, FTP plugin upload.
Request: Can you temporarily increase max_execution_time for this site to complete
the import? Or can the import be run server-side?
Note: We understand this is a shared hosting limitation. We can schedule for off-peak.
```

---

### SG-003 — CDN Cache Staleness After Content Updates

**Severity:** 🟡 Major

**Symptom:**
- Content changes (REST API or wp-admin) don't appear on the live site
- Old version of pages persist for minutes to hours
- `?nocache=timestamp` shows updated content, but normal URL shows old content
- Different visitors see different page versions

**Root Cause:**
SiteGround uses a 3-layer caching architecture (see Section 10). All 3 layers must be purged for changes to appear.

**Fix:**
```bash
# Quick validation — bypass all caches
curl -s "https://site.com/page/?nocache=$(date +%s)" | grep "expected content"

# Purge SG Dynamic Cache
# Site Tools → Speed → Caching → Dynamic Cache → Flush

# Purge CDN Cache
# Site Tools → Speed → CDN → Purge Cache

# Or programmatically via SG Optimizer plugin:
curl -X POST "https://site.com/wp-json/sg-cachepress/v1/purge" \
  -u "user:app-pass" \
  -H "User-Agent: ASI360-Sentinel/1.0.0"
```

**Prevention:**
- After any REST API content push, always validate with `?nocache=timestamp`
- After global element changes (footer, header), flush ALL cache layers
- See [bugs-and-lessons.md WIN-004](bugs-and-lessons.md) for the proven cache-bust pattern
- Add cache purge step to Site Factory Engine post-deploy validation

---

### SG-004 — PHP max_input_vars Locked

**Severity:** 🟡 Major

**Symptom:**
- Complex forms lose fields on submission (WooCommerce product variations, WC EPO forms)
- Theme options save partially — some settings revert after saving
- Error in debug log: `Input variables exceeded [number]. Increase max_input_vars`

**Root Cause:**
PHP `max_input_vars` defaults to 1000 on SiteGround. Some themes/plugins require 5000+. Editable via PHP Manager but easy to overlook.

**Fix:**
```
Site Tools → DevTools → PHP Manager → PHP Variables
  max_input_vars: 5000
  → Save
```

**Prevention:**
- Add to Pre-Flight Phase D: Set `max_input_vars = 5000` for ANY site using WooCommerce or complex themes
- Porto requires at least 3000 for its theme options panel
- WC Extra Product Options with many form fields may need 10000

---

### SG-005 — FTP/SFTP Connection Failures

**Severity:** 🟡 Major

**Symptom:**
- FTP client cannot connect (timeout or auth failure)
- Site Factory deployer fails: `ftplib.error_perm: 530 Login authentication failed`
- SFTP connection refused

**Root Cause (common):**
1. Wrong port — FTP uses 21, SFTP uses **18765** (non-standard)
2. FTP account password changed in Site Tools but not updated in Vault
3. IP blocked by SiteGround firewall (too many failed attempts)
4. FTP account was for a different site (SG creates per-site FTP users)

**Fix:**
```bash
# Test FTP connection
python3 -c "
from ftplib import FTP
ftp = FTP()
ftp.connect('ftp.asi360.co', 21, timeout=30)
ftp.login('user', 'password')
print(ftp.pwd())
ftp.quit()
"

# Test SFTP connection
ssh -p 18765 u2154-jvbuddbe6fqb@ssh.asi360.co
```

**Prevention:**
- Always use Python `ftplib` — lftp/curl have reliability issues (BUG-006 in bugs-and-lessons.md)
- Store FTP password in Supabase Vault, never in `.env` or config files
- After password changes, update Vault AND test connection before deploying
- Current FTP creds are in [config.py](../../site-factory/config.py) lines 135-150

---

### SG-006 — SSL Certificate Issues

**Severity:** 🟡 Major

**Symptom:**
- Browser shows "Your connection is not private" or "NET::ERR_CERT_COMMON_NAME_MISMATCH"
- New subdomain works over HTTP but not HTTPS
- SSL certificate shows wrong domain

**Root Cause:**
Let's Encrypt auto-provisioning takes 10-15 minutes for new subdomains. If you install WordPress or import content before SSL is ready, all URLs may be stored as `http://`.

**Fix:**
1. Wait 15 min after creating subdomain, then check SSL Manager
2. If cert still missing: Site Tools → Security → SSL Manager → Order New Certificate
3. If wrong domain: Delete cert → Re-order for correct domain
4. After fixing SSL: Run Search & Replace (SG-001) to fix any stored `http://` URLs

**Prevention:**
- Pre-Flight Phase A: Wait for SSL BEFORE installing WordPress
- Enable HTTPS Enforce BEFORE any content import

---

### SG-007 — PHP Version Incompatibility

**Severity:** 🟠 Moderate

**Symptom:**
- White Screen of Death (WSOD) after plugin update
- PHP deprecation warnings in error log
- Theme features broken after PHP upgrade

**Root Cause:**
PHP version mismatch. Porto requires PHP 7.4+. Some older plugins break on PHP 8.2+. SiteGround auto-updates PHP minor versions.

**Fix:**
```
Site Tools → DevTools → PHP Manager → PHP Version
  Switch to compatible version (8.1 is safest for broad compatibility)
  → Save
```

**Prevention:**
- Before any plugin update: check plugin's stated PHP compatibility
- Porto: PHP 7.4 - 8.2 (as of 2026)
- Astra Pro: PHP 7.4 - 8.3
- WooCommerce: PHP 7.4 - 8.3
- Safe default for multi-theme sites: **PHP 8.1**

---

### SG-008 — SG Optimizer Plugin Conflicts

**Severity:** 🟠 Moderate

**Symptom:**
- Theme styles partially broken after enabling SG Optimizer features
- JavaScript errors in console (`Uncaught TypeError`, `$ is not defined`)
- WPBakery/Spectra visual editor broken
- Fonts not loading or showing fallback

**Root Cause:**
SG Optimizer's minification/combination features can conflict with theme-specific optimizations. Porto and Spectra both have their own CSS/JS optimization.

**Fix:**
```
Site Tools → Speed → SG Optimizer → Environment tab:
  ✅ HTTPS Enforce: ON
  ❌ HTML Minification: OFF (conflicts with theme builders)
  ❌ JavaScript Minification: OFF (breaks WPBakery/Spectra)
  ❌ CSS Minification: OFF (theme handles this)
  ❌ JS Combination: OFF
  ❌ CSS Combination: OFF
  ✅ Browser Caching: ON
  ✅ GZIP Compression: ON
```

**Prevention:**
- For Porto sites: Disable ALL SG Optimizer minification — Porto has its own
- For Astra/Spectra sites: Disable JS/CSS combination — Spectra generates per-block CSS
- Only use SG Optimizer for: HTTPS enforce, browser caching, GZIP compression

---

### SG-009 — Staging Environment URL Issues

**Severity:** 🟠 Moderate

**Symptom:**
- Staging copy loads but all internal links point to production URL
- Images show broken links on staging
- "Push to Live" breaks production site URLs

**Root Cause:**
SiteGround staging creates a copy at `stg-[site].siteground.biz` but does NOT rewrite all URLs in the database. Some theme-specific options, serialized data, and hardcoded URLs survive.

**Fix:**
1. After creating staging: Run Search & Replace on staging database
   - Search: `https://production-domain.com`
   - Replace: `https://stg-site.siteground.biz`
2. Before "Push to Live": Run Search & Replace in reverse
3. Clear all caches on both staging and production

**Prevention:**
- Always test staging thoroughly BEFORE pushing to live
- Never use "Push to Live" for Porto sites — do a fresh import instead
- SiteGround staging is useful for testing plugin updates, NOT for content workflows

---

### SG-010 — File Permission Issues

**Severity:** 🟠 Moderate

**Symptom:**
- "Could not create directory" errors during plugin/theme install
- Upload failures in Media Library
- "Permission denied" in error log

**Root Cause:**
Incorrect file permissions. SiteGround expects:
- Directories: `755`
- Files: `644`
- `wp-config.php`: `640` or `600`
- `wp-content/uploads/`: `755` (writable by web server)

**Fix:**
```bash
# Via SSH (port 18765)
find ~/www/site.com/public_html/ -type d -exec chmod 755 {} \;
find ~/www/site.com/public_html/ -type f -exec chmod 644 {} \;
chmod 640 ~/www/site.com/public_html/wp-config.php
```

**Prevention:**
- FTP uploads preserve source permissions — ensure local files are 644/755
- Never set 777 permissions (SiteGround may auto-reset these)
- After bulk FTP deploy, verify uploads directory is writable

---

### SG-011 — .htaccess Conflicts

**Severity:** 🟠 Moderate

**Symptom:**
- 500 Internal Server Error after editing .htaccess
- Redirects not working or causing loops
- "Too many redirects" in browser

**Root Cause:**
SiteGround adds its own rules to `.htaccess` (caching, security). Custom rules can conflict, especially:
- Duplicate HTTPS redirect rules (SG already handles this)
- `RewriteBase` conflicts between root install and subdirectory installs
- PHP value overrides that SG ignores

**Fix:**
1. SSH in and backup: `cp .htaccess .htaccess.bak`
2. Replace with minimal WordPress .htaccess:
   ```apache
   # BEGIN WordPress
   <IfModule mod_rewrite.c>
   RewriteEngine On
   RewriteBase /
   RewriteRule ^index\.php$ - [L]
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteRule . /index.php [L]
   </IfModule>
   # END WordPress
   ```
3. Let SG Optimizer re-add its rules automatically

**Prevention:**
- Never add HTTPS redirect rules in .htaccess — use SG's HTTPS Enforce instead
- Never add `php_value` or `php_flag` directives — use PHP Manager instead
- For custom redirects (like teslaev → root), add AFTER the WordPress block

---

### SG-012 — Database Connection Errors

**Severity:** 🔴 Critical

**Symptom:**
- "Error establishing a database connection" on frontend
- wp-admin completely inaccessible
- `wp-config.php` credentials verified correct but connection fails

**Root Cause (common):**
1. MySQL server temporarily down (SiteGround shared hosting — rare but happens)
2. Database user permissions revoked
3. Database hit size/connection limits
4. `wp-config.php` DB_HOST incorrect after server migration

**Fix:**
1. Check if MySQL is up: Site Tools → MySQL → phpMyAdmin → try to connect
2. Verify `wp-config.php` credentials match Site Tools → MySQL → Databases
3. If DB user missing: recreate in Site Tools → MySQL → Users
4. If persistent: contact SiteGround support (it's their server)

**Prevention:**
- Monitor site availability (uptime check via N8N or external service)
- Keep database optimized (delete post revisions, spam comments, transients)
- For WooCommerce sites: add `define('WP_POST_REVISIONS', 5);` to wp-config.php

**SG Support Template:**
```
Subject: Database Connection Error — [site URL]
Site: [site URL]
Issue: "Error establishing a database connection" on all pages and wp-admin.
Verified: wp-config.php credentials match Site Tools database settings.
DB Name: [name] | DB User: [user] | DB Host: [host]
Request: Please check MySQL server status and database user permissions.
This is blocking all site operations.
```

---

## 6. Emergency Procedures

### EMERGENCY-1: White Screen of Death (WSOD)

```bash
# 1. Check error log (via SSH)
ssh -p 18765 user@ssh.asi360.co
tail -50 ~/www/site.com/public_html/wp-content/debug.log

# 2. If plugin caused it — rename the plugin folder
mv wp-content/plugins/problem-plugin wp-content/plugins/problem-plugin.disabled

# 3. If theme caused it — switch to default theme via DB
# Use phpMyAdmin or WP-CLI:
wp option update template twentytwentyfour
wp option update stylesheet twentytwentyfour

# 4. If nothing works — restore from backup
# Site Tools → Security → Backups → Restore (pick yesterday)
```

### EMERGENCY-2: CSS/Styling Completely Broken

```
1. Check for SG-001 (mixed content) → Browser console → look for "Mixed Content" errors
2. If mixed content → Site Tools → WordPress → Search & Replace → http:// → https://
3. If NOT mixed content → disable SG Optimizer minification (SG-008)
4. If still broken → clear ALL caches (SG dynamic + CDN + browser)
5. Validate with: https://site.com/?nocache=[timestamp]
```

### EMERGENCY-3: Site Extremely Slow (>10s load)

```
1. Check CDN: Site Tools → Speed → CDN → verify enabled
2. Check caching: Site Tools → Speed → Caching → verify dynamic cache ON
3. Check plugins: Deactivate all plugins, test, reactivate one by one
4. Check PHP: Site Tools → DevTools → PHP Manager → ensure PHP 8.1+
5. Check database: wp-admin → Tools → optimize database
6. If persistent: check SiteGround status page (status.siteground.com)
```

### EMERGENCY-4: Locked Out of wp-admin

```bash
# Via SSH — reset admin password
ssh -p 18765 user@ssh.asi360.co
cd ~/www/site.com/public_html
# Use WP-CLI if available:
wp user update webdevteam --user_pass=NewTempPassword123!

# Or via phpMyAdmin:
# Site Tools → MySQL → phpMyAdmin
# UPDATE wp_users SET user_pass = MD5('NewTempPassword123!') WHERE user_login = 'webdevteam';
```

### EMERGENCY-5: Database Corrupted

```
1. Site Tools → Security → Backups → Restore most recent backup
2. If backup also corrupted:
   a. Site Tools → MySQL → phpMyAdmin
   b. Select all tables → "Repair table" from dropdown
3. If still failing → contact SiteGround (SG-012 template)
```

### EMERGENCY-6: Plugin/Theme Update Broke Site

```
1. IMMEDIATE: If WSOD → follow EMERGENCY-1
2. If partial breakage:
   a. SSH in: rename updated plugin to .disabled
   b. Re-upload previous version via FTP from local backup
   c. Restore from SiteGround backup if no local copy
3. POST-MORTEM:
   a. Check plugin changelog for breaking changes
   b. Test update on staging first next time (Pre-Flight Phase E)
   c. Document in bugs-and-lessons.md
```

---

## 7. SiteGround Support Playbook

### What SiteGround Support CAN Do

| Action | How to Request | Typical Wait |
|--------|---------------|--------------|
| Run Search & Replace | Ask directly — they have the tool | 15-30 min |
| Increase PHP limits temporarily | Ask for specific limit + reason | 30-60 min |
| Check MySQL server status | Report "DB connection error" | 15 min |
| Restore from backup | They'll confirm date, you approve | 15-30 min |
| Check server-side error logs | Ask for recent errors for specific site | 15-30 min |
| Force SSL certificate renewal | If auto-renewal failed | 1-2 hours |
| Whitelist IP for FTP | If IP blocked by firewall | 15 min |
| Move site to different server | Performance issues | 24-48 hours |

### What SiteGround Support WON'T Do

- Debug custom PHP code or plugin conflicts
- Modify WordPress core files
- Install or configure themes/plugins
- Optimize database queries
- Fix broken site content or design
- Override max_execution_time permanently on shared hosting
- Provide root/sudo access

### Escalation Path

```
1. Live Chat (fastest) — my.siteground.com → Help Center → Chat
2. Phone — Available for GrowBig+
3. Ticket — For non-urgent issues or when documentation needed
4. Priority Queue — GoGeek plan only
```

### Ticket Template — General Issue

```
Subject: [Issue Type] — [site URL]
Account: [SiteGround account email]
Site: [full URL including https://]

ISSUE:
[1-2 sentence description of what's broken]

STEPS TO REPRODUCE:
1. Navigate to [URL]
2. [What happens vs what should happen]

ALREADY TRIED:
- [List troubleshooting steps taken]
- [Any relevant error messages]

REQUESTED ACTION:
[Specific ask — be precise about what you want them to do]

URGENCY: [Low/Medium/High/Critical — site down]
```

---

## 8. Porto Theme Integration Notes

Porto uses **WPBakery Page Builder** (not Gutenberg/Spectra). This means:

### Porto-Specific SiteGround Gotchas

1. **Setup Wizard is MANDATORY** — Porto bundles WPBakery, Revolution Slider, and Porto Core. All must be installed via the Setup Wizard before demo import. Manual installation causes version conflicts.

2. **Demo import requires ZipArchive** — Verify PHP ZipArchive extension is enabled:
   ```
   Site Tools → DevTools → PHP Manager → PHP Extensions → zip → Enable
   ```

3. **Large demo imports timeout** (SG-002 applies):
   - Porto's full demo is 100MB+ of content
   - Use "Alternative Mode" in the demo import wizard — splits into smaller chunks
   - If alternative mode fails: import "content only" first, then "widgets", then "options"

4. **Porto + SG Optimizer conflicts** (SG-008 applies):
   - Disable ALL minification in SG Optimizer
   - Porto has its own CSS/JS optimization: Porto → Theme Settings → Performance
   - Enable Porto's JS/CSS minification INSTEAD of SG Optimizer's

5. **Porto Popup Builder z-index:**
   - Porto demos import popup configurations (newsletter, banners)
   - Popups use Magnific Popup library at z-index 9042-9043
   - If popup covers entire page: Porto → Theme Settings → Popups → disable or configure

6. **RevSlider + CDN:** Revolution Slider loads external assets. After enabling CDN, verify sliders render correctly. May need CDN exclusion for RevSlider paths.

### Porto PHP Requirements

| Setting | Minimum | Recommended |
|---------|---------|-------------|
| PHP Version | 7.4 | 8.1 |
| memory_limit | 256M | 512M |
| max_execution_time | 120s (SG limit) | Use Alternative Import |
| max_input_vars | 3000 | 5000 |
| post_max_size | 32M | 64M |
| upload_max_filesize | 32M | 64M |

---

## 9. Astra/Spectra Integration Notes

Astra Pro + Spectra Pro is the primary stack for content-driven sites (asi360.co, sandbox). For comprehensive reference, see [astra-spectra-reference.md Section 11](astra-spectra-reference.md).

### SiteGround-Specific Considerations

1. **Spectra CSS Generation:** Spectra generates per-block CSS files. SG Optimizer's CSS combination/minification can break this. Disable CSS combination in SG Optimizer.

2. **Starter Template Import:** Uses WordPress's built-in importer — subject to SG-002 (120s timeout). Premium Starter Templates (Astra Pro) typically import in under 60s — well within SG limits.

3. **REST API and SG Caching:** The Site Factory Engine pushes content via REST API. SG's dynamic cache may serve stale content after API updates. Always validate with `?nocache=timestamp` after pushing changes. See [bugs-and-lessons.md WIN-004](bugs-and-lessons.md) for the validated pattern.

4. **SureForms + SG Security:** SiteGround's security rules may block form submissions if they contain suspicious patterns. If SureForms submissions fail, check SG's Application Firewall: Site Tools → Security → Managed Security Rules.

---

## 10. CDN & Caching Operations

### 3-Layer Cache Model

```
Request → CDN (Cloudflare via SG) → SG Dynamic Cache → SG Static Cache → PHP/WordPress

Layer 1: SG Static Cache    — HTML files on disk, fastest, auto-generated
Layer 2: SG Dynamic Cache   — In-memory cache for dynamic pages
Layer 3: CDN (Cloudflare)   — Global edge cache, controlled by SG
```

### Purge Order (CRITICAL — Purge in This Order)

```
1. WordPress Object Cache  →  wp-admin → SG Optimizer → Purge
2. SG Dynamic Cache         →  Site Tools → Speed → Caching → Flush
3. CDN Cache                →  Site Tools → Speed → CDN → Purge
4. Browser Cache            →  Ctrl+Shift+R (hard refresh)
```

### Cache-Bust Validation Pattern

```bash
# Bypass all caches for testing
curl -s "https://site.com/page/?nocache=$(date +%s)" | grep "expected text"

# If nocache shows new content but normal URL shows old:
# → Cache is stale, purge all 3 layers in order above
```

### REST API and Caching

SiteGround does NOT cache REST API responses (`/wp-json/*`) by default. However:
- **GET requests** may be cached if SG Optimizer "REST API Cache" is enabled (usually off)
- **POST/PUT/DELETE** always bypass cache
- After a content push via REST API, the **page HTML cache** must be purged for visitors to see changes

---

## 11. PHP Configuration Management

### Default vs Recommended Settings

| Setting | SG Default | Recommended | Editable? | Location |
|---------|-----------|-------------|-----------|----------|
| PHP Version | 8.2 | 8.1 | ✅ | PHP Manager → Version |
| memory_limit | 256M | 512M | ✅ | PHP Manager → Variables |
| max_execution_time | 120s | 120s (LOCKED) | ❌ | Server-level — see SG-002 |
| max_input_vars | 1000 | 5000 | ✅ | PHP Manager → Variables |
| post_max_size | 64M | 64M | ✅ | PHP Manager → Variables |
| upload_max_filesize | 64M | 64M | ✅ | PHP Manager → Variables |
| max_file_uploads | 20 | 50 | ✅ | PHP Manager → Variables |
| display_errors | Off | Off | ✅ | Keep Off in production |
| error_reporting | E_ALL & ~E_DEPRECATED | E_ALL & ~E_DEPRECATED | ✅ | PHP Manager |

### How to Change PHP Settings

```
Site Tools → DevTools → PHP Manager → PHP Variables
  Select variable → Set value → Save
```

**Important:** Changes take effect immediately but may require cache purge to verify.

---

## 12. SSL & HTTPS Management

### Auto-Provisioning

SiteGround auto-provisions Let's Encrypt SSL for:
- Main domain (asi360.co) — immediately on account creation
- Subdomains (shop.asi360.co) — within 10-15 minutes of subdomain creation
- Wildcard certs — NOT available on GrowBig (GoGeek required)

### HTTPS Enforce

```
Site Tools → Security → HTTPS Enforce → Toggle ON
```

This adds server-level redirect (faster than .htaccess redirect). Enable BEFORE WordPress install to prevent SG-001.

### Certificate Renewal

- Auto-renews 30 days before expiry
- If renewal fails: Site Tools → Security → SSL Manager → Manage → Renew
- Check cert status: `echo | openssl s_client -connect site.com:443 2>/dev/null | openssl x509 -noout -dates`

---

## 13. FTP/SSH Access Reference

### Connection Details (from [config.py](../../site-factory/config.py))

| Protocol | Host | Port | User |
|----------|------|------|------|
| FTP | ftp.asi360.co | 21 | claude_agentic_system@asi360.co |
| SFTP | ssh.asi360.co | 18765 | u2154-jvbuddbe6fqb |
| SSH | ssh.asi360.co | 18765 | u2154-jvbuddbe6fqb |

### Credentials

- FTP Password: Loaded from Supabase Vault (`siteground_ftp_password`)
- SSH Key: `~/.ssh/siteground_ed25519` (passphrase-protected)
- SSH Wrapper: `/tmp/sg-ssh.sh` (handles passphrase — see config.py line 158)

### Per-Site FTP Paths

| Site | FTP Path |
|------|----------|
| sandbox | `/sandbox.asi360.co/public_html/asi360/` |
| teslaev | `/asi360.co/public_html/teslaev/` |
| asi360-root | `/asi360.co/public_html/` |
| shop | `/shop.asi360.co/public_html/` |

### FTP Best Practices

- Always use Python `ftplib` — lftp/curl have reliability issues (BUG-006)
- Use MD5 hash-based sync to only upload changed files (see HYBRID_SITEGROUND_ARCHITECTURE.md deployment pipeline)
- Test connection before any deployment: `ftp.connect() → ftp.login() → ftp.pwd()`
- After bulk upload, verify file count matches source

---

## 14. Staging Environment Operations

### Creating a Staging Copy

```
Site Tools → WordPress → Staging → Create Staging Copy
```

### Key Limitations

1. **One staging copy per site** (GrowBig plan)
2. **URLs are rewritten** to `stg-[hash].siteground.biz` — but NOT all URLs (SG-009)
3. **No SSL on staging** by default — may cause mixed content if original site is HTTPS
4. **Push to Live** does a full database + files overwrite — **DESTRUCTIVE**
5. **Staging is NOT synced** — production changes after staging creation are lost on push-to-live

### When to Use Staging

✅ Testing plugin updates before applying to production
✅ Testing PHP version changes
✅ Verifying theme updates don't break anything

### When NOT to Use Staging

❌ Content editing workflow (use REST API instead)
❌ Porto demo re-imports (do fresh install instead)
❌ Multi-developer collaboration (use Git + local dev)

---

## 15. FAQ

**Q1: How do I know if my site has mixed content issues?**
Open browser DevTools (F12) → Console tab. Look for yellow/red "Mixed Content" warnings. Or use: `https://www.whynopadlock.com/` to scan your site.

**Q2: Can I increase max_execution_time above 120 seconds?**
No. SiteGround enforces this at the server level on shared hosting. Use chunked imports, FTP uploads, or SSH/WP-CLI for long-running operations. See SG-002.

**Q3: How do I completely clear all caches?**
Purge in order: (1) wp-admin SG Optimizer purge, (2) Site Tools → Caching → Flush, (3) Site Tools → CDN → Purge. Then hard-refresh browser (Ctrl+Shift+R). See Section 10.

**Q4: My FTP connection keeps timing out. What do I check?**
Verify port (21 for FTP, 18765 for SFTP), check credentials in Vault, ensure your IP isn't blocked (too many failed attempts). Use Python ftplib, not lftp. See SG-005.

**Q5: Porto demo import failed halfway. What do I do?**
Use Porto's "Alternative Mode" (splits import into chunks). If that fails: import content only first, then widgets, then options separately. See Section 8.

**Q6: Should I use SG Optimizer with Porto?**
Only for HTTPS enforce, browser caching, and GZIP. Disable ALL minification and combination — Porto has its own optimization. See SG-008.

**Q7: How do I access my site via SSH?**
`ssh -p 18765 u2154-jvbuddbe6fqb@ssh.asi360.co` — requires SSH key (`~/.ssh/siteground_ed25519`). See Section 13.

**Q8: I pushed content via REST API but the site shows old content.**
Cache staleness. Validate with `?nocache=timestamp`. If new content shows with nocache but not normally, purge all 3 cache layers. See SG-003 and Section 10.

**Q9: Can I use WP-CLI on SiteGround?**
Yes, via SSH. WP-CLI is pre-installed. `ssh -p 18765 user@ssh.asi360.co` then `cd ~/www/site.com/public_html && wp --info`.

**Q10: How often does SiteGround backup my site?**
Daily, with 30-day retention. Restore via Site Tools → Security → Backups. Backups are full-site (files + database) — no per-file restore available.

---

## 16. Cross-Reference Index

### SG Failure Code → Existing Documentation

| SG Code | Related Entry | Document |
|---------|--------------|----------|
| SG-001 | TT909 (VTiger + Airtable) | Ticket closed 2026-03-09 |
| SG-001 | — | Trigger event for this manual |
| SG-003 | WIN-004 (cache-bust pattern) | [bugs-and-lessons.md](bugs-and-lessons.md) |
| SG-005 | BUG-006 (FTP reliability) | [bugs-and-lessons.md](bugs-and-lessons.md) |
| SG-008 | Section 11 (Troubleshooting) | [astra-spectra-reference.md](astra-spectra-reference.md) |
| — | Deployment Pipeline | [HYBRID_SITEGROUND_ARCHITECTURE.md](../docs/architecture/HYBRID_SITEGROUND_ARCHITECTURE.md) |
| — | FTP/SSH Config | [config.py](../../site-factory/config.py) lines 135-170 |
| — | License Allocation | [webdev-product-inventory.md](webdev-product-inventory.md) |

### Document → Relevant SG Codes

| Document | Relevant Failure Codes |
|----------|----------------------|
| Pre-Flight Checklist (Section 4) | SG-001, SG-004, SG-006 |
| Porto Integration (Section 8) | SG-001, SG-002, SG-004, SG-008 |
| Astra/Spectra (Section 9) | SG-002, SG-003, SG-008 |
| CDN/Caching (Section 10) | SG-003 |
| FTP/SSH (Section 13) | SG-005 |
| Staging (Section 14) | SG-009 |

---

*Last updated: 2026-03-09 | Maintained by: ASI 360 WebDev Operations*
