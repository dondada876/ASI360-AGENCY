// 500 Grand Live — Zone Configuration
// Zone data from Mapbox Dataset: cmmx2qu5g0leg1olhtkj83bs5
// Tileset: asi360said.cmmx2qu5g0leg1olhtkj83bs5-03u9l

import type { Zone } from '@/types/booking'

export const MAPBOX_CONFIG = {
  style: 'mapbox://styles/asi360said/cmmx3trjt001i01r97yv10e7i',
  tileset: 'asi360said.cmmx2qu5g0leg1olhtkj83bs5-03u9l',
  dataset: 'cmmx2qu5g0leg1olhtkj83bs5',
  center: [-122.2509, 37.8073] as [number, number],
  zoom: 17.5,
  bearing: -30, // angle the map to face the sunset direction
  pitch: 45,
}

// Zone definitions — aligned with Mapbox dataset features
export const ZONES: Zone[] = [
  {
    id: 'A1',
    name: 'Sunrise Lawn',
    label: 'Zone A1',
    description: 'Open grass near the pergola. Morning sun, afternoon shade from trees.',
    poleIds: ['P1', 'P2'],
    sunsetQuality: 'partial',
    maxCapacity: 8,
  },
  {
    id: 'A2',
    name: 'Pergola East',
    label: 'Zone A2',
    description: 'Just past the colonnade. Close to parking and restrooms.',
    poleIds: ['P2', 'P3'],
    sunsetQuality: 'partial',
    maxCapacity: 6,
  },
  {
    id: 'B1',
    name: 'Golden Strip North',
    label: 'Zone B1',
    description: 'Prime sunset views. Open grass, unobstructed western sky.',
    poleIds: ['P3', 'P4'],
    sunsetQuality: 'golden',
    maxCapacity: 10,
  },
  {
    id: 'B2',
    name: 'Golden Strip South',
    label: 'Zone B2',
    description: 'Waterfront sunset zone. Premium golden hour location.',
    poleIds: ['P4', 'P5'],
    sunsetQuality: 'golden',
    maxCapacity: 10,
  },
  {
    id: 'B3',
    name: 'Lakeview Terrace',
    label: 'Zone B3',
    description: 'Elevated grass with panoramic lake views.',
    poleIds: ['P5', 'P6'],
    sunsetQuality: 'golden',
    maxCapacity: 8,
  },
  {
    id: 'B4',
    name: 'Church Lawn',
    label: 'Zone B4',
    description: 'Quiet grass near Our Lady of Lourdes. Late sunset, peaceful.',
    poleIds: ['P6', 'P7'],
    sunsetQuality: 'golden',
    maxCapacity: 8,
  },
  {
    id: 'C1',
    name: 'Grand Avenue Strip',
    label: 'Zone C1',
    description: 'Across from restaurants. Quick delivery, shaded by 5pm.',
    poleIds: ['P8'],
    sunsetQuality: 'shaded',
    maxCapacity: 6,
  },
  {
    id: 'C2',
    name: 'Restaurant Row',
    label: 'Zone C2',
    description: 'Closest to Coach Sushi and Comal. Food arrives in minutes.',
    poleIds: ['P8', 'P9'],
    sunsetQuality: 'shaded',
    maxCapacity: 6,
  },
  {
    id: 'D1',
    name: 'Bellevue Meadow',
    label: 'Zone D1',
    description: 'Wide open grass near Bellevue Ave. Great for large groups.',
    poleIds: ['P9', 'P10'],
    sunsetQuality: 'partial',
    maxCapacity: 12,
  },
  {
    id: 'D2',
    name: 'Willow Grove',
    label: 'Zone D2',
    description: 'Shaded by willows. Cool spot on hot days.',
    poleIds: ['P10'],
    sunsetQuality: 'shaded',
    maxCapacity: 6,
  },
  {
    id: 'D3',
    name: 'South Point',
    label: 'Zone D3',
    description: 'Southern tip near the bridge. Unique water views.',
    poleIds: ['P10'],
    sunsetQuality: 'partial',
    maxCapacity: 4,
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
