// 500 Grand Live — Pricing & Product Data

import type { PricingTier, AddOn, TimeSlotConfig, RestaurantPartner } from '@/types/booking'

export const PRICING_TIERS: PricingTier[] = [
  {
    type: 'umbrella',
    label: 'Umbrella',
    description: 'Classic lakeside shade. Perfect for solo or couples.',
    icon: '☂️',
    prices: {
      morning: 15,
      afternoon: 20,
      sunset: 25,
      fullday: 45,
    },
    includes: [
      'Premium 8ft umbrella',
      'Ground blanket',
      'Welcome water bottle',
    ],
    color: '#4CAF50',
  },
  {
    type: 'canopy',
    label: 'Canopy Tent',
    description: 'Room for the crew. 10×10 ft of shade and vibes.',
    icon: '⛺',
    prices: {
      morning: 35,
      afternoon: 45,
      sunset: 55,
      fullday: 85,
    },
    includes: [
      '10×10 ft canopy tent',
      'Ground blanket set',
      'Welcome water bottles (4)',
      'Portable table',
    ],
    color: '#FF6B35',
  },
  {
    type: 'cabana',
    label: 'Cabana',
    description: 'Pop-up cabana tent with sectional couch, rug, and shade.',
    icon: '🏕️',
    prices: {
      morning: 45,
      afternoon: 55,
      sunset: 65,
      fullday: 99,
    },
    includes: [
      '10×10 cabana tent',
      'Sectional couch',
      'Area rug',
      'Side table',
      'Full shade coverage',
    ],
    color: '#C084FC',
  },
  {
    type: 'vip',
    label: 'VIP Lounge',
    description: 'The full experience. Premium everything, sunset guaranteed.',
    icon: '👑',
    prices: {
      morning: 55,
      afternoon: 65,
      sunset: 75,
      fullday: 120,
    },
    includes: [
      '10×10 ft premium canopy',
      'Luxury blanket & pillows',
      'Cooler with ice & drinks',
      'Bluetooth speaker',
      'Beach towels (×2)',
      'Charcuterie board for 2',
      'Priority food delivery',
    ],
    color: '#D4AF37',
  },
]

export const ADD_ONS: AddOn[] = [
  {
    id: 'cooler',
    name: 'Cooler with Ice',
    icon: '🧊',
    price: 10,
    description: 'Keep your drinks cold all day',
    category: 'comfort',
  },
  {
    id: 'speaker',
    name: 'Bluetooth Speaker',
    icon: '🎵',
    price: 5,
    description: 'JBL portable speaker, fully charged',
    category: 'entertainment',
  },
  {
    id: 'towels',
    name: 'Beach Towels (×2)',
    icon: '🏖️',
    price: 8,
    description: 'Premium oversized towels',
    category: 'comfort',
  },
  {
    id: 'picnic-basket',
    name: 'Picnic Basket',
    icon: '🧺',
    price: 25,
    description: 'Plates, utensils, napkins, wine glasses for 4',
    category: 'food',
  },
  {
    id: 'charcuterie',
    name: 'Charcuterie Board',
    icon: '🧀',
    price: 35,
    description: 'Artisan cheeses, meats, crackers, fruits for 2-4',
    category: 'food',
  },
  {
    id: 'snack-pack',
    name: 'Snack & Drink Pack',
    icon: '🍿',
    price: 12,
    description: 'Chips, trail mix, sparkling water, juice',
    category: 'food',
  },
  {
    id: 'blanket-upgrade',
    name: 'Luxury Blanket Upgrade',
    icon: '🛋️',
    price: 15,
    description: 'Oversized quilted blanket with pillows',
    category: 'comfort',
  },
  {
    id: 'phone-charger',
    name: 'Portable Charger',
    icon: '🔋',
    price: 5,
    description: '20,000mAh power bank, all cables included',
    category: 'entertainment',
  },
]

export const TIME_SLOTS: TimeSlotConfig[] = [
  {
    id: 'morning',
    label: 'Morning',
    time: '8:00 AM – 12:00 PM',
    description: 'Quiet lakeside morning. Joggers, birds, calm water.',
    icon: '🌅',
  },
  {
    id: 'afternoon',
    label: 'Afternoon',
    time: '12:00 PM – 5:00 PM',
    description: 'Peak sun. Perfect for lounging and people-watching.',
    icon: '☀️',
  },
  {
    id: 'sunset',
    label: 'Golden Hour',
    time: '5:00 PM – 8:00 PM',
    description: 'The magic window. Golden light over the lake.',
    icon: '🌇',
  },
  {
    id: 'fullday',
    label: 'Full Day',
    time: '8:00 AM – 8:00 PM',
    description: 'All day, all vibes. Best value.',
    icon: '🌞',
  },
]

export const RESTAURANT_PARTNERS: RestaurantPartner[] = [
  {
    id: 'coach-sushi',
    name: 'Coach Sushi',
    cuisine: 'Japanese',
    description: 'Premium sushi & rolls, right across Grand Ave. Our flagship partner.',
    deliveryTime: '15-20 min',
    priceRange: '$$',
    featured: ['Dragon Roll', 'Salmon Sashimi', 'Bento Box'],
    url: 'https://coachsushi.500grandlive.com',
  },
  {
    id: 'comal-next-door',
    name: 'Comal Next Door',
    cuisine: 'Mexican',
    description: 'Oaxacan-inspired street food. Tacos, burritos, aguas frescas.',
    deliveryTime: '15-25 min',
    priceRange: '$$',
    featured: ['Street Tacos (3)', 'Burrito Bowl', 'Agua Fresca'],
  },
  {
    id: 'ahns-burger',
    name: "Ahn's Quarter Pound",
    cuisine: 'Burgers',
    description: 'Smash burgers and loaded fries. Perfect lakeside food.',
    deliveryTime: '10-15 min',
    priceRange: '$',
    featured: ['Quarter Pounder', 'Loaded Fries', 'Milkshake'],
  },
  {
    id: 'avevista',
    name: 'Avevista',
    cuisine: 'Mediterranean',
    description: 'Fresh bowls, wraps, and smoothies.',
    deliveryTime: '15-20 min',
    priceRange: '$$',
    featured: ['Mediterranean Bowl', 'Falafel Wrap', 'Smoothie'],
  },
  {
    id: 'house-of-curries',
    name: 'House of Curries',
    cuisine: 'Indian',
    description: 'Rich curries, naan, and biryani.',
    deliveryTime: '20-30 min',
    priceRange: '$$',
    featured: ['Chicken Tikka Masala', 'Garlic Naan', 'Mango Lassi'],
  },
]

export const MEMBER_DISCOUNT = 0.20

export function calculateTotal(
  tierType: string,
  timeSlot: string,
  addOnIds: string[],
  memberCode: string
): { subtotal: number; discount: number; total: number } {
  const tier = PRICING_TIERS.find(t => t.type === tierType)
  if (!tier) return { subtotal: 0, discount: 0, total: 0 }

  const basePrice = tier.prices[timeSlot as keyof typeof tier.prices] || 0
  const addOnsTotal = addOnIds.reduce((sum, id) => {
    const addOn = ADD_ONS.find(a => a.id === id)
    return sum + (addOn?.price || 0)
  }, 0)

  const subtotal = basePrice + addOnsTotal
  const isValidMember = memberCode.startsWith('500GL') && memberCode.length >= 7
  const discount = isValidMember ? subtotal * MEMBER_DISCOUNT : 0
  const total = subtotal - discount

  return { subtotal, discount, total }
}
