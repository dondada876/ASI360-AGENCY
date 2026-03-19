'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { AnimatePresence } from 'framer-motion'
import Header from '@/components/Header'
import BookingPanel from '@/components/BookingPanel'
import ZonePrompt from '@/components/ZonePrompt'

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

export default function BookingPage() {
  const [selectedZone, setSelectedZone] = useState<string | null>(null)

  const handleZoneSelect = useCallback((zoneId: string | null) => {
    setSelectedZone(zoneId)
  }, [])

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Map fills the entire viewport */}
      <BookingMap onZoneSelect={handleZoneSelect} selectedZone={selectedZone} />

      {/* Floating header */}
      <Header />

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
    </div>
  )
}
