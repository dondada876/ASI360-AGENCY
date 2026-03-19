# 500GL Booking Engine — Issue Tickets

Generated from Playwright audit on 2026-03-19.

---

## BK-001: Map stuck at Bay Area zoom after intro (CRITICAL)

**Status:** Open
**Priority:** P1
**Screenshots:** Desktop shows Bay Area satellite view (zoom ~10), not Lake Merritt (zoom 17.5)

**Problem:** The `fly-orbit` intro sequence flies to Oakland but the `flyTo` animation doesn't complete to zoom 17.5. The `moveend` event may not fire reliably with globe projection transitions. On desktop, the map settles at the Bay Area level showing SF, Oakland, Alameda — not the park.

**Root Cause:** The `runDescent()` function in `intro.ts` switches from globe to mercator projection AND fires a `flyTo` simultaneously. The projection change may cancel or interfere with the flyTo animation. Also, `map.once('moveend')` may resolve prematurely during the projection switch.

**Fix:**
- Add a fallback timeout in `runDescent()`: if `moveend` doesn't fire within 5 seconds, resolve anyway
- After intro completes, always do a final `map.flyTo()` to the Lake Merritt center at zoom 17.5 as a safety net
- Separate the projection change from the flyTo — change projection first, wait 500ms, then flyTo

**Affected:** All users on visits 2-5 (fly-orbit intro)

---

## BK-002: Mobile — Map blank/dark, no satellite tiles loading (CRITICAL)

**Status:** Open
**Priority:** P1
**Screenshots:** Mobile (375x812) shows header + weather badge + Athena button but entire map area is dark/blank

**Problem:** On mobile in Playwright, the Mapbox satellite tiles don't render. This could be:
1. WebGL not available in headless browser (Playwright limitation, not real-device issue)
2. Globe projection failing on mobile
3. The intro animation preventing tile loading

**Investigation Needed:**
- Test on real mobile device to confirm if this is a Playwright-only issue
- Check if `projection: 'globe'` works on mobile Safari/Chrome
- Add a loading timeout — if tiles don't load within 10s, fall back to instant view

**Affected:** Mobile users (95% of target audience)

---

## BK-003: Athena button overlaps Mapbox nav controls (HIGH)

**Status:** Open
**Priority:** P2
**Screenshots:** Athena button (bottom-right) sits on top of Mapbox zoom +/- and compass controls

**Problem:** Both Athena (`fixed right-4 bottom-24`) and Mapbox NavigationControl (`bottom-right`) occupy the same bottom-right corner. The Athena "ATHENA" label and the compass control overlap.

**Fix:**
- Move Athena button higher: `bottom-40` instead of `bottom-24` (160px from bottom)
- OR move Mapbox nav controls to `top-right` position
- OR offset Athena to the left of nav controls
- Best: Move Athena to `right-4 bottom-44` and ensure legend (bottom-left) doesn't conflict

---

## BK-004: Legend and Athena overlap on mobile (HIGH)

**Status:** Open
**Priority:** P2

**Problem:** On 375px mobile width:
- Legend panel (bottom-left, 200px wide) + Athena button (bottom-right, 56px) leave only ~119px between them
- When legend is expanded, it takes up over half the screen width
- Athena tooltip (200px) can overlap with the legend

**Fix:**
- On mobile, legend should be a bottom sheet (full width, slides up from bottom)
- OR limit legend width to 160px on mobile
- Athena tooltip should appear ABOVE the button, not to the left
- Add `@media (max-width: 640px)` responsive adjustments

---

## BK-005: Weather badge shows fallback data, not live (MEDIUM)

**Status:** Open
**Priority:** P3
**Screenshots:** Shows "72°F Partly Cloudy" (hardcoded fallback), not real weather

**Problem:** The Weather Jockey last synced on 2026-03-17. The `/api/weather` route queries `wj_daily_weather` but the data is 2 days stale. The fallback kicks in correctly, but users see inaccurate weather.

**Fix:**
- Verify Weather Jockey cron is running: `systemctl status wj-sync.service`
- If WJ is down, restart it
- Add a "Last updated" timestamp to the weather badge so users know data freshness
- Add a visual indicator (amber dot) when data is >24hrs stale
- Consider adding a direct OpenWeather API call as a secondary fallback in the `/api/weather` route

**Affected:** All users see stale/fallback weather data

---

## BK-006: Camera angle buttons don't highlight active state (LOW)

**Status:** Open
**Priority:** P4

**Problem:** The camera angle buttons (Top, 30°, 45°, 70°) use `map.current?.getPitch()` to determine active state, but this is read during render — it doesn't update reactively as the user drags the map. The highlight only updates when another state change triggers a re-render.

**Fix:**
- Add a `pitch` state variable that updates on `map.on('pitchend')` event
- Use that state to determine which camera button is highlighted
- Or simply add an `activePitch` state that's set explicitly when a button is clicked

---

