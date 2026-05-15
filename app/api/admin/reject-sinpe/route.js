import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendSinpeRejectionEmail } from '@/lib/email';

function verifyToken(orderId, token) {
  const expected = createHash('sha256')
    .update(`${orderId}:${process.env.SINPE_ACTION_SECRET ?? 'fomo-sinpe'}`)
    .digest('hex')
    .slice(0, 24);
  return token === expected;
}

async function rejectOrder(orderId) {
  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('*, events(title)')
    .eq('id', orderId)
    .eq('payment_status', 'pending_sinpe')
    .single();

  if (fetchErr || !order) return { error: 'Order not found or already processed' };

  const { error } = await supabase
    .from('orders')
    .update({ payment_status: 'rejected' })
    .eq('id', orderId);

  if (error) return { error: error.message };

  // Return tickets to inventory
  await supabase.rpc('increment_tickets', {
    p_event_id: order.event_id,
    p_quantity: order.quantity,
  }).catch(() => {
    // Fallback if RPC not available
    supabase.from('events')
      .select('tickets_remaining')
      .eq('id', order.event_id)
      .single()
      .then(({ data: ev }) => {
        if (ev) {
          supabase.from('events')
            .update({ tickets_remaining: ev.tickets_remaining + order.quantity })
            .eq('id', order.event_id);
        }
      });
  });

  if (order.tier_id) {
    const { data: tier } = await supabase
      .from('ticket_tiers')
      .select('quantity_remaining, early_bird_sold')
      .eq('id', order.tier_id)
      .single();

    if (tier) {
      const tierUpdate = { quantity_remaining: tier.quantity_remaining + order.quantity };
      if (order.is_early_bird) {
        tierUpdate.early_bird_sold = Math.max(0, (tier.early_bird_sold ?? 0) - order.quantity);
      }
      await supabase.from('ticket_tiers').update(tierUpdate).eq('id', order.tier_id);
    }
  }

  if (order.discount_code_id) {
    const { data: dc } = await supabase
      .from('discount_codes')
      .select('times_used')
      .eq('id', order.discount_code_id)
      .single();
    if (dc) {
      await supabase
        .from('discount_codes')
        .update({ times_used: Math.max(0, dc.times_used - 1) })
        .eq('id', order.discount_code_id);
    }
  }

  await sendSinpeRejectionEmail({
    order,
    event: order.events ?? { title: 'el evento' },
  });

  return { success: true };
}

// GET — called from email link with token
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId');
  const token = searchParams.get('token');

  if (!orderId || !token || !verifyToken(orderId, token)) {
    return new Response('<html><body style="font-family:sans-serif;padding:60px;text-align:center"><h2>Enlace inválido o expirado.</h2></body></html>', {
      status: 403,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const result = await rejectOrder(orderId);

  if (result.error) {
    return new Response(`<html><body style="font-family:sans-serif;padding:60px;text-align:center"><h2>Error: ${result.error}</h2></body></html>`, {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  return new Response(`
    <html><body style="font-family:sans-serif;text-align:center;padding:80px;color:#111827;">
      <div style="font-size:56px;margin-bottom:16px">✗</div>
      <h1 style="margin-bottom:8px;">Pago rechazado</h1>
      <p style="color:#6b7280;">Se notificó al comprador y se liberaron los tickets.</p>
      <a href="/admin" style="display:inline-block;margin-top:24px;color:#1d4ed8;text-decoration:none;font-weight:600;">Ir al panel admin →</a>
    </body></html>
  `, { headers: { 'Content-Type': 'text/html' } });
}

// POST — called from admin panel
export async function POST(request) {
  const { orderId } = await request.json();
  if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });

  // Get authenticated user
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized - Authentication required' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
  }

  // Fetch order with event details to check ownership
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*, events(user_id)')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Check if user is the event organizer
  if (order.events?.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden - You can only reject payments for your own events' }, { status: 403 });
  }

  const result = await rejectOrder(orderId);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ success: true });
}
