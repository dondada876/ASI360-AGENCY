'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { AnimatePresence } from 'framer-motion'
import Header from '@/components/Header'
import BookingPanel from '@/components/BookingPanel'
import ZonePrompt from '@/components/ZonePrompt'
import Immersive360Modal from '@/components/Immersive360Modal'
import WeatherBadge from '@/components/WeatherBadge'
import AthenaButton from '@/components/AthenaButton'
import { getIntroSequence, incrementVisitCount } from '@/lib/intro'
import type { IntroSequence } from '@/lib/intro'
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
    label: '360\u00B0 WALKWAY',
    lngLat: [-122.25150, 37.80835],
    videoUrl: '/360/zone-a2-360.mp4',
    posterUrl: '/360/posters/walkway-poster.jpg',
    title: 'Zone A1 \u2014 Walkway 360\u00B0 View',
    subtitle: '7-second immersive view from the lakeside walkway',
    startYaw: 135,
    startPitch: -3,
    startZoom: 40,
  },
  {
    id: 'a1-tents-view',
    label: '360\u00B0 TENTS',
    lngLat: [-122.25210, 37.80820],
    videoUrl: '/360/zone-a2-tents-360.mp4',
    posterUrl: '/360/posters/tents-poster.jpg',
    title: 'Zone A1 \u2014 Tent & Umbrella Setup',
    subtitle: '45-second immersive view of canopy tents and umbrellas',
    startYaw: 210,
    startPitch: -8,
    startZoom: 42,
  },
]

export default function BookingPage() {
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [active360, setActive360] = useState<Video360Hotspot | null>(null)
  const [introSequence] = useState<IntroSequence>(() => getIntroSequence())
  const [introComplete, setIntroComplete] = useState(false)
  const [showIntroOverlay, setShowIntroOverlay] = useState(() => introSequence === 'globe-full')

  // Increment visit count on mount
  useEffect(() => {
    incrementVisitCount()
  }, [])

  // Hide intro overlay after globe phase
  useEffect(() => {
    if (showIntroOverlay) {
      const timer = setTimeout(() => setShowIntroOverlay(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [showIntroOverlay])

  const handleZoneSelect = useCallback((zoneId: string | null) => {
    setSelectedZone(zoneId)
  }, [])

  const handleOpen360 = useCallback((hotspot: Video360Hotspot) => {
    setActive360(hotspot)
  }, [])

  const handleIntroDive360 = useCallback(() => {
    // Open the A1 walkway 360° hotspot automatically at end of globe intro
    const a1Hotspot = VIDEO_360_HOTSPOTS.find(h => h.id === 'a1-walkway-view')
    if (a1Hotspot) setActive360(a1Hotspot)
  }, [])

  const handleIntroComplete = useCallback(() => {
    setIntroComplete(true)
  }, [])

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Map fills the entire viewport */}
      <BookingMap
        onZoneSelect={handleZoneSelect}
        selectedZone={selectedZone}
        onOpen360={handleOpen360}
        video360Hotspots={VIDEO_360_HOTSPOTS}
        introSequence={introSequence}
        onIntroDive360={handleIntroDive360}
        onIntroComplete={handleIntroComplete}
      />

      {/* Globe intro overlay text — only on first visit during globe phase */}
      {showIntroOverlay && (
        <div className="intro-overlay">
          <div>
            <div className="intro-title text-3xl sm:text-5xl">500 Grand Live</div>
            <div className="intro-subtitle text-center">Lake Merritt Social Club</div>
          </div>
        </div>
      )}

      {/* Floating header */}
      <Header />

      {/* Weather badge — always visible */}
      <WeatherBadge />

      {/* Athena voice concierge — floating button, right side */}
      <AthenaButton
        onSelectZone={(zoneId) => {
          setActive360(null) // close 360 if open
          setTimeout(() => setSelectedZone(zoneId), 300)
        }}
      />

      {/* Zone selection prompt — visible when no zone selected, only after intro */}
      <AnimatePresence>
        {!selectedZone && introComplete && <ZonePrompt />}
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
          onBookNow={() => {
            // Close 360° modal and open booking panel for nearest zone
            const nearestZone = active360.id.startsWith('a') ? 'A1' : 'B1'
            setActive360(null)
            setTimeout(() => setSelectedZone(nearestZone), 300) // Wait for modal close animation
          }}
          videoUrl={active360.videoUrl}
          posterUrl={active360.posterUrl}
          title={active360.title}
          subtitle={active360.subtitle}
          startYaw={active360.startYaw}
          startPitch={active360.startPitch}
          startZoom={active360.startZoom}
          zoneId={active360.id.includes('walkway') ? 'A2' : 'A1'}
        />
      )}
    </div>
  )
}
