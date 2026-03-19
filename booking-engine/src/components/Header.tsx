'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="flex items-center justify-between p-4 sm:p-5">
          {/* Logo */}
          <div className="pointer-events-auto">
            <div className="glass rounded-2xl px-5 py-3 border-glow-gold flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-light via-gold to-ember flex items-center justify-center">
                <span className="text-dusk font-bold text-xs">500</span>
              </div>
              <div>
                <div className="font-[family-name:var(--font-display)] text-base font-semibold text-cream leading-none">
                  Grand Live
                </div>
                <div className="text-[9px] uppercase tracking-[0.25em] text-gold/70 mt-0.5">
                  Social Club
                </div>
              </div>
            </div>
          </div>

          {/* Right side actions */}
          <div className="pointer-events-auto flex items-center gap-2">
            <a
              href="https://www.500grandlive.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex glass rounded-xl px-4 py-2.5 text-xs text-cream/60 hover:text-cream transition-colors items-center gap-2"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
                <path d="M3.6 9h16.8M3.6 15h16.8" />
                <path d="M12 3a15 15 0 014 9 15 15 0 01-4 9 15 15 0 01-4-9 15 15 0 014-9z" />
              </svg>
              500grandlive.com
            </a>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="glass rounded-xl w-10 h-10 flex items-center justify-center hover:border-cream/20 transition-all"
            >
              <div className="flex flex-col gap-1">
                <span className={`block w-4 h-[1.5px] bg-cream/70 transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-[3.5px]' : ''}`} />
                <span className={`block w-4 h-[1.5px] bg-cream/70 transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-[2px]' : ''}`} />
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Menu dropdown */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed top-20 right-4 sm:right-5 z-40 glass-dark rounded-2xl p-2 min-w-[200px] border-glow-gold"
          >
            {[
              { label: 'Home', href: 'https://www.500grandlive.com', icon: '🏠' },
              { label: 'Coach Sushi', href: 'https://coachsushi.500grandlive.com', icon: '🍣' },
              { label: 'Membership', href: 'https://www.500grandlive.com/membership', icon: '💳' },
              { label: 'Contact', href: 'https://www.500grandlive.com/contact', icon: '📞' },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-cream/70 hover:text-cream hover:bg-cream/5 transition-all"
              >
                <span>{item.icon}</span>
                {item.label}
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
