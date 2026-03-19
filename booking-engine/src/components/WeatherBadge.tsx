'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWeather } from '@/hooks/useWeather'

export default function WeatherBadge() {
  const { getTodayForecast, getWeatherIcon, getSunTime, loading } = useWeather()
  const [expanded, setExpanded] = useState(false)

  if (loading) return null

  const today = new Date().toISOString().split('T')[0]
  const forecast = getTodayForecast()
  const sun = getSunTime(today)

  if (!forecast) return null

  const icon = getWeatherIcon(forecast.day_type, forecast.condition)

  return (
    <div className="fixed top-16 right-3 z-30">
      <AnimatePresence mode="wait">
        {!expanded ? (
          /* Collapsed: just icon + temp — one tap to expand */
          <motion.button
            key="compact"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setExpanded(true)}
            className="rounded-full px-3 py-1.5 flex items-center gap-1.5 cursor-pointer"
            style={{ backdropFilter: 'blur(16px)', background: 'rgba(15,41,55,0.85)', border: '1px solid rgba(212,175,55,0.2)' }}
          >
            <span className="text-base">{icon}</span>
            <span className="text-white font-semibold text-sm">{Math.round(forecast.high_f)}°</span>
            {sun && <span className="text-amber-400/70 text-[10px]">🌅{sun.sunset}</span>}
          </motion.button>
        ) : (
          /* Expanded: full weather details */
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.9, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -5 }}
            className="rounded-xl px-3 py-2.5 flex flex-col gap-1 w-[170px]"
            style={{ backdropFilter: 'blur(16px)', background: 'rgba(15,41,55,0.9)', border: '1px solid rgba(212,175,55,0.25)' }}
          >
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-lg">{icon}</span>
                <div>
                  <div className="text-white font-semibold text-sm leading-tight">{Math.round(forecast.high_f)}°F</div>
                  <div className="text-white/40 text-[10px]">{forecast.condition}</div>
                </div>
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="text-white/30 hover:text-white/60 text-xs p-1"
              >✕</button>
            </div>

            {/* Details */}
            <div className="border-t border-white/10 pt-1 mt-0.5 grid grid-cols-2 gap-x-2 gap-y-0.5">
              <span className="text-white/50 text-[10px]">💧 {forecast.precip_pct}% rain</span>
              <span className="text-white/50 text-[10px] text-right">💨 {forecast.wind_mph}mph</span>
              <span className="text-white/50 text-[10px]">☀️ UV {forecast.uv_index}</span>
              <span className="text-white/50 text-[10px] text-right">{forecast.humidity_pct}%💦</span>
            </div>

            {/* Sun times */}
            {sun && (
              <div className="border-t border-white/10 pt-1 mt-0.5 grid grid-cols-2 gap-x-2">
                <span className="text-amber-400/70 text-[10px]">🌅 {sun.sunset}</span>
                <span className="text-amber-400/70 text-[10px] text-right">✨ {sun.golden_hour_start}</span>
              </div>
            )}

            {/* Hot day CTA */}
            {forecast.day_type === 'hot' && (
              <div className="bg-amber-500/15 text-amber-300 text-[9px] rounded-full px-2 py-0.5 text-center mt-0.5">
                ☂️ Hot day — book shade!
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
