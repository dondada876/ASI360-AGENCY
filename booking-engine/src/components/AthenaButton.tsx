'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function AthenaButton() {
  const [showTooltip, setShowTooltip] = useState(true)
  const [showModal, setShowModal] = useState(false)

  // Auto-hide tooltip after 8 seconds
  useState(() => {
    const timer = setTimeout(() => setShowTooltip(false), 8000)
    return () => clearTimeout(timer)
  })

  const handleClick = () => {
    setShowTooltip(false)
    setShowModal(true)
  }

  return (
    <>
      {/* Floating Athena button — right side, above bottom controls */}
      <div className="fixed right-4 bottom-24 z-40 flex flex-col items-end gap-2">
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
                Tap to ask about zones, weather, or book by voice
              </div>
              <div className="absolute -bottom-1 right-6 w-2 h-2 rotate-45"
                   style={{ background: 'rgba(15,41,55,0.9)', borderRight: '1px solid rgba(212,175,55,0.25)', borderBottom: '1px solid rgba(212,175,55,0.25)' }} />
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
          {/* Pulse ring */}
          <span className="absolute inset-0 rounded-full animate-ping opacity-20"
                style={{ background: 'rgba(212,175,55,0.5)' }} />
          {/* Mic icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="relative z-10">
            <rect x="9" y="2" width="6" height="12" rx="3" fill="#1A1A2E" />
            <path d="M5 10a7 7 0 0 0 14 0" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 17v4M8 21h8" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {/* Label */}
          <span className="absolute -bottom-5 text-[8px] text-gold/80 font-bold tracking-wider uppercase whitespace-nowrap">
            ATHENA
          </span>
        </motion.button>
      </div>

      {/* Athena Modal — voice agent + info */}
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
              onClick={() => setShowModal(false)}
            />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              className="relative w-full sm:w-[400px] max-h-[80vh] rounded-t-2xl sm:rounded-2xl overflow-hidden"
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
                      <p className="text-cream/40 text-[11px]">Your Lake Merritt Concierge</p>
                    </div>
                  </div>
                  <button onClick={() => setShowModal(false)}
                          className="text-cream/30 hover:text-cream/60 p-2 text-lg">✕</button>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-4">
                <div className="text-cream/70 text-sm leading-relaxed">
                  Welcome to the <strong className="text-gold">Umbrella Project</strong> at Lake Merritt.
                  I can help you find the perfect spot, check the weather, or book an umbrella or cabana.
                </div>

                {/* Quick actions */}
                <div className="space-y-2">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-cream/30 font-semibold">Quick Actions</div>
                  {[
                    { icon: '☂️', label: 'Book an umbrella', desc: 'Find shade at the lake' },
                    { icon: '🏕️', label: 'Book a cabana', desc: 'Full setup with couch & rug' },
                    { icon: '🌅', label: 'Best sunset spots', desc: 'Golden hour zones C1-C4' },
                    { icon: '🌤️', label: "Today's weather", desc: 'Temperature, UV, sunset time' },
                    { icon: '📞', label: 'Call to book', desc: '(510) 288-0994' },
                  ].map((action) => (
                    <button key={action.label}
                      className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all hover:bg-white/5 border border-white/5 hover:border-gold/20"
                    >
                      <span className="text-lg">{action.icon}</span>
                      <div>
                        <div className="text-cream text-[12px] font-medium">{action.label}</div>
                        <div className="text-cream/40 text-[10px]">{action.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Voice CTA */}
                <div className="pt-2 border-t border-white/10">
                  <button className="w-full flex items-center justify-center gap-2 rounded-full py-3 font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
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
                    Voice powered by ElevenLabs · Or call (510) 288-0994
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
