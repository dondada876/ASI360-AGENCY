/**
 * Pricing Engine — TT-1033
 * Reads from Supabase booking_pricing table
 * Calculates final price with surge/demand/day-of-week rules
 * Single source of truth for all pricing across React, IVR, and backend
 */

export interface PricingTier {
  id: string
  tier: 'umbrella' | 'cabana' | 'vip'
  duration: '30min' | '1hr' | '4hr' | 'fullday'
  basePriceCents: number
  weekendSurchargePct: number
  holidaySurchargePct: number
  sunsetPremiumCents: number
  deliveryFeeCents: number
  ameliaServiceId: number | null
  stripePriceId: string | null
  wooProductId: string | null
  displayName: string
  description: string | null
  active: boolean
}

export interface Addon {
  id: string
  name: string
  priceCents: number
  category: 'comfort' | 'food' | 'entertainment' | 'store'
  stripePriceId: string | null
  icon: string | null
  description: string | null
  active: boolean
}

export interface PriceBreakdown {
  tierLabel: string
  durationLabel: string
  basePriceCents: number
  deliveryFeeCents: number
  sunsetPremiumCents: number
  weekendSurchargeCents: number
  holidaySurchargeCents: number
  addonsTotalCents: number
  addonsDetail: { name: string; priceCents: number }[]
  subtotalCents: number
  totalCents: number
  totalFormatted: string
  isWeekend: boolean
  isHoliday: boolean
  isSunset: boolean
}

// Oakland holidays (parks are busiest)
const HOLIDAYS_2026 = [
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-05-25',
  '2026-07-04', '2026-09-07', '2026-11-26', '2026-12-25',
  // Juneteenth, MLK Day, etc
  '2026-06-19', '2026-03-31',
]

export function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  return day === 0 || day === 6
}

export function isHoliday(dateStr: string): boolean {
  return HOLIDAYS_2026.includes(dateStr)
}

export function isSunsetSlot(timeSlot: string): boolean {
  return timeSlot === 'sunset'
}

export function calculatePrice(
  tier: PricingTier,
  dateStr: string,
  timeSlot: string,
  selectedAddons: Addon[] = []
): PriceBreakdown {
  const weekend = isWeekend(dateStr)
  const holiday = isHoliday(dateStr)
  const sunset = isSunsetSlot(timeSlot)

  const basePriceCents = tier.basePriceCents
  const deliveryFeeCents = tier.deliveryFeeCents

  // Surge calculations
  const weekendSurchargeCents = weekend
    ? Math.round(basePriceCents * (tier.weekendSurchargePct / 100))
    : 0
  const holidaySurchargeCents = holiday
    ? Math.round(basePriceCents * (tier.holidaySurchargePct / 100))
    : 0
  const sunsetPremiumCents = sunset ? tier.sunsetPremiumCents : 0

  // Add-ons
  const addonsDetail = selectedAddons.map(a => ({ name: a.name, priceCents: a.priceCents }))
  const addonsTotalCents = addonsDetail.reduce((sum, a) => sum + a.priceCents, 0)

  const subtotalCents = basePriceCents + weekendSurchargeCents + holidaySurchargeCents + sunsetPremiumCents
  const totalCents = subtotalCents + deliveryFeeCents + addonsTotalCents

  // Duration labels
  const durationLabels: Record<string, string> = {
    '30min': '30 Min', '1hr': '1 Hour', '4hr': '4 Hours', 'fullday': 'Full Day'
  }
  const tierLabels: Record<string, string> = {
    'umbrella': '☂️ Umbrella', 'cabana': '🏕️ Cabana', 'vip': '⭐ VIP'
  }

  return {
    tierLabel: tierLabels[tier.tier] || tier.tier,
    durationLabel: durationLabels[tier.duration] || tier.duration,
    basePriceCents,
    deliveryFeeCents,
    sunsetPremiumCents,
    weekendSurchargeCents,
    holidaySurchargeCents,
    addonsTotalCents,
    addonsDetail,
    subtotalCents,
    totalCents,
    totalFormatted: `$${(totalCents / 100).toFixed(2)}`,
    isWeekend: weekend,
    isHoliday: holiday,
    isSunset: sunset,
  }
}

// Format cents to dollar string
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
}
