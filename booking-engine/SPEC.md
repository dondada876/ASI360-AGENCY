# 500GL Booking Engine — Technical Specification

## Project Overview

**Product:** The Umbrella Project at Lake Merritt — Lakeside Booking Engine
**Domain:** bookit.500grandlive.com
**Stack:** Next.js 16 + React 19 + Mapbox GL JS 3.20 + Supabase + Stripe
**Entity:** 500 Grand Live Social Club × ASHE Sanctuary & Empowerment Foundation

### Mission
Conscious capitalism — every umbrella booked funds judicial reform advocacy.
**"Prosecution of Perjury Prevents Perjury"** — The Four Ps.
**Athena, Guardian of Innocence** — AI voice concierge powered by ElevenLabs.

### HARD RULE: Modular Multi-Location Design

**Every component, table, API route, and config MUST support multiple locations.**
No hardcoded Lake Merritt coordinates, zone IDs, or pricing outside of a location config.

```
Phase 1: Empowerment Park (Zones A1-A2, B1-B5)     ← CURRENT FOCUS
Phase 2: Golden Sunset Strip (Zones C1-C4)
Phase 3: Full Lake Merritt (180 poles, A-Z zones)
Phase 4: Oakland Parks Network (multiple parks)
Phase 5: Multi-city (franchise model)
Phase 6: White-label platform (any operator, any park)
```

**Implementation pattern:**
- `locations` table in Supabase — each location has its own Mapbox tileset, timezone, pricing
- `zones` table FK → `locations` — zones belong to a location
- `light_poles` table FK → `zones` — poles belong to a zone
- URL routing: `bookit.500grandlive.com/[location-slug]`
- All coordinates, tileset IDs, pricing loaded from DB at runtime, not hardcoded
- Same Docker container serves ALL locations — just different data

**Current state:** Config is in `lib/zones.ts` and `lib/pricing.ts` (hardcoded for Phase 1).
When TT-992 executes, these move to Supabase. Until then, the structure supports it.

---

## Architecture

```
┌─── Customer Interfaces ──────────────────────────┐
│  Web (bookit.500grandlive.com)                    │
│  Phone IVR (+1 510-288-0994 → ElevenLabs AI)     │
│  QR Code (LP-001 through LP-180 light poles)      │
│  SMS ("UMBRELLA" to book)                         │
└──────────────────┬────────────────────────────────┘
                   ↓
┌─── Application Layer ────────────────────────────┐
│  Next.js 16 (Docker container, port 3206)         │
│  Cloudflare CDN (free tier, caches static assets) │
│  Nginx reverse proxy + SSL                        │
└──────────────────┬────────────────────────────────┘
                   ↓
┌─── Data Layer ───────────────────────────────────┐
│  Supabase Pro (gtfffxwfgcxiiauliynd)              │
│  ├── bookings table (source of truth)             │
│  ├── zones table (zone config, pricing)           │
│  ├── light_poles table (180 poles, GPS, QR)       │
│  ├── members table (codes, discounts, points)     │
│  ├── video_360 table (hotspots, yaw/pitch/zoom)   │
│  └── Storage bucket (360° videos, audio clips)    │
│                                                    │
│  Stripe (payments, webhooks)                      │
│  Mapbox (tiles, tileset, dataset)                 │
│  WooCommerce (order sync, customer profiles)      │
│  Airtable appzvSjPs7r8k3iDU (ops dashboard)      │
└──────────────────────────────────────────────────┘
```

### Overflow Strategy
```
Normal → Droplet container (300+ bookings/hr)
Viral  → VAST.AI spins identical container ($100 credits)
         Cloudflare load balances between both
```

---

## Current State (MVP v0.1.0)

### What Works
- [x] Satellite map with 11 booking zones from Mapbox tileset
- [x] Zone hover tooltips + click-to-select
- [x] 5-step booking wizard (tier → date/time → add-ons → food → checkout)
- [x] 360° immersive video viewer (Photo Sphere Viewer)
- [x] Two 360° hotspots on map (park view + tents view)
- [x] Auto-rotate + 3D terrain toggles
- [x] Premium glassmorphism UI with gold palette
- [x] Standalone Next.js build deployed on droplet
- [x] SSL + nginx proxy on bookit.500grandlive.com
- [x] systemd service running

### What's Missing (Production Gaps)

