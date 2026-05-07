const SANDBOX = process.env.NEXT_PUBLIC_PAYPAL_LIVE !== 'true';

export const PAYPAL_BASE = SANDBOX
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

const CLIENT_ID = SANDBOX
  ? process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX
  : process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_LIVE;

const SECRET = SANDBOX
  ? process.env.PAYPAL_SECRET_SANDBOX
  : process.env.PAYPAL_SECRET_LIVE;

export async function getPayPalAccessToken() {
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${SECRET}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal token error: ${err}`);
  }
  const { access_token } = await res.json();
  return access_token;
}
