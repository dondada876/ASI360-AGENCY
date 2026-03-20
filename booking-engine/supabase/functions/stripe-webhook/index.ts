import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══ HELPER: Get secrets from Vault ═══
async function getSecrets(supabase: any, names: string[]): Promise<Record<string, string>> {
  const { data } = await supabase.rpc('get_secrets', { secret_names: names });
  if (!data) return {};
  if (typeof data === 'object' && !Array.isArray(data)) return data;
  // List format
  const result: Record<string, string> = {};
  for (const s of data) {
    if (s?.name && s?.secret) result[s.name] = s.secret;
  }
  return result;
}

// ═══ HELPER: Create Amelia appointment (TT-1028) ═══
async function syncToAmelia(
  secrets: Record<string, string>,
  order: any,
  pricing: any,
  customerEmail: string,
  customerName: string
): Promise<{ success: boolean; ameliaId?: number; error?: string }> {
  try {
    const ameliaKey = secrets['amelia_api_key'];
    if (!ameliaKey) return { success: false, error: 'No Amelia API key' };
    if (!pricing?.amelia_service_id) return { success: false, error: 'No Amelia service ID for this tier/duration' };

    // Calculate booking start time from date + slot
    const slotTimes: Record<string, string> = {
      'morning': '08:00', 'afternoon': '12:00', 'sunset': '16:00', 'fullday': '08:00'
    };
    const startTime = slotTimes[order.time_slot] || '10:00';
    const bookingStart = `${order.booking_date} ${startTime}`;

    // Duration mapping
    const durationMap: Record<string, number> = {
      '30min': 1800, '1hr': 3600, '4hr': 14400, 'fullday': 43200
    };

    const body = JSON.stringify({
      bookingStart,
      serviceId: pricing.amelia_service_id,
      providerId: 3, // Lakeside Manager
      locationId: 1, // Lake Merritt Empowerment Park
      notifyParticipants: 1,
      timeZone: 'America/Los_Angeles',
      internalNotes: `Zone: ${order.zone_id} | Pole: ${order.pole_id || 'N/A'} | Order: ${order.order_number}`,
      bookings: [{
        customer: {
          email: customerEmail || 'guest@500grandlive.com',
          firstName: customerName?.split(' ')[0] || 'Guest',
          lastName: customerName?.split(' ').slice(1).join(' ') || 'Booking',
          phone: order.phone || '',
        },
        persons: 1,
        status: 'approved',
        duration: durationMap[pricing.duration] || 3600,
        extras: [],
      }],
    });

    const resp = await fetch(
      'https://500grandlive.com/wp-admin/admin-ajax.php?action=wpamelia_api&call=/api/v1/appointments',
      {
        method: 'POST',
        headers: {
          'Amelia': ameliaKey,
          'Content-Type': 'application/json',
          'User-Agent': 'ASI360-Sentinel/1.0.0 (+https://asi360.co; contact=ops@asi360.co)',
        },
        body,
      }
    );

    const result = await resp.json();
    if (resp.ok && result?.data?.appointment?.id) {
      return { success: true, ameliaId: result.data.appointment.id };
    }
    return { success: false, error: JSON.stringify(result).slice(0, 200) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ═══ HELPER: Create WooCommerce order (TT-1029) ═══
async function syncToWooCommerce(
  secrets: Record<string, string>,
  order: any,
  pricing: any,
  customerEmail: string,
  customerName: string,
  amountCents: number
): Promise<{ success: boolean; wooOrderId?: number; error?: string }> {
  try {
    const wooKey = secrets['woocommerce_500gl_consumer_key'];
    const wooSecret = secrets['woocommerce_500gl_consumer_secret'];
    if (!wooKey || !wooSecret) return { success: false, error: 'No WooCommerce keys' };

    const auth = btoa(`${wooKey}:${wooSecret}`);
    const wooProductId = pricing?.woo_product_id ? parseInt(pricing.woo_product_id) : null;

    const lineItems = [];
    if (wooProductId) {
      lineItems.push({ product_id: wooProductId, quantity: 1 });
    } else {
      // Fallback: create order with custom line item
      lineItems.push({
        name: pricing?.display_name || `${order.order_type} Booking`,
        quantity: 1,
        total: (amountCents / 100).toFixed(2),
      });
    }

    const body = JSON.stringify({
      status: 'processing',
      billing: {
        first_name: customerName?.split(' ')[0] || 'Guest',
        last_name: customerName?.split(' ').slice(1).join(' ') || 'Booking',
        email: customerEmail || '',
        phone: order.phone || '',
      },
      line_items: lineItems,
      payment_method: 'stripe',
      set_paid: true,
      meta_data: [
        { key: '_umbrella_project', value: 'true' },
        { key: '_supabase_order_id', value: order.id },
        { key: '_zone_id', value: order.zone_id || '' },
        { key: '_time_slot', value: order.time_slot || '' },
        { key: '_booking_date', value: order.booking_date || '' },
        { key: '_pole_id', value: order.pole_id || '' },
      ],
      customer_note: `Zone ${order.zone_id} | ${order.time_slot} | ${order.booking_date}${order.pole_id ? ` | Pole ${order.pole_id}` : ''}`,
    });

    const resp = await fetch('https://500grandlive.com/wp-json/wc/v3/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ASI360-Sentinel/1.0.0 (+https://asi360.co; contact=ops@asi360.co)',
      },
      body,
    });

    const result = await resp.json();
    if (resp.ok && result?.id) {
      return { success: true, wooOrderId: result.id };
    }
    return { success: false, error: JSON.stringify(result).slice(0, 200) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ═══ HELPER: Create Airtable ops record (TT-1030) ═══
async function syncToAirtable(
  secrets: Record<string, string>,
  order: any,
  amountCents: number,
  customerName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const atKey = secrets['airtable_api_key'];
    if (!atKey) return { success: false, error: 'No Airtable API key' };

    const baseId = 'appTxd0ui52pLc1fT'; // ops_hub
    const tableId = 'Daily%20Orders%20Snapshot'; // or create a new table

    // For now, we'll log to Daily Orders Snapshot with umbrella metadata
    // This can be upgraded to a dedicated Umbrella Bookings table later
    const resp = await fetch(
      `https://api.airtable.com/v0/${baseId}/${tableId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${atKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            'Supabase ID': `umbrella_${order.id}`,
            'Date': order.booking_date,
            'Notes': `Umbrella Booking: Zone ${order.zone_id} | ${order.time_slot} | ${order.order_type} | $${(amountCents/100).toFixed(2)} | ${customerName || 'Guest'}`,
          },
        }),
      }
    );

    return { success: resp.ok };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ═══ MAIN WEBHOOK HANDLER ═══
Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const event = body;

    // ═══ Handle checkout.session.completed ═══
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const sessionId = session.id;
      const paymentIntent = session.payment_intent;
      const customerEmail = session.customer_email || session.customer_details?.email;
      const customerName = session.customer_details?.name;
      const amountTotal = session.amount_total;
      const metadata = session.metadata || {};

      // ──────────────────────────────────────────────────
      // UMBRELLA BOOKING (source = 'umbrella_booking')
      // ──────────────────────────────────────────────────
      if (metadata.source === 'umbrella_booking' && metadata.order_id) {
        console.log(`Umbrella booking payment: ${sessionId} - $${(amountTotal / 100).toFixed(2)}`);

        // 1. Update Supabase order → confirmed
        await supabase
          .from('orders')
          .update({
            status: 'confirmed',
            internal_status: 'confirmed',
            payment_status: 'paid',
            payment_reference: paymentIntent,
            stripe_payment_intent_id: paymentIntent,
            updated_at: new Date().toISOString(),
            metadata: {
              ...metadata,
              stripe_session_id: sessionId,
              paid_at: new Date().toISOString(),
            },
          })
          .eq('id', metadata.order_id);

        // Fetch the full order for sync
        const { data: order } = await supabase
          .from('orders')
          .select('*')
          .eq('id', metadata.order_id)
          .single();

        if (!order) {
          console.error(`Order not found: ${metadata.order_id}`);
          return new Response(JSON.stringify({ received: true, warning: 'order_not_found' }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Fetch pricing config for this tier/duration
        const tier = metadata.tier || 'umbrella';
        const { data: pricing } = await supabase
          .from('booking_pricing')
          .select('*')
          .eq('tier', tier)
          .eq('duration', '1hr') // Default to 1hr for now
          .single();

        // Get all secrets needed for syncs
        const secrets = await getSecrets(supabase, [
          'amelia_api_key',
          'woocommerce_500gl_consumer_key',
          'woocommerce_500gl_consumer_secret',
          'airtable_api_key',
          'twilio_account_sid',
          'twilio_auth_token',
          'twilio_phone_number',
        ]);

        // 2. Log payment event
        const { data: paymentEvent } = await supabase.from('payment_events').insert({
          event_type: 'payment_succeeded',
          customer_phone: order.phone,
          customer_name: customerName || order.customer_name,
          customer_email: customerEmail,
          amount_cents: amountTotal,
          description: `Umbrella booking: Zone ${order.zone_id} | ${order.time_slot} | ${order.booking_date}`,
          stripe_session_id: sessionId,
          stripe_payment_intent_id: paymentIntent,
          source: 'booking_engine',
          raw_payload: event,
        }).select('id').single();

        // 3. Sync to Amelia (TT-1028)
        const ameliaResult = await syncToAmelia(secrets, order, pricing, customerEmail || '', customerName || '');
        console.log(`Amelia sync: ${ameliaResult.success ? 'OK (ID:' + ameliaResult.ameliaId + ')' : 'FAILED: ' + ameliaResult.error}`);

        // 4. Sync to WooCommerce (TT-1029)
        const wooResult = await syncToWooCommerce(secrets, order, pricing, customerEmail || '', customerName || '', amountTotal);
        console.log(`WooCommerce sync: ${wooResult.success ? 'OK (ID:' + wooResult.wooOrderId + ')' : 'FAILED: ' + wooResult.error}`);

        // 5. Sync to Airtable (TT-1030)
        const atResult = await syncToAirtable(secrets, order, amountTotal, customerName || '');
        console.log(`Airtable sync: ${atResult.success ? 'OK' : 'FAILED: ' + atResult.error}`);

        // 6. Update order with sync results
        await supabase
          .from('orders')
          .update({
            wp_order_id: wooResult.wooOrderId || null,
            metadata: {
              ...order.metadata,
              amelia_appointment_id: ameliaResult.ameliaId || null,
              amelia_sync: ameliaResult.success ? 'synced' : 'failed',
              woo_sync: wooResult.success ? 'synced' : 'failed',
              airtable_sync: atResult.success ? 'synced' : 'failed',
              paid_at: new Date().toISOString(),
            },
          })
          .eq('id', order.id);

        // 7. Add sync_ledger entries for any failures (retry later)
        if (paymentEvent?.id) {
          const ledgerEntries = [];
          if (!ameliaResult.success) {
            ledgerEntries.push({ event_id: paymentEvent.id, target_system: 'amelia', status: 'pending', error_message: ameliaResult.error });
          }
          if (!wooResult.success) {
            ledgerEntries.push({ event_id: paymentEvent.id, target_system: 'woocommerce', status: 'pending', error_message: wooResult.error });
          }
          if (!atResult.success) {
            ledgerEntries.push({ event_id: paymentEvent.id, target_system: 'airtable', status: 'pending', error_message: atResult.error });
          }
          // Always add CRM sync
          ledgerEntries.push({ event_id: paymentEvent.id, target_system: 'crm', status: 'pending' });

          if (ledgerEntries.length > 0) {
            await supabase.from('sync_ledger').insert(ledgerEntries);
          }
        }

        // 8. Update umbrella availability (decrement available spots)
        if (order.zone_id && order.booking_date && order.time_slot) {
          // Upsert availability record
          const { data: avail } = await supabase
            .from('umbrella_availability')
            .select('*')
            .eq('zone_id', order.zone_id)
            .eq('booking_date', order.booking_date)
            .eq('time_slot', order.time_slot)
            .single();

          if (avail) {
            await supabase
              .from('umbrella_availability')
              .update({ booked_spots: avail.booked_spots + 1, updated_at: new Date().toISOString() })
              .eq('id', avail.id);
          } else {
            await supabase
              .from('umbrella_availability')
              .insert({
                zone_id: order.zone_id,
                booking_date: order.booking_date,
                time_slot: order.time_slot,
                total_spots: 10,
                booked_spots: 1,
              });
          }
        }

        // 9. Send SMS confirmation via Twilio
        if (order.phone && secrets['twilio_account_sid']) {
          try {
            const twilioSid = secrets['twilio_account_sid'];
            const twilioToken = secrets['twilio_auth_token'];
            const twilioPhone = secrets['twilio_phone_number'];
            const auth = btoa(`${twilioSid}:${twilioToken}`);

            const smsBody = `Booking confirmed! Zone ${order.zone_id} | ${order.time_slot} | ${order.booking_date} | $${(amountTotal/100).toFixed(2)}. The Umbrella Project at Lake Merritt. See you there! - 500 Grand Live`;

            await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                To: order.phone,
                From: twilioPhone || '+15102880994',
                Body: smsBody,
              }).toString(),
            });
            console.log(`SMS confirmation sent to ${order.phone}`);
          } catch (smsErr: any) {
            console.error(`SMS failed: ${smsErr.message}`);
          }
        }

        console.log(`Umbrella booking complete: ${order.order_number} | Zone ${order.zone_id} | Amelia:${ameliaResult.success} | Woo:${wooResult.success} | AT:${atResult.success}`);

        return new Response(JSON.stringify({ received: true, type: 'umbrella_booking', order_id: order.id }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // ──────────────────────────────────────────────────
      // EXISTING: SMS Payment Link flow
      // ──────────────────────────────────────────────────
      const { data: linkRecord } = await supabase
        .from('stripe_payment_links')
        .select('*')
        .eq('stripe_session_id', sessionId)
        .single();

      if (linkRecord) {
        await supabase
          .from('stripe_payment_links')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', linkRecord.id);

        await supabase.from('payment_events').insert({
          event_type: 'payment_succeeded',
          customer_phone: linkRecord.customer_phone,
          customer_name: customerName || linkRecord.customer_name,
          customer_email: customerEmail || linkRecord.customer_email,
          product_id: linkRecord.product_id,
          amount_cents: amountTotal,
          description: linkRecord.description,
          stripe_session_id: sessionId,
          stripe_payment_intent_id: paymentIntent,
          payment_link_id: linkRecord.id,
          source: 'stripe',
          raw_payload: event,
        });

        const { data: paymentEvent } = await supabase
          .from('payment_events')
          .select('id')
          .eq('stripe_session_id', sessionId)
          .eq('event_type', 'payment_succeeded')
          .single();

        if (paymentEvent) {
          await supabase.from('sync_ledger').insert([
            { event_id: paymentEvent.id, target_system: 'woocommerce', status: 'pending' },
            { event_id: paymentEvent.id, target_system: 'crm', status: 'pending' },
          ]);
        }

        console.log(`Payment succeeded: ${sessionId} - $${(amountTotal / 100).toFixed(2)} from ${linkRecord.customer_phone}`);
      } else {
        // Non-SMS, non-umbrella payment
        await supabase.from('payment_events').insert({
          event_type: 'payment_succeeded',
          customer_email: customerEmail,
          customer_name: customerName,
          amount_cents: amountTotal,
          stripe_session_id: sessionId,
          stripe_payment_intent_id: paymentIntent,
          source: 'stripe',
          raw_payload: event,
        });
        console.log(`Payment succeeded (other source): ${sessionId}`);
      }
    }

    // ═══ Handle payment_intent.payment_failed ═══
    if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object;
      const metadata = intent.metadata || {};

      await supabase.from('payment_events').insert({
        event_type: 'payment_failed',
        amount_cents: intent.amount,
        stripe_payment_intent_id: intent.id,
        source: 'stripe',
        raw_payload: event,
      });

      // If this was an umbrella booking, update order status
      if (metadata.order_id) {
        await supabase
          .from('orders')
          .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', metadata.order_id);
      }

      const sessionId = metadata.checkout_session_id;
      if (sessionId) {
        await supabase
          .from('stripe_payment_links')
          .update({ status: 'failed' })
          .eq('stripe_session_id', sessionId);
      }
    }

    // ═══ Handle checkout.session.expired ═══
    if (event.type === 'checkout.session.expired') {
      const session = event.data.object;
      const metadata = session.metadata || {};

      await supabase
        .from('stripe_payment_links')
        .update({ status: 'expired' })
        .eq('stripe_session_id', session.id);

      // If umbrella booking expired, cancel the pending order
      if (metadata.order_id) {
        await supabase
          .from('orders')
          .update({ status: 'cancelled', payment_status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', metadata.order_id);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Webhook error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
