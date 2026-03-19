'use client'

import { motion } from 'framer-motion'

export default function ZonePrompt() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.5, duration: 0.6 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30"
    >
      <div className="glass rounded-2xl px-6 py-4 border-glow-gold flex items-center gap-4 max-w-md">
        <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
          <span className="text-xl">👆</span>
        </div>
        <div>
          <div className="font-[family-name:var(--font-display)] text-sm font-medium text-cream">
            Tap a zone to begin
          </div>
          <div className="text-xs text-cream/50 mt-0.5">
            Choose your lakeside spot. Gold zones have the best sunset views.
          </div>
        </div>
      </div>
    </motion.div>
  )
}
