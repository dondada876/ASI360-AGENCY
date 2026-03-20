'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAPBOX_CONFIG, ZONES, ZONE_COLORS } from '@/lib/zones'
import type { IntroSequence } from '@/lib/intro'
import { runIntro } from '@/lib/intro'

export interface Video360Hotspot {
  id: string
  label: string
  lngLat: [number, number]
  videoUrl: string
  posterUrl?: string
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
  introSequence?: IntroSequence
  onIntroDive360?: () => void
  onIntroComplete?: () => void
}

// Load/save HUD collapse states from localStorage
function loadHudState(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback
  const stored = localStorage.getItem(key)
  if (stored === null) return fallback
  return stored === 'true'
}

function saveHudState(key: string, value: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, String(value))
}

export default function BookingMap({
  onZoneSelect,
  selectedZone,
  onOpen360,
  video360Hotspots = [],
  introSequence = 'instant',
  onIntroDive360,
  onIntroComplete,
}: BookingMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [hoveredZone, setHoveredZone] = useState<string | null>(null)
  const [autoRotate, setAutoRotate] = useState(true) // ON by default
  const [rotateSpeed, setRotateSpeed] = useState(0.06) // degrees per frame (0.03=slow, 0.06=medium, 0.15=fast)
  const [terrain3D, setTerrain3D] = useState(true)
  const [buildings3D, setBuildings3D] = useState(true)
  const autoRotateRef = useRef(false)
  const rotateSpeedRef = useRef(0.06)
  const animFrameRef = useRef<number | null>(null)
  const [introComplete, setIntroComplete] = useState(introSequence === 'instant')
  // Default to COLLAPSED on mobile (< 768px), EXPANDED on desktop
  const [hudExpanded, setHudExpanded] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth >= 768 ? loadHudState('500gl_hud_expanded', true) : false
  })
  const [legendExpanded, setLegendExpanded] = useState(false) // Always start collapsed

  // Persist collapse states
  useEffect(() => { saveHudState('500gl_hud_expanded', hudExpanded) }, [hudExpanded])
  useEffect(() => { saveHudState('500gl_legend_expanded', legendExpanded) }, [legendExpanded])

  // Keep speed ref in sync
  useEffect(() => { rotateSpeedRef.current = rotateSpeed }, [rotateSpeed])

  // Auto-rotate logic
  const startAutoRotate = useCallback(() => {
    if (!map.current) return
    autoRotateRef.current = true

    const rotate = () => {
      if (!map.current || !autoRotateRef.current) return
      const bearing = map.current.getBearing() + rotateSpeedRef.current
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

  // Toggle auto-rotate with 5-second initial delay
  useEffect(() => {
    if (!introComplete) return // Don't start auto-rotate during intro
    if (autoRotate) {
      const delay = setTimeout(() => startAutoRotate(), 5000) // 5-second pause before first rotation
      return () => clearTimeout(delay)
    } else {
      stopAutoRotate()
    }
    return () => stopAutoRotate()
  }, [autoRotate, startAutoRotate, stopAutoRotate, introComplete])

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

  // Toggle 3D buildings
  useEffect(() => {
    if (!map.current || !mapLoaded) return
    const m = map.current

    if (buildings3D) {
      // Add 3D building extrusions if layer doesn't exist
      if (!m.getLayer('3d-buildings')) {
        // Use the composite source which includes building data
        m.addLayer({
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': [
              'interpolate', ['linear'], ['get', 'height'],
              0, 'rgba(180, 170, 150, 0.6)',   // low buildings: warm stone
              20, 'rgba(160, 155, 145, 0.7)',    // medium
              50, 'rgba(140, 140, 140, 0.75)',   // tall buildings
            ],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.7,
          },
        })
      } else {
        m.setLayoutProperty('3d-buildings', 'visibility', 'visible')
      }
    } else {
      if (m.getLayer('3d-buildings')) {
        m.setLayoutProperty('3d-buildings', 'visibility', 'none')
      }
    }
  }, [buildings3D, mapLoaded])

  // Pause auto-rotate on user interaction, resume after 5s
  useEffect(() => {
    if (!map.current || !mapLoaded) return
    const m = map.current

    let resumeTimeout: ReturnType<typeof setTimeout> | null = null

    const pauseRotate = () => {
      if (autoRotateRef.current && autoRotate) {
        stopAutoRotate()
        if (resumeTimeout) clearTimeout(resumeTimeout)
        resumeTimeout = setTimeout(() => {
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
      if (resumeTimeout) clearTimeout(resumeTimeout)
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

    // Determine initial view based on intro sequence
    let initOptions: mapboxgl.MapboxOptions & { container: HTMLElement } = {
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      antialias: true,
      maxZoom: 20,
      minZoom: 1,
      center: MAPBOX_CONFIG.center,
      zoom: MAPBOX_CONFIG.zoom,
      bearing: MAPBOX_CONFIG.bearing,
      pitch: MAPBOX_CONFIG.pitch,
    }

    if (introSequence === 'globe-full') {
      initOptions = {
        ...initOptions,
        center: [30, 15],
        zoom: 1.5,
        pitch: 0,
        bearing: 0,
        projection: 'globe' as any,
      }
    } else if (introSequence === 'fly-orbit') {
      initOptions = {
        ...initOptions,
        center: [-122.2509, 37.8073],
        zoom: 10,
        pitch: 0,
        bearing: 0,
      }
    }

    map.current = new mapboxgl.Map(initOptions)

    // Nav controls: top-right on mobile (avoid bottom overlap), bottom-right on desktop
    const isMobile = window.innerWidth < 640
    map.current.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      isMobile ? 'top-right' : 'bottom-right'
    )

    if (!isMobile) {
      map.current.addControl(
        new mapboxgl.ScaleControl({ maxWidth: 120 }),
        'bottom-left'
      )
    }

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
            'B5', 7, 'C1', 8, 'C2', 9, 'C3', 10, 'C4', 11,
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

      // ── Infrastructure: Restroom Labels (only visible at zoom 18+) ──
      map.current.addLayer({
        id: 'infra-restroom-labels',
        type: 'symbol',
        source: 'booking-zones',
        'source-layer': MAPBOX_CONFIG.sourceLayer,
        minzoom: 17.5,  // Hide at low zoom to reduce clutter
        filter: ['all',
          ['==', ['get', 'type'], 'infrastructure'],
          ['any',
            ['==', ['get', 'infra_type'], 'restroom'],
            ['!', ['has', 'infra_type']],
          ],
        ],
        layout: {
          'text-field': '\u{1F6BB}',
          'text-size': 12,
          'text-anchor': 'center',
          'text-allow-overlap': true,
        },
      })

      // ── Infrastructure: Hand Wash Station (BLUE) ──
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
        ">\u{1F9FC}</div>
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
      new mapboxgl.Marker({ element: handwashMarkerEl, anchor: 'center' })
        .setLngLat([-122.25128, 37.80902])
        .addTo(map.current!)

      // ── Restroom HTML markers for labels ──
      const restroomCoords: [number, number][] = [
        [-122.25130, 37.80906],
        [-122.25126, 37.80898],
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

      // Run the intro sequence after map is loaded
      if (introSequence !== 'instant') {
        runIntro(map.current!, introSequence, onIntroDive360).then(() => {
          setIntroComplete(true)
          onIntroComplete?.()
          // Start auto-rotate after intro
          if (autoRotate) startAutoRotate()
        })
      } else {
        setIntroComplete(true)
        onIntroComplete?.()
        // Start auto-rotate immediately for instant
        if (autoRotate) startAutoRotate()
      }
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
    // Filter out BK1 service boundary, map old tileset names to new code names
    const TILESET_ZONE_MAP: Record<string, string> = {
      'C': 'C1',    // Old tileset has "C", code expects "C1"
      'C2': 'C2',   // Direct match (if tileset updated)
      'D1': 'C2',   // Old D-zone names → new C-zone names
      'D2': 'C3',
      'D3': 'C4',
    }

    map.current.on('click', 'zone-fills', (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      if (!e.features?.length) return

      // Find the first actual booking zone (skip BK1 service boundary)
      const bookingFeature = e.features.find(f => {
        const fType = f.properties?.type
        const fZone = f.properties?.zone
        return fType === 'booking_zone' && fZone !== 'BK1'
      })

      if (!bookingFeature) return

      let zoneId = bookingFeature.properties?.zone
      if (!zoneId) return

      // Map old tileset zone names to current code names
      zoneId = TILESET_ZONE_MAP[zoneId] || zoneId

      onZoneSelect(zoneId)
    })

    // ── Click outside zones to deselect ──
    map.current.on('click', (e: mapboxgl.MapMouseEvent) => {
      if (!map.current) return
      const features = map.current.queryRenderedFeatures(e.point, { layers: ['zone-fills'] })
      // Only deselect if no booking zones found (ignore BK1)
      const hasBookingZone = features.some(f =>
        f.properties?.type === 'booking_zone' && f.properties?.zone !== 'BK1'
      )
      if (!hasBookingZone) onZoneSelect(null)
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
          {zoneData.sunsetQuality === 'golden' && <span className="text-[10px]">&#127749;</span>}
        </div>
      )}

      {/* ── HUD Controls — expandable panel, top-left ── */}
      {introComplete && (
        <div className="absolute top-16 left-3 z-10">
          {hudExpanded ? (
            <div className="rounded-xl p-3 flex flex-col gap-2 w-[180px]"
                 style={{ backdropFilter: 'blur(16px)', background: 'rgba(15,41,55,0.85)', border: '1px solid rgba(212,175,55,0.15)' }}>
              {/* Header with collapse button */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] uppercase tracking-[0.2em] text-gold/60 font-semibold">CONTROLS</span>
                <button onClick={() => setHudExpanded(false)}
                        className="text-cream/30 hover:text-cream/60 text-xs">{'\u25BE'}</button>
              </div>

              {/* Auto-Rotate toggle */}
              <button onClick={() => setAutoRotate(!autoRotate)}
                      className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-[11px] font-medium transition-all ${
                        autoRotate ? 'bg-gold/15 text-gold border border-gold/30' : 'bg-white/5 text-cream/60 border border-white/5'
                      }`}>
                <span className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
                  </svg>
                  Auto-Rotate
                </span>
                <span className={`w-8 h-4 rounded-full relative transition-colors ${autoRotate ? 'bg-gold/40' : 'bg-white/10'}`}>
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${autoRotate ? 'left-4 bg-gold' : 'left-0.5 bg-cream/40'}`} />
                </span>
              </button>

              {/* Speed slider — only visible when auto-rotate is on */}
              {autoRotate && (
                <div className="rounded-lg px-2.5 py-2 bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] text-cream/40 uppercase tracking-wider">Speed</span>
                    <span className="text-[9px] text-gold/60">
                      {rotateSpeed <= 0.03 ? 'Slow' : rotateSpeed <= 0.08 ? 'Medium' : 'Fast'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.02"
                    max="0.2"
                    step="0.01"
                    value={rotateSpeed}
                    onChange={(e) => setRotateSpeed(parseFloat(e.target.value))}
                    className="w-full h-1 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, rgba(212,175,55,0.6) 0%, rgba(212,175,55,0.6) ${((rotateSpeed - 0.02) / 0.18) * 100}%, rgba(255,255,255,0.1) ${((rotateSpeed - 0.02) / 0.18) * 100}%, rgba(255,255,255,0.1) 100%)`,
                    }}
                  />
                </div>
              )}

              {/* 3D Terrain toggle */}
              <button onClick={() => setTerrain3D(!terrain3D)}
                      className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-[11px] font-medium transition-all ${
                        terrain3D ? 'bg-gold/15 text-gold border border-gold/30' : 'bg-white/5 text-cream/60 border border-white/5'
                      }`}>
                <span className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
                  </svg>
                  3D Terrain
                </span>
                <span className={`w-8 h-4 rounded-full relative transition-colors ${terrain3D ? 'bg-gold/40' : 'bg-white/10'}`}>
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${terrain3D ? 'left-4 bg-gold' : 'left-0.5 bg-cream/40'}`} />
                </span>
              </button>

              {/* 3D Buildings toggle */}
              <button onClick={() => setBuildings3D(!buildings3D)}
                      className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-[11px] font-medium transition-all ${
                        buildings3D ? 'bg-gold/15 text-gold border border-gold/30' : 'bg-white/5 text-cream/60 border border-white/5'
                      }`}>
                <span className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="8" width="7" height="13" rx="1" />
                    <rect x="14" y="3" width="7" height="18" rx="1" />
                    <path d="M10 14h4" />
                  </svg>
                  3D Buildings
                </span>
                <span className={`w-8 h-4 rounded-full relative transition-colors ${buildings3D ? 'bg-gold/40' : 'bg-white/10'}`}>
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${buildings3D ? 'left-4 bg-gold' : 'left-0.5 bg-cream/40'}`} />
                </span>
              </button>

              {/* Camera Angle — highlighted active state */}
              <div className="mt-1">
                <div className="text-[9px] text-cream/40 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gold/50">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  Camera Angle
                </div>
                <div className="flex gap-1">
                  {[
                    { label: 'Top', pitch: 0, bearing: 0 },
                    { label: '30\u00B0', pitch: 30, bearing: -20 },
                    { label: '45\u00B0', pitch: 45, bearing: -30 },
                    { label: '70\u00B0', pitch: 70, bearing: -30 },
                  ].map((p) => (
                    <button key={p.label}
                      onClick={() => map.current?.easeTo({ pitch: p.pitch, bearing: p.bearing, duration: 800 })}
                      className={`flex-1 text-[10px] rounded py-1.5 transition-colors text-center border ${
                        Math.abs((map.current?.getPitch() || 70) - p.pitch) < 10
                          ? 'text-gold bg-gold/15 border-gold/30 font-semibold'
                          : 'text-cream/50 hover:text-gold hover:bg-gold/10 border-white/5 hover:border-gold/20'
                      }`}
                    >{p.label}</button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Collapsed: single button to expand */
            <button onClick={() => setHudExpanded(true)}
                    className="rounded-lg w-9 h-9 flex items-center justify-center"
                    style={{ backdropFilter: 'blur(12px)', background: 'rgba(15,41,55,0.8)', border: '1px solid rgba(212,175,55,0.2)' }}>
              <span className="text-gold text-sm">{'\u2699'}</span>
            </button>
          )}
        </div>
      )}

      {/* ── Interactive Legend ── */}
      {/* Mobile: bottom center, full-width bar. Desktop: bottom-left panel */}
      {introComplete && (
        <>
          {legendExpanded ? (
            <>
              {/* Mobile: bottom sheet style */}
              <div className="sm:hidden absolute bottom-0 left-0 right-0 z-20 rounded-t-xl p-3 pb-6"
                   style={{ backdropFilter: 'blur(16px)', background: 'rgba(15,41,55,0.92)', borderTop: '1px solid rgba(212,175,55,0.2)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] uppercase tracking-[0.2em] text-gold/60 font-semibold">LEGEND</span>
                  <button onClick={() => setLegendExpanded(false)}
                          className="text-cream/50 hover:text-cream/80 text-[11px] px-3 py-1 rounded-full border border-white/10 hover:border-gold/20 hover:bg-gold/10 transition-all">
                    Hide
                  </button>
                </div>
                {/* 2-column grid for mobile */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#D4AF37' }} />
                    <span className="text-[11px] text-cream/70">Golden Sunset 🌅</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#4CAF50' }} />
                    <span className="text-[11px] text-cream/70">Partial Sun ⛅</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#6B8F6B' }} />
                    <span className="text-[11px] text-cream/70">Shaded 🌳</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-gold" />
                    <span className="text-[11px] text-cream/50">Umbrella ●</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0 bg-gold" />
                    <span className="text-[11px] text-cream/50">Cabana ■</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#DC2626' }} />
                    <span className="text-[11px] text-cream/50">Restroom 🚻</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#2563EB' }} />
                    <span className="text-[11px] text-cream/50">Hand Wash 🧼</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-gold/60" />
                    <span className="text-[11px] text-cream/50">QR Pole 📍</span>
                  </div>
                </div>
              </div>

              {/* Desktop: side panel */}
              <div className="hidden sm:block absolute bottom-4 left-3 z-10">
                <div className="rounded-xl p-3 w-[200px]"
                     style={{ backdropFilter: 'blur(16px)', background: 'rgba(15,41,55,0.85)', border: '1px solid rgba(212,175,55,0.15)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] uppercase tracking-[0.2em] text-gold/60 font-semibold">LEGEND</span>
                    <button onClick={() => setLegendExpanded(false)}
                            className="text-cream/40 hover:text-cream/80 text-[10px] px-2 py-0.5 rounded border border-white/10 hover:border-gold/20 hover:bg-gold/10 transition-all">
                      Hide
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <button className="flex items-center gap-2 w-full text-left hover:bg-white/5 rounded px-1.5 py-1 transition-colors">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#D4AF37' }} />
                      <span className="text-[11px] text-cream/70">Golden Sunset (+2hrs)</span>
                      <span className="text-[10px] ml-auto">🌅</span>
                    </button>
                    <button className="flex items-center gap-2 w-full text-left hover:bg-white/5 rounded px-1.5 py-1 transition-colors">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#4CAF50' }} />
                      <span className="text-[11px] text-cream/70">Partial Sun</span>
                      <span className="text-[10px] ml-auto">⛅</span>
                    </button>
                    <button className="flex items-center gap-2 w-full text-left hover:bg-white/5 rounded px-1.5 py-1 transition-colors">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#6B8F6B' }} />
                      <span className="text-[11px] text-cream/70">Shaded / Trees</span>
                      <span className="text-[10px] ml-auto">🌳</span>
                    </button>
                    <div className="border-t border-white/10 pt-1.5 mt-1.5" />
                    <div className="flex items-center gap-2 px-1.5 py-0.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-gold" />
                      <span className="text-[11px] text-cream/50">Umbrella Spot</span>
                    </div>
                    <div className="flex items-center gap-2 px-1.5 py-0.5">
                      <div className="w-2.5 h-2.5 rounded-sm shrink-0 bg-gold" />
                      <span className="text-[11px] text-cream/50">Cabana / Tent</span>
                    </div>
                    <div className="border-t border-white/10 pt-1.5 mt-1.5" />
                    <div className="flex items-center gap-2 px-1.5 py-0.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#DC2626' }} />
                      <span className="text-[11px] text-cream/50">Restroom 🚻</span>
                    </div>
                    <div className="flex items-center gap-2 px-1.5 py-0.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#2563EB' }} />
                      <span className="text-[11px] text-cream/50">Hand Wash 🧼</span>
                    </div>
                    <div className="flex items-center gap-2 px-1.5 py-0.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-gold/60" />
                      <span className="text-[11px] text-cream/50">Light Pole / QR 📍</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Collapsed: mobile = bottom-center, desktop = bottom-left */
            <div className="absolute bottom-4 left-1/2 sm:left-3 -translate-x-1/2 sm:translate-x-0 z-10">
              <button onClick={() => setLegendExpanded(true)}
                      className="rounded-xl px-4 py-2.5 flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95"
                      style={{ backdropFilter: 'blur(16px)', background: 'rgba(15,41,55,0.85)', border: '1px solid rgba(212,175,55,0.25)' }}>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#D4AF37' }} />
                  <div className="w-2 h-2 rounded-full" style={{ background: '#4CAF50' }} />
                  <div className="w-2 h-2 rounded-full" style={{ background: '#6B8F6B' }} />
                </div>
                <span className="text-[11px] text-cream/70 font-medium">Show Legend</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