| Category | Score | Critical Items |
|----------|-------|---------------|
| Payment | 0/10 | No Stripe integration — "Confirm Booking" does nothing |
| Auth | 0/10 | No user login, member codes unverified |
| Database | 0/10 | No Supabase tables, no booking persistence |
| Mobile UX | 4/10 | Responsive but not mobile-first, no bottom sheet |
| Error Handling | 2/10 | No try-catch, no error boundaries, no fallbacks |
| Security | 2/10 | Exposed token, no auth, no rate limiting |
| Testing | 0/10 | No unit or E2E tests |
| Accessibility | 2/10 | No ARIA labels, no keyboard nav |
| Monitoring | 0/10 | No error tracking, no analytics |
| IVR Integration | 0/10 | Phone booking not connected to same database |

---

## Zone Architecture

### Naming Convention (Revised)
```
Section A — Empowerment Park (Pergola area, Grand Ave side)
  A1: Pergola West
  A2: Pergola East

Section B — Main Lakefront (wide grass, partial sun)
  B1: Lakefront North
  B2: Lakefront Central
  B3: Lakeview Terrace
  B4: Church Lawn
  B5: Grand Avenue Strip (absorbed from old Zone C)

Section C — Golden Sunset Strip (Lakeshore curve, extra 2hr sun)
  C1: Lakeshore Curve Start   🌅
  C2: Bellevue Meadow          🌅
  C3: Willow Grove              🌅
  C4: South Point               🌅
```

### Sunset Physics
- A/B zones: 10-15ft elevation, Grand Ave buildings cast shadows by 5-6pm
- C zones: 3-4ft below street level, 6-8ft lower than A/B, sun visible until 7-8pm
- Sun sets over distant western hills, not blocked by buildings at C elevation

### Light Pole System
- **180 poles** around the lake, spaced ~50ft apart
- **Naming:** LP-001 through LP-180, clockwise from pergola
- **Pergola = finish line:** LP-176 through LP-180 are at the pergola
- **LP-001** starts just past the pergola going clockwise
- Each pole gets: GPS, city plaque #, zone assignment, QR code, condition rating
- Poles are the **delivery addressing system** — permanent, zone-independent
- QR route: `bookit.500grandlive.com/qr/LP-047`

### Current Pole Mapping (10 mapped, 170 remaining)
| Current | New | Position |
|---------|-----|----------|
| P3 | LP-001 | First pole clockwise past pergola |
| P6 | LP-002 | Second pole clockwise |
| P7 | LP-003 | Third |
| P9 | LP-004 | Fourth |
| P10 | LP-005 | Fifth |
| P2 | LP-176 | Approaching pergola |
| P5 | LP-177 | Almost at pergola |
| P8 | LP-178 | Pergola area |
| P4 | LP-179 | Pergola area |
| P1 | LP-180 | Last pole — loop complete |

---

## Pricing

### Tiers
| Tier | Morning (8a-12p) | Afternoon (12p-5p) | Sunset (5p-8p) | Full Day |
|------|------|------|------|------|
| ☂️ Umbrella | $15 | $20 | $25 | $45 |
| ⛺ Canopy Tent | $35 | $45 | $55 | $85 |
| 👑 VIP Package | $55 | $65 | $75 | $120 |

### Add-Ons
| Item | Price |
|------|-------|
| Cooler with ice | $10 |
| Bluetooth speaker | $5 |
| Beach towels (×2) | $8 |
| Picnic basket | $25 |
| Charcuterie board | $35 |
| Sunscreen kit | $8 |
| Phone charger | $5 |
| Meditation cushion | $12 |

### Member Discount: 20% (code prefix: 500GL, min 7 chars)

### Restaurant Partners
- Coach Sushi (coachsushi.500grandlive.com)
- Comal Next Door
- Ahn's Quarter Pound Burger
- Avevista
- House of Curries

---

## Supabase Schema (Planned)

### bookings
```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code TEXT UNIQUE NOT NULL, -- BK-20260319-001
  zone_id TEXT NOT NULL,             -- A1, B3, C2
  tier TEXT NOT NULL,                -- umbrella, canopy, vip
  time_slot TEXT NOT NULL,           -- morning, afternoon, sunset, fullday
  booking_date DATE NOT NULL,
  pole_id TEXT,                      -- LP-047 (nearest pole for delivery)
  pin_lat NUMERIC,                   -- exact spot latitude
  pin_lng NUMERIC,                   -- exact spot longitude
  customer_name TEXT,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  member_code TEXT,
  add_ons JSONB DEFAULT '[]',        -- [{id, name, price}]
  food_orders JSONB DEFAULT '[]',    -- [{restaurant, items, total}]
  subtotal NUMERIC NOT NULL,
  discount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',     -- pending, paid, confirmed, active, completed, cancelled
  payment_id TEXT,                   -- Stripe session ID
  source TEXT DEFAULT 'web',         -- web, ivr, qr, sms
  woocommerce_order_id TEXT,         -- synced WooCommerce order
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_bookings_zone ON bookings(zone_id);
CREATE INDEX idx_bookings_status ON bookings(status);
```

