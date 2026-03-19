# 500GL Booking Engine — Handoff Document
## Project: bookit.500grandlive.com
## Created: 2026-03-19
## Status: Ready for Build Sprint

---

## HARD RULES

1. **USE MAPBOX MCP SERVER** for ALL map operations — tilequery, style_builder, geojson_preview, validate_style, create_style. Do NOT hand-code coordinates.
2. **EXTEND existing Airtable tables** — do NOT create new booking tables from scratch. The schema already exists.
3. **Git-first** — `feature/500gl-booking-engine` branch. Never touch production.
4. **Supabase Vault** for secrets. Only `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` in .env.

---

## PROJECT TRACKING

### Airtable
- **Base**: ASI360-Operations-Engine (`appT0pH3nPdPOCwUQ`)
- **Table**: 500GL Booking Engine (`tblcgNdnsvAeRSKIT`)
- **17 tickets** logged (BK-001 through BK-017)
- Fields: Ticket ID, Title, Priority, Status, Category, Description, MCP Tools Required, Sprint, Est Tokens

### Supabase
- **Project**: asi360-commerce (`gtfffxwfgcxiiauliynd`)
- **Tables created**:
  - `gl_booking_zones` — admin-defined booking areas (GeoJSON polygons)
  - `gl_booking_spots` — individual bookable spots with lat/lng
  - `gl_booking_slots` — time slots per spot per day (race-condition safe with UNIQUE constraint)
  - `gl_booking_orders` — booking orders with Stripe payment tracking
- RLS enabled, indexes created, policies set

---

## EXISTING INFRASTRUCTURE (DO NOT REBUILD)

### Airtable: `500 Grand Live` (`appzvSjPs7r8k3iDU`) — 36 tables

| Table | ID | Reuse For |
|---|---|---|
| Event Bookings | `tblZJ8mlYl0jjetPx` | **Booking records** — has date, time, spaces, rate, payment status |
| Rental Equipment Inventory | `tblyEih8GCKmUnjKY` | **Umbrella/tent inventory** — has item, type, price, deposit, availability |
| Lakeside Product Catalog | `tblgPT0hpoxioZJzB` | **Pricing engine** — 4 tiers with margins, seasonality, delivery eligible |
| Membership Roster | `tblQER6igZaevmFj6` | **Member discount verification** — Stripe Customer ID, VIP status |
| Billing Exemptions | `tblxOVlPOrxIhL5j1` | **Free Umbrellas checkbox already exists!** |
| Parking Sessions | `tblRkIjnMiWj5NOzE` | **Same pattern** — session ID, stall, check-in/out, payment |
| Parking Customers | `tblomDxqLISlKYXNk` | **Customer lookup** — phone, email, visit count, Stripe link |

### Airtable: `Billing & Memberships` (`appBXdRi3TJIINEVT`) — 8 tables

| Table | ID | Reuse For |
|---|---|---|
| Products & Store | `tblLAzklzKVexSCpE` | SKU, retail/member price, Stripe Price ID |
| Membership Tiers | `tblShvGkYclLqqvhw` | Tier pricing (Base, Enhanced) |
| Billing Seasons | `tblQl3ebthvd80Lcc` | Seasonal pricing |

### Fields to ADD to Existing Tables

**Rental Equipment Inventory** — add:
- `lat` (number) — GPS latitude
- `lng` (number) — GPS longitude
- `zone_id` (text) — links to gl_booking_zones
- `spot_type` (single select) — umbrella/tent/vip
- `mapbox_marker_id` (text) — for map sync

**Event Bookings** — add:
- `spot_id` (text) — links to gl_booking_spots
- `stripe_session_id` (text) — Stripe Checkout session
- `booking_source` (single select) — website/amelia/walkin/phone

---

## MAPBOX CONFIGURATION

### Account
- **Username**: asi360said
- **Public Token**: `<MAPBOX_PUBLIC_TOKEN_IN_VAULT>`
- **Allowed URLs**: bookit.500grandlive.com, www.bookit.500grandlive.com, 360.500grandlive.com, sc.500grandlive.com, www.500grandlive.com

