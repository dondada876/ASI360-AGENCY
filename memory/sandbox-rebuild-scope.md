# ASI 360 Sandbox Rebuild — Project Scope & Handoff

**Last Updated:** 2026-03-06
**Project:** Rebuild asi360.co on sandbox environment
**Sandbox URL:** https://sandbox.asi360.co/asi360/
**Methodology:** WordPress REST API ONLY (`/wp-json/wp/v2/*`) — NO direct MySQL writes

---

## Credentials

| Item | Value |
|------|-------|
| Sandbox URL | `https://sandbox.asi360.co/asi360/` |
| WP Admin URL | `https://sandbox.asi360.co/asi360/wp-admin/` |
| WP Username | `webdevteam` |
| WP Admin Password | `MontegoB@y1981!876.` |
| WP Application Password | `Z7O2 0wbR Lsqy Vz57 4dSO 28eT` |
| Required User-Agent | `ASI360-Sentinel/1.0.0 (+https://asi360.co; contact=ops@asi360.co)` |

### REST API Auth Pattern
```bash
curl -X POST "https://sandbox.asi360.co/asi360/wp-json/wp/v2/pages/{ID}" \
  -u "webdevteam:Z7O2 0wbR Lsqy Vz57 4dSO 28eT" \
  -H "Content-Type: application/json" \
  -H "User-Agent: ASI360-Sentinel/1.0.0 (+https://asi360.co; contact=ops@asi360.co)" \
  -d '{"title":"...","content":"...","status":"draft"}'
```

### License Keys (Business Toolkit — expires Nov 2, 2026)
- Astra Pro: `78556789547f911ad94942fc91e327d3` — ACTIVE on sandbox
- Premium Starter Templates: `c2a6a82b8afbc31931e20297278817cf` — ACTIVE
- Spectra Pro: `1bdcc7359ad604fa999fd41a64eb3825` — NOT INSTALLED (see Blocker below)

---

## Current State (as of 2026-03-06)

### Template Imported
Electrician Company template (Premium Starter Templates, blue palette Style 1). Creates a professional layout but all content is "Spark Electrical" electrician-themed placeholder text.

### Page Inventory

| Page | ID | Content Status | Action Needed |
|------|----|---------------|---------------|
| Homepage | 487 | UNTOUCHED — all Spark Electrical content | Full rewrite with ASI 360 content |
| About | 488 | MOSTLY CUSTOMIZED — has real ASI 360 content | Minor cleanup |
| Services | 489 | FULLY CUSTOMIZED — real ASI 360 services | Done — review only |
| Projects/Portfolio | 490 | Electrician template content | Rewrite or repurpose |
| Careers | 491 | Electrician template content | Rewrite or repurpose |
| Testimonials | 492 | Electrician template content | Rewrite with real/placeholder testimonials |
| Blogs | 493 | Template listing page | Keep as-is (blog index) |
| Contact | 494 | MOSTLY CUSTOMIZED | Needs form, phone, email updates |
| Privacy Policy | 495 | Template placeholder | Rewrite for ASI 360 |
| Terms of Service | 496 | Template placeholder | Rewrite for ASI 360 |
| Sample Page | 2 | WordPress default | DELETE |
| Home (old) | 14 | Original scaffold | DELETE |
| About (old) | 15 | Original scaffold | DELETE |
| Services (old) | 16 | Original scaffold | DELETE |
| Contact (old) | 17 | Original scaffold | DELETE |
| Blog (old) | 33 | Original scaffold | DELETE |
| Shop | 6 | WooCommerce default | Keep |
| Cart | 7 | WooCommerce default | Keep |
| Checkout | 8 | WooCommerce default | Keep |
| My Account | 9 | WooCommerce default | Keep |

### Blog Posts

| Post | ID | Status |
|------|----|--------|
| 5 electrician template posts | 231-243 (odd) | DELETE — Spark Electrical content |
| 5 ASI 360 branded posts | 245-253 (odd) | KEEP — real content |

### Global Elements (Affect ALL Pages)

| Element | Current State | Action |
|---------|--------------|--------|
| Site Title | "Spark Electrical" | Change to "ASI 360" |
| Tagline | Electrician tagline | "One Source \| Unlimited Solutions" |
| Header Logo | Lightning bolt / Spark Electrical | Replace with ASI 360 logo |
| Header Nav | Template navigation | Update menu items |
| Footer | "Spark Electrical", (555) 123-4567, info@spa.com | Full rebrand |
| Phone Number | (555) 123-4567 everywhere | Replace with real ASI 360 number |
| Email | info@spa.com everywhere | Replace with real ASI 360 email |

### Plugin State

**Active & Needed:** Astra Pro, Premium Starter Templates, Spectra (free), SureForms, WooCommerce, Speed Optimizer, Security Optimizer
**Active — Evaluate:** 3CX Live Chat, AI Studio, Import/Export Customizer, SureRank
**NOT INSTALLED:** Spectra Pro (see Blocker)

---

## Blocker: Spectra Pro Not Installed

