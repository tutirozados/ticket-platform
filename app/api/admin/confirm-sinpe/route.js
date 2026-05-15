import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function verifyToken(orderId, token) {
  const expected = createHash('sha256')
    .update(`${orderId}:${process.env.SINPE_ACTION_SECRET ?? 'fomo-sinpe'}`)
    .digest('hex')
    .slice(0, 24);
  return token === expected;
}

async function confirmOrder(orderId) {
  const { error } = await supabase
    .from('orders')
    .update({ payment_status: 'confirmed' })
    .eq('id', orderId)
    .eq('payment_status', 'pending_sinpe');

  if (error) return { error: error.message };

  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fomocr.com';
    await fetch(`${base}/api/send-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });
  } catch (err) {
    console.error('[confirm-sinpe] send-ticket failed:', err);
  }

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

  const result = await confirmOrder(orderId);

  if (result.error) {
    return new Response(`<html><body style="font-family:sans-serif;padding:60px;text-align:center"><h2>Error: ${result.error}</h2></body></html>`, {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  return new Response(`
    <html><body style="font-family:sans-serif;text-align:center;padding:80px;color:#111827;">
      <div style="font-size:56px;margin-bottom:16px">✓</div>
      <h1 style="margin-bottom:8px;">Pago confirmado</h1>
      <p style="color:#6b7280;">El ticket fue enviado al comprador por correo.</p>
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
    return NextResponse.json({ error: 'Forbidden - You can only approve payments for your own events' }, { status: 403 });
  }

  const result = await confirmOrder(orderId);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ success: true });
}
