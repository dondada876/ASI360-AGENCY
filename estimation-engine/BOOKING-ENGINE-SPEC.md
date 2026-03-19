# 500GL Booking Engine — Architecture Spec
## Session: 2026-03-18

### Live URLs
- **bookit.500grandlive.com** — SSL active, nginx configured, serves /var/www/500gl-booking/
- **projects.asi360.co/estimation/** — DHV Security Hub, proposal, streetview audit

### Known Bugs (16 Tickets)
- BK-001: Markers not on correct grass area (need satellite-verified coords)
- BK-002: Markers don't scale with zoom level
- BK-003: Need grass detection for sunlit open areas (no trees)
- BK-004: Product card click doesn't properly filter map markers
- BK-005: 3D terrain toggle broken
- BK-006: Booking zone polygon mispositioned
- BK-007: Building extrusion toggle broken
- BK-008: Need Mapbox GL Draw for admin zones
- BK-009: Need lat/lng grid overlay
- BK-010: Need draggable markers in admin mode
- BK-011: Need distance measurement tool
- BK-012: Port ASI 360 Site Map control panel
- BK-013: Build Next.js scaffold (extend existing Airtable)
- BK-014: Supabase booking tables with concurrency
- BK-015: Stripe Payment Intents with hold
- BK-016: Amelia WordPress sync
- **NEW: Clicking marker number jumps page left (selectSpot bug)**

### Existing Infrastructure (DON'T REBUILD)
- Airtable `500 Grand Live` (appzvSjPs7r8k3iDU) — 36 tables
  - Event Bookings (tblZJ8mlYl0jjetPx) — has date, time, spaces, rate, payment
  - Rental Equipment Inventory (tblyEih8GCKmUnjKY) — has item, type, price, deposit
  - Lakeside Product Catalog (tblgPT0hpoxioZJzB) — 4 pricing tiers
  - Membership Roster — member verification
  - Billing Exemptions — Free Umbrellas checkbox exists!
  - Parking Sessions — same pattern as booking sessions
- Airtable `Billing & Memberships` (appBXdRi3TJIINEVT) — 8 tables
  - Products & Store — SKU, Stripe Price ID
  - Membership Tiers — tier pricing
- Supabase (gtfffxwfgcxiiauliynd) — asi360-commerce
- Mapbox token: <MAPBOX_PUBLIC_TOKEN_IN_VAULT>
  - Allowed URLs: bookit.500grandlive.com, 360.500grandlive.com, sc.500grandlive.com, www.500grandlive.com
- Mapbox styles: "Empowerment Park — 500GL Delivery" (cmm4wxjih008l01r61gpihb40)

### Correct Grass Location (verified via Mapbox Static API)
- Grass is SOUTH of Grand Ave, between Bellevue Ave and the lake
- Approximate center: 37.8080, -122.2525
- Open sunlit grass (no trees): 37.8078-37.8082, -122.2530 to -122.2515
- Landmarks: Ahn's Quarter Pound Burger (north), Bellevue Ave (west), Lake Merritt path (south)
- Current markers are too far NORTH (on buildings/streets)

### Target Stack
- Next.js 16 + Supabase + Stripe + Mapbox GL JS + GL Draw + Turf.js
- Extend existing Airtable tables (add lat/lng/zone fields)
- Branch: feature/500gl-booking-engine
- Staging: bookit.500grandlive.com

### Files on Droplet (104.248.69.86)
- /var/www/500gl-booking/index.html — current prototype
- /var/www/estimation-engine/ — DHV security hub + proposal + audit
- /etc/nginx/sites-enabled/500gl-booking — nginx config with SSL

### OpenTopography / LiDAR
- API Key in vault: opentopography_api_key (218b87...)
- 5 datasets cover Lake Merritt (best: CA AlamedaCo 2 2021, QL2)
- 10m DEM downloaded: /tmp/lake-merritt-dem-10m.tif