### Existing Styles
- `cmmvrx1ne000s01sv5v127yjc` — "ASI 360 — Security Site Assessment" (satellite + terrain + streets)
- `cmm4wxjih008l01r61gpihb40` — "Empowerment Park — 500GL Delivery" (has grass/park layer highlighting!)

### MCP Tools to Use
| Tool | Purpose |
|---|---|
| `mapbox_tilequery` | Query terrain elevation, building data, land use at coordinates |
| `mapbox_style_builder` | Generate custom style with grass highlighting, booking zones |
| `mapbox_create_style` | Create "500GL Booking" style with satellite + zones |
| `mapbox_geojson_preview` | Visualize spot positions before deploying |
| `mapbox_validate_style` | Validate style JSON before applying |
| `mapbox_retrieve_style` | Get the existing Empowerment Park style (has grass layer!) |
| `mapbox_bounding_box` | Calculate bounding box for the booking zone |
| `mapbox_coordinate_conversion` | Convert between coordinate systems |

### Correct Location (Satellite-Verified)
- **Park**: Empowerment Park, between Bellevue Ave and Lake Merritt
- **Open sunlit grass**: ~37.8078-37.8082, -122.2530 to -122.2515
- **Landmarks**: Ahn's Quarter Pound Burger (N), Bellevue Ave (W), Lake path (S)
- **DO NOT place markers on**: buildings, trees, streets, lake
- **Use satellite imagery to verify**: look for human-sized dots on grass as scale reference

---

## TICKETS (Priority Order)

### Sprint 1 — Foundation (P0/P1)
| ID | Title | Category | MCP Tools |
|---|---|---|---|
| BK-001 | Fix marker positions on sunlit grass | Map/Geo | mapbox_tilequery, mapbox_geojson_preview |
| BK-002 | Zoom-responsive marker sizing | Map/Geo | Mapbox symbol-size interpolation |
| BK-003 | Grass detection for open sunlit areas | Map/Geo | mapbox_tilequery (landuse layer) |
| BK-017 | Fix selectSpot() page jump bug | Bug Fix | Frontend debug |

### Sprint 2 — Map Engine (P1)
| ID | Title | Category | MCP Tools |
|---|---|---|---|
| BK-008 | Mapbox GL Draw for admin zones | Map/Geo | mapbox_create_style |
| BK-009 | Lat/lng grid overlay | Map/Geo | Turf.js |
| BK-010 | Draggable markers in admin mode | Map/Geo | Mapbox draggable markers API |
| BK-011 | Distance measurement tool | Map/Geo | Turf.js distance |
| BK-012 | Port ASI 360 Site Map control panel | Frontend | — |
| BK-005 | Fix 3D terrain toggle | Bug Fix | mapbox_validate_style |
| BK-006 | Fix booking zone polygon | Bug Fix | mapbox_geojson_preview |
| BK-007 | Fix building extrusion toggle | Bug Fix | mapbox_validate_style |

### Sprint 3 — Booking Flow (P1)
| ID | Title | Category | MCP Tools |
|---|---|---|---|
| BK-004 | Product card → map marker filtering | Frontend | — |
| BK-013 | Next.js app scaffold | Frontend | — |
| BK-014 | Supabase booking tables (concurrency) | Backend | Supabase MCP |
| BK-015 | Stripe Payment Intents + hold | Payments | — |

### Sprint 4 — Integrations (P2)
| ID | Title | Category | MCP Tools |
|---|---|---|---|
| BK-016 | Amelia WordPress webhook sync | Integration | — |

---

## DEPLOYMENT

### Current (Prototype)
- **URL**: https://bookit.500grandlive.com
- **SSL**: Let's Encrypt (auto-renew)
- **Nginx**: /etc/nginx/sites-enabled/500gl-booking
- **Files**: /var/www/500gl-booking/index.html
- **Port**: 80/443 (nginx) + 3205 (direct)