**BUG-001** — Chrome DevTools Protocol blocks `file_upload` for WordPress plugin zip uploads. Tracked in:
- Airtable: `recZ4dTHG9ZCnrgWf` (CEO Dashboard Bug Tracker)
- Vtiger: TT894 (HelpDesk)

**Local zip file:** `/Users/dbucknor/Downloads/Astra Pro/spectra-pro-1.2.9.zip`

### Resolution Options (pick one)
1. **Ask user to upload manually** — 30 seconds in wp-admin → Plugins → Upload
2. **FTP upload** to `wp-content/plugins/` then activate via REST API
3. **Full curl workflow** — login → get nonce → upload (single cookie jar, see bugs-and-lessons.md)
4. **WP-CLI via SSH** (if available on SiteGround)

---

## Recommended Phase Plan

### Phase 1: Unblock & Clean (15 min)
- [ ] Install Spectra Pro (ask user for manual 30-sec upload or use FTP)
- [ ] Activate Spectra Pro license via wp-admin
- [ ] Delete old scaffold pages (IDs: 2, 14, 15, 16, 17, 33)
- [ ] Delete electrician blog posts (IDs: 231, 233, 237, 241, 243)
- [ ] Deactivate unneeded plugins (3CX Live Chat, SureRank)

### Phase 2: Global Branding (30 min)
- [ ] Update site title/tagline via REST API: `PUT /wp-json/wp/v2/settings`
- [ ] Update header via Astra Customizer (browser — header builder is visual)
- [ ] Update footer via Astra Customizer (browser — footer builder is visual)
- [ ] Replace phone/email sitewide
- [ ] Upload ASI 360 logo via REST API media endpoint

### Phase 3: Homepage Rewrite (45 min)
- [ ] Design ASI 360 homepage content (hero, services overview, CTA)
- [ ] Build with Spectra blocks (uagb/container, uagb/info-box, uagb/call-to-action)
- [ ] Push via REST API: `PUT /wp-json/wp/v2/pages/487`

### Phase 4: Remaining Pages (60 min)
- [ ] Projects/Portfolio (ID 490) — rewrite for ASI 360 case studies
- [ ] Careers (ID 491) — rewrite or hide
- [ ] Testimonials (ID 492) — rewrite with real/placeholder
- [ ] Contact (ID 494) — finalize form, add real contact info
- [ ] Privacy Policy (ID 495) — generate for ASI 360
- [ ] Terms of Service (ID 496) — generate for ASI 360

### Phase 5: Navigation & Polish (30 min)
- [ ] Update primary menu items and order
- [ ] Review all pages visually via browser
- [ ] Test mobile responsiveness
- [ ] Verify WooCommerce pages functional

---

## REST API Quick Reference

### Update a page
```bash
curl -X PUT "https://sandbox.asi360.co/asi360/wp-json/wp/v2/pages/{ID}" \
  -u "webdevteam:Z7O2 0wbR Lsqy Vz57 4dSO 28eT" \
  -H "Content-Type: application/json" \
  -H "User-Agent: ASI360-Sentinel/1.0.0 (+https://asi360.co; contact=ops@asi360.co)" \
  -d '{"content":"<!-- wp:uagb/container -->...<!-- /wp:uagb/container -->"}'
```

### Delete a page/post
```bash
curl -X DELETE "https://sandbox.asi360.co/asi360/wp-json/wp/v2/pages/{ID}?force=true" \
  -u "webdevteam:Z7O2 0wbR Lsqy Vz57 4dSO 28eT" \
  -H "User-Agent: ASI360-Sentinel/1.0.0 (+https://asi360.co; contact=ops@asi360.co)"
```

### Update site settings
```bash
curl -X PUT "https://sandbox.asi360.co/asi360/wp-json/wp/v2/settings" \
  -u "webdevteam:Z7O2 0wbR Lsqy Vz57 4dSO 28eT" \
  -H "Content-Type: application/json" \
  -H "User-Agent: ASI360-Sentinel/1.0.0 (+https://asi360.co; contact=ops@asi360.co)" \
  -d '{"title":"ASI 360","description":"One Source | Unlimited Solutions"}'
```

### Upload media
```bash
curl -X POST "https://sandbox.asi360.co/asi360/wp-json/wp/v2/media" \
  -u "webdevteam:Z7O2 0wbR Lsqy Vz57 4dSO 28eT" \
  -H "User-Agent: ASI360-Sentinel/1.0.0 (+https://asi360.co; contact=ops@asi360.co)" \
  -H "Content-Disposition: attachment; filename=asi360-logo.png" \
  --data-binary @asi360-logo.png
```

---

## ASI 360 Brand Reference

- **Company:** ASI 360 — Allied Systems Integrations
- **Tagline:** "One Source | Unlimited Solutions"
- **Colors:** Dark blue #1A3A5C, accent blue #2980B9
- **Services:** Access Control, CCTV/Surveillance, Fire Alarm, Intrusion Detection, Structured Cabling, IT Infrastructure, Audio/Visual, Project Management
- **Target Market:** Commercial, enterprise, law firms, property management, education, healthcare
