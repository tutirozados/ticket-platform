import { getPayPalAccessToken, PAYPAL_BASE } from '@/lib/paypal';

export async function POST(request) {
  try {
    const { amount, currency = 'USD' } = await request.json();

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const accessToken = await getPayPalAccessToken();

    const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'PayPal-Request-Id': `order-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: parseFloat(amount).toFixed(2),
            },
          },
        ],
        payment_source: {
          card: {
            attributes: {
              verification: { method: 'SCA_WHEN_REQUIRED' },
            },
          },
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[create-order] PayPal error:', data);
      return Response.json({ error: data.message ?? 'Failed to create order' }, { status: res.status });
    }

    return Response.json({ id: data.id });
  } catch (err) {
    console.error('[create-order] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
