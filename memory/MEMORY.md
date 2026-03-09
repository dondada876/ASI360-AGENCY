# ASI360 Agency Memory

## Active Projects
- **Sandbox Rebuild** — See [sandbox-rebuild-scope.md](sandbox-rebuild-scope.md) for full scope, page inventory, phase plan, and credentials
- **Transplanting Engine v1.0** — Strategic framework COMPLETE (draft). See [transplanting-engine.md](transplanting-engine.md). All 8 deliverables from the vision request created: lint guide, hint guide, block inventory, business context framework, LLM guidelines, testing pipeline, viability assessment, module strategy. Ready for operational use.
  - **Next steps:** (1) Execute remaining 5 page transplants using the Engine framework (Testimonials 492, Careers 491, Terms 496, Privacy 495, Blogs 493), (2) Header transplant investigation, (3) Image transplant workflow, (4) Multi-site orchestration
- **Site Factory Engine 2.0** — File-level automated site production. 4-stage pipeline: CATALOG → MATCH → PROCESS → DEPLOY. Completely separate from v1. Code at `~/Projects/ASI360-AGENCY/site-factory/`. Skill: `/site-factory`. Supabase tables: `template_index`, `site_jobs`, `asset_uploads`.
  - **Status:** End-to-end pipeline VALIDATED ✅ — Scanner (532 assets cataloged), Matcher, Processor, Deployer all functional. Jobs #2 and #3 deployed on teslaev site (64 total replacements across 5 pages). Multi-site config working (`sandbox` + `teslaev` targets in config.py).
  - **Next steps:** (1) Source client images for image pipeline testing, (2) Deploy on production client site, (3) Add more starter templates to catalog

## Reference Documents
- **Transplanting Engine — Master Reference** — See [transplanting-engine.md](transplanting-engine.md) — Complete operational guide for the ASI 360 Site Factory Engine. 1,100 lines covering: viability assessment (20-40x speed), architecture, 70-block inventory with transplant status, 8 lint checks (LINT-001→008 with full Python code), 14 development hints (HINT-001→014), business context framework with client intake + template selection matrix, LLM Python script generation guidelines with 3 prompt templates, automated testing pipeline with rollback protocol, module activation strategy by growth tier, and full cross-reference index.
- **Astra Pro + Spectra Pro Reference** — See [astra-spectra-reference.md](astra-spectra-reference.md) — Complete frontend designer training document for mass website production. Covers all 20 Astra Pro modules, 54 Spectra blocks, page patterns, REST API workflows, responsive design, global theming, and troubleshooting. ~1400 lines.
- **WebDev Product Inventory** — See [webdev-product-inventory.md](webdev-product-inventory.md) — Comprehensive catalog of all licensed WordPress themes and plugins (350+ lines). Covers 9 products: 3 themes (Flatsome, Porto, Traveler), 4 plugins (WC Extra Product Options, Ultimate Affiliate Pro, Cost Calculator, Table Rate Shipping), plus Astra Pro stack. Includes: license summary table with purchase codes, detailed capability analysis per product, architecture mapping (which product serves which property), theme selection decision matrix, plugin compatibility matrix, prioritized recommendations, and 7 key gotchas. All licenses owned by 500 Grand Live LLC.
- **SiteGround WebDev Operations Manual** — See [siteground-operations-manual.md](siteground-operations-manual.md) — Comprehensive tactical runbook for all SiteGround hosting operations (~550 lines). Covers: 15 Site Tools with paths and gotchas, 32-item pre-flight checklist for new WP installs, 12 failure codes (SG-001→SG-012) with Symptom/Cause/Fix/Prevention/Support Templates, 6 emergency procedures (WSOD, CSS broken, slow, locked out, DB corrupt, update broke site), SiteGround support playbook with ticket templates, Porto and Astra/Spectra integration notes, 3-layer CDN cache model with purge order, PHP config management, SSL/HTTPS management, FTP/SSH access reference, staging operations, 10-item FAQ, and cross-reference index. Triggered by TT909 shop.asi360.co mixed content failure (2026-03-09).