### Target (Production)
- **Framework**: Next.js 16 (React)
- **Hosting**: Droplet (104.248.69.86) or Vercel
- **Branch**: feature/500gl-booking-engine
- **Local dev**: ~/Projects/500GL/booking-engine/
- **Supabase**: gl_booking_* tables (already created)
- **Stripe**: Use existing Products & Store Stripe Price IDs

---

## OPEN SOURCE REFERENCES

| Template | URL | Use For |
|---|---|---|
| Restaurant Reservation | github.com/msabeeh01/Restaurant-Reservation-System | Double-booking prevention pattern |
| Vercel SaaS Starter | vercel.com/templates/next.js/stripe-supabase-saas-starter-kit | Auth + Stripe scaffold |
| Hotel Booking | github.com/OthmaneNissoukin/nextjs-hotel-booking | Date range + availability |

---

## GOVERNMENT DATA AVAILABLE

| Source | Dataset | Use |
|---|---|---|
| USGS 3DEP | CA AlamedaCo 2 2021 (QL2) | LiDAR point cloud — tree canopy vs grass |
| OpenTopography | API key in vault (`opentopography_api_key`) | DEM downloads |
| Oakland Open Data | oakland-oakgis.opendata.arcgis.com | Park boundaries, building footprints |
| Alameda County GIS | data.acgov.org | Parcel data |
| Mapbox Terrain | mapbox.mapbox-terrain-dem-v1 | Elevation (built-in) |

---

## AMELIA WORDPRESS INTEGRATION

- **Webhooks**: Available on Standard/Pro/Elite plans (one-way: Amelia → external)
- **REST API**: Elite plan only (bidirectional)
- **WordPress Hooks**: `amelia_booking_added`, `amelia_booking_canceled`, etc.
- **Strategy**: Amelia webhook on booking → POST to Supabase edge function → update gl_booking_orders

---

*This document is the single source of truth for the 500GL Booking Engine build. Start a new Claude Code session, read this file first, then begin Sprint 1.*

---

## CRITICAL UPDATE: Exact Location + Sun Zones (from Google Maps)

### Empowerment Park Center
- **Google Maps verified**: 37.8077557, -122.2525083
- **Google Maps URL**: https://www.google.com/maps/place/Empowerment+Park/@37.8080465,-122.2525687,251m
- **Zoom**: 251m view (very close)

### Two Sun Zones (Split by Pergola)

```
                    NORTH
                      |
        ┌─────────────┴─────────────┐
        │                           │
  WEST  │    ZONE A: PARK SIDE     │  EAST
        │    NE of Pergola          │
        │    Sunset: ~6 PM          │
        │    (earlier sunset —      │
        │     buildings block sun)  │
        │                           │
        │ ═══ PERGOLA STRUCTURE ═══ │
        │                           │
        │    ZONE B: LAKESHORE SIDE│
        │    East/SE of Pergola     │
        │    Sunset: ~8 PM          │
        │    (+2 hours more sun!)   │
        │    Near the church        │
        │    Prime umbrella spots   │
        │                           │
        └─────────────┬─────────────┘
                      |
                LAKE MERRITT
```

### Pricing Implications
- **Zone B (Lakeshore/Church side)** = PREMIUM pricing (+$5-10) — 2 extra hours of sun
- **Zone A (Park side)** = STANDARD pricing — earlier sunset
- **Sunset slot (4-7 PM)** only makes sense in Zone B

### What the MCP Server Should Do
1. `mapbox_tilequery` at 37.8077557, -122.2525083 to get land use classification
2. Query the pergola structure location (it's a building/structure in OSM data)
3. Calculate sun angle at 6 PM and 8 PM to verify the shadow line
4. Place Zone A markers NE of pergola, Zone B markers SE toward lakeshore
5. Both zones should be on GRASS (class: "grass" or "park" in Mapbox streets)
6. The ENTIRE grass area NE of the park + beyond the pergola toward lakeshore = bookable

### For the Next Session
- Use `mapbox_tilequery` with tileset `mapbox.mapbox-streets-v8` at 37.8077557, -122.2525083, radius 200m
- Filter for `class: "grass"` or `class: "park"` features
- These polygons define the exact bookable grass boundary — no hand-drawing needed
- The pergola splits the two pricing zones
