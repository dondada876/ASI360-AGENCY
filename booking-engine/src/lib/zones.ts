// 500 Grand Live — Zone Configuration
// Zone data from Mapbox Dataset: cmmx2qu5g0leg1olhtkj83bs5
// Tileset: asi360said.cmmx2qu5g0leg1olhtkj83bs5-03u9l

import type { Zone } from '@/types/booking'

export const MAPBOX_CONFIG = {
  style: 'mapbox://styles/asi360said/cmmx3trjt001i01r97yv10e7i',
  tileset: 'asi360said.cmmx2qu5g0leg1olhtkj83bs5-03u9l',
  dataset: 'cmmx2qu5g0leg1olhtkj83bs5',
  sourceLayer: '500GL-Social-Club',
  center: [-122.2512, 37.8082] as [number, number],  // Grand Ave / Euclid — looking at A1/A2/B zones
  zoom: 17.5,
  bearing: -30, // angle the map to face the sunset direction
  pitch: 65, // immersive but not too extreme
}

// Zone definitions — aligned with Mapbox dataset features
// Poles renamed to LP-XXX format (clockwise from pergola): LP-001 through LP-005 (north), LP-176 through LP-180 (south curve)
export const ZONES: Zone[] = [
  {
    id: 'A1',
    name: 'Sunrise Lawn',
    label: 'Zone A1',
    description: 'Open grass near the pergola. Morning sun, afternoon shade from trees.',
    poleIds: ['LP-180', 'LP-176'],
    sunsetQuality: 'partial',
    maxCapacity: 8,
    elevation: { streetLevelFt: 25, zoneLevelFt: 12, slopeFromStreetFt: 13, relativeToWalkwayFt: 2, terrain: 'steep-slope' },
    shadowOffsetHours: -2.0,
    effectiveSunsetNote: 'Buildings shade by ~5:20pm. Best for morning/midday.',
  },
  {
    id: 'A2',
    name: 'Pergola East',
    label: 'Zone A2',
    description: 'Just past the colonnade. Close to parking and restrooms.',
    poleIds: ['LP-176', 'LP-001'],
    sunsetQuality: 'partial',
    maxCapacity: 6,
    elevation: { streetLevelFt: 25, zoneLevelFt: 14, slopeFromStreetFt: 11, relativeToWalkwayFt: 4, terrain: 'steep-slope' },
    shadowOffsetHours: -1.75,
    effectiveSunsetNote: 'Buildings shade by ~5:35pm. Close to restrooms & parking.',
  },
  {
    id: 'B1',
    name: 'Lakefront North',
    label: 'Zone B1',
    description: 'Wide open grass with lake views. Great midday sun, 8-10ft slope from Grand Ave.',
    poleIds: ['LP-001', 'LP-179'],
    sunsetQuality: 'partial',
    maxCapacity: 10,
    elevation: { streetLevelFt: 25, zoneLevelFt: 16, slopeFromStreetFt: 9, relativeToWalkwayFt: 6, terrain: 'moderate-slope' },
    shadowOffsetHours: -1.75,
    effectiveSunsetNote: 'Buildings shade by ~5:30pm. Great midday spot, wide grass.',
  },
  {
    id: 'B2',
    name: 'Lakefront Central',
    label: 'Zone B2',
    description: 'Central lakefront grass. Beautiful midday, moderate slope to water.',
    poleIds: ['LP-179', 'LP-177'],
    sunsetQuality: 'partial',
    maxCapacity: 10,
    elevation: { streetLevelFt: 25, zoneLevelFt: 15, slopeFromStreetFt: 10, relativeToWalkwayFt: 5, terrain: 'moderate-slope' },
    shadowOffsetHours: -2.0,
    effectiveSunsetNote: 'Buildings shade by ~5:15pm. Best for morning/afternoon.',
  },
  {
    id: 'B3',
    name: 'Lakeview Terrace',
    label: 'Zone B3',
    description: 'Elevated grass with panoramic lake views. Moderate slope.',
    poleIds: ['LP-179', 'LP-177'],
    sunsetQuality: 'partial',
    maxCapacity: 8,
    elevation: { streetLevelFt: 25, zoneLevelFt: 15, slopeFromStreetFt: 10, relativeToWalkwayFt: 5, terrain: 'moderate-slope' },
    shadowOffsetHours: -1.75,
    effectiveSunsetNote: 'Buildings shade by ~5:30pm. Great lake panorama.',
  },
  {
    id: 'B4',
    name: 'Church Lawn',
    label: 'Zone B4',
    description: 'Quiet grass near Our Lady of Lourdes. Peaceful, moderate slope.',
    poleIds: ['LP-177', 'LP-002'],
    sunsetQuality: 'partial',
    maxCapacity: 8,
    elevation: { streetLevelFt: 25, zoneLevelFt: 14, slopeFromStreetFt: 11, relativeToWalkwayFt: 4, terrain: 'moderate-slope' },
    shadowOffsetHours: -1.75,
    effectiveSunsetNote: 'Buildings shade by ~5:30pm. Peaceful & quiet.',
  },
  {
    id: 'B5',
    name: 'Grand Avenue Strip',
    label: 'Zone B5',
    description: 'Across from restaurants. Quick food delivery, closest to Grand Ave. Earliest shade.',
    poleIds: ['LP-177'],
    sunsetQuality: 'shaded',
    maxCapacity: 6,
    elevation: { streetLevelFt: 25, zoneLevelFt: 18, slopeFromStreetFt: 7, relativeToWalkwayFt: 8, terrain: 'gentle' },
    shadowOffsetHours: -2.5,
    effectiveSunsetNote: 'Shaded by ~4:50pm. Best for hot days — natural cooling.',
  },
  {
    id: 'C1',
    name: 'Restaurant Row Curve',
    label: 'Zone C1',
    description: 'Where the lakeshore curves. Food arrives in minutes. Golden sunset — extra 2hrs over the hills.',
    poleIds: ['LP-002'],
    sunsetQuality: 'golden',
    maxCapacity: 6,
    elevation: { streetLevelFt: 25, zoneLevelFt: 7, slopeFromStreetFt: 18, relativeToWalkwayFt: -3, terrain: 'gentle' },
    shadowOffsetHours: 0.25,
    effectiveSunsetNote: '🌅 Sun until ~7:30pm. Low bowl catches extended golden light.',
  },
  {
    id: 'C2',
    name: 'Bellevue Meadow',
    label: 'Zone C2',
    description: 'Wide open grass near Bellevue Ave. Great for large groups. Golden sunset — low bowl, unblocked sky.',
    poleIds: ['LP-002', 'LP-003'],
    sunsetQuality: 'golden',
    maxCapacity: 12,
    elevation: { streetLevelFt: 25, zoneLevelFt: 6, slopeFromStreetFt: 19, relativeToWalkwayFt: -4, terrain: 'flat' },
    shadowOffsetHours: 0.25,
    effectiveSunsetNote: '🌅 Sun until ~7:45pm. Lowest point, widest grass, best golden hour.',
  },
  {
    id: 'C3',
    name: 'Willow Grove',
    label: 'Zone C3',
    description: 'Natural tree shade midday. Golden sunset zone — extra 2hrs in the low bowl.',
    poleIds: ['LP-003', 'LP-178'],
    sunsetQuality: 'golden',
    maxCapacity: 6,
    elevation: { streetLevelFt: 25, zoneLevelFt: 6, slopeFromStreetFt: 19, relativeToWalkwayFt: -4, terrain: 'flat' },
    shadowOffsetHours: 0.25,
    effectiveSunsetNote: '🌅 Sun until ~7:45pm. Willows provide midday shade, open sky for sunset.',
  },
  {
    id: 'C4',
    name: 'South Point',
    label: 'Zone C4',
    description: 'Southern tip near the bridge. Unique water views. Golden sunset over the lake.',
    poleIds: ['LP-178', 'LP-004'],
    sunsetQuality: 'golden',
    maxCapacity: 4,
    elevation: { streetLevelFt: 25, zoneLevelFt: 7, slopeFromStreetFt: 18, relativeToWalkwayFt: -3, terrain: 'flat' },
    shadowOffsetHours: 0.0,
    effectiveSunsetNote: '🌅 Sun until ~7:30pm. Water reflections amplify the golden light.',
  },
]

export const ZONE_COLORS: Record<string, string> = {
  golden: '#D4AF37',
  partial: '#E8A849',
  shaded: '#6B8F6B',
}

export function getZoneById(id: string): Zone | undefined {
  return ZONES.find(z => z.id === id)
}

export function getZonesBySunset(quality: Zone['sunsetQuality']): Zone[] {
  return ZONES.filter(z => z.sunsetQuality === quality)
}
