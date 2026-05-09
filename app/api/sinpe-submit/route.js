import { createHash } from 'crypto';
import { supabase } from '@/lib/supabase';
import { sendSinpeAdminEmail } from '@/lib/email';

function makeToken(orderId) {
  return createHash('sha256')
    .update(`${orderId}:${process.env.SINPE_ACTION_SECRET ?? 'fomo-sinpe'}`)
    .digest('hex')
    .slice(0, 24);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      eventId, firstName, lastName, idNumber, email, quantity,
      totalUsd, crcAmount, sinpeReference, userId,
      tierId, tierName, isEarlyBird,
      discountCodeId, discountCode, discountAmount,
      ticketsRemaining, tierRemaining, earlyBirdSold, discountCurrentUses,
    } = body;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        event_id: eventId,
        buyer_name: `${firstName} ${lastName}`,
        buyer_email: email,
        first_name: firstName,
        last_name: lastName,
        id_number: idNumber,
        quantity,
        total_price: parseFloat(totalUsd),
        user_id: userId ?? null,
        tier_id: tierId ?? null,
        tier_name: tierName ?? null,
        discount_code_id: discountCodeId ?? null,
        discount_code: discountCode ?? null,
        discount_amount: discountAmount ?? 0,
        is_early_bird: isEarlyBird ?? false,
        payment_method: 'sinpe',
        payment_status: 'pending_sinpe',
        sinpe_reference: sinpeReference,
      })
      .select('id')
      .single();

    if (orderError) {
      return Response.json({ error: orderError.message }, { status: 500 });
    }

    // Reserve tickets immediately so they aren't oversold
    await supabase
      .from('events')
      .update({ tickets_remaining: ticketsRemaining - quantity })
      .eq('id', eventId);

    if (tierId) {
      const tierUpdate = { quantity_remaining: tierRemaining - quantity };
      if (isEarlyBird) tierUpdate.early_bird_sold = (earlyBirdSold ?? 0) + quantity;
      await supabase.from('ticket_tiers').update(tierUpdate).eq('id', tierId);
    }

    if (discountCodeId) {
      await supabase
        .from('discount_codes')
        .update({ times_used: (discountCurrentUses ?? 0) + 1 })
        .eq('id', discountCodeId);
    }

    const { data: event } = await supabase
      .from('events').select('title').eq('id', eventId).single();

    const token = makeToken(order.id);
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fomocr.com';
    const confirmUrl = `${base}/api/admin/confirm-sinpe?orderId=${order.id}&token=${token}`;
    const rejectUrl = `${base}/api/admin/reject-sinpe?orderId=${order.id}&token=${token}`;

    await sendSinpeAdminEmail({
      order: {
        id: order.id,
        buyer_name: `${firstName} ${lastName}`,
        buyer_email: email,
        first_name: firstName,
        quantity,
        total_price: totalUsd,
        sinpe_reference: sinpeReference,
      },
      event: event ?? { title: 'Evento' },
      crcAmount,
      confirmUrl,
      rejectUrl,
    });

    return Response.json({ success: true, orderId: order.id });
  } catch (err) {
    console.error('[sinpe-submit] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