## Skills
- **Front End Designer 2.0 — Astra Pro Spectra Edition** — `/astra-spectra-designer` command at `~/.claude/commands/astra-spectra-designer.md`. 232 lines. Specialized WordPress production skill encoding all transplanting engine knowledge: 6 hard rules, 7-phase pipeline, 5 text extraction patterns, 70-block inventory summary, 8 lint checks, encoding gotchas, anti-patterns table. References the 3 memory docs on-demand instead of duplicating content. Supplements the built-in `anthropic-skills:astra-spectra-workflow` skill.
- **Site Factory Engine 2.0** — `/site-factory` command at `~/.claude/commands/site-factory.md`. Automated file-level site production skill. 4-stage CLI pipeline (scan → match → process → deploy). Covers: YAML client briefs, template catalog queries, image crop/resize with Pillow, WP Media Library upload, REST API content transplant, 5-point validation. Database: 3 Supabase tables (`template_index`, `site_jobs`, `asset_uploads`).
  - **Future skills planned:** Listeo Marketplace + Flavor Edition, Flatsome E-Commerce Edition

## Known Issues & Lessons Learned
- See [bugs-and-lessons.md](bugs-and-lessons.md) for detailed bug reports
- BUG-001: ~~Browser file_upload blocked by CDP~~ **RESOLVED** — Spectra Pro manually uploaded and active (v1.2.9)
- BUG-002: REST API content push overwrites Spectra block styling — workaround: modify text within template pages, don't create full block structures via API
- BUG-003: Gutenberg editor can't parse REST-API-pushed nested Container blocks (shows empty layout selector). Frontend renders correctly. Fix: use Starter Templates for page structure, REST API only for text/image swaps
- WIN-001: 🏆 **Surgical copy transplant validated** — Full page text swap (67/67 blocks preserved) via REST API + Python str.replace(). Frontend styling + Gutenberg editor compatibility both confirmed.
- WIN-002: 🏆 **Checklist items are info-box blocks** — "List items" with checkmark icons are NOT wp:list or uagb/icon-list. They're `uagb/info-box` blocks with `iconimgPosition: "left-title"`, `headingTag: "p"`, empty `tempHeadingDesc`. Same `uagb-ifb-title` CSS class as card titles.
- SOP-001: 📋 **Contact Page Transplant — Full 7-Phase Framework** documented in bugs-and-lessons.md. Canonical SOP for all future page transplants. Includes new discovery: `srfm/form` blocks reference a separate CPT (`sureforms_form`) that needs its own REST API update.
- WIN-003: 🏆 **SOP Framework Validated Across 3 Different Page Layouts** — Contact (34 blocks, forms/maps/social), Services (78 blocks, buttons), About (45 blocks, images). 157 total blocks, 65 replacements, 0 failures. Proves layout-agnostic capability for Site Factory Engine.
- SOP-002: 📋 **Services Page Transplant** — 40 replacements (6 service categories + 18 sub-items + 8 descriptions + 6 buttons + 1 hero + 1 CTA). All electrician content → ASI 360 security.
- SOP-003: 📋 **About Page Transplant** — 7 replacements (hero, story, mission, innovation, metric). New block type: `uagb/image` (3 blocks, no text, pass-through). Apostrophe variant discovery: U+2019 vs U+0027.
- WIN-004: 🏆 **Footer Transplant via Widget REST API** — Footer content lives in WP widgets (not pages/CPTs). Widget API at `/wp-json/wp/v2/widgets/{id}?context=edit` exposes `instance.raw.content`. Same str.replace() SOP works. 5 widgets + site description updated. CDN cache-bust required for validation.
- SOP-004: 📋 **Footer Transplant** — 11 replacements across 5 widgets + WP settings (tagline, 6 services, phone, email, address, site description). Copyright bar preserved.
- SOP-005: 📋 **Home Page Transplant** — 46 replacements across 8 categories. LARGEST page: 126 blocks, 127K chars. Zero-width spaces in titles, context-sensitive "Residential"/"Commercial" handling, pricing transformed ($8-$40 → $79-$499). 2-pass approach: 40/40 first pass + 6 context-sensitive second pass.

