import { supabase } from '@/lib/supabase';
import { generateQRCode } from '@/lib/qr';
import { sendReminderEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const now = new Date();
    const in12h = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    const in13h = new Date(now.getTime() + 13 * 60 * 60 * 1000);

    const { data: events } = await supabase
      .from('events')
      .select('id, title, date, location, currency')
      .eq('status', 'approved')
      .gte('date', in12h.toISOString())
      .lte('date', in13h.toISOString());

    if (!events || events.length === 0) {
      return Response.json({ sent: 0, message: 'No events in window' });
    }

    let sent = 0;
    const errors = [];

    for (const event of events) {
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('event_id', event.id)
        .eq('payment_status', 'confirmed')
        .eq('reminder_sent', false);

      if (!orders || orders.length === 0) continue;

      for (const order of orders) {
        try {
          const { data: tickets } = await supabase
            .from('tickets')
            .select('*')
            .eq('order_id', order.id);

          if (!tickets || tickets.length === 0) continue;

          const ticketsWithQR = await Promise.all(
            tickets.map(async (t) => ({
              ...t,
              qrDataUrl: await generateQRCode(t.ticket_code),
            }))
          );

          await sendReminderEmail({
            to: order.buyer_email,
            buyerFirstName: order.first_name ?? order.buyer_name?.split(' ')[0] ?? 'there',
            event,
            tickets: ticketsWithQR,
          });

          await supabase
            .from('orders')
            .update({ reminder_sent: true })
            .eq('id', order.id);

          sent++;
        } catch (err) {
          console.error('[send-reminders] order', order.id, err.message);
          errors.push({ orderId: order.id, error: err.message });
        }
      }
    }

    return Response.json({ sent, ...(errors.length > 0 && { errors }) });
  } catch (err) {
    console.error('[send-reminders]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
