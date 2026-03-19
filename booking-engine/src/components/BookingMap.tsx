'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAPBOX_CONFIG, ZONES, ZONE_COLORS } from '@/lib/zones'

export interface Video360Hotspot {
  id: string
  label: string
  lngLat: [number, number]
  videoUrl: string
  title: string
  subtitle: string
  startYaw: number
  startPitch: number
  startZoom: number
}

interface BookingMapProps {
  onZoneSelect: (zoneId: string | null) => void
  selectedZone: string | null
  onOpen360?: (hotspot: Video360Hotspot) => void
  video360Hotspots?: Video360Hotspot[]
}

export default function BookingMap({ onZoneSelect, selectedZone, onOpen360, video360Hotspots = [] }: BookingMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [hoveredZone, setHoveredZone] = useState<string | null>(null)
  const [autoRotate, setAutoRotate] = useState(false)
  const [terrain3D, setTerrain3D] = useState(true)
  const autoRotateRef = useRef(false)
  const animFrameRef = useRef<number | null>(null)

  // Auto-rotate logic
  const startAutoRotate = useCallback(() => {
    if (!map.current) return
    autoRotateRef.current = true

    const rotate = () => {
      if (!map.current || !autoRotateRef.current) return
      const bearing = map.current.getBearing() + 0.15 // slow rotation
      map.current.setBearing(bearing % 360)
      animFrameRef.current = requestAnimationFrame(rotate)
    }
    rotate()
  }, [])

  const stopAutoRotate = useCallback(() => {
    autoRotateRef.current = false
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
  }, [])

  // Toggle auto-rotate
  useEffect(() => {
    if (autoRotate) {
      startAutoRotate()
    } else {
      stopAutoRotate()
    }
    return () => stopAutoRotate()
  }, [autoRotate, startAutoRotate, stopAutoRotate])

  // Toggle 3D terrain
  useEffect(() => {
    if (!map.current || !mapLoaded) return
    if (terrain3D) {
      map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 })
    } else {
      map.current.setTerrain(null as any)
      map.current.easeTo({ pitch: 0, duration: 800 })
    }
  }, [terrain3D, mapLoaded])

  // Pause auto-rotate on user interaction
  useEffect(() => {
    if (!map.current || !mapLoaded) return
    const m = map.current

    const pauseRotate = () => {
      if (autoRotateRef.current && autoRotate) {
        stopAutoRotate()
        // Resume after 5 seconds of no interaction
        setTimeout(() => {
          if (autoRotate) startAutoRotate()
        }, 5000)
      }
    }

    m.on('mousedown', pauseRotate)
    m.on('touchstart', pauseRotate)
    m.on('wheel', pauseRotate)

    return () => {
      m.off('mousedown', pauseRotate)
      m.off('touchstart', pauseRotate)
      m.off('wheel', pauseRotate)
    }
  }, [mapLoaded, autoRotate, startAutoRotate, stopAutoRotate])

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return

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

    map.current.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      'bottom-right'
    )

    map.current.addControl(
      new mapboxgl.ScaleControl({ maxWidth: 120 }),
      'bottom-left'
    )

    map.current.on('load', () => {
      if (!map.current) return

      // Add 3D terrain DEM source
      map.current.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      })
      map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 })

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

      // ── Zone Labels — collision-aware so overlapping zones hide gracefully ──
      map.current.addLayer({
        id: 'zone-labels',
        type: 'symbol',
        source: 'booking-zones',
        'source-layer': MAPBOX_CONFIG.sourceLayer,
        filter: ['==', ['get', 'type'], 'booking_zone'],
        layout: {
          'text-field': ['get', 'zone'],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            16, 10,
            17, 12,
            18, 14,
            19, 16,
          ],
          'text-anchor': 'center',
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-padding': 8,
          'symbol-sort-key': ['match', ['get', 'zone'],
            'A1', 1, 'A2', 2, 'B1', 3, 'B2', 4, 'B3', 5, 'B4', 6,
            'C', 7, 'C2', 8, 'D1', 9, 'D2', 10, 'D3', 11,
            99
          ],
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

      // ── Infrastructure: Restrooms (RED) ──
      map.current.addLayer({
        id: 'infra-restrooms',
        type: 'circle',
        source: 'booking-zones',
        'source-layer': MAPBOX_CONFIG.sourceLayer,
        filter: ['all',
          ['==', ['get', 'type'], 'infrastructure'],
          ['any',
            ['==', ['get', 'infra_type'], 'restroom'],
            // Fallback: the two easternmost infrastructure points are restrooms
            ['!', ['has', 'infra_type']],
          ],
        ],
        paint: {
          'circle-radius': 9,
          'circle-color': '#DC2626',
          'circle-stroke-color': '#FFF8F0',
          'circle-stroke-width': 2.5,
          'circle-opacity': 0.95,
        },
      })

      // ── Infrastructure: Restroom Labels ──
      map.current.addLayer({
        id: 'infra-restroom-labels',
        type: 'symbol',
        source: 'booking-zones',
        'source-layer': MAPBOX_CONFIG.sourceLayer,
        filter: ['all',
          ['==', ['get', 'type'], 'infrastructure'],
          ['any',
            ['==', ['get', 'infra_type'], 'restroom'],
            ['!', ['has', 'infra_type']],
          ],
        ],
        layout: {
          'text-field': '🚻',
          'text-size': 12,
          'text-anchor': 'center',
          'text-allow-overlap': true,
        },
      })

      // ── Infrastructure: Hand Wash Station (BLUE) ──
      // We'll also add hand wash markers as HTML markers since we need to
      // differentiate restrooms from handwash in the tileset.
      // For now, add the third infrastructure point as blue via a separate
      // HTML marker positioned at the known handwash location.
      const handwashMarkerEl = document.createElement('div')
      handwashMarkerEl.innerHTML = `
        <div style="
          width: 22px; height: 22px;
          background: #2563EB;
          border: 2.5px solid #FFF8F0;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px;
          box-shadow: 0 2px 8px rgba(37,99,235,0.5);
          cursor: pointer;
        ">🧼</div>
        <div style="
          font-size: 9px;
          color: #93C5FD;
          text-align: center;
          margin-top: 2px;
          text-shadow: 0 1px 3px rgba(0,0,0,0.8);
          white-space: nowrap;
          font-weight: 600;
        ">HAND WASH</div>
      `
      // Hand wash station is near the restrooms at the parking lot
      new mapboxgl.Marker({ element: handwashMarkerEl, anchor: 'center' })
        .setLngLat([-122.25128, 37.80902])
        .addTo(map.current!)

      // ── Restroom HTML markers for labels ──
      const restroomCoords: [number, number][] = [
        [-122.25130, 37.80906],  // Restroom 1
        [-122.25126, 37.80898],  // Restroom 2
      ]
      restroomCoords.forEach((coord, i) => {
        const el = document.createElement('div')
        el.innerHTML = `
          <div style="
            font-size: 9px;
            color: #FCA5A5;
            text-align: center;
            margin-top: 22px;
            text-shadow: 0 1px 3px rgba(0,0,0,0.8);
            white-space: nowrap;
            font-weight: 600;
            pointer-events: none;
          ">RESTROOM ${i + 1}</div>
        `
        new mapboxgl.Marker({ element: el, anchor: 'top' })
          .setLngLat(coord)
          .addTo(map.current!)
      })

      // ── 360° Immersive View Markers ──
      video360Hotspots.forEach((hotspot) => {
        const el = document.createElement('div')
        el.className = 'marker-360-bubble'
        el.innerHTML = `
          <div class="marker-360-outer">
            <div class="marker-360-ring"></div>
            <div class="marker-360-ring marker-360-ring-delayed"></div>
            <div class="marker-360-core">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#D4AF37" stroke-width="1.5"/>
                <ellipse cx="12" cy="12" rx="4" ry="10" stroke="#D4AF37" stroke-width="1.5"/>
                <path d="M2 12h20" stroke="#D4AF37" stroke-width="1.5"/>
              </svg>
            </div>
            <div class="marker-360-label">${hotspot.label}</div>
          </div>
        `
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onOpen360?.(hotspot)
        })

        new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat(hotspot.lngLat)
          .addTo(map.current!)
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
      stopAutoRotate()
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [onZoneSelect])

  // ── Highlight selected zone ──
  useEffect(() => {
    if (!map.current || !mapLoaded) return

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

  const zoneData = hoveredZone ? ZONES.find((z) => z.id === hoveredZone) : null

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Hover tooltip — compact, bottom center on mobile */}
      {zoneData && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-full px-3 py-1.5 pointer-events-none flex items-center gap-2"
             style={{ backdropFilter: 'blur(16px)', background: 'rgba(15,41,55,0.85)', border: '1px solid rgba(212,175,55,0.3)' }}>
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ZONE_COLORS[zoneData.sunsetQuality] }} />
          <span className="text-xs font-semibold text-cream">{zoneData.label}</span>
          <span className="text-[10px] text-cream/50">{zoneData.name}</span>
          {zoneData.sunsetQuality === 'golden' && <span className="text-[10px]">🌅</span>}
        </div>
      )}

      {/* ── Toggle Controls — compact icon buttons, top-left ── */}
      <div className="absolute top-16 left-3 z-10 flex flex-col gap-1.5">
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          title={autoRotate ? 'Stop rotating' : 'Auto-rotate'}
          className={`rounded-lg w-9 h-9 flex items-center justify-center transition-all duration-300 ${
            autoRotate
              ? 'text-gold shadow-[0_0_10px_rgba(212,175,55,0.3)]'
              : 'text-cream/50 hover:text-cream/80'
          }`}
          style={{ backdropFilter: 'blur(12px)', background: autoRotate ? 'rgba(212,175,55,0.15)' : 'rgba(15,41,55,0.7)', border: `1px solid ${autoRotate ? 'rgba(212,175,55,0.4)' : 'rgba(255,248,240,0.1)'}` }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
          </svg>
        </button>

        <button
          onClick={() => setTerrain3D(!terrain3D)}
          title={terrain3D ? '3D Terrain ON' : 'Flat map'}
          className={`rounded-lg w-9 h-9 flex items-center justify-center transition-all duration-300 ${
            terrain3D
              ? 'text-gold shadow-[0_0_10px_rgba(212,175,55,0.3)]'
              : 'text-cream/50 hover:text-cream/80'
          }`}
          style={{ backdropFilter: 'blur(12px)', background: terrain3D ? 'rgba(212,175,55,0.15)' : 'rgba(15,41,55,0.7)', border: `1px solid ${terrain3D ? 'rgba(212,175,55,0.4)' : 'rgba(255,248,240,0.1)'}` }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
          </svg>
        </button>
      </div>

      {/* Map legend — compact icon row, bottom-left */}
      <div className="absolute bottom-4 left-3 z-10 rounded-lg px-2 py-1.5 flex items-center gap-3"
           style={{ backdropFilter: 'blur(12px)', background: 'rgba(15,41,55,0.75)', border: '1px solid rgba(255,248,240,0.08)' }}>
        <div className="flex items-center gap-1" title="Golden Hour (+2hrs sunset)">
          <div className="w-2 h-2 rounded-full" style={{ background: ZONE_COLORS.golden }} />
          <span className="text-[9px] text-cream/50">🌅</span>
        </div>
        <div className="flex items-center gap-1" title="Partial Sun">
          <div className="w-2 h-2 rounded-full" style={{ background: ZONE_COLORS.partial }} />
          <span className="text-[9px] text-cream/50">⛅</span>
        </div>
        <div className="flex items-center gap-1" title="Shaded">
          <div className="w-2 h-2 rounded-full" style={{ background: ZONE_COLORS.shaded }} />
          <span className="text-[9px] text-cream/50">🌳</span>
        </div>
        <div className="w-px h-3 bg-cream/10" />
        <div className="flex items-center gap-1" title="Restroom (code required)">
          <div className="w-2 h-2 rounded-full" style={{ background: '#DC2626' }} />
          <span className="text-[9px]">🚻</span>
        </div>
        <div className="flex items-center gap-1" title="Hand Wash">
          <div className="w-2 h-2 rounded-full" style={{ background: '#2563EB' }} />
          <span className="text-[9px]">🧼</span>
        </div>
        <div className="flex items-center gap-1" title="Light Pole / QR">
          <div className="w-2 h-2 rounded-full bg-gold" />
          <span className="text-[9px]">📍</span>
        </div>
      </div>
    </div>
  )
}
