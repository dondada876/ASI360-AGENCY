import { NextResponse } from 'next/server'

// MODULAR: Timezone per location. Default Oakland.
// When TT-992 (multi-location) executes, this comes from the locations table.
const LOCATION_TIMEZONE = 'America/Los_Angeles'
const LOCATION_LAT = 37.8073
const LOCATION_LNG = -122.2509

function getTodayInTimezone(tz: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz }) // YYYY-MM-DD
}

function getNowInTimezone(tz: string): { hour: number; date: string } {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: tz })
  const hourStr = now.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false })
  return { date: dateStr, hour: parseInt(hourStr) }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '14')

  const supabaseUrl = process.env.SUPABASE_URL || 'https://gtfffxwfgcxiiauliynd.supabase.co'
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || ''

  const today = getTodayInTimezone(LOCATION_TIMEZONE)
  const currentTime = getNowInTimezone(LOCATION_TIMEZONE)

  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
  }

  // Fetch daily forecasts — from today forward
  const dailyRes = await fetch(
    `${supabaseUrl}/rest/v1/wj_daily_weather?select=forecast_date,day_type,high_f,low_f,precip_pct,wind_mph,humidity_pct,uv_index,condition,ivr_sentence,consensus_confidence,updated_at&forecast_date=gte.${today}&order=forecast_date.asc&limit=${days}`,
    { headers, next: { revalidate: 1800 } }
  )

  // If no future data, get the most recent available (stale but useful)
  let daily = dailyRes.ok ? await dailyRes.json() : []
  let dataStale = false

  if (daily.length === 0) {
    const fallbackRes = await fetch(
      `${supabaseUrl}/rest/v1/wj_daily_weather?select=forecast_date,day_type,high_f,low_f,precip_pct,wind_mph,humidity_pct,uv_index,condition,ivr_sentence,consensus_confidence,updated_at&order=forecast_date.desc&limit=${days}`,
      { headers, next: { revalidate: 1800 } }
    )
    daily = fallbackRes.ok ? await fallbackRes.json() : []
    dataStale = true
  }

  // Check data freshness — if latest update > 24hrs ago, flag as stale
  if (daily.length > 0 && daily[0].updated_at) {
    const lastUpdate = new Date(daily[0].updated_at)
    const hoursAgo = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60)
    if (hoursAgo > 24) dataStale = true
  }

  // Fetch hourly for today and next 3 days
  const hourlyRes = await fetch(
    `${supabaseUrl}/rest/v1/wj_hourly_weather?select=forecast_date,hour,temp_f,precip_pct,wind_mph,comfort_score&forecast_date=gte.${today}&order=forecast_date.asc,hour.asc&limit=96`,
    { headers, next: { revalidate: 1800 } }
  )
  const hourly = hourlyRes.ok ? await hourlyRes.json() : []

  // Compute sunrise/sunset for location coordinates
  const sunTimes = daily.map((d: any) => {
    const date = new Date(d.forecast_date + 'T12:00:00')
    const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000)
    const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81))
    const latRad = LOCATION_LAT * Math.PI / 180
    const decRad = declination * Math.PI / 180
    const hourAngle = Math.acos(-Math.tan(latRad) * Math.tan(decRad)) * 180 / Math.PI

    // Solar noon in UTC, then convert to local
    const solarNoon = 12 - (LOCATION_LNG / 15) // UTC solar noon
    const sunriseUTC = solarNoon - hourAngle / 15
    const sunsetUTC = solarNoon + hourAngle / 15

    // Convert UTC to Pacific — check if DST active
    // DST: 2nd Sunday March → 1st Sunday November
    const month = date.getMonth()
    const utcOffset = (month >= 2 && month <= 10) ? -7 : -8 // PDT vs PST

    return {
      date: d.forecast_date,
      sunrise: formatTime(sunriseUTC + utcOffset),
      sunset: formatTime(sunsetUTC + utcOffset),
      golden_hour_start: formatTime(sunsetUTC + utcOffset - 1),
    }
  })

  return NextResponse.json({
    daily,
    hourly,
    sunTimes,
    meta: {
      timezone: LOCATION_TIMEZONE,
      today,
      currentHour: currentTime.hour,
      dataStale,
      locationLat: LOCATION_LAT,
      locationLng: LOCATION_LNG,
    }
  })
}

function formatTime(decimalHours: number): string {
  // Handle negative or >24 wraparound
  let h = Math.floor(((decimalHours % 24) + 24) % 24)
  const m = Math.round((Math.abs(decimalHours) - Math.floor(Math.abs(decimalHours))) * 60)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`
}
