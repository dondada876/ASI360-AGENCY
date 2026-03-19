'use client'
import { useState, useEffect } from 'react'

export interface RecommendedProduct {
  sku: string
  name: string
  category: string
  price: number
  icon: string
  demand: string
  badge?: string
  unit?: string
  score: number
}

export function useProductRecommendations(
  dayType: string | null,
  timeSlot: string | null,
  highTemp: number | null,
  uvIndex: number | null,
  windMph: number | null,
  precipPct: number | null
) {
  const [products, setProducts] = useState<RecommendedProduct[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!dayType) return

    setLoading(true)
    const params = new URLSearchParams({
      dayType: dayType || 'perfect',
      timeSlot: timeSlot || 'afternoon',
      highTemp: String(highTemp || 75),
      uvIndex: String(uvIndex || 3),
      windMph: String(windMph || 5),
      precipPct: String(precipPct || 0),
    })

    fetch(`/api/products?${params}`)
      .then(r => r.json())
      .then(data => {
        setProducts(data.products || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [dayType, timeSlot, highTemp, uvIndex, windMph, precipPct])

  return { products, loading }
}
