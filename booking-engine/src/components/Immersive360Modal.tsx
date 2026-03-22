'use client'

import { useEffect, useRef, useCallback, useState, Component, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { useWeather } from '@/hooks/useWeather'

// ── Error Boundary: catches 360° viewer crashes without killing the page ──
class Modal360ErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { hasError: boolean; error: string }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  componentDidCatch(error: Error) {
    console.error('360° viewer crashed:', error)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0a1a] text-white gap-4 p-8">
          <span className="text-4xl">🌅</span>
          <h3 className="text-lg font-semibold">360° view couldn&apos;t load</h3>
          <p className="text-white/50 text-sm text-center max-w-xs">
            The immersive viewer encountered an issue. Tap below to go back to the map.
          </p>
          <button
            onClick={this.props.onError}
            className="px-6 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #D4AF37, #B8962E)',
              color: '#1A1A2E',
            }}
          >
            ← Back to Map
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Zone data for booking context ──
const BOOKING_ZONES = [
  { id: 'A1', name: 'Pergola Lawn', sunset: 'partial', desc: 'Near the pergola, shaded afternoon' },
  { id: 'A2', name: 'Pergola East', sunset: 'partial', desc: 'Open grass, partial sun' },
  { id: 'B1', name: 'Lakefront North', sunset: 'partial', desc: 'Wide grass, lake views' },
  { id: 'B2', name: 'Lakefront Central', sunset: 'partial', desc: 'Prime midday spot' },
  { id: 'B3', name: 'Lakeview Terrace', sunset: 'partial', desc: 'Elevated, great views' },
  { id: 'B4', name: 'Church Lawn', sunset: 'partial', desc: 'Quiet, near Our Lady of Lourdes' },
  { id: 'B5', name: 'Grand Ave Strip', sunset: 'shaded', desc: 'Closest to restaurants' },
  { id: 'C1', name: 'Lakeshore Curve', sunset: 'golden', desc: '🌅 Golden sunset until 8pm' },
  { id: 'C2', name: 'Bellevue Meadow', sunset: 'golden', desc: '🌅 Wide open, extra 2hrs sun' },
  { id: 'C3', name: 'Willow Grove', sunset: 'golden', desc: '🌅 Quiet sunset retreat' },
  { id: 'C4', name: 'South Point', sunset: 'golden', desc: '🌅 Best sunset on the lake' },
]

const TIER_OPTIONS = [
  { id: 'umbrella', label: '☂️ Umbrella', desc: 'Shade + delivered to your spot' },
  { id: 'cabana', label: '🏖️ Cabana', desc: '10×10 canopy tent + rug' },
  { id: 'vip', label: '⭐ VIP', desc: 'Cabana + couch + cooler + speaker' },
]

const DURATION_OPTIONS = [
  { id: '30min', label: '30 Min', shortLabel: '30m' },
  { id: '1hr', label: '1 Hour', shortLabel: '1h' },
  { id: '4hr', label: '4 Hours', shortLabel: '4h' },
  { id: 'fullday', label: 'Full Day', shortLabel: 'All' },
]

interface Immersive360ModalProps {
  isOpen: boolean
  onClose: () => void
  onBookNow?: () => void
  videoUrl: string
  posterUrl?: string
  /** Equirectangular sphere image URL — loads instantly, video loads behind */
  sphereUrl?: string
  /** Low-res sphere preview for instant first visual (~23KB) */
  spherePreviewUrl?: string
  /** Welcome audio narration URL */
  welcomeAudioUrl?: string
  title?: string
  subtitle?: string
  startYaw?: number
  startPitch?: number
  startZoom?: number
  /** Zone ID this 360° is associated with (e.g., 'A1') */
  zoneId?: string
}

// ── Date helpers ──
function getNext14Days(): { date: string; dayName: string; dayNum: number; month: string }[] {
  const days = []
  for (let i = 0; i < 14; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    days.push({
      date: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: d.getDate(),
      month: d.toLocaleDateString('en-US', { month: 'short' }),
    })
  }
  return days
}

const TIME_SLOTS = [
  { id: 'morning', label: 'Morning', hours: '8am–12pm', icon: '🌅' },
  { id: 'afternoon', label: 'Afternoon', hours: '12–4pm', icon: '☀️' },
  { id: 'sunset', label: 'Sunset', hours: '4–8pm', icon: '🌇', premium: true },
]

const QUICK_ADDONS = [
  { id: 'sushi', label: '🍣 Coach Sushi', price: 18, desc: 'Rolls & sake delivered' },
  { id: 'blanket', label: '🧺 Picnic Set', price: 10, desc: 'Blanket + cushion' },
  { id: 'cooler', label: '🧊 Cooler + Ice', price: 10, desc: 'Keeps drinks cold' },
  { id: 'charcuterie', label: '🧀 Charcuterie', price: 25, desc: 'Board for 2' },
]

