import { getPayPalAccessToken, PAYPAL_BASE } from '@/lib/paypal';

export async function POST(request) {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return Response.json({ error: 'Missing orderId' }, { status: 400 });
    }

    const accessToken = await getPayPalAccessToken();

    const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[capture-order] PayPal error:', data);
      return Response.json({ error: data.message ?? 'Capture failed' }, { status: res.status });
    }

    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
    const captureId = capture?.id;
    const captureStatus = capture?.status;

    if (!captureId || captureStatus !== 'COMPLETED') {
      return Response.json({ error: `Payment not completed. Status: ${captureStatus}` }, { status: 400 });
    }

    return Response.json({ captureId, status: captureStatus });
  } catch (err) {
    console.error('[capture-order] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
