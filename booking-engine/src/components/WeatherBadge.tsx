'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWeather } from '@/hooks/useWeather'

export default function WeatherBadge() {
  const { weather, getTodayForecast, getWeatherIcon, getSunTime, loading } = useWeather()
  const [expanded, setExpanded] = useState(false)

  // Get today's forecast, or fall back to the most recent available
  const today = new Date().toISOString().split('T')[0]
  let forecast = getTodayForecast()
  let sun = getSunTime(today)
  let dateLabel = 'Today'

  // If no today forecast, use the latest available
  if (!forecast && weather?.daily?.length) {
    forecast = weather.daily[weather.daily.length - 1]
    dateLabel = forecast.forecast_date
    sun = getSunTime(forecast.forecast_date)
  }

  // If still nothing, show a static fallback for Oakland
  if (!forecast) {
    // Hardcoded fallback — Oakland March typical weather
    forecast = {
      forecast_date: today,
      day_type: 'perfect',
      high_f: 72,
      low_f: 54,
      precip_pct: 0,
      wind_mph: 8,
      humidity_pct: 60,
      uv_index: 4,
      condition: 'Partly Cloudy',
      ivr_sentence: '',
      consensus_confidence: 0,
    }
    dateLabel = 'Typical'
  }

  const icon = getWeatherIcon(forecast.day_type, forecast.condition)

  return (
    <div className="fixed top-16 right-3 z-30">
      <AnimatePresence mode="wait">
        {!expanded ? (
          <motion.button
            key="compact"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setExpanded(true)}
            className="rounded-xl px-3 py-2 flex items-center gap-2 cursor-pointer"
            style={{ backdropFilter: 'blur(16px)', background: 'rgba(15,41,55,0.85)', border: '1px solid rgba(212,175,55,0.2)' }}
          >
            <span className="text-lg">{icon}</span>
            <div className="text-left">
              <div className="text-white font-semibold text-sm leading-tight">{Math.round(forecast.high_f)}°F</div>
              <div className="text-white/40 text-[9px]">{forecast.condition}</div>
            </div>
            {sun && (
              <div className="text-amber-400/70 text-[10px] flex flex-col items-end ml-1">
                <span>🌅 {sun.sunset}</span>
              </div>
            )}
          </motion.button>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.9, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -5 }}
            className="rounded-xl px-3 py-2.5 flex flex-col gap-1.5 w-[190px]"
            style={{ backdropFilter: 'blur(16px)', background: 'rgba(15,41,55,0.9)', border: '1px solid rgba(212,175,55,0.25)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{icon}</span>
                <div>
                  <div className="text-white font-semibold text-base leading-tight">{Math.round(forecast.high_f)}°F</div>
                  <div className="text-white/40 text-[10px]">{forecast.condition} · {dateLabel}</div>
                </div>
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="text-white/30 hover:text-white/60 text-sm p-1"
              >✕</button>
            </div>

            <div className="border-t border-white/10 pt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
              <span className="text-white/60 text-[11px]">💧 {forecast.precip_pct}% rain</span>
              <span className="text-white/60 text-[11px] text-right">💨 {forecast.wind_mph}mph</span>
              <span className="text-white/60 text-[11px]">☀️ UV {forecast.uv_index}</span>
              <span className="text-white/60 text-[11px] text-right">💦 {forecast.humidity_pct}%</span>
            </div>

            {sun && (
              <div className="border-t border-white/10 pt-1.5 grid grid-cols-2 gap-x-3">
                <span className="text-amber-400/80 text-[11px]">🌅 Sunset {sun.sunset}</span>
                <span className="text-amber-400/80 text-[11px] text-right">✨ Golden {sun.golden_hour_start}</span>
              </div>
            )}

            {forecast.day_type === 'hot' && (
              <div className="bg-amber-500/15 text-amber-300 text-[10px] rounded-full px-2 py-1 text-center mt-0.5 font-medium">
                ☂️ Hot day — book shade!
              </div>
            )}

            {forecast.day_type === 'perfect' && (
              <div className="bg-emerald-500/15 text-emerald-300 text-[10px] rounded-full px-2 py-1 text-center mt-0.5 font-medium">
                🌤️ Perfect lake day!
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
