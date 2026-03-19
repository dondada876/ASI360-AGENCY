import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const dayType = searchParams.get('dayType') || 'perfect'
  const timeSlot = searchParams.get('timeSlot') || 'afternoon'
  const highTemp = parseFloat(searchParams.get('highTemp') || '75')
  const uvIndex = parseFloat(searchParams.get('uvIndex') || '3')
  const windMph = parseFloat(searchParams.get('windMph') || '5')
  const precipPct = parseFloat(searchParams.get('precipPct') || '0')

  // Static catalog from Airtable Lakeside Product Catalog (appzvSjPs7r8k3iDU / tblgPT0hpoxioZJzB)
  // TODO: fetch live from Airtable API with caching
  const allProducts = getProductCatalog()

  const weather = { dayType, timeSlot, highTemp, uvIndex, windMph, precipPct }
  const scored = allProducts
    .map(p => ({ ...p, score: scoreProduct(p, weather) }))
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  return NextResponse.json({ products: scored, weather })
}

interface Product {
  sku: string
  name: string
  category: string
  price: number
  icon: string
  demand: string
  badge?: string
  unit?: string
}

interface Weather {
  dayType: string
  timeSlot: string
  highTemp: number
  uvIndex: number
  windMph: number
  precipPct: number
}

function scoreProduct(product: Product, weather: Weather): number {
  let score = 0
  const { dayType, timeSlot, highTemp, uvIndex, windMph, precipPct } = weather

  // Hot day boosts
  if (highTemp >= 85) {
    if (product.category === 'Sun Protection') score += 10
    if (product.category === 'Hydration') score += 8
    if (product.category === 'Comfort & Cooling') score += 9
    if (product.sku === 'BEV-004') score += 7
  }

  // Perfect day
  if (dayType === 'perfect') {
    if (product.category === 'Entertainment') score += 5
    if (product.category === 'Food & Snacks') score += 6
    if (product.category === 'Seating & Furniture') score += 4
    if (product.sku === 'CMF-006') score += 7
  }

  // UV high
  if (uvIndex >= 5) {
    if (product.category === 'Sun Protection') score += 8
  }

  // Rainy
  if (precipPct >= 30) {
    if (product.sku === 'FUR-004') score += 10
    if (product.category === 'Comfort & Cooling') score += 4
  }

  // Windy
  if (windMph >= 12) {
    if (product.sku === 'FUR-004') score += 8
    if (product.sku === 'SUN-003') score += 5
  }

  // Sunset slot
  if (timeSlot === 'sunset' || timeSlot === 'fullday') {
    if (product.sku === 'HLT-004') score += 7
    if (product.sku === 'CMF-004') score += 6
    if (product.sku === 'ENT-004') score += 5
  }

  // Morning slot
  if (timeSlot === 'morning') {
    if (product.category === 'Hydration') score += 5
    if (product.sku === 'HLT-001') score += 4
  }

  // Demand boost
  if (product.demand === 'Hot') score += 2
  if (product.demand === 'High') score += 1

  return score
}

function getProductCatalog(): Product[] {
  return [
    { sku: 'SUN-001', name: 'Sunscreen SPF50', category: 'Sun Protection', price: 10, icon: '\u2600\uFE0F', demand: 'Hot' },
    { sku: 'SUN-002', name: 'Sunscreen No White Cast', category: 'Sun Protection', price: 15, icon: '\u2600\uFE0F', demand: 'Hot', badge: 'Black Owned' },
    { sku: 'SUN-003', name: 'Polarized Sunglasses', category: 'Sun Protection', price: 12, icon: '\uD83D\uDD76\uFE0F', demand: 'Hot' },
    { sku: 'SUN-004', name: 'Sun Visors', category: 'Sun Protection', price: 12, icon: '\uD83E\uDDE2', demand: 'High' },
    { sku: 'BEV-001', name: 'Bottled Water 16.9oz', category: 'Hydration', price: 2, icon: '\uD83D\uDCA7', demand: 'Hot' },
    { sku: 'BEV-002', name: 'Bottled Water 1L', category: 'Hydration', price: 3, icon: '\uD83D\uDCA7', demand: 'Hot' },
    { sku: 'BEV-003', name: 'Sparkling Water', category: 'Hydration', price: 3.50, icon: '\u2728', demand: 'High' },
    { sku: 'BEV-004', name: 'Ice Bag 10lb', category: 'Hydration', price: 5, icon: '\uD83E\uDDCA', demand: 'Hot' },
    { sku: 'BEV-005', name: 'Capri Sun Variety', category: 'Hydration', price: 2, icon: '\uD83E\uDDC3', demand: 'Hot' },
    { sku: 'BEV-006', name: 'Fresh Lemonade', category: 'Hydration', price: 4, icon: '\uD83C\uDF4B', demand: 'Hot' },
    { sku: 'CMF-001', name: 'Clacking Hand Fan', category: 'Comfort & Cooling', price: 8, icon: '\uD83E\uDEAD', demand: 'Hot' },
    { sku: 'CMF-002', name: 'Misting Fan Bottle', category: 'Comfort & Cooling', price: 12, icon: '\uD83D\uDCA8', demand: 'Hot' },
    { sku: 'CMF-004', name: 'Fleece Blanket', category: 'Comfort & Cooling', price: 15, icon: '\uD83E\uDDE3', demand: 'High' },
    { sku: 'CMF-005', name: 'Beach Towel', category: 'Comfort & Cooling', price: 12, icon: '\uD83C\uDFD6\uFE0F', demand: 'High' },
    { sku: 'CMF-006', name: 'Picnic Blanket (Waterproof)', category: 'Comfort & Cooling', price: 15, icon: '\uD83E\uDDFA', demand: 'Hot' },
    { sku: 'HLT-001', name: 'Hand Sanitizer', category: 'Health & Wellness', price: 4, icon: '\uD83E\uDDF4', demand: 'High' },
    { sku: 'HLT-002', name: 'Tylenol Travel Pack', category: 'Health & Wellness', price: 6, icon: '\uD83D\uDC8A', demand: 'High' },
    { sku: 'HLT-003', name: 'Allergy Medicine', category: 'Health & Wellness', price: 8, icon: '\uD83E\uDD27', demand: 'High' },
    { sku: 'HLT-004', name: 'Bug Repellent Spray', category: 'Health & Wellness', price: 10, icon: '\uD83E\uDD9F', demand: 'High' },
    { sku: 'TCH-001', name: 'iPhone Cable', category: 'Tech & Accessories', price: 12, icon: '\uD83D\uDD0C', demand: 'Hot' },
    { sku: 'TCH-002', name: 'USB-C Cable', category: 'Tech & Accessories', price: 12, icon: '\uD83D\uDD0C', demand: 'Hot' },
    { sku: 'TCH-003', name: 'Portable Charger', category: 'Tech & Accessories', price: 35, icon: '\uD83D\uDD0B', demand: 'High' },
    { sku: 'ENT-004', name: 'Bluetooth Speaker', category: 'Entertainment', price: 5, icon: '\uD83D\uDD0A', demand: 'High', unit: '/hr' },
    { sku: 'FD-001', name: 'XL Pizza Slice', category: 'Food & Snacks', price: 4, icon: '\uD83C\uDF55', demand: 'Hot' },
    { sku: 'FD-002', name: 'Fresh Fruit Cup', category: 'Food & Snacks', price: 5, icon: '\uD83C\uDF53', demand: 'High' },
    { sku: 'FUR-004', name: 'Canopy Tent Upgrade', category: 'Seating & Furniture', price: 35, icon: '\u26FA', demand: 'Hot', unit: '/session' },
  ]
}
