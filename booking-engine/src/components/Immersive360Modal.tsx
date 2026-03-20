'use client'

import { useEffect, useRef, useCallback, useState, Component, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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

interface Immersive360ModalProps {
  isOpen: boolean
  onClose: () => void
  onBookNow?: () => void
  videoUrl: string
  posterUrl?: string
  title?: string
  subtitle?: string
  startYaw?: number
  startPitch?: number
  startZoom?: number
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
  title = 'Lake Merritt — Live 360° View',
  subtitle = 'Explore the golden hour experience',
  startYaw = 135,
  startPitch = -3,
  startZoom = 40,
}: Immersive360ModalProps) {
  const viewerContainerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const { getTodayForecast, getWeatherIcon, getSunTime, getForecast } = useWeather()

  // Booking HUD state
  const [showBookingHUD, setShowBookingHUD] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set())

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
      setSelectedDate(null)
      setSelectedSlot(null)
      setSelectedAddons(new Set())
    }
  }, [isOpen])

  // Initialize Photo Sphere Viewer
  const initViewer = useCallback(async () => {
    if (!viewerContainerRef.current || viewerRef.current) return

    try {
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
          muted: false,
        }],
        panorama: {
          source: videoUrl,
        },
        plugins: [
          [VideoPlugin, {
            progressbar: true,
            bigbutton: false,
            volume: true,
          }],
          [GyroscopePlugin, {
            touchmove: true,
            absolutePosition: true,
            moveMode: 'smooth',
          }],
          [AutorotatePlugin, {
            autorotateSpeed: '0.08rpm',   // Very slow — 12 min per rotation
            autostartDelay: 1000,
            autostartOnIdle: true,
          }],
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

      viewerRef.current = viewer
    } catch (err) {
      console.error('Failed to initialize 360° viewer:', err)
    }
  }, [videoUrl, startYaw, startPitch, startZoom])

  // Init on open, cleanup on close
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => initViewer(), 300)
      return () => clearTimeout(timer)
    } else {
      if (viewerRef.current) {
        try { viewerRef.current.destroy() } catch {}
        viewerRef.current = null
      }
    }
  }, [isOpen, initViewer])

  useEffect(() => {
    return () => {
      if (viewerRef.current) {
        try { viewerRef.current.destroy() } catch {}
        viewerRef.current = null
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

  // Calculate total
  const basePrice = 25
  const deliveryFee = 25
  const addonsTotal = QUICK_ADDONS.filter(a => selectedAddons.has(a.id)).reduce((sum, a) => sum + a.price, 0)
  const total = basePrice + deliveryFee + addonsTotal

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

                  <div className="flex items-center gap-1.5 bg-gold/15 border border-gold/30 rounded-full px-2.5 py-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-gold">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                      <ellipse cx="12" cy="12" rx="4" ry="10" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M2 12h20" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
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
              <div className="absolute top-14 left-3 sm:left-5 z-30 flex gap-2">
                <button
                  onClick={() => setShowBookingHUD(!showBookingHUD)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-xs sm:text-sm transition-all duration-300 hover:scale-105 active:scale-95"
                  style={{
                    background: showBookingHUD
                      ? 'rgba(212,175,55,0.2)'
                      : 'linear-gradient(135deg, #D4AF37, #B8962E)',
                    color: showBookingHUD ? '#D4AF37' : '#1A1A2E',
                    boxShadow: showBookingHUD ? 'none' : '0 4px 20px rgba(212,175,55,0.4)',
                    border: showBookingHUD ? '1px solid rgba(212,175,55,0.4)' : '1px solid rgba(255,248,240,0.3)',
                  }}
                >
                  <span>☂️</span>
                  <span>{showBookingHUD ? 'Hide Booking' : 'Book This Spot'}</span>
                </button>
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
                      {/* Title */}
                      <div className="flex items-center justify-between">
                        <h4 className="text-white font-semibold text-sm">Book Your Spot</h4>
                        <span className="text-gold text-xs font-medium">☂️ Umbrella · 1 Hour</span>
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
                            onClick={() => {
                              setShowBookingHUD(false)
                              if (onBookNow) onBookNow()
                            }}
                            className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                            style={{
                              background: 'linear-gradient(135deg, #D4AF37, #B8962E)',
                              color: '#1A1A2E',
                              boxShadow: '0 4px 24px rgba(212,175,55,0.4)',
                            }}
                          >
                            <div className="flex items-center justify-center gap-2">
                              <span>☂️</span>
                              <span>Book Now — ${total}</span>
                            </div>
                            <div className="text-[10px] opacity-60 mt-0.5">
                              Umbrella $25 + Delivery $25{addonsTotal > 0 ? ` + Add-ons $${addonsTotal}` : ''}
                            </div>
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Photo Sphere Viewer container — fills entire modal */}
              <div
                ref={viewerContainerRef}
                className="w-full h-full viewer-360"
              />
            </Modal360ErrorBoundary>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