### zones
```sql
CREATE TABLE zones (
  id TEXT PRIMARY KEY,               -- A1, B3, C2
  name TEXT NOT NULL,
  section TEXT NOT NULL,             -- A, B, C
  sunset_quality TEXT,               -- golden, partial, shaded
  elevation_ft NUMERIC,              -- relative to street level
  delivery_time_min INTEGER,
  delivery_time_max INTEGER,
  grass_type TEXT,                   -- wide, compact
  capacity INTEGER,                  -- max simultaneous bookings
  active BOOLEAN DEFAULT true,
  centroid_lat NUMERIC,
  centroid_lng NUMERIC
);
```

### light_poles
```sql
CREATE TABLE light_poles (
  id TEXT PRIMARY KEY,               -- LP-001 through LP-180
  city_plaque_number TEXT,
  zone_id TEXT REFERENCES zones(id),
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  condition TEXT DEFAULT 'unknown',  -- good, repair, replace, light_out
  has_360_video BOOLEAN DEFAULT false,
  video_url TEXT,
  start_yaw NUMERIC DEFAULT 0,
  start_pitch NUMERIC DEFAULT 0,
  start_zoom NUMERIC DEFAULT 40,
  has_qr_sign BOOLEAN DEFAULT false,
  installed_date DATE,
  last_inspected DATE,
  notes TEXT
);
```

### video_360_hotspots
```sql
CREATE TABLE video_360_hotspots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  zone_id TEXT REFERENCES zones(id),
  pole_id TEXT REFERENCES light_poles(id),
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  video_url TEXT NOT NULL,
  title TEXT,
  subtitle TEXT,
  start_yaw NUMERIC DEFAULT 0,
  start_pitch NUMERIC DEFAULT -3,
  start_zoom NUMERIC DEFAULT 40,
  active BOOLEAN DEFAULT true
);
```

### members
```sql
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_code TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  discount_pct NUMERIC DEFAULT 20,
  points INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Mapbox Configuration

### Accounts & Assets
| Asset | ID |
|-------|-----|
| Username | asi360said |
| Style | cmmx3trjt001i01r97yv10e7i (500GL-Social-Club-Booking) |
| Tileset | asi360said.cmmx2qu5g0leg1olhtkj83bs5-03u9l |
| Dataset | cmmx2qu5g0leg1olhtkj83bs5 |
| Source Layer | 500GL-Social-Club |
| Public Token | pk.eyJ1IjoiYXNpMzYwc2FpZCIsImEiOiJjbW00OTk4ZHYwOHZ1MnhxMzdlN3RoYmJjIn0... |

### Map Defaults
- Center: [-122.2509, 37.8073]
- Zoom: 17.5, Min: 14, Max: 20
- Pitch: 45°, Bearing: -30°
- Projection: mercator (satellite)
- Terrain: mapbox-dem, exaggeration 1.2

---

## IVR Integration (Planned)

### Phone: +1 (510) 288-0994
### Flow: Twilio → N8N webhook → ElevenLabs AI → Supabase

### Menu Structure (Aligned to Zones)
```
Welcome to 500 Grand Live at Lake Merritt!

Press 1 — PARKING
Press 2 — LAKESIDE BOOKING (The Umbrella Project)
  → Zone A (Empowerment Park, pergola)
  → Zone B (Main Lakefront)
  → Zone C (Golden Sunset Strip)
  → Tier selection → Time slot → Confirmation
