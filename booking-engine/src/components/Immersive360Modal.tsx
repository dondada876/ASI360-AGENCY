'use client'

import { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWeather } from '@/hooks/useWeather'

interface Immersive360ModalProps {
  isOpen: boolean
  onClose: () => void
  onBookNow?: () => void
  videoUrl: string
  posterUrl?: string
  title?: string
  subtitle?: string
  /** Initial horizontal angle in degrees (0-360). 0=center of frame, 180=behind camera */
  startYaw?: number
  /** Initial vertical angle in degrees. 0=horizon, negative=look down, positive=look up */
  startPitch?: number
  /** Initial zoom level 0-100. Lower=wider view, Higher=zoomed in */
  startZoom?: number
}

export default function Immersive360Modal({
  isOpen,
  onClose,
  onBookNow,
  videoUrl,
  posterUrl,
  title = 'Lake Merritt — Live 360° View',
  subtitle = 'Explore the golden hour experience',
  startYaw = 135,
  startPitch = -3,
  startZoom = 40,
}: Immersive360ModalProps) {
  const viewerContainerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const { getTodayForecast, getWeatherIcon, getSunTime } = useWeather()

  const todayForecast = getTodayForecast()
  const today = new Date().toISOString().split('T')[0]
  const todaySun = getSunTime(today)

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKey)
    }
    return () => {
      document.removeEventListener('keydown', handleKey)
    }
  }, [isOpen, onClose])

  // Initialize Photo Sphere Viewer
  const initViewer = useCallback(async () => {
    if (!viewerContainerRef.current || viewerRef.current) return

    const [
      { Viewer },
      { EquirectangularVideoAdapter },
      { VideoPlugin },
      { GyroscopePlugin },
      { AutorotatePlugin },
    ] = await Promise.all([
      import('@photo-sphere-viewer/core'),
      import('@photo-sphere-viewer/equirectangular-video-adapter'),
      import('@photo-sphere-viewer/video-plugin'),
      import('@photo-sphere-viewer/gyroscope-plugin'),
      import('@photo-sphere-viewer/autorotate-plugin'),
    ])

    // Import CSS
    await import('@photo-sphere-viewer/core/index.css')
    await import('@photo-sphere-viewer/video-plugin/index.css')

    const viewer = new Viewer({
      container: viewerContainerRef.current,
      adapter: [EquirectangularVideoAdapter, {
        autoplay: true,   // Auto-play video when modal opens
        muted: false,     // Sound ON for immersive experience
      }],
      panorama: {
        source: videoUrl,
      },
      plugins: [
        [VideoPlugin, {
          progressbar: true,
          bigbutton: false,     // No big play button — auto-plays immediately
          volume: true,         // Show volume control
        }],
        [GyroscopePlugin, {
          touchmove: true,      // Phone gyro controls the view
          absolutePosition: true, // Match phone orientation to camera orientation
          moveMode: 'smooth',   // Smooth gyro tracking, not jerky
        }],
        [AutorotatePlugin, {
          autorotateSpeed: '0.3rpm',    // Slow, cinematic rotation
          autostartDelay: 1000,         // Start rotating after 1 second
          autostartOnIdle: true,        // Resume rotation when user stops interacting
        }],
      ],
      navbar: ['videoPlay', 'videoVolume', 'videoTime', 'gyroscope', 'autorotate', 'caption', 'fullscreen'],

      // ── Initial Camera Position ──
      // Yaw = horizontal rotation (radians). 0 = center of equirectangular
      // Insta360 X4: front lens faces the center of the frame
      // Adjust these to face the lake/sunset direction on first load
      defaultYaw: (startYaw * Math.PI) / 180,     // Convert degrees to radians
      defaultPitch: (startPitch * Math.PI) / 180,  // Convert degrees to radians
      defaultZoomLvl: startZoom,                    // 0-100 scale

      // ── Zoom Limits ──
      minFov: 25,                   // Max zoom in — tight detail
      maxFov: 110,                  // Max zoom out — ultra-wide panorama

      // ── Movement ──
      moveSpeed: 1.8,               // Drag sensitivity — higher = faster rotation
      moveInertia: true,            // Smooth coast after releasing drag
      zoomSpeed: 1.5,               // Scroll/pinch zoom sensitivity

      // ── Rendering ──
      fisheye: false,
      mousewheel: true,
      mousemove: true,
      touchmoveTwoFingers: false,   // Single finger drag works

      caption: '500 Grand Live Social Club — Zone A2 Pergola East',
      loadingTxt: 'Loading 360° view...',
    })

    viewerRef.current = viewer
  }, [videoUrl])

  // Init on open, cleanup on close
  useEffect(() => {
    if (isOpen) {
      // Small delay to let the modal animate in
      const timer = setTimeout(() => initViewer(), 300)
      return () => clearTimeout(timer)
    } else {
      if (viewerRef.current) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  }, [isOpen, initViewer])

  // Full cleanup on unmount
  useEffect(() => {
    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  }, [])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="relative w-[96vw] h-[92vh] max-w-[1500px] rounded-2xl overflow-hidden"
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            style={{
              background: '#000',
              border: '1px solid rgba(212, 175, 55, 0.25)',
              boxShadow: '0 40px 120px rgba(0, 0, 0, 0.7), 0 0 60px rgba(212, 175, 55, 0.08)',
            }}
          >
            {/* Header overlay */}
            <div
              className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-5 py-3"
              style={{
                background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.8) 0%, transparent 100%)',
              }}
            >
              <div className="flex items-center gap-2">
                {/* Home button — clearly visible, always accessible */}
                <button
                  onClick={onClose}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full transition-all
                    bg-white/10 hover:bg-white/20 border border-white/15 hover:border-gold/40 active:scale-95"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white">
                    <path d="M3 12l9-9 9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-white text-[11px] font-semibold">Map</span>
                </button>

                <div className="flex items-center gap-2 bg-gold/15 border border-gold/30 rounded-full px-3 py-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-gold">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                    <ellipse cx="12" cy="12" rx="4" ry="10" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M2 12h20" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  <span className="text-gold text-[10px] font-bold tracking-wider uppercase">360°</span>
                </div>
                <div className="hidden sm:block">
                  <h3 className="font-[family-name:var(--font-display)] text-white text-sm font-medium leading-tight">
                    {title}
                  </h3>
                  <p className="text-white/40 text-[10px] mt-0.5">{subtitle}</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="group flex items-center gap-2 px-3 py-1.5 rounded-full transition-all
                  bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/25"
              >
                <span className="text-white/50 group-hover:text-white text-[10px] tracking-wide">ESC</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  className="text-white/50 group-hover:text-white transition-colors">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Book Now CTA — top area, below header, always visible above video controls */}
            {onBookNow && (
              <div className="absolute top-14 left-5 z-30">
                <button
                  onClick={onBookNow}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 hover:scale-105 active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #D4AF37, #B8962E)',
                    color: '#1A1A2E',
                    boxShadow: '0 4px 20px rgba(212,175,55,0.4), 0 0 40px rgba(212,175,55,0.15)',
                    border: '1px solid rgba(255,248,240,0.3)',
                  }}
                >
                  <span>☂️</span>
                  <span>Book This Spot</span>
                </button>
              </div>
            )}

            {/* Weather chip — top-right, below close button */}
            {todayForecast && (
              <div
                className="absolute top-14 right-5 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{
                  backdropFilter: 'blur(12px)',
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(212,175,55,0.2)',
                }}
              >
                <span className="text-sm">{getWeatherIcon(todayForecast.day_type, todayForecast.condition)}</span>
                <span className="text-white font-medium text-[11px]">{Math.round(todayForecast.high_f)}°F</span>
                {todaySun && <span className="text-amber-400/70 text-[10px]">🌅{todaySun.sunset}</span>}
              </div>
            )}

            {/* Photo Sphere Viewer container — fills entire modal */}
            <div
              ref={viewerContainerRef}
              className="w-full h-full viewer-360"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
