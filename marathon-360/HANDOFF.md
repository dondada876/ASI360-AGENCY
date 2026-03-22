# Marathon 360° — Session Handoff

## What This Is
Oakland Marathon 2026 was captured in 360° from an 8-foot pole at Empowerment Park, Lake Merritt.
Lead magnet page is LIVE at **https://staging.500grandlive.com/marathon/**
Leads capture to Supabase `marathon_leads` table.

## CURRENT STATUS
- [x] Lead magnet landing page live
- [x] Supabase table `marathon_leads` with RLS (currently disabled for speed)
- [x] Marathon route GeoJSON created and validated
- [x] Mapbox style created: `cmn23aqsr002p01rd5k9gbwf5` (Oakland Marathon 5K Route)
- [x] Official course maps downloaded (PDF + JPG)
- [x] Sphere extraction pipeline tested (ffmpeg)
- [x] Photo Sphere Viewer installed in booking-engine
- [ ] **PENDING: Upload 360° video from USB to droplet**
- [ ] Upload to YouTube for public 360° player embed
- [ ] Extract frames from video for bib number scanning
- [ ] Wire YouTube embed into landing page split hero
- [ ] Add interactive Mapbox route map to landing page
- [ ] Set up Stripe payment for donations
- [ ] Build video-to-frame extraction pipeline for runner identification

## NEXT SESSION: Video Upload from Surface Pro

### Step 1: Transfer USB files to droplet
From Windows terminal (PowerShell or WSL):
```bash
scp D:\path\to\360-videos\*.mp4 root@104.248.69.86:/var/www/500gl-media/360/marathon-2026/
```
Or if using PuTTY/WinSCP:
- Host: 104.248.69.86
- User: root
- Path: /var/www/500gl-media/360/marathon-2026/

### Step 2: Verify upload
```bash
ssh root@104.248.69.86 "ls -lh /var/www/500gl-media/360/marathon-2026/"
```

### Step 3: Extract sphere frames from each video
```bash
ssh root@104.248.69.86 "cd /var/www/500gl-media/360/marathon-2026 && for f in *.mp4; do ffmpeg -y -i \$f -ss 3 -vframes 1 -q:v 2 \${f%.mp4}-sphere.jpg; done"
```

### Step 4: Extract ALL frames for bib scanning (1 frame per second)
```bash
ssh root@104.248.69.86 "cd /var/www/500gl-media/360/marathon-2026 && mkdir -p frames && for f in *.mp4; do ffmpeg -i \$f -vf fps=1 frames/\${f%.mp4}-%04d.jpg; done"
```

### Step 5: Upload to YouTube
- Upload each 360° video to YouTube as unlisted
- YouTube auto-detects 360° metadata from Insta360 files
- Get embed URLs, update landing page

## INFRASTRUCTURE

### Droplet (104.248.69.86)
- Video directory: `/var/www/500gl-media/360/marathon-2026/`
- Landing page: `/var/www/marathon-360/index.html`
- GeoJSON route: `/var/www/marathon-360/oakland-marathon-5k-route.geojson`
- Course maps: `/var/www/marathon-360/oakland-*.{pdf,jpg}`
- Nginx: served via `staging.500grandlive.com/marathon/`
- Disk free: 109 GB

### Supabase (gtfffxwfgcxiiauliynd)
- Table: `marathon_leads`
- Columns: id, name, email, phone, bib_number, donation_amount, event, source, status, race_type, clip_generated, clip_url, photo_360_url, photo_flat_url, stripe_payment_id, created_at
- RLS: currently DISABLED (re-enable after fixing anon insert policy)

### Mapbox (asi360said)
- Style: `cmn23aqsr002p01rd5k9gbwf5` — Oakland Marathon 5K Route
- Existing booking style: `cmmx3trjt001i01r97yv10e7i` — 500GL-Social-Club-Booking

### GitHub
- Branch: `feature/360-immersive-v2` on ASI360-AGENCY repo
- Marathon page code: `marathon-360/` directory
- Booking engine: `booking-engine/` directory

### URLs
- Lead page: https://staging.500grandlive.com/marathon/
- Booking staging: https://staging.500grandlive.com
- Booking production: https://bookit.500grandlive.com

## ASHE SANCTUARY & EMPOWERMENT FOUNDATION
- Donation model: $1-$25 (default $5)
- "Usually $25, discounted through Ashe Foundation"
- 100% of donations to judicial reform
- Empowerment Park is on the marathon route
- Messaging: "You passed Empowerment Park. People who run marathons change the world."

## RELATED PROJECTS
- PROJ384 — Unified Booking Commerce Engine
- Coach Sushi — Revenue Share Platform (TT1017)
- ASI 360 Consulting Division (31x96272)
- Booking UI Overhaul — TT1023 (DoorDash half-sheet overlay)

## VTiger TICKETS
Create these tickets when picking up:
- Video upload and processing
- YouTube 360° channel setup
- Bib number OCR/scanning pipeline
- Stripe integration for donations
- Interactive Mapbox route map on landing page
