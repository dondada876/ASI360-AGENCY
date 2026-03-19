// 500 Grand Live — Booking Engine Types

export type SpotType = 'umbrella' | 'canopy' | 'vip'
export type TimeSlot = 'morning' | 'afternoon' | 'sunset' | 'fullday'
export type SpotStatus = 'available' | 'reserved' | 'booked'

export interface Zone {
  id: string
  name: string
  label: string
  description: string
  poleIds: string[]
  sunsetQuality: 'golden' | 'partial' | 'shaded'
  maxCapacity: number
}

export interface BookingSpot {
  id: string
  zoneId: string
  poleId: string
  type: SpotType
  status: SpotStatus
  coordinates: [number, number]
}

export interface PricingTier {
  type: SpotType
  label: string
  description: string
  icon: string
  prices: Record<TimeSlot, number>
  includes: string[]
  color: string
}

export interface AddOn {
  id: string
  name: string
  icon: string
  price: number
  description: string
  category: 'comfort' | 'food' | 'entertainment'
}

export interface RestaurantPartner {
  id: string
  name: string
  cuisine: string
  description: string
  deliveryTime: string
  priceRange: string
  featured: string[]
  logo?: string
  url?: string
}

export interface BookingState {
  selectedZone: string | null
  selectedSpot: BookingSpot | null
  selectedTier: SpotType | null
  selectedTimeSlot: TimeSlot | null
  selectedDate: string | null
  addOns: string[]
  partySize: number
  guestName: string
  guestEmail: string
  guestPhone: string
  memberCode: string
  restaurantOrders: string[]
}

export interface TimeSlotConfig {
  id: TimeSlot
  label: string
  time: string
  description: string
  icon: string
}
