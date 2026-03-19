'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { AnimatePresence } from 'framer-motion'
import Header from '@/components/Header'
import BookingPanel from '@/components/BookingPanel'
import ZonePrompt from '@/components/ZonePrompt'
import Immersive360Modal from '@/components/Immersive360Modal'
import WeatherBadge from '@/components/WeatherBadge'
import type { Video360Hotspot } from '@/components/BookingMap'

// Dynamic import for map (SSR disabled — Mapbox needs window)
const BookingMap = dynamic(() => import('@/components/BookingMap'), {
  ssr: false,
  loading: () => (
    <div className="w-screen h-screen bg-dusk flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-2 border-gold/30 border-t-gold animate-spin mx-auto mb-4" />
        <div className="font-[family-name:var(--font-display)] text-lg text-cream/80">
          Loading Lake Merritt...
        </div>
        <div className="text-xs text-cream/30 mt-1">Satellite imagery incoming</div>
      </div>
    </div>
  ),
})

// ── 360° Video Hotspots ──
// Each hotspot = a pulsing gold bubble on the map linked to a 360° video
// Future: these will be managed via admin panel + Supabase table
const VIDEO_360_HOTSPOTS: Video360Hotspot[] = [
  {
    id: 'a1-walkway-view',
    label: '360° WALKWAY',
    lngLat: [-122.25150, 37.80835],  // A1/A2 boundary — on the walkway where you stood
    videoUrl: '/360/zone-a2-360.mp4',
    title: 'Zone A1 — Walkway 360° View',
    subtitle: '7-second immersive view from the lakeside walkway',
    startYaw: 135,      // Face the lake/sunset (west-southwest)
    startPitch: -3,     // Slightly below horizon
    startZoom: 40,      // Wide view
  },
  {
    id: 'a1-tents-view',
    label: '360° TENTS',
    lngLat: [-122.25210, 37.80820],  // A1 — near the pergola, tent/umbrella area
    videoUrl: '/360/zone-a2-tents-360.mp4',
    title: 'Zone A1 — Tent & Umbrella Setup',
    subtitle: '45-second immersive view of canopy tents and umbrellas',
    startYaw: 90,       // Face east toward the tents
    startPitch: -5,     // Slightly down to see ground setup
    startZoom: 45,      // Slightly tighter to see tent details
  },
]

export default function BookingPage() {
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [active360, setActive360] = useState<Video360Hotspot | null>(null)

  const handleZoneSelect = useCallback((zoneId: string | null) => {
    setSelectedZone(zoneId)
  }, [])

  const handleOpen360 = useCallback((hotspot: Video360Hotspot) => {
    setActive360(hotspot)
  }, [])

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Map fills the entire viewport */}
      <BookingMap
        onZoneSelect={handleZoneSelect}
        selectedZone={selectedZone}
        onOpen360={handleOpen360}
        video360Hotspots={VIDEO_360_HOTSPOTS}
      />

      {/* Floating header */}
      <Header />

      {/* Weather badge — top-right, below header */}
      <WeatherBadge />

      {/* Zone selection prompt — visible when no zone selected */}
      <AnimatePresence>
        {!selectedZone && <ZonePrompt />}
      </AnimatePresence>

      {/* Booking panel — slides in from right when zone selected */}
      <AnimatePresence>
        {selectedZone && (
          <BookingPanel
            selectedZone={selectedZone}
            onClose={() => setSelectedZone(null)}
          />
        )}
      </AnimatePresence>

      {/* 360° Immersive View Modal — dynamic per hotspot */}
      {active360 && (
        <Immersive360Modal
          isOpen={!!active360}
          onClose={() => setActive360(null)}
          videoUrl={active360.videoUrl}
          title={active360.title}
          subtitle={active360.subtitle}
          startYaw={active360.startYaw}
          startPitch={active360.startPitch}
          startZoom={active360.startZoom}
        />
      )}
    </div>
  )
}
