import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || 'https://gtfffxwfgcxiiauliynd.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || ''
  )
}

import { isWeekend, isHoliday, isSunsetSlot } from '@/lib/pricing-engine'

// Fallback Stripe prices (used if pricing table lookup fails)
const FALLBACK_PRICES: Record<string, string> = {
  'umbrella': 'price_1TCyPiK2owjndB2o7aZbSFgY',
  'umbrella_delivery': 'price_1TCyPjK2owjndB2objsCFNUF',
  'cabana': 'price_1TCyPjK2owjndB2obs0ikG0h',
  'vip': 'price_1TCyPkK2owjndB2oLASmR769',
  'blanket': 'price_1TCyPkK2owjndB2o2TPDv1Zq',
  'cooler': 'price_1TCyPlK2owjndB2ofp8xtz81',
  'charcuterie': 'price_1TCyPlK2owjndB2of8mQeZQ0',
  'sushi': 'price_1TCyPmK2owjndB2oyYbCp1Nf',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      zone_id,
      tier,          // 'umbrella' | 'cabana' | 'vip'
      duration = '1hr', // '30min' | '1hr' | '4hr' | 'fullday'
      booking_date,
      time_slot,     // 'morning' | 'afternoon' | 'sunset'
      pole_id,
      addons = [],   // ['blanket', 'cooler', 'sushi', 'charcuterie']
      phone,
      email,
      name,
    } = body

    // Validate required fields
    if (!zone_id || !tier || !booking_date || !time_slot) {
      return NextResponse.json(
        { error: 'Missing required fields: zone_id, tier, booking_date, time_slot' },
        { status: 400 }
      )
    }

    // Check availability
    const { data: avail } = await getSupabase()
      .from('umbrella_availability')
      .select('*')
      .eq('zone_id', zone_id)
      .eq('booking_date', booking_date)
      .eq('time_slot', time_slot)
      .single()

    if (avail && avail.booked_spots >= avail.total_spots) {
      return NextResponse.json(
        { error: 'No spots available for this zone/date/time', available: 0 },
        { status: 409 }
      )
    }

    // Get Stripe key from Vault
    const { data: secrets } = await getSupabase().rpc('get_secrets', {
      secret_names: ['stripe_secret_key']
    })
    const stripeKey = typeof secrets === 'object' && !Array.isArray(secrets)
      ? secrets.stripe_secret_key
      : ''

    if (!stripeKey) {
      return NextResponse.json({ error: 'Payment system unavailable' }, { status: 503 })
    }

    // Fetch pricing from unified table
    const { data: pricingRow } = await getSupabase()
      .from('booking_pricing')
      .select('*')
      .eq('tier', tier)
      .eq('duration', duration)
      .eq('active', true)
      .single()

    // Calculate dynamic price with surge rules
    let totalCents = pricingRow ? pricingRow.base_price_cents : 2500
    let deliveryCents = pricingRow ? pricingRow.delivery_fee_cents : 2500

    if (pricingRow && booking_date) {
      if (isWeekend(booking_date)) {
        totalCents += Math.round(totalCents * (pricingRow.weekend_surcharge_pct / 100))
      }
      if (isHoliday(booking_date)) {
        totalCents += Math.round(totalCents * (pricingRow.holiday_surcharge_pct / 100))
      }
      if (isSunsetSlot(time_slot)) {
        totalCents += pricingRow.sunset_premium_cents
      }
    }

    // Fetch selected add-ons from database
    const { data: addonRows } = addons.length > 0
      ? await getSupabase()
          .from('booking_addons')
          .select('*')
          .in('name', addons.map((a: string) => {
            const nameMap: Record<string, string> = {
              'blanket': 'Picnic Blanket', 'cooler': 'Cooler + Ice',
              'charcuterie': 'Charcuterie Board', 'sushi': 'Coach Sushi Delivery',
              'speaker': 'Bluetooth Speaker', 'towels': 'Beach Towels x2',
              'chips': 'Chips + Water', 'sunscreen': 'Sunscreen',
            }
            return nameMap[a] || a
          }))
          .eq('active', true)
      : { data: [] }

    let addonsCents = 0
    for (const ar of (addonRows || [])) {
      addonsCents += ar.price_cents
    }

    const grandTotalCents = totalCents + deliveryCents + addonsCents

    // Build Stripe line items using price_data (dynamic pricing, not fixed Stripe prices)
    const stripeLineItems: any[] = [
      {
        price_data: {
          currency: 'usd',
          unit_amount: totalCents,
          product_data: {
            name: pricingRow?.display_name || `${tier} ${duration}`,
            description: `Zone ${zone_id} | ${time_slot} | ${booking_date}`,
          },
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: 'usd',
          unit_amount: deliveryCents,
          product_data: { name: 'Delivery to Zone' },
        },
        quantity: 1,
      },
    ]

    // Add add-on line items
    for (const ar of (addonRows || [])) {
      stripeLineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: ar.price_cents,
          product_data: {
            name: ar.name,
            description: ar.description || '',
          },
        },
        quantity: 1,
      })
    }

    // Create order in Supabase first (pending status)
    const orderNumber = `U${Date.now().toString(36).toUpperCase()}`
    const { data: order, error: orderErr } = await getSupabase()
      .from('orders')
      .insert({
        order_number: orderNumber,
        order_type: tier === 'cabana' ? 'cabana_rental' : tier === 'vip' ? 'vip_rental' : 'umbrella_rental',
        status: 'pending',
        internal_status: 'new',
        payment_status: 'unpaid',
        phone: phone || null,
        customer_name: name || null,
        zone_id,
        time_slot,
        booking_date,
        pole_id: pole_id || null,
        addons: addons,
        fulfillment_type: 'delivery_to_zone',
        delivery_location: { zone: zone_id, pole: pole_id || null, description: `Zone ${zone_id}${pole_id ? `, Pole ${pole_id}` : ''}` },
        order_placed_at: new Date().toISOString(),
        metadata: {
          source: 'booking_engine',
          tier,
          created_via: 'bookit.500grandlive.com',
        },
      })
      .select()
      .single()

    if (orderErr) {
      console.error('Order creation failed:', orderErr)
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }

    // Build Stripe checkout with dynamic pricing (price_data, not fixed price IDs)
    const stripeParams = new URLSearchParams()
    stripeParams.append('mode', 'payment')
    stripeParams.append('success_url', `https://bookit.500grandlive.com/?booked=true&order=${order.id}&session_id={CHECKOUT_SESSION_ID}`)
    stripeParams.append('cancel_url', `https://bookit.500grandlive.com/?cancelled=true&order=${order.id}`)

    stripeLineItems.forEach((item: any, i: number) => {
      stripeParams.append(`line_items[${i}][price_data][currency]`, item.price_data.currency)
      stripeParams.append(`line_items[${i}][price_data][unit_amount]`, item.price_data.unit_amount.toString())
      stripeParams.append(`line_items[${i}][price_data][product_data][name]`, item.price_data.product_data.name)
      if (item.price_data.product_data.description) {
        stripeParams.append(`line_items[${i}][price_data][product_data][description]`, item.price_data.product_data.description)
      }
      stripeParams.append(`line_items[${i}][quantity]`, item.quantity.toString())
    })

    // Metadata for webhook processing
    stripeParams.append('metadata[order_id]', order.id)
    stripeParams.append('metadata[order_number]', orderNumber)
    stripeParams.append('metadata[source]', 'umbrella_booking')
    stripeParams.append('metadata[zone_id]', zone_id)
    stripeParams.append('metadata[time_slot]', time_slot)
    stripeParams.append('metadata[booking_date]', booking_date)
    stripeParams.append('metadata[tier]', tier)
    stripeParams.append('metadata[duration]', duration)
    if (phone) stripeParams.append('metadata[customer_phone]', phone)
    if (email) stripeParams.append('customer_email', email)

    // Phone number for receipts
    if (phone) stripeParams.append('phone_number_collection[enabled]', 'true')

    // Create Stripe Checkout Session
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: stripeParams.toString(),
    })

    const stripeSession = await stripeRes.json()

    if (!stripeRes.ok) {
      console.error('Stripe error:', stripeSession)
      // Rollback: delete the pending order
      await getSupabase().from('orders').delete().eq('id', order.id)
      return NextResponse.json({ error: 'Payment session failed' }, { status: 500 })
    }

    // Update order with Stripe session ID
    await getSupabase()
      .from('orders')
      .update({
        stripe_payment_intent_id: stripeSession.payment_intent,
        metadata: {
          ...order.metadata,
          stripe_session_id: stripeSession.id,
        },
      })
      .eq('id', order.id)

    // Log payment event
    await getSupabase().from('payment_events').insert({
      event_type: 'checkout_created',
      customer_phone: phone || null,
      customer_name: name || null,
      customer_email: email || null,
      amount_cents: stripeSession.amount_total,
      description: `${tier} booking - Zone ${zone_id} - ${booking_date} ${time_slot}`,
      stripe_session_id: stripeSession.id,
      source: 'booking_engine',
      raw_payload: {
        order_id: order.id,
        zone_id,
        time_slot,
        booking_date,
        tier,
        addons,
      },
    })

    // Add to sync ledger for WooCommerce (will sync after payment)
    // This happens in stripe-webhook after payment succeeds

    return NextResponse.json({
      success: true,
      checkout_url: stripeSession.url,
      order_id: order.id,
      order_number: orderNumber,
      stripe_session_id: stripeSession.id,
    })

  } catch (err: any) {
    console.error('Checkout error:', err)
    return NextResponse.json(
      { error: err.message || 'Checkout failed' },
      { status: 500 }
    )
  }
}

// GET: Fetch products and availability for the booking UI
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const zone = url.searchParams.get('zone')
    const date = url.searchParams.get('date')

    // Fetch umbrella products
    const { data: products } = await getSupabase()
      .from('stripe_products')
      .select('id, name, description, amount_cents, category, stripe_price_id')
      .in('category', ['umbrella_package', 'equipment_rental', 'custom'])
      .eq('active', true)
      .order('amount_cents')

    // Fetch availability if zone and date provided
    let availability = null
    if (zone && date) {
      const { data } = await getSupabase()
        .from('umbrella_availability')
        .select('*')
        .eq('zone_id', zone)
        .eq('booking_date', date)

      availability = data
    }

    return NextResponse.json({
      products: products || [],
      availability: availability || [],
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