export default function Immersive360Modal({
  isOpen,
  onClose,
  onBookNow,
  videoUrl,
  posterUrl,
  sphereUrl,
  spherePreviewUrl,
  welcomeAudioUrl,
  title = 'Lake Merritt — Live 360° View',
  subtitle = 'Explore the golden hour experience',
  startYaw = 135,
  startPitch = -3,
  startZoom = 40,
  zoneId,
}: Immersive360ModalProps) {
  const viewerContainerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoPreloadRef = useRef<HTMLVideoElement | null>(null)
  const { getTodayForecast, getWeatherIcon, getSunTime, getForecast } = useWeather()

  // 360 Immersive Engine v2 state
  const [viewMode, setViewMode] = useState<'sphere' | 'video' | 'transitioning'>('sphere')
  const [videoBufferProgress, setVideoBufferProgress] = useState(0)
  const [narrationPlaying, setNarrationPlaying] = useState(false)

  // Booking HUD state
  const [showBookingHUD, setShowBookingHUD] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [selectedZone, setSelectedZone] = useState<string | null>(zoneId || null)
  const [selectedTier, setSelectedTier] = useState<string>('umbrella')
  const [selectedDuration, setSelectedDuration] = useState<string>('1hr')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set())
  const [showZonePicker, setShowZonePicker] = useState(false)

  const todayForecast = getTodayForecast()
  const today = new Date().toISOString().split('T')[0]
  const todaySun = getSunTime(today)
  const forecast14 = getForecast()
  const next14Days = getNext14Days()

  // ── Browser Back Button Handler ──
  // Push a history state when modal opens, pop it to close
  useEffect(() => {
    if (!isOpen) return

    const handlePopState = () => {
      // Back button pressed — close modal instead of navigating away
      onClose()
    }

    // Push a fake history entry so back button has something to pop
    window.history.pushState({ modal360: true }, '', window.location.href)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      // If modal closes via X/Home button (not back button), clean up the fake history entry
      if (window.history.state?.modal360) {
        window.history.back()
      }
    }
  }, [isOpen, onClose])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKey)
    }
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  // Reset booking HUD state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowBookingHUD(false)
      setSelectedDuration('1hr')
      setSelectedDate(null)
      setSelectedSlot(null)
      setSelectedAddons(new Set())
      setShowZonePicker(false)
    } else {
      // Set zone from prop when modal opens
      if (zoneId) setSelectedZone(zoneId)
    }
  }, [isOpen, zoneId])

  // ── 360 Immersive Engine v2: Sphere-first, video crossfade ──
  // Phase 1: Load sphere image instantly (2-5MB vs 69-400MB video)
  // Phase 2: Start voice narration + camera choreography
  // Phase 3: Preload video in background, crossfade when 50% buffered

  const initViewer = useCallback(async () => {
    if (!viewerContainerRef.current || viewerRef.current) return

    // Determine what to load: sphere image (fast) or fall back to video
    const useSphere = !!sphereUrl
    const panoramaSource = useSphere ? sphereUrl : undefined

    try {
      if (useSphere) {
        // ── SPHERE MODE (v2): Load static equirectangular image — instant ──
        const [
          { Viewer },
          { AutorotatePlugin },
          { MarkersPlugin },
        ] = await Promise.all([
          import('@photo-sphere-viewer/core'),
          import('@photo-sphere-viewer/autorotate-plugin'),
          import('@photo-sphere-viewer/markers-plugin'),
        ])

        await import('@photo-sphere-viewer/core/index.css')
        await import('@photo-sphere-viewer/markers-plugin/index.css')

        const viewer = new Viewer({
          container: viewerContainerRef.current,
          panorama: panoramaSource,
          plugins: [
            [AutorotatePlugin, {
              autorotateSpeed: '0.3rpm',   // Slow cinematic rotate
              autostartDelay: 500,
              autostartOnIdle: true,
            }],
            [MarkersPlugin, {
              markers: [], // Hotspots added dynamically
            }],
          ],
          navbar: ['autorotate', 'fullscreen'],
          defaultYaw: (startYaw * Math.PI) / 180,
          defaultPitch: (startPitch * Math.PI) / 180,
          defaultZoomLvl: startZoom,
          minFov: 25,
          maxFov: 110,
          moveSpeed: 1.8,
          moveInertia: true,
          zoomSpeed: 1.5,
          fisheye: false,
          mousewheel: true,
          mousemove: true,
          touchmoveTwoFingers: false,
          caption: '500 Grand Live Social Club — The Umbrella Project',
          loadingTxt: '',  // No loading text — poster is already visible
        })

        viewerRef.current = viewer
        setViewMode('sphere')

        // ── Start voice narration when sphere is ready ──
        viewer.addEventListener('ready', () => {
          // Play welcome audio if provided
          if (welcomeAudioUrl) {
            try {
              const audio = new Audio(welcomeAudioUrl)
              audio.volume = 0.7
              audio.play().then(() => {
                setNarrationPlaying(true)
                audioRef.current = audio
              }).catch(() => {
                // Autoplay blocked — user needs to interact first
                console.log('Audio autoplay blocked — will play on interaction')
              })
              audio.onended = () => setNarrationPlaying(false)
            } catch {}
          }

          // ── Start video preload in background ──
          if (videoUrl) {
            const preloadVideo = document.createElement('video')
            preloadVideo.preload = 'auto'
            preloadVideo.muted = true
            preloadVideo.playsInline = true
            preloadVideo.src = videoUrl
            preloadVideo.style.display = 'none'
            document.body.appendChild(preloadVideo)
            videoPreloadRef.current = preloadVideo

            // Track buffer progress
            const checkBuffer = setInterval(() => {
              if (preloadVideo.buffered.length > 0 && preloadVideo.duration > 0) {
                const buffered = preloadVideo.buffered.end(preloadVideo.buffered.length - 1)
                const progress = Math.round((buffered / preloadVideo.duration) * 100)
                setVideoBufferProgress(progress)

                // Auto-crossfade to video when 50% buffered
                if (progress >= 50 && viewMode === 'sphere') {
                  clearInterval(checkBuffer)
                  // Don't auto-switch — let user stay on sphere unless they want video
                  // The video is ready for instant switch when they tap the toggle
                }
              }
            }, 1000)

            // Cleanup interval on unmount
            return () => clearInterval(checkBuffer)
          }
        })

      } else {
        // ── FALLBACK: Original video mode (v1) ──
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

        await import('@photo-sphere-viewer/core/index.css')
        await import('@photo-sphere-viewer/video-plugin/index.css')

        const viewer = new Viewer({
          container: viewerContainerRef.current,
          adapter: [EquirectangularVideoAdapter, {
            autoplay: true,
            muted: true,
          }],
          panorama: { source: videoUrl },
          plugins: [
            [VideoPlugin, { progressbar: true, bigbutton: false, volume: true }],
            [GyroscopePlugin, { touchmove: true, absolutePosition: true, moveMode: 'smooth' }],
            [AutorotatePlugin, { autorotateSpeed: '0.08rpm', autostartDelay: 1000, autostartOnIdle: true }],
          ],
          navbar: ['videoPlay', 'videoVolume', 'videoTime', 'gyroscope', 'autorotate', 'caption', 'fullscreen'],
          defaultYaw: (startYaw * Math.PI) / 180,
          defaultPitch: (startPitch * Math.PI) / 180,
          defaultZoomLvl: startZoom,
          minFov: 25,
          maxFov: 110,
          moveSpeed: 1.8,
          moveInertia: true,
          zoomSpeed: 1.5,
          fisheye: false,
          mousewheel: true,
          mousemove: true,
          touchmoveTwoFingers: false,
          caption: '500 Grand Live Social Club — The Umbrella Project',
          loadingTxt: 'Loading 360° view...',
        })

        viewer.addEventListener('ready', () => {
          try {
            const videoEl = viewerRef.current?.container?.querySelector('video')
            if (videoEl) { videoEl.volume = 0.5; videoEl.muted = false }
          } catch {}
        })

        viewerRef.current = viewer
        setViewMode('video')
      }
    } catch (err) {
      console.error('Failed to initialize 360° viewer:', err)
    }
  }, [videoUrl, sphereUrl, welcomeAudioUrl, startYaw, startPitch, startZoom, viewMode])

  // ── Switch from sphere to video mode ──
  const switchToVideo = useCallback(async () => {
    if (!viewerRef.current || viewMode === 'video') return
    setViewMode('transitioning')

    try {
      // Capture current camera angle from sphere
      const currentPosition = viewerRef.current.getPosition()
      const currentZoom = viewerRef.current.getZoomLevel()

      // Destroy sphere viewer
      viewerRef.current.destroy()
      viewerRef.current = null

      // Load video viewer at same camera angle
      const [
        { Viewer },
        { EquirectangularVideoAdapter },
        { VideoPlugin },
        { AutorotatePlugin },
      ] = await Promise.all([
        import('@photo-sphere-viewer/core'),
        import('@photo-sphere-viewer/equirectangular-video-adapter'),
        import('@photo-sphere-viewer/video-plugin'),
        import('@photo-sphere-viewer/autorotate-plugin'),
      ])

      await import('@photo-sphere-viewer/video-plugin/index.css')

      const viewer = new Viewer({
        container: viewerContainerRef.current!,
        adapter: [EquirectangularVideoAdapter, { autoplay: true, muted: false }],
        panorama: { source: videoUrl },
        plugins: [
          [VideoPlugin, { progressbar: true, bigbutton: false, volume: true }],
          [AutorotatePlugin, { autorotateSpeed: '0.08rpm', autostartDelay: 2000, autostartOnIdle: true }],
        ],
        navbar: ['videoPlay', 'videoVolume', 'videoTime', 'autorotate', 'fullscreen'],
        defaultYaw: currentPosition.yaw,
        defaultPitch: currentPosition.pitch,
        defaultZoomLvl: currentZoom,
        minFov: 25,
        maxFov: 110,
        moveSpeed: 1.8,
        moveInertia: true,
        caption: '500 Grand Live Social Club — The Umbrella Project',
        loadingTxt: '',
      })

      viewer.addEventListener('ready', () => {
        try {
          const videoEl = viewer.container?.querySelector('video')
          if (videoEl) { videoEl.volume = 0.5 }
        } catch {}
        setViewMode('video')
      })

      viewerRef.current = viewer
    } catch (err) {
      console.error('Failed to switch to video:', err)
      setViewMode('sphere')
    }
  }, [videoUrl, viewMode])

  // ── Switch back to sphere mode ──
  const switchToSphere = useCallback(async () => {
    if (!viewerRef.current || !sphereUrl || viewMode === 'sphere') return
    setViewMode('transitioning')

    try {
      const currentPosition = viewerRef.current.getPosition()
      const currentZoom = viewerRef.current.getZoomLevel()
      viewerRef.current.destroy()
      viewerRef.current = null

      const [
        { Viewer },
        { AutorotatePlugin },
      ] = await Promise.all([
        import('@photo-sphere-viewer/core'),
        import('@photo-sphere-viewer/autorotate-plugin'),
      ])

      const viewer = new Viewer({
        container: viewerContainerRef.current!,
        panorama: sphereUrl,
        plugins: [
          [AutorotatePlugin, { autorotateSpeed: '0.3rpm', autostartDelay: 500, autostartOnIdle: true }],
        ],
        navbar: ['autorotate', 'fullscreen'],
        defaultYaw: currentPosition.yaw,
        defaultPitch: currentPosition.pitch,
        defaultZoomLvl: currentZoom,
        minFov: 25,
        maxFov: 110,
        moveSpeed: 1.8,
        moveInertia: true,
        caption: '500 Grand Live Social Club — The Umbrella Project',
        loadingTxt: '',
      })

      viewerRef.current = viewer
      setViewMode('sphere')
    } catch (err) {
      console.error('Failed to switch to sphere:', err)
    }
  }, [sphereUrl, viewMode])

  // Init on open, cleanup on close
  useEffect(() => {
    if (isOpen) {
      setViewMode('sphere')
      setVideoBufferProgress(0)
      const timer = setTimeout(() => initViewer(), 300)
      return () => clearTimeout(timer)
    } else {
      // Cleanup everything on close
      if (viewerRef.current) {
        try { viewerRef.current.destroy() } catch {}
        viewerRef.current = null
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
        setNarrationPlaying(false)
      }
      if (videoPreloadRef.current) {
        videoPreloadRef.current.pause()
        videoPreloadRef.current.remove()
        videoPreloadRef.current = null
      }
    }
  }, [isOpen, initViewer])

  useEffect(() => {
    return () => {
      if (viewerRef.current) {
        try { viewerRef.current.destroy() } catch {}
        viewerRef.current = null
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (videoPreloadRef.current) {
        videoPreloadRef.current.pause()
        videoPreloadRef.current.remove()
        videoPreloadRef.current = null
      }
    }
  }, [])

  // Toggle addon
  const toggleAddon = (id: string) => {
    setSelectedAddons(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Calculate total using pricing lookup
  const PRICE_TABLE: Record<string, Record<string, number>> = {
    umbrella: { '30min': 15, '1hr': 25, '4hr': 40, fullday: 65 },
    cabana:   { '30min': 45, '1hr': 75, '4hr': 120, fullday: 199 },
    vip:      { '30min': 89, '1hr': 150, '4hr': 250, fullday: 399 },
  }
  const currentTier = TIER_OPTIONS.find(t => t.id === selectedTier) || TIER_OPTIONS[0]
  const basePrice = PRICE_TABLE[selectedTier]?.[selectedDuration] || 25
  const deliveryFee = 25
  const addonsTotal = QUICK_ADDONS.filter(a => selectedAddons.has(a.id)).reduce((sum, a) => sum + a.price, 0)
  const total = basePrice + deliveryFee + addonsTotal
  const currentZone = BOOKING_ZONES.find(z => z.id === selectedZone)
  const durationLabel = DURATION_OPTIONS.find(d => d.id === selectedDuration)?.label || '1 Hour'

  // Get weather for selected date
  const selectedDateWeather = selectedDate
    ? forecast14.find((f) => f.forecast_date === selectedDate)
    : null

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
            className="relative w-[96vw] h-[92vh] sm:max-w-[1500px] rounded-2xl overflow-hidden"
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
            <Modal360ErrorBoundary onError={onClose}>
              {/* Header overlay */}
              <div
                className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 sm:px-5 py-2 sm:py-3"
                style={{
                  background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.85) 0%, transparent 100%)',
                }}
              >
                <div className="flex items-center gap-2">
                  {/* Home/Map button — prominent, always accessible */}
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

                  <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-xl px-2 py-1">
                    <Image
                      src="/500gl-logo.png"
                      alt="500 Grand Live"
                      width={80}
                      height={22}
                      className="h-5 w-auto object-contain"
                    />
                    <span className="text-gold text-[9px] font-bold tracking-wider uppercase">360°</span>
                  </div>

                  <div className="hidden sm:block">
                    <h3 className="font-[family-name:var(--font-display)] text-white text-sm font-medium leading-tight">
                      {title}
                    </h3>
                    <p className="text-white/40 text-[10px] mt-0.5">{subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Weather chip */}
                  {todayForecast && (
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                      style={{
                        backdropFilter: 'blur(12px)',
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid rgba(212,175,55,0.2)',
                      }}
                    >
                      <span className="text-xs">{getWeatherIcon(todayForecast.day_type, todayForecast.condition)}</span>
                      <span className="text-white font-medium text-[10px]">{Math.round(todayForecast.high_f)}°</span>
                      {todaySun && <span className="text-amber-400/60 text-[9px]">🌅{todaySun.sunset}</span>}
                    </div>
                  )}

                  {/* Close button */}
                  <button
                    onClick={onClose}
                    className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all
                      bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/25"
                  >
                    <span className="text-white/50 group-hover:text-white text-[10px] hidden sm:inline">ESC</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      className="text-white/50 group-hover:text-white transition-colors">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Book This Spot CTA — toggles the booking HUD */}
              <div className="absolute top-14 left-3 sm:left-5 z-30 flex gap-2 items-start">
                <button
                  onClick={() => setShowBookingHUD(!showBookingHUD)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs sm:text-sm transition-all duration-300 hover:scale-105 active:scale-95"
                  style={{
                    background: showBookingHUD
                      ? 'rgba(30, 30, 60, 0.9)'
                      : 'linear-gradient(135deg, #D4AF37, #B8962E)',
                    color: showBookingHUD ? '#FFFFFF' : '#1A1A2E',
                    boxShadow: showBookingHUD
                      ? '0 2px 12px rgba(0,0,0,0.5)'
                      : '0 4px 20px rgba(212,175,55,0.4)',
                    border: showBookingHUD
                      ? '1px solid rgba(255,255,255,0.2)'
                      : '1px solid rgba(255,248,240,0.3)',
                  }}
                >
                  <span>{showBookingHUD ? '✕' : '☂️'}</span>
                  <span>{showBookingHUD ? 'Hide Booking' : 'Book This Spot'}</span>
                </button>

                {/* ═══ LIVE PREVIEW THERMOMETER — Photo/Video toggle + buffer progress ═══ */}
                {sphereUrl && (
                  <div className="flex flex-col items-center gap-1.5">
                    {/* Photo / Video segmented toggle */}
                    <div
                      className="flex items-center rounded-full overflow-hidden"
                      style={{
                        background: 'rgba(10,10,26,0.85)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(212,175,55,0.25)',
                      }}
                    >
                      <button
                        onClick={switchToSphere}
                        className="px-3 py-1.5 text-[10px] font-bold transition-all"
                        style={{
                          background: viewMode === 'sphere' ? 'rgba(212,175,55,0.3)' : 'transparent',
                          color: viewMode === 'sphere' ? '#D4AF37' : 'rgba(255,255,255,0.5)',
                        }}
                      >
                        📷 Photo
                      </button>
                      <button
                        onClick={switchToVideo}
                        disabled={viewMode === 'transitioning'}
                        className="px-3 py-1.5 text-[10px] font-bold transition-all"
                        style={{
                          background: viewMode === 'video' ? 'rgba(212,175,55,0.3)' : 'transparent',
                          color: viewMode === 'video' ? '#D4AF37' : 'rgba(255,255,255,0.5)',
                          opacity: viewMode === 'transitioning' ? 0.5 : 1,
                        }}
                      >
                        🎬 {viewMode === 'transitioning' ? 'Loading...' : 'Video'}
                      </button>
                    </div>

                    {/* Thermometer — Live Preview buffer indicator */}
                    {videoUrl && viewMode === 'sphere' && videoBufferProgress < 100 && (
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                        style={{
                          background: 'rgba(10,10,26,0.85)',
                          backdropFilter: 'blur(12px)',
                          border: '1px solid rgba(212,175,55,0.15)',
                        }}
                      >
                        {/* Thermometer bar */}
                        <div className="relative w-12 h-2 rounded-full overflow-hidden bg-white/10">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
                            style={{
                              width: `${videoBufferProgress}%`,
                              background: videoBufferProgress >= 50
                                ? 'linear-gradient(90deg, #D4AF37, #4ADE80)'
                                : 'linear-gradient(90deg, #D4AF37, #FBBF24)',
                            }}
                          />
                        </div>
                        <span className="text-[8px] font-medium" style={{
                          color: videoBufferProgress >= 50 ? '#4ADE80' : 'rgba(255,255,255,0.4)',
                        }}>
                          {videoBufferProgress >= 50 ? '🟢 Live Ready' : `${videoBufferProgress}%`}
                        </span>
                      </div>
                    )}

                    {/* Live Preview active badge */}
                    {viewMode === 'video' && (
                      <div
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full animate-pulse"
                        style={{
                          background: 'rgba(74,222,128,0.15)',
                          border: '1px solid rgba(74,222,128,0.3)',
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-green-400 text-[9px] font-bold">LIVE PREVIEW</span>
                      </div>
                    )}

                    {/* Narration indicator */}
                    {narrationPlaying && (
                      <div
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                        style={{
                          background: 'rgba(212,175,55,0.1)',
                          border: '1px solid rgba(212,175,55,0.2)',
                        }}
                      >
                        <span className="text-[9px]">🔊</span>
                        <span className="text-gold/70 text-[8px] font-medium">Athena speaking...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ═══ BOOKING HUD — Bottom Sheet inside 360° ═══ */}
              <AnimatePresence>
                {showBookingHUD && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 z-30 max-h-[55vh] overflow-y-auto"
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                    style={{
                      background: 'linear-gradient(to top, rgba(10,10,26,0.95) 0%, rgba(10,10,26,0.85) 100%)',
                      backdropFilter: 'blur(20px)',
                      borderTop: '1px solid rgba(212,175,55,0.2)',
                    }}
                  >
                    {/* Drag handle */}
                    <div className="flex justify-center pt-2 pb-1">
                      <div className="w-10 h-1 rounded-full bg-white/20" />
                    </div>

                    <div className="px-4 pb-4 space-y-3">
                      {/* Zone selector + title */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowZonePicker(!showZonePicker)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all bg-gold/15 border border-gold/30 hover:bg-gold/25 active:scale-95"
                          >
                            <span className="text-gold font-bold text-xs">{selectedZone || '—'}</span>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="text-gold/60">
                              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </button>
                          <div>
                            <h4 className="text-white font-semibold text-sm">
                              {currentZone ? currentZone.name : 'Choose a Zone'}
                            </h4>
                            {currentZone && (
                              <p className="text-white/40 text-[9px]">{currentZone.desc}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-gold text-xs font-medium">{currentTier.label} · 1 Hour</span>
                      </div>

                      {/* Zone picker dropdown */}
                      <AnimatePresence>
                        {showZonePicker && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1 mb-1">
                              {BOOKING_ZONES.map((zone) => (
                                <button
                                  key={zone.id}
                                  onClick={() => { setSelectedZone(zone.id); setShowZonePicker(false) }}
                                  className={`flex flex-col items-center py-1.5 px-1 rounded-lg transition-all text-center ${
                                    selectedZone === zone.id
                                      ? 'bg-gold/20 border-gold/50'
                                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                                  } border`}
                                >
                                  <span className={`text-[11px] font-bold ${selectedZone === zone.id ? 'text-gold' : 'text-white'}`}>
                                    {zone.id}
                                  </span>
                                  <span className="text-white/30 text-[7px] leading-tight truncate w-full">
                                    {zone.sunset === 'golden' ? '🌅' : ''}{zone.name.split(' ')[0]}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* ── Tier + Duration Selection ── */}
                      <div className="space-y-2">
                        <div className="flex gap-1.5">
                          {TIER_OPTIONS.map((tier) => (
                            <button
                              key={tier.id}
                              onClick={() => setSelectedTier(tier.id)}
                              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all ${
                                selectedTier === tier.id
                                  ? 'bg-gold/20 border-gold/50'
                                  : 'bg-white/5 border-white/10 hover:bg-white/10'
                              } border`}
                            >
                              <span className="text-sm">{tier.label.split(' ')[0]}</span>
                              <span className={`text-[10px] font-semibold ${selectedTier === tier.id ? 'text-gold' : 'text-white/70'}`}>
                                {tier.label.split(' ').slice(1).join(' ')}
                              </span>
                              <span className="text-white/30 text-[8px]">{tier.desc}</span>
                            </button>
                          ))}
                        </div>

                        {/* Duration pills */}
                        <div className="flex gap-1">
                          {DURATION_OPTIONS.map((dur) => (
                            <button
                              key={dur.id}
                              onClick={() => setSelectedDuration(dur.id)}
                              className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                                selectedDuration === dur.id
                                  ? 'bg-gold/20 border-gold/40 text-gold'
                                  : 'bg-white/5 border-white/8 text-white/50 hover:bg-white/10'
                              } border text-[10px] font-semibold`}
                            >
                              {dur.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* ── Date Strip (14 days with weather) ── */}
                      <div>
                        <p className="text-white/40 text-[10px] font-medium tracking-wider uppercase mb-1.5">Pick a Date</p>
                        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                          {next14Days.map((day) => {
                            const dayWeather = forecast14.find((f) =>
                              f.forecast_date === day.date
                            )
                            const isSelected = selectedDate === day.date
                            const isToday = day.date === today
                            const highTemp = dayWeather ? Math.round(dayWeather.high_f || 0) : null
                            const isHot = highTemp && highTemp >= 80

                            return (
                              <button
                                key={day.date}
                                onClick={() => setSelectedDate(isSelected ? null : day.date)}
                                className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all ${
                                  isSelected
                                    ? 'bg-gold/20 border-gold/50 scale-105'
                                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                                } border`}
                                style={{ minWidth: 52 }}
                              >
                                <span className={`text-[9px] font-medium ${isToday ? 'text-gold' : 'text-white/40'}`}>
                                  {isToday ? 'Today' : day.dayName}
                                </span>
                                <span className={`text-sm font-bold ${isSelected ? 'text-gold' : 'text-white'}`}>
                                  {day.dayNum}
                                </span>
                                {highTemp ? (
                                  <>
                                    <span className="text-[10px]">
                                      {dayWeather?.condition?.includes('Rain') ? '🌧' :
                                       dayWeather?.condition?.includes('Cloud') ? '⛅' : '☀️'}
                                    </span>
                                    <span className={`text-[10px] font-semibold ${
                                      isHot ? 'text-amber-400' : 'text-white/50'
                                    }`}>
                                      {highTemp}°
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-white/20 text-[10px]">—</span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* ── Time Slots ── */}
                      {selectedDate && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          transition={{ duration: 0.2 }}
                        >
                          <p className="text-white/40 text-[10px] font-medium tracking-wider uppercase mb-1.5">
                            Choose Time
                            {selectedDateWeather && (
                              <span className="text-amber-400/70 ml-2 normal-case">
                                Sunset: {getSunTime(selectedDate)?.sunset || '—'}
                              </span>
                            )}
                          </p>
                          <div className="flex gap-2">
                            {TIME_SLOTS.map((slot) => {
                              const isSelected = selectedSlot === slot.id
                              return (
                                <button
                                  key={slot.id}
                                  onClick={() => setSelectedSlot(isSelected ? null : slot.id)}
                                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all ${
                                    isSelected
                                      ? 'bg-gold/20 border-gold/50'
                                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                                  } border`}
                                >
                                  <span className="text-sm">{slot.icon}</span>
                                  <span className={`text-[11px] font-semibold ${isSelected ? 'text-gold' : 'text-white'}`}>
                                    {slot.label}
                                  </span>
                                  <span className="text-white/30 text-[9px]">{slot.hours}</span>
                                  {slot.premium && (
                                    <span className="text-amber-400 text-[8px] font-bold">★ GOLDEN HOUR</span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </motion.div>
                      )}

                      {/* ── Quick Add-Ons ── */}
                      {selectedSlot && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          transition={{ duration: 0.2 }}
                        >
                          <p className="text-white/40 text-[10px] font-medium tracking-wider uppercase mb-1.5">Add to Your Experience</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {QUICK_ADDONS.map((addon) => {
                              const isOn = selectedAddons.has(addon.id)
                              return (
                                <button
                                  key={addon.id}
                                  onClick={() => toggleAddon(addon.id)}
                                  className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all ${
                                    isOn
                                      ? 'bg-gold/15 border-gold/40'
                                      : 'bg-white/5 border-white/8 hover:bg-white/10'
                                  } border`}
                                >
                                  <span className="text-sm">{addon.label.split(' ')[0]}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className={`text-[10px] font-medium truncate ${isOn ? 'text-gold' : 'text-white/70'}`}>
                                      {addon.label.split(' ').slice(1).join(' ')}
                                    </div>
                                    <div className="text-white/30 text-[9px]">+${addon.price}</div>
                                  </div>
                                  <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${
                                    isOn ? 'bg-gold text-black' : 'bg-white/10 text-white/30'
                                  }`}>
                                    {isOn ? '✓' : '+'}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </motion.div>
                      )}

                      {/* ── Book CTA ── */}
                      {selectedDate && selectedSlot && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <button
                            onClick={async () => {
                              setCheckoutLoading(true)
                              try {
                                const res = await fetch('/api/checkout', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    zone_id: selectedZone,
                                    tier: selectedTier,
                                    duration: selectedDuration,
                                    booking_date: selectedDate,
                                    time_slot: selectedSlot,
                                    addons: Array.from(selectedAddons),
                                    email: 'donbucknor@gmail.com', // TODO: collect from member
                                    name: 'Guest',
                                  }),
                                })
                                const data = await res.json()
                                if (data.checkout_url) {
                                  window.location.href = data.checkout_url
                                } else {
                                  setCheckoutError(data.error || 'Checkout failed')
                                  setTimeout(() => setCheckoutError(null), 4000)
                                }
                              } catch (err) {
                                setCheckoutError('Connection error — try again')
                                setTimeout(() => setCheckoutError(null), 4000)
                              } finally {
                                setCheckoutLoading(false)
                              }
                            }}
                            disabled={checkoutLoading}
                            className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                            style={{
                              background: 'linear-gradient(135deg, #D4AF37, #B8962E)',
                              color: '#1A1A2E',
                              boxShadow: '0 4px 24px rgba(212,175,55,0.4)',
                            }}
                          >
                            <div className="flex items-center justify-center gap-2">
                              <span>{currentTier.label.split(' ')[0]}</span>
                              <span>{checkoutLoading ? 'Connecting to Stripe...' : `Book Now — $${total}`}</span>
                            </div>
                            <div className="text-[10px] opacity-60 mt-0.5">
                              Zone {selectedZone} · {currentTier.label.split(' ').slice(1).join(' ')} ${basePrice} + Delivery $25{addonsTotal > 0 ? ` + Add-ons $${addonsTotal}` : ''}
                            </div>
                            {checkoutError && (
                              <div className="text-red-400 text-[10px] mt-1">{checkoutError}</div>
                            )}
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ═══ STICKY CART BAR — shows when HUD is closed but has selections ═══ */}
              {!showBookingHUD && (selectedDate || selectedZone) && (
                <motion.div
                  className="absolute bottom-0 left-0 right-0 z-30"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <button
                    onClick={() => setShowBookingHUD(true)}
                    className="w-full flex items-center justify-between px-4 py-3 transition-all"
                    style={{
                      background: 'linear-gradient(to top, rgba(10,10,26,0.95), rgba(10,10,26,0.8))',
                      backdropFilter: 'blur(16px)',
                      borderTop: '1px solid rgba(212,175,55,0.3)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gold font-bold text-xs px-2 py-0.5 rounded bg-gold/15 border border-gold/30">
                        {selectedZone || '—'}
                      </span>
                      <span className="text-white text-xs">
                        {currentTier.label}
                        {selectedDate && ` · ${new Date(selectedDate + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}
                        {selectedSlot && ` · ${TIME_SLOTS.find(s => s.id === selectedSlot)?.label}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gold font-bold text-sm">${total}</span>
                      <span className="text-[9px] text-white/40 bg-white/10 px-2 py-0.5 rounded-full">
                        Tap to edit ↑
                      </span>
                    </div>
                  </button>
                </motion.div>
              )}

              {/* Photo Sphere Viewer container — fills entire modal */}
              <div
                ref={viewerContainerRef}
                className={`w-full h-full viewer-360 ${showBookingHUD ? 'hud-open' : 'hud-closed'}`}
              />
            </Modal360ErrorBoundary>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