## Sandbox WordPress Site
- URL: https://sandbox.asi360.co/asi360/
- WP Username: webdevteam
- Application Password: Z7O2 0wbR Lsqy Vz57 4dSO 28eT
- Admin Password: MontegoB@y1981!876.
- Template: Electrician Company (Premium Starter Templates, blue palette Style 1)
- Astra Pro: Active + Licensed
- Spectra Pro: **Active + v1.2.9** (installed 2026-03-06)
- Spectra Free: Active + v2.19.20
- Total Spectra blocks: 90+ activated (23 server-registered, rest client-side JS)
- POC Page: ID 536, slug `poc-spectra-block-validation` — 7 block types validated

## Content Methodology
- ALL content written via WordPress REST API (`/wp-json/wp/v2/*`)
- NEVER direct MySQL writes — per Astra/Spectra workflow rules
- Auth: Basic auth with Application Password
- Required header: `User-Agent: ASI360-Sentinel/1.0.0 (+https://asi360.co; contact=ops@asi360.co)`

## Key Patterns
- WordPress plugin uploads via browser automation (Claude in Chrome) are BLOCKED by Chrome DevTools Protocol
- ~~Header/Footer changes require Astra Customizer~~ **DISPROVEN** — Footer content is in WP widgets, updatable via `/wp-json/wp/v2/widgets/{id}` PUT with `instance.raw.content`. Use `?context=edit` to get raw block markup. (WIN-004)
- Spectra block namespace: `uagb/*` (e.g., `uagb/container`, `uagb/info-box`)
- Always wrap content in `uagb/container` with `alignfull` for full-width sections
- **Spectra blocks register 2 ways:** 23 blocks via PHP (appear in `/wp/v2/block-types`), 67+ via client-side JS only (NOT in REST API but fully functional)
- **Block Conditions (Display Conditions):** Currently `disabled` in Spectra settings — enable via wp-admin → Spectra → Settings to use per-block visibility rules
- **Info-box block taxonomy:** 3 types — Card (h4, tempHeadingDesc), Heading (h1/h2, tempHeadingDesc), Checklist (p, icon-left, empty tempHeadingDesc)
- **Dual text locations:** Card/Heading info-boxes store text in HTML AND `tempHeadingDesc` JSON attribute. Checklist items store text in HTML only.
- **Block integrity check:** After every transplant, verify `block_tag count` and `block_id count` match original. If counts change, transplant corrupted structure.
- **Python > sed for transplants:** Use Python `str.replace()` — handles special chars, multi-line, no escaping issues. Save payload as JSON file, push via curl (Python 3.13 macOS has SSL issues)
- **Text extraction regex:** Use `<[ph][1-6]? class="uagb-ifb-title">` to catch ALL info-box text (cards AND checklists)
- **Apostrophe variants in templates:** Different pages in the SAME Starter Template may use different apostrophe encodings — U+0027 (straight `'`) vs U+2019 (curly `'`). After first str.replace() pass, always run residual term check. If old terms remain, try the alternate apostrophe.
- **Zero-width spaces (U+200B) in Spectra titles:** Some Starter Template titles contain invisible `\u200B` chars after text (e.g., `Commercial\u200B`). str.replace() won't match unless the ZWS is included. Always check hex of surrounding chars when a replacement fails on visible text.
- **CDN cache-bust for validation:** SiteGround CDN caches page HTML aggressively. After pushing changes to widgets or global elements, validate with `?nocache=timestamp` query parameter.
- **Widget REST API transplant pattern:** `GET /wp-json/wp/v2/widgets/{id}?context=edit` → read `instance.raw.content` → str.replace() → `PUT` with `{"id":"block-XX","instance":{"raw":{"content":"..."}}}`. Same block integrity principles as page transplants.
- **SureForms blocks (`srfm/form`) are SEPARATE entities.** Page block stores `{"id":225}` reference only. Form fields/labels/dropdowns live in `sureforms_form` CPT — update via `PUT /wp-json/wp/v2/sureforms_form/{id}`. Dropdown options in `srfm/dropdown` block as `"options":[{"label":"..."}]` array.
- **Google Map blocks (`uagb/google-map`)** store address in `"address"` JSON attribute — update via str.replace on the address string in raw content.
- **7-Phase Transplant SOP:** (1) Discover page ID, (2) Block census + text extraction, (3) Cross-reference layout to blocks, (4) Build replacement map (KEEP vs REPLACE), (5) Execute str.replace + push, (6) Validate 5-point check, (7) Document. See SOP-001 in bugs-and-lessons.md.

