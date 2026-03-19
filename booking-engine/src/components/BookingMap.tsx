'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAPBOX_CONFIG, ZONES, ZONE_COLORS } from '@/lib/zones'

interface BookingMapProps {
  onZoneSelect: (zoneId: string | null) => void
  selectedZone: string | null
}

export default function BookingMap({ onZoneSelect, selectedZone }: BookingMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [hoveredZone, setHoveredZone] = useState<string | null>(null)

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return

    // Clean up any existing map (handles React strict mode remount)
    if (map.current) {
      map.current.remove()
      map.current = null
    }

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: MAPBOX_CONFIG.center,
      zoom: MAPBOX_CONFIG.zoom,
      bearing: MAPBOX_CONFIG.bearing,
      pitch: MAPBOX_CONFIG.pitch,
      antialias: true,
      maxZoom: 20,
      minZoom: 14,
    })

    // Navigation controls — bottom right, out of the way
    map.current.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      'bottom-right'
    )

    // Scale bar
    map.current.addControl(
      new mapboxgl.ScaleControl({ maxWidth: 120 }),
      'bottom-left'
    )

    map.current.on('load', () => {
      if (!map.current) return

      // Add 3D terrain
      map.current.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      })
      map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.2 })

      // Add tileset source with booking zones
      map.current.addSource('booking-zones', {
        type: 'vector',
        url: `mapbox://${MAPBOX_CONFIG.tileset}`,
      })

      // ── BK1 Service Boundary — dashed outline only ──
      map.current.addLayer({
        id: 'service-boundary',
        type: 'line',
        source: 'booking-zones',
        'source-layer': MAPBOX_CONFIG.sourceLayer,
        filter: ['==', ['get', 'type'], 'service_boundary'],
        paint: {
          'line-color': '#D4AF37',
          'line-width': 2,
          'line-dasharray': [3, 2],
          'line-opacity': 0.7,
        },
      })

      // ── Zone Fills — semi-transparent, colored by sunset quality ──
      map.current.addLayer({
        id: 'zone-fills',
        type: 'fill',
        source: 'booking-zones',
        'source-layer': MAPBOX_CONFIG.sourceLayer,
        filter: ['==', ['get', 'type'], 'booking_zone'],
        paint: {
          'fill-color': [
            'match',
            ['get', 'sunset'],
            'golden', ZONE_COLORS.golden,
            'partial', ZONE_COLORS.partial,
            'shaded', ZONE_COLORS.shaded,
            '#4CAF50',
          ],
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false], 0.35,
            ['boolean', ['feature-state', 'selected'], false], 0.45,
            0.15,
          ],
        },
      })

      // ── Zone Outlines ──
      map.current.addLayer({
        id: 'zone-outlines',
        type: 'line',
        source: 'booking-zones',
        'source-layer': MAPBOX_CONFIG.sourceLayer,
        filter: ['==', ['get', 'type'], 'booking_zone'],
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false], '#D4AF37',
            ['boolean', ['feature-state', 'hover'], false], '#E8C84A',
            'rgba(255, 255, 255, 0.4)',
          ],
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'selected'], false], 3,
            ['boolean', ['feature-state', 'hover'], false], 2.5,
            1.5,
          ],
        },
      })

      // ── Zone Labels ──
      map.current.addLayer({
        id: 'zone-labels',
        type: 'symbol',
        source: 'booking-zones',
        'source-layer': MAPBOX_CONFIG.sourceLayer,
        filter: ['==', ['get', 'type'], 'booking_zone'],
        layout: {
          'text-field': ['get', 'zone'],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': 13,
          'text-anchor': 'center',
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#FFF8F0',
          'text-halo-color': 'rgba(0, 0, 0, 0.7)',
          'text-halo-width': 1.5,
        },
      })

      // ── Pole Markers ──
      map.current.addLayer({
        id: 'pole-markers',
        type: 'circle',
        source: 'booking-zones',
        'source-layer': MAPBOX_CONFIG.sourceLayer,
        filter: ['==', ['get', 'type'], 'light_pole'],
        paint: {
          'circle-radius': 5,
          'circle-color': '#D4AF37',
          'circle-stroke-color': '#FFF8F0',
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.9,
        },
      })

      // ── Pole Labels ──
      map.current.addLayer({
        id: 'pole-labels',
        type: 'symbol',
        source: 'booking-zones',
        'source-layer': MAPBOX_CONFIG.sourceLayer,
        filter: ['==', ['get', 'type'], 'light_pole'],
        layout: {
          'text-field': ['get', 'pole_id'],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': 10,
          'text-offset': [0, -1.2],
          'text-anchor': 'bottom',
        },
        paint: {
          'text-color': '#D4AF37',
          'text-halo-color': 'rgba(0, 0, 0, 0.8)',
          'text-halo-width': 1,
        },
      })

      // ── Infrastructure markers (restroom, handwash) ──
      map.current.addLayer({
        id: 'infrastructure',
        type: 'circle',
        source: 'booking-zones',
        'source-layer': MAPBOX_CONFIG.sourceLayer,
        filter: ['==', ['get', 'type'], 'infrastructure'],
        paint: {
          'circle-radius': 7,
          'circle-color': '#FF6B35',
          'circle-stroke-color': '#FFF8F0',
          'circle-stroke-width': 2,
        },
      })

      setMapLoaded(true)
    })

    // ── Zone hover interaction ──
    let hoveredFeatureId: string | number | null = null

    map.current.on('mousemove', 'zone-fills', (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      if (!map.current || !e.features?.length) return
      map.current.getCanvas().style.cursor = 'pointer'

      const feature = e.features[0]
      if (hoveredFeatureId !== null) {
        map.current.setFeatureState(
          { source: 'booking-zones', sourceLayer: MAPBOX_CONFIG.sourceLayer, id: hoveredFeatureId },
          { hover: false }
        )
      }
      hoveredFeatureId = feature.id ?? null
      if (hoveredFeatureId !== null) {
        map.current.setFeatureState(
          { source: 'booking-zones', sourceLayer: MAPBOX_CONFIG.sourceLayer, id: hoveredFeatureId },
          { hover: true }
        )
      }
      const zoneName = feature.properties?.zone || ''
      setHoveredZone(zoneName)
    })

    map.current.on('mouseleave', 'zone-fills', () => {
      if (!map.current) return
      map.current.getCanvas().style.cursor = ''
      if (hoveredFeatureId !== null) {
        map.current.setFeatureState(
          { source: 'booking-zones', sourceLayer: MAPBOX_CONFIG.sourceLayer, id: hoveredFeatureId },
          { hover: false }
        )
      }
      hoveredFeatureId = null
      setHoveredZone(null)
    })

    // ── Zone click ──
    map.current.on('click', 'zone-fills', (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      if (!e.features?.length) return
      const zoneId = e.features[0].properties?.zone
      if (zoneId) onZoneSelect(zoneId)
    })

    // ── Click outside zones to deselect ──
    map.current.on('click', (e: mapboxgl.MapMouseEvent) => {
      if (!map.current) return
      const features = map.current.queryRenderedFeatures(e.point, { layers: ['zone-fills'] })
      if (!features.length) onZoneSelect(null)
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [onZoneSelect])

  // ── Highlight selected zone ──
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Clear all selections
    const features = map.current.querySourceFeatures('booking-zones', {
      sourceLayer: MAPBOX_CONFIG.sourceLayer,
    })
    features.forEach((f) => {
      if (f.id != null) {
        map.current!.setFeatureState(
          { source: 'booking-zones', sourceLayer: MAPBOX_CONFIG.sourceLayer, id: f.id },
          { selected: false }
        )
      }
    })

    // Set selected zone
    if (selectedZone) {
      const selectedFeatures = features.filter(
        (f) => f.properties?.zone === selectedZone && f.properties?.type === 'booking_zone'
      )
      selectedFeatures.forEach((f: any) => {
        if (f.id != null) {
          map.current!.setFeatureState(
            { source: 'booking-zones', sourceLayer: MAPBOX_CONFIG.sourceLayer, id: f.id },
            { selected: true }
          )
        }
      })
    }
  }, [selectedZone, mapLoaded])

  // Tooltip for hovered zone
  const zoneData = hoveredZone ? ZONES.find((z) => z.id === hoveredZone) : null

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Hover tooltip */}
      {zoneData && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 glass rounded-xl px-5 py-3 border-glow-gold pointer-events-none">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ background: ZONE_COLORS[zoneData.sunsetQuality] }}
            />
            <span className="font-[family-name:var(--font-display)] text-lg font-medium text-cream">
              {zoneData.label}
            </span>
            <span className="text-cream/60 text-sm">—</span>
            <span className="text-cream/70 text-sm">{zoneData.name}</span>
            {zoneData.sunsetQuality === 'golden' && (
              <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded-full">
                Golden Hour
              </span>
            )}
          </div>
        </div>
      )}

      {/* Map legend */}
      <div className="absolute bottom-24 left-4 glass rounded-xl p-3 z-10">
        <div className="text-[10px] uppercase tracking-[0.15em] text-cream/40 mb-2">Zones</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: ZONE_COLORS.golden }} />
            <span className="text-xs text-cream/70">Golden Hour</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: ZONE_COLORS.partial }} />
            <span className="text-xs text-cream/70">Partial Sun</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: ZONE_COLORS.shaded }} />
            <span className="text-xs text-cream/70">Shaded</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-cream/10">
            <div className="w-2.5 h-2.5 rounded-full bg-gold" />
            <span className="text-xs text-cream/70">Light Pole / QR</span>
          </div>
        </div>
      </div>
    </div>
  )
}
