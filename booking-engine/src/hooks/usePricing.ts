'use client'

import { useState, useEffect, useMemo } from 'react'
import { PricingTier, Addon, PriceBreakdown, calculatePrice } from '@/lib/pricing-engine'

interface UsePricingReturn {
  tiers: PricingTier[]
  addons: Addon[]
  loading: boolean
  error: string | null
  getTiersForType: (tier: 'umbrella' | 'cabana' | 'vip') => PricingTier[]
  getDurations: (tier: 'umbrella' | 'cabana' | 'vip') => PricingTier[]
  getPrice: (tier: PricingTier, date: string, timeSlot: string, selectedAddons?: Addon[]) => PriceBreakdown
  getAddonsByCategory: (category: string) => Addon[]
}

export function usePricing(): UsePricingReturn {
  const [tiers, setTiers] = useState<PricingTier[]>([])
  const [addons, setAddons] = useState<Addon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPricing() {
      try {
        // Fetch from our API which reads Supabase
        const [pricingRes, addonsRes] = await Promise.all([
          fetch('/api/pricing'),
          fetch('/api/pricing?type=addons'),
        ])

        if (pricingRes.ok) {
          const data = await pricingRes.json()
          setTiers(data.tiers || [])
        }

        if (addonsRes.ok) {
          const data = await addonsRes.json()
          setAddons(data.addons || [])
        }

        setLoading(false)
      } catch (err: any) {
        setError(err.message)
        setLoading(false)
      }
    }

    fetchPricing()
  }, [])

  const getTiersForType = (tier: 'umbrella' | 'cabana' | 'vip') =>
    tiers.filter(t => t.tier === tier && t.active)

  const getDurations = (tier: 'umbrella' | 'cabana' | 'vip') =>
    tiers.filter(t => t.tier === tier && t.active).sort((a, b) => a.basePriceCents - b.basePriceCents)

  const getPrice = (tier: PricingTier, date: string, timeSlot: string, selectedAddons: Addon[] = []) =>
    calculatePrice(tier, date, timeSlot, selectedAddons)

  const getAddonsByCategory = (category: string) =>
    addons.filter(a => a.category === category && a.active)

  return {
    tiers, addons, loading, error,
    getTiersForType, getDurations, getPrice, getAddonsByCategory,
  }
}