Press 3 — FOOD ORDERING
Press 4 — MEMBERSHIP
```

### N8N Workflows
- 9awIlITBacAv22Du — 500GL Incoming Voice Handler
- RuJHnXjWP8QLXULz — 500GL Parking Confirmation Sender

---

## Deployment

### Current (v0.1.0)
```
Droplet: 104.248.69.86
Path: /var/www/500gl-booking-next/
Service: 500gl-booking.service (systemd)
Port: 3206
Nginx: proxy to 127.0.0.1:3206
SSL: Let's Encrypt (bookit.500grandlive.com)
```

### Target (v1.0.0)
```
Docker container on same droplet
Cloudflare CDN in front
VAST.AI overflow trigger ($100 credits)
GitHub Container Registry for image storage
```

### Docker Configuration
See: Dockerfile, docker-compose.yml in repo root

---

## Roadmap

### Phase 1 — Mobile-First Rebuild (MVP → v0.2.0)
- [ ] Bottom sheet booking flow (native mobile UX pattern)
- [ ] Mobile-first responsive layout
- [ ] Touch-friendly map controls
- [ ] Audio welcome modal (ElevenLabs, 30-second mission statement)
- [ ] Phone number CTA in header
- [ ] Share buttons (Web Share API)
- [ ] Zone rename (A1-A2, B1-B5, C1-C4)
- [ ] Pole rename (LP-001 through LP-180)

### Phase 2 — Backend Integration (v0.3.0)
- [ ] Supabase tables (bookings, zones, light_poles, members)
- [ ] Booking persistence (form → Supabase INSERT)
- [ ] Member code server-side verification
- [ ] Stripe Checkout integration
- [ ] Stripe webhook for payment confirmation
- [ ] Booking confirmation SMS (Twilio)
- [ ] Booking confirmation email (Resend)

### Phase 3 — Immersive Experience (v0.4.0)
- [ ] Camera system (context-sensitive presets)
- [ ] Pin drop for exact spot placement (Turf.js)
- [ ] Zone popups with sunset/delivery/amenity info
- [ ] Infrastructure icons (red restrooms, blue handwash)
- [ ] Tiny Planet hover preview for 360° markers
- [ ] Little Planet → panorama opening transition
- [ ] Weather integration (14-day forecast, sunrise/sunset per zone)
- [ ] Sun position visualization (map.setLight per time slot)

### Phase 4 — Multi-Channel (v0.5.0)
- [ ] QR landing pages (/qr/LP-001 through /qr/LP-180)
- [ ] Persona routes (/sunset, /zen, /party, /arrive)
- [ ] IVR update (ElevenLabs agent prompt + N8N workflow)
- [ ] WooCommerce order sync (Edge Function)
- [ ] Airtable ops sync (daily booking summary)
- [ ] SMS booking ("Text UMBRELLA to...")

### Phase 5 — Admin & Scale (v0.6.0)
- [ ] Admin panel (/admin/360, /admin/zones, /admin/bookings)
- [ ] 360° hotspot management (upload, set view angle, assign to zone)
- [ ] Pricing management UI
- [ ] Docker containerization
- [ ] Cloudflare CDN setup
- [ ] VAST.AI overflow trigger
- [ ] Pole walk inventory system (upload from phone)
- [ ] Real-time availability dashboard

### Phase 6 — Hardening (v1.0.0)
- [ ] Error boundaries + fallback UI
- [ ] Sentry error tracking
- [ ] Analytics (Plausible or Mixpanel)
- [ ] Rate limiting
- [ ] Input validation (Zod schemas)
- [ ] Accessibility audit (ARIA, keyboard nav, screen reader)
- [ ] Unit tests (Vitest)
- [ ] E2E tests (Playwright)
- [ ] Load testing (k6 or Artillery)
- [ ] Security audit (OWASP top 10)

---

## Revenue Projections

| Scenario | Rentals/mo | Avg Order | Monthly | Annual |
|----------|-----------|-----------|---------|--------|
| Slow start | 100 | $35 | $3,500 | $42K |
| Steady | 300 | $45 | $13,500 | $162K |
| Peak summer | 600 | $55 | $33,000 | $396K |
| Viral | 1,000 | $65 | $65,000 | $780K |

Additional revenue: 15-20% delivery commission on restaurant food orders.

---

## External Service Dependencies

| Service | Tier | Monthly Cost | Purpose |
|---------|------|-------------|---------|
| Supabase | Pro | $25 × 2 DBs | Database, auth, storage, edge functions |
| DigitalOcean | Droplet | ~$48 | Application hosting |
| Stripe | Pay-as-you-go | 2.9% + $0.30/txn | Payment processing |
| Mapbox | Free tier | $0 (200K tiles) | Map rendering, tileset hosting |
| Twilio | Pay-as-you-go | ~$20-50 | SMS, voice, IVR |
| ElevenLabs | Pro | ~$22 | AI voice agent, audio generation |
| Cloudflare | Free | $0 | CDN, DDoS protection, caching |
| VAST.AI | Credits | $100 prepaid | Overflow compute |
| SiteGround | Existing | Included | WordPress (500grandlive.com) |
| GitHub | Free | $0 | Source code, container registry |

**Total infrastructure: ~$165-195/month** (already paying for most of it)

---

*Last updated: 2026-03-19*
*Branch: feature/booking-engine*
*Repo: github.com/dondada876/ASI360-AGENCY*