## Mass Production Workflow — Validated 2026-03-06
**Correct approach (proven via POC page 536, full transplant on page 490):**
1. **Import Starter Template** → creates editor-compatible Spectra block structure
2. **Astra Customizer** → global colors, fonts, logo, header/footer branding
3. **REST API surgical copy transplant** → Python str.replace() on raw content (see astra-spectra-reference.md Section 7):
   - Headings (`uagb-heading-text`)
   - Card titles & checklist items (`uagb-ifb-title` — covers BOTH h4 cards AND p checklists)
   - Descriptions (`uagb-ifb-desc`)
   - Button labels (`uagb-button__link`)
   - `tempHeadingDesc` JSON attributes (caught automatically by str.replace)
4. **Block integrity verification** → count block tags + block_ids before and after
5. **QA + Publish** → verify frontend styling AND Gutenberg editor editability

**DO NOT** create full page structures via REST API — blocks render on frontend but editor shows empty containers (BUG-003). Instead, modify text content within template-generated pages.

**Estimated speed:** ~5 min per page programmatic, ~45-60 min per full site (vs 20-40 hours traditional)

### Proven Transplant Record
- **Page 490 (Projects):** 67/67 blocks, 67/67 IDs preserved. All headings, titles, descriptions, 18 checklist items, buttons transplanted. Zero electrician content remains.
- **Page 494 (Contact):** 34/34 blocks, 34/34 IDs preserved. 12 page replacements + 6 form dropdown replacements (separate `sureforms_form` CPT). New block types handled: `srfm/form`, `uagb/google-map`, `uagb/social-share`. Full SOP documented as SOP-001.
- **Page 489 (Services):** 78/78 blocks, 78/78 IDs preserved. 40 replacements — 6 service categories (Emergency→Security Response, Residential→Access Control, Commercial→IP Camera, LED→Alarm, Panel→Cabling, EV→Integration), 18 sub-items, 8 descriptions (×2 HTML+JSON), 6 buttons (×2). SOP-002.
- **Page 488 (About):** 45/45 blocks, 45/45 IDs preserved. 7 replacements — hero, story (Spark Electrical→ASI 360), mission, scope, innovation, metric. 3 `uagb/image` blocks preserved (no text, pass-through). Apostrophe: U+2019 curly quote. SOP-003.
- **Footer (Widgets):** 5 widgets updated via Widget REST API (block-12, block-15, block-18, block-19, block-20). 11 replacements — tagline, 6 services, phone, email, address, site description. SOP-004.
- **Page 487 (Home):** 126/126 blocks, 126/126 IDs preserved. 46 replacements across 8 categories — hero, service grid (6), pricing (6 tiers), trust section (4), projects (5), emergency (5), testimonials (4), CTA (2), context-sensitive fixes (6). 12 images preserved. Zero-width space handling. 2-pass approach. SOP-005.

## ASI 360 Business Identity
- **Full Name:** Allied Systems Integrations 360
- **Short Name:** ASI 360
- **Tagline:** "One Company.. Unlimited Solutions.."
- **Industry:** Security systems integration (access control, cameras, alarms, cabling, consultation)
- **Phone:** (510) 288-0994
- **Email:** ops@asi360.co
- **Hours:** Mon to Fri - 8:00 AM - 6:00 PM
- **Area:** San Francisco Bay Area

## Ticket Systems
- Airtable Bug Tracker: base `appOkZt0CLLBLo2Fr`, table `tblNy9kYWGlz91PSq`
- Vtiger API Gateway: `http://104.248.69.86:3004`