## BK-007: No loading/error state for map initialization (MEDIUM)

**Status:** Open
**Priority:** P3

**Problem:** If Mapbox token is invalid, network fails, or WebGL is unavailable, the map area is just blank dark. No error message, no retry button, no fallback.

**Fix:**
- Add `map.on('error')` handler
- Show a user-friendly error overlay: "Map couldn't load. Please check your connection and refresh."
- Add a "Retry" button
- Log errors to Supabase `edge_errors` table for monitoring

---

## BK-008: Intro sequence runs on every page load in dev (LOW)

**Status:** Open
**Priority:** P4

**Problem:** During development, hot-reload clears component state but NOT localStorage. So the visit count increments but the intro still runs because the component remounts. This makes dev testing inconsistent.

**Fix:**
- Add a dev-only "Skip Intro" button
- Or check `process.env.NODE_ENV === 'development'` and default to 'instant'
- Add a URL param override: `?intro=globe-full` or `?intro=skip`

---

## BK-009: ElevenLabs voice not yet integrated in Athena (PLANNED)

**Status:** Planned
**Priority:** P2

**Problem:** The "Speak with Athena" button in the Athena modal is a placeholder. No `@elevenlabs/react` package installed, no agent ID configured, no voice session management.

**Implementation:**
1. `npm install @elevenlabs/react`
2. Create `/api/voice-token` route that fetches signed URL from ElevenLabs using API key from Supabase Vault
3. Wire `useConversation` hook into AthenaButton component
4. Configure client tools: `bookTimeSlot`, `getWeather`, `findBestZone`
5. Add voice activity indicator (pulsing ring when Athena is speaking)
6. Test on mobile (microphone permissions)

---

## BK-010: No automated tests (DEBT)

**Status:** Open
**Priority:** P3

**Problem:** Zero unit tests, zero E2E tests. No CI/CD pipeline.

**Implementation:**
1. Add Vitest for unit tests (pricing calculations, weather scoring, product recommendations)
2. Add Playwright for E2E tests:
   - Page loads with map
   - Zone click opens booking panel
   - 360° modal opens/closes
   - Weather badge renders
   - Athena button opens modal
   - Mobile responsive layout
3. GitHub Actions workflow for PR checks

---

## Summary

| Ticket | Priority | Status | Category |
|--------|----------|--------|----------|
| BK-001 | P1 CRITICAL | Open | Map/Intro |
| BK-002 | P1 CRITICAL | Open | Mobile |
| BK-003 | P2 HIGH | Open | Layout |
| BK-004 | P2 HIGH | Open | Mobile Layout |
| BK-005 | P3 MEDIUM | Open | Data/Weather |
| BK-006 | P4 LOW | Open | UI Polish |
| BK-007 | P3 MEDIUM | Open | Error Handling |
| BK-008 | P4 LOW | Open | DX |
| BK-009 | P2 HIGH | Planned | Voice Agent |
| BK-010 | P3 MEDIUM | Open | Testing |

## BK-011: Timezone mismatch — UTC vs Pacific (MEDIUM)

**Status:** Open
**Priority:** P3

**Problem:** Droplet runs UTC. `/api/weather` route uses `new Date().toISOString().split('T')[0]` which returns UTC date. After 5pm PDT (midnight UTC), "today" becomes tomorrow's date, so no weather data matches.

**Fix:**
- Use `America/Los_Angeles` timezone in the weather API route
- `new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })` returns `YYYY-MM-DD` in Pacific time
- Apply consistently to all date comparisons in weather + booking code

---

## BK-012: "Book This Spot" hidden behind 360° video controls (HIGH)

**Status:** Open
**Priority:** P2

**Problem:** In the 360° modal, the "Book This Spot" gold button is at the bottom — behind the Photo Sphere Viewer's navbar (play/pause, volume, timeline, gyroscope, fullscreen controls). Users can't tap it.

**Fix:**
- Move "Book This Spot" to **top-left below the 360° badge**, not the bottom
- Or place it as a floating pill between the header and the viewer
- Keep weather chip at the bottom-left (it's less critical than the CTA)

---

## BK-013: Weather Jockey not fetching new forecasts (MEDIUM)

**Status:** Open
**Priority:** P3

**Problem:** WJ sync service is running but last forecast data is 2026-03-17 (2 days stale). The service may be syncing Airtable but not fetching fresh weather.

**Investigation:**
- Check WJ logs: `journalctl -u wj-sync.service --since "2 hours ago"`
- The WJ sync service handles Supabase→Airtable sync, not weather fetching
- The weather fetch may be a separate cron or N8N workflow
- Need to find and restart the weather fetch process

---

**Critical path:** BK-001 → BK-003 → BK-004 → BK-012 (map must work, buttons must be tappable, CTA visible)
**Next sprint:** BK-005 → BK-009 → BK-011 (live weather, voice agent, timezone)
**Tech debt:** BK-007 → BK-010 (error handling, tests)
