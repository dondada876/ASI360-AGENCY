'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [weather, setWeather] = useState<{ temp: number; condition: string; sunset?: string } | null>(null)

  // Fetch weather for header badge
  useEffect(() => {
    fetch('/api/weather?days=1')
      .then(r => r.json())
      .then(data => {
        const today = data.daily?.[0]
        if (today) {
          setWeather({
            temp: Math.round(today.high_f || 72),
            condition: today.condition || 'Sunny',
            sunset: data.sunTimes?.[0]?.sunset,
          })
        }
      })
      .catch(() => {})
  }, [])

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="flex items-center justify-between px-3 py-2 sm:px-5 sm:py-3">
          {/* Logo — official 500 Grand Live branding */}
          <div className="pointer-events-auto">
            <a
              href="https://www.500grandlive.com"
              target="_blank"
              rel="noopener noreferrer"
              className="glass rounded-xl px-3 py-1.5 border-glow-gold flex items-center gap-2 hover:scale-105 transition-transform"
            >
              <Image
                src="/500gl-logo.png"
                alt="500 Grand Live"
                width={120}
                height={32}
                className="h-7 w-auto object-contain"
                priority
              />
            </a>
          </div>

          {/* Right side — weather pill + hamburger */}
          <div className="pointer-events-auto flex items-center gap-2">
            {/* Weather pill — compact, tap to expand later */}
            {weather && (
              <div
                className="glass rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 border-glow-gold"
              >
                <span className="text-xs">
                  {weather.condition?.includes('Rain') ? '🌧' :
                   weather.condition?.includes('Cloud') ? '⛅' : '☀️'}
                </span>
                <span className="text-cream font-semibold text-xs">{weather.temp}°F</span>
                {weather.sunset && (
                  <span className="text-gold/60 text-[9px] hidden sm:inline">🌅{weather.sunset}</span>
                )}
              </div>
            )}

            {/* Hamburger menu */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="glass rounded-xl w-9 h-9 flex items-center justify-center hover:border-cream/20 transition-all"
              aria-label="Menu"
            >
              <div className="flex flex-col gap-1">
                <span className={`block w-4 h-[1.5px] bg-cream/70 transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-[3.5px]' : ''}`} />
                <span className={`block w-4 h-[1.5px] bg-cream/70 transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-[2px]' : ''}`} />
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Menu dropdown — translucent backdrop */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop to close menu */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[39]"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed top-14 right-3 sm:right-5 z-40 glass-dark rounded-2xl p-2 min-w-[200px] border-glow-gold"
              style={{
                backdropFilter: 'blur(20px)',
                background: 'rgba(10, 10, 26, 0.92)',
              }}
            >
              {[
                { label: 'Home', href: 'https://www.500grandlive.com', icon: '🏠' },
                { label: 'Coach Sushi', href: 'https://coachsushi.500grandlive.com', icon: '🍣' },
                { label: 'Membership', href: 'https://www.500grandlive.com/membership', icon: '💳' },
                { label: 'The Umbrella Project', href: '#mission', icon: '☂️' },
                { label: 'Call to Book', href: 'tel:+15102880994', icon: '📞' },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target={item.href.startsWith('http') ? '_blank' : undefined}
                  rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-cream/70 hover:text-cream hover:bg-cream/5 transition-all"
                >
                  <span>{item.icon}</span>
                  {item.label}
                </a>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
