'use client'
import { useState, useEffect } from 'react'

export interface DailyForecast {
  forecast_date: string
  day_type: string
  high_f: number
  low_f: number
  precip_pct: number
  wind_mph: number
  humidity_pct: number
  uv_index: number
  condition: string
  ivr_sentence: string
  consensus_confidence: number
}

export interface HourlyForecast {
  forecast_date: string
  hour: number
  temp_f: number
  precip_pct: number
  wind_mph: number
  comfort_score: number
}

export interface SunTime {
  date: string
  sunrise: string
  sunset: string
  golden_hour_start: string
}

export interface WeatherData {
  daily: DailyForecast[]
  hourly: HourlyForecast[]
  sunTimes: SunTime[]
}

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/weather?days=14')
      .then(r => r.json())
      .then(data => {
        setWeather(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const getDayForecast = (date: string) => weather?.daily.find(d => d.forecast_date === date)
  const getHourlyForDate = (date: string) => weather?.hourly.filter(h => h.forecast_date === date) || []
  const getSunTime = (date: string) => weather?.sunTimes.find(s => s.date === date)

  const getTodayForecast = () => {
    const today = new Date().toISOString().split('T')[0]
    return getDayForecast(today)
  }

  const getWeatherIcon = (dayType: string, condition: string) => {
    if (condition?.toLowerCase().includes('rain')) return '\u{1F327}\u{FE0F}'
    if (dayType === 'hot') return '\u{2600}\u{FE0F}'
    if (dayType === 'perfect') return '\u{1F324}\u{FE0F}'
    if (dayType === 'mild') return '\u26C5'
    if (dayType === 'cool') return '\u{1F325}\u{FE0F}'
    if (condition?.toLowerCase().includes('cloud')) return '\u2601\u{FE0F}'
    return '\u{2600}\u{FE0F}'
  }

  const getComfortLabel = (score: number) => {
    if (score >= 0.9) return { label: 'Excellent', color: '#4CAF50' }
    if (score >= 0.75) return { label: 'Good', color: '#8BC34A' }
    if (score >= 0.6) return { label: 'Warm', color: '#FFC107' }
    if (score >= 0.4) return { label: 'Hot', color: '#FF9800' }
    return { label: 'Intense', color: '#F44336' }
  }

  return {
    weather, loading, error,
    getDayForecast, getHourlyForDate, getSunTime, getTodayForecast,
    getWeatherIcon, getComfortLabel,
  }
}
