import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || 'https://gtfffxwfgcxiiauliynd.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || ''
  )
}

// Product → Stripe Price mapping (from stripe_products table)
const PRODUCT_PRICES: Record<string, string> = {
  'umbrella': 'price_1TCyPiK2owjndB2o7aZbSFgY',        // $25
  'umbrella_delivery': 'price_1TCyPjK2owjndB2objsCFNUF', // $50
  'cabana': 'price_1TCyPjK2owjndB2obs0ikG0h',           // $75
  'vip': 'price_1TCyPkK2owjndB2oLASmR769',              // $100
  'blanket': 'price_1TCyPkK2owjndB2o2TPDv1Zq',          // $10
  'cooler': 'price_1TCyPlK2owjndB2ofp8xtz81',           // $10
  'charcuterie': 'price_1TCyPlK2owjndB2of8mQeZQ0',      // $25
  'sushi': 'price_1TCyPmK2owjndB2oyYbCp1Nf',            // $18
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      zone_id,
      tier,          // 'umbrella' | 'cabana' | 'vip'
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

    // Build line items for Stripe checkout
    // Main tier includes delivery
    const tierWithDelivery = tier === 'umbrella' ? 'umbrella_delivery' : tier
    const lineItems: { price: string; quantity: number }[] = [
      { price: PRODUCT_PRICES[tierWithDelivery] || PRODUCT_PRICES['umbrella_delivery'], quantity: 1 }
    ]

    // Add selected add-ons
    for (const addon of addons) {
      const priceId = PRODUCT_PRICES[addon]
      if (priceId) {
        lineItems.push({ price: priceId, quantity: 1 })
      }
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

    // Build Stripe checkout line_items params
    const stripeParams = new URLSearchParams()
    stripeParams.append('mode', 'payment')
    stripeParams.append('success_url', `https://bookit.500grandlive.com/?booked=true&order=${order.id}&session_id={CHECKOUT_SESSION_ID}`)
    stripeParams.append('cancel_url', `https://bookit.500grandlive.com/?cancelled=true&order=${order.id}`)

    lineItems.forEach((item, i) => {
      stripeParams.append(`line_items[${i}][price]`, item.price)
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
