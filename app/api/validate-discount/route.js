import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
  const { code, eventId, subtotal } = await request.json();

  if (!code?.trim()) {
    return NextResponse.json({ valid: false, error: 'Enter a discount code.' });
  }

  const { data: discount } = await supabase
    .from('discount_codes')
    .select('*')
    .ilike('code', code.trim())
    .eq('is_active', true)
    .single();

  if (!discount) {
    return NextResponse.json({ valid: false, error: 'Invalid discount code.' });
  }

  const now = new Date();
  if (discount.valid_from && new Date(discount.valid_from) > now) {
    return NextResponse.json({ valid: false, error: 'This code is not active yet.' });
  }
  if (discount.valid_until && new Date(discount.valid_until) < now) {
    return NextResponse.json({ valid: false, error: 'This code has expired.' });
  }
  if (discount.max_uses != null && discount.times_used >= discount.max_uses) {
    return NextResponse.json({ valid: false, error: 'This code has reached its maximum uses.' });
  }
  if (discount.event_id && discount.event_id !== eventId) {
    return NextResponse.json({ valid: false, error: 'This code is not valid for this event.' });
  }

  const amount = discount.discount_type === 'percentage'
    ? parseFloat(((subtotal * discount.discount_value) / 100).toFixed(2))
    : parseFloat(Math.min(discount.discount_value, subtotal).toFixed(2));

  return NextResponse.json({
    valid: true,
    codeId: discount.id,
    code: discount.code,
    type: discount.discount_type,
    value: discount.discount_value,
    amount,
    currentUses: discount.times_used,
  });
}
