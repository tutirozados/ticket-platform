import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendEventStatusEmail } from '@/lib/email';

export async function POST(request) {
  const { eventId, status, reason } = await request.json();

  if (!eventId || !status) {
    return NextResponse.json({ error: 'eventId and status are required' }, { status: 400 });
  }

  const update = { status };
  if (reason) update.rejection_reason = reason;

  const { data: event, error: updateError } = await supabase
    .from('events')
    .update(update)
    .eq('id', eventId)
    .select('title, organizer_email')
    .single();

  if (updateError || !event) {
    console.error('[event-status] Failed to update event:', updateError);
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }

  if (event.organizer_email) {
    const { error: emailError } = await sendEventStatusEmail({
      to: event.organizer_email,
      eventTitle: event.title,
      status,
      reason,
    });
    if (emailError) {
      console.error('[event-status] Failed to send notification email:', emailError);
    }
  }

  return NextResponse.json({ success: true });
}
