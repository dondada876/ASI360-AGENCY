'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

export default function ZonePrompt() {
  const [dismissed, setDismissed] = useState(false)
  const [compact, setCompact] = useState(false)

  // Auto-compact after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setCompact(true), 5000)
    return () => clearTimeout(timer)
  }, [])

  if (dismissed) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.5, duration: 0.6 }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30"
    >
      <AnimatePresence mode="wait">
        {compact ? (
          <motion.button
            key="compact"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setCompact(false)}
            className="rounded-full px-4 py-2 flex items-center gap-2 cursor-pointer"
            style={{ backdropFilter: 'blur(16px)', background: 'rgba(15,41,55,0.8)', border: '1px solid rgba(212,175,55,0.3)' }}
          >
            <span className="text-sm">👆</span>
            <span className="text-xs text-cream/80 font-medium">Tap a zone</span>
            <button
              onClick={(e) => { e.stopPropagation(); setDismissed(true) }}
              className="text-white/30 hover:text-white/60 text-xs ml-1"
            >✕</button>
          </motion.button>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="rounded-xl px-4 py-2.5 flex items-center gap-3 max-w-[300px]"
            style={{ backdropFilter: 'blur(16px)', background: 'rgba(15,41,55,0.85)', border: '1px solid rgba(212,175,55,0.25)' }}
          >
            <span className="text-lg shrink-0">👆</span>
            <div className="min-w-0">
              <div className="text-xs font-medium text-cream">Tap a zone to begin</div>
              <div className="text-[10px] text-cream/40 mt-0.5 leading-tight">Gold zones = best sunset</div>
            </div>
            <button
              onClick={() => setCompact(true)}
              className="text-white/30 hover:text-white/60 text-xs shrink-0 ml-auto"
            >✕</button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
