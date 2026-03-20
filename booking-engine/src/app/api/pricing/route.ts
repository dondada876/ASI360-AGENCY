import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || 'https://gtfffxwfgcxiiauliynd.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || ''
  )
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const type = url.searchParams.get('type')

    if (type === 'addons') {
      // Fetch add-ons
      const { data, error } = await getSupabase()
        .from('booking_addons')
        .select('*')
        .eq('active', true)
        .order('sort_order')

      if (error) throw error

      const addons = (data || []).map(a => ({
        id: a.id,
        name: a.name,
        priceCents: a.price_cents,
        category: a.category,
        stripePriceId: a.stripe_price_id,
        icon: a.icon,
        description: a.description,
        active: a.active,
      }))

      return NextResponse.json({ addons })
    }

    // Fetch pricing tiers
    const { data, error } = await getSupabase()
      .from('booking_pricing')
      .select('*')
      .eq('active', true)
      .order('sort_order')

    if (error) throw error

    const tiers = (data || []).map(t => ({
      id: t.id,
      tier: t.tier,
      duration: t.duration,
      basePriceCents: t.base_price_cents,
      weekendSurchargePct: t.weekend_surcharge_pct,
      holidaySurchargePct: t.holiday_surcharge_pct,
      sunsetPremiumCents: t.sunset_premium_cents,
      deliveryFeeCents: t.delivery_fee_cents,
      ameliaServiceId: t.amelia_service_id,
      stripePriceId: t.stripe_price_id,
      wooProductId: t.woo_product_id,
      displayName: t.display_name,
      description: t.description,
      active: t.active,
    }))

    return NextResponse.json({ tiers })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
