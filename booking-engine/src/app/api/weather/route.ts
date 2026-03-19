import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '14')

  const supabaseUrl = process.env.SUPABASE_URL || 'https://gtfffxwfgcxiiauliynd.supabase.co'
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || ''

  // Fetch daily forecasts
  const dailyRes = await fetch(
    `${supabaseUrl}/rest/v1/wj_daily_weather?select=forecast_date,day_type,high_f,low_f,precip_pct,wind_mph,humidity_pct,uv_index,condition,ivr_sentence,consensus_confidence&order=forecast_date.asc&limit=${days}`,
    {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      next: { revalidate: 1800 } // cache 30 min
    }
  )

  // Fetch hourly for today and next 3 days
  const today = new Date().toISOString().split('T')[0]
  const hourlyRes = await fetch(
    `${supabaseUrl}/rest/v1/wj_hourly_weather?select=forecast_date,hour,temp_f,precip_pct,wind_mph,comfort_score&forecast_date=gte.${today}&order=forecast_date.asc,hour.asc&limit=96`,
    {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      next: { revalidate: 1800 }
    }
  )

  const daily = dailyRes.ok ? await dailyRes.json() : []
  const hourly = hourlyRes.ok ? await hourlyRes.json() : []

  // Compute sunrise/sunset for Oakland (37.8073, -122.2509)
  // Simple solar calculation for the next 14 days
  const sunTimes = daily.map((d: any) => {
    const date = new Date(d.forecast_date + 'T12:00:00')
    const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000)
    // Approximate sunrise/sunset for Oakland latitude 37.8
    const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81))
    const latRad = 37.8073 * Math.PI / 180
    const decRad = declination * Math.PI / 180
    const hourAngle = Math.acos(-Math.tan(latRad) * Math.tan(decRad)) * 180 / Math.PI
    const sunrise = 12 - hourAngle / 15 + 8 // UTC-8 Pacific
    const sunset = 12 + hourAngle / 15 + 8
    // Adjust for DST (March-November)
    const month = date.getMonth()
    const dstOffset = (month >= 2 && month <= 10) ? -1 : 0
    return {
      date: d.forecast_date,
      sunrise: formatTime(sunrise + dstOffset),
      sunset: formatTime(sunset + dstOffset),
      golden_hour_start: formatTime(sunset + dstOffset - 1),
    }
  })

  return NextResponse.json({ daily, hourly, sunTimes })
}

function formatTime(decimalHours: number): string {
  const h = Math.floor(decimalHours)
  const m = Math.round((decimalHours - h) * 60)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`
}
