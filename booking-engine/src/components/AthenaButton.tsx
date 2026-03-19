'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface AthenaButtonProps {
  onSelectZone?: (zoneId: string) => void
  onClose360?: () => void
}

const AUDIO_CLIPS = {
  welcome: '/audio/welcome.mp3',
  umbrella: '/audio/book-umbrella.mp3',
  cabana: '/audio/book-cabana.mp3',
  sunset: '/audio/sunset-spots.mp3',
  history: '/audio/lake-history.mp3',
}

export default function AthenaButton({ onSelectZone, onClose360 }: AthenaButtonProps) {
  const [showTooltip, setShowTooltip] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [playing, setPlaying] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Auto-hide tooltip after 8 seconds
  useState(() => {
    const timer = setTimeout(() => setShowTooltip(false), 8000)
    return () => clearTimeout(timer)
  })

  const playAudio = useCallback((clipKey: string, src: string) => {
    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    if (playing === clipKey) {
      setPlaying(null)
      return
    }

    const audio = new Audio(src)
    audio.addEventListener('ended', () => setPlaying(null))
    audio.addEventListener('error', () => setPlaying(null))
    audio.play().catch(() => setPlaying(null))
    audioRef.current = audio
    setPlaying(clipKey)
  }, [playing])

  const handleAction = useCallback((action: string) => {
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setPlaying(null)
    }

    switch (action) {
      case 'umbrella':
        playAudio('umbrella', AUDIO_CLIPS.umbrella)
        setTimeout(() => {
          setShowModal(false)
          onSelectZone?.('A1')
        }, 500)
        break
      case 'cabana':
        playAudio('cabana', AUDIO_CLIPS.cabana)
        setTimeout(() => {
          setShowModal(false)
          onSelectZone?.('A1')
        }, 500)
        break
      case 'sunset':
        playAudio('sunset', AUDIO_CLIPS.sunset)
        setTimeout(() => {
          setShowModal(false)
          onSelectZone?.('C2')
        }, 500)
        break
      case 'weather':
        // Play welcome which includes weather context
        playAudio('welcome', AUDIO_CLIPS.welcome)
        break
      case 'call':
        window.location.href = 'tel:+15102880994'
        break
      case 'speak':
        // Play welcome audio first, then future: ElevenLabs live agent
        playAudio('welcome', AUDIO_CLIPS.welcome)
        break
      case 'history':
        playAudio('history', AUDIO_CLIPS.history)
        break
    }
  }, [playAudio, onSelectZone])

  const handleClick = () => {
    setShowTooltip(false)
    setShowModal(true)
    // Auto-play welcome when modal opens
    setTimeout(() => playAudio('welcome', AUDIO_CLIPS.welcome), 300)
  }

  return (
    <>
      {/* Hidden audio element for preloading */}
      <audio preload="none" />

      {/* Floating Athena button */}
      <div className="fixed right-4 bottom-48 sm:bottom-40 z-40 flex flex-col items-end gap-2">
        {/* Welcome tooltip */}
        <AnimatePresence>
          {showTooltip && !showModal && (
            <motion.div
              initial={{ opacity: 0, x: 10, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.9 }}
              transition={{ delay: 2, duration: 0.4 }}
              className="rounded-xl px-3 py-2 max-w-[200px] mr-1"
              style={{
                backdropFilter: 'blur(16px)',
                background: 'rgba(15,41,55,0.9)',
                border: '1px solid rgba(212,175,55,0.25)',
              }}
            >
              <div className="text-[11px] text-cream font-medium leading-tight">
                👋 Hi! I&apos;m Athena
              </div>
              <div className="text-[10px] text-cream/50 mt-0.5 leading-tight">
                Tap to learn about the lake or book by voice
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main button */}
        <motion.button
          onClick={handleClick}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #D4AF37, #B8962E)',
            border: '2px solid rgba(255,248,240,0.3)',
            boxShadow: '0 4px 20px rgba(212,175,55,0.4), 0 0 40px rgba(212,175,55,0.1)',
          }}
        >
          <span className="absolute inset-0 rounded-full animate-ping opacity-20"
                style={{ background: 'rgba(212,175,55,0.5)' }} />
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="relative z-10">
            <rect x="9" y="2" width="6" height="12" rx="3" fill="#1A1A2E" />
            <path d="M5 10a7 7 0 0 0 14 0" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 17v4M8 21h8" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="absolute -bottom-5 text-[8px] text-gold/80 font-bold tracking-wider uppercase whitespace-nowrap">
            ATHENA
          </span>
        </motion.button>
      </div>

      {/* Athena Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => { setShowModal(false); if (audioRef.current) { audioRef.current.pause(); setPlaying(null) } }}
            />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              className="relative w-full sm:w-[400px] max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl"
              style={{
                background: 'rgba(15,41,55,0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(212,175,55,0.2)',
                boxShadow: '0 -10px 60px rgba(0,0,0,0.5)',
              }}
            >
              {/* Header */}
              <div className="px-5 pt-5 pb-3 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center"
                         style={{ background: 'linear-gradient(135deg, #D4AF37, #B8962E)' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <rect x="9" y="2" width="6" height="12" rx="3" fill="#1A1A2E" />
                        <path d="M5 10a7 7 0 0 0 14 0" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" />
                        <path d="M12 17v4M8 21h8" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-cream font-semibold text-base">Athena</h3>
                      <p className="text-cream/40 text-[11px]">Guardian of Innocence</p>
                    </div>
                  </div>
                  <button onClick={() => { setShowModal(false); if (audioRef.current) { audioRef.current.pause(); setPlaying(null) } }}
                          className="text-cream/30 hover:text-cream/60 p-2 text-lg">✕</button>
                </div>
              </div>

              {/* Now Playing indicator */}
              {playing && (
                <div className="px-5 py-2 bg-gold/10 border-b border-gold/20 flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="w-1 bg-gold rounded-full animate-pulse"
                           style={{ height: `${8 + Math.random() * 12}px`, animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <span className="text-gold text-[11px] font-medium">Athena is speaking...</span>
                  <button onClick={() => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }; setPlaying(null) }}
                          className="ml-auto text-cream/40 hover:text-cream/70 text-[10px] px-2 py-0.5 rounded border border-white/10">
                    Stop
                  </button>
                </div>
              )}

              {/* Body */}
              <div className="px-5 py-4 space-y-4">
                <div className="text-cream/70 text-sm leading-relaxed">
                  Welcome to the <strong className="text-gold">Umbrella Project</strong> at Empowerment Park.
                  Empower your reservoir for community, fun, fitness, and good times.
                </div>

                {/* Quick actions — all functional */}
                <div className="space-y-2">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-cream/30 font-semibold">Quick Actions</div>
                  {[
                    { key: 'umbrella', icon: '☂️', label: 'Book an umbrella', desc: 'Find shade at the lake', action: 'umbrella' },
                    { key: 'cabana', icon: '🏕️', label: 'Book a cabana', desc: 'Full setup with couch & rug', action: 'cabana' },
                    { key: 'sunset', icon: '🌅', label: 'Best sunset spots', desc: 'Golden hour zones C1-C4', action: 'sunset' },
                    { key: 'weather', icon: '🌤️', label: "Today's weather", desc: 'Temperature, UV, sunset time', action: 'weather' },
                    { key: 'history', icon: '🏛️', label: 'Empowerment Park story', desc: '180 lights, community legacy', action: 'history' },
                    { key: 'call', icon: '📞', label: 'Call to book', desc: '(510) 288-0994', action: 'call' },
                  ].map((item) => (
                    <button key={item.key}
                      onClick={() => handleAction(item.action)}
                      className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all border ${
                        playing === item.key
                          ? 'bg-gold/15 border-gold/30'
                          : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-gold/20 active:scale-[0.98]'
                      }`}
                    >
                      <span className="text-lg">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-cream text-[12px] font-medium">{item.label}</div>
                        <div className="text-cream/40 text-[10px]">{item.desc}</div>
                      </div>
                      {playing === item.key && (
                        <div className="flex gap-0.5">
                          {[1,2,3].map(i => (
                            <div key={i} className="w-0.5 bg-gold rounded-full animate-pulse"
                                 style={{ height: `${6 + Math.random() * 8}px`, animationDelay: `${i * 0.1}s` }} />
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Speak with Athena CTA */}
                <div className="pt-2 border-t border-white/10">
                  <button
                    onClick={() => handleAction('speak')}
                    className="w-full flex items-center justify-center gap-2 rounded-full py-3 font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: 'linear-gradient(135deg, #D4AF37, #B8962E)',
                      color: '#1A1A2E',
                      boxShadow: '0 4px 20px rgba(212,175,55,0.3)',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <rect x="9" y="2" width="6" height="12" rx="3" fill="#1A1A2E" />
                      <path d="M5 10a7 7 0 0 0 14 0" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" />
                      <path d="M12 17v4M8 21h8" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    Speak with Athena
                  </button>
                  <div className="text-center text-cream/30 text-[9px] mt-2">
                    Voice by ElevenLabs · Or call (510) 288-0994
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
