import Razorpay from 'razorpay';

let client = null;

function getClient() {
  if (client) return client;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    console.warn('WARNING: RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set. Credit purchases will fail.');
    return null;
  }
  client = new Razorpay({ key_id, key_secret });
  return client;
}

export function isConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function getKeyId() {
  return process.env.RAZORPAY_KEY_ID || null;
}

export async function createOrder({ amountPaise, currency, receipt, notes }) {
  const c = getClient();
  if (!c) throw new Error('Razorpay not configured');
  return c.orders.create({
    amount: amountPaise,
    currency,
    receipt,
    notes,
    payment_capture: true,
  });
}

/**
 * Verify a webhook signature against the raw body.
 * Razorpay docs: signature = HMAC_SHA256(rawBody, webhookSecret).
 * The body MUST be the raw request body, not parsed JSON.
 */
export function verifyWebhookSignature(rawBody, signature, secret) {
  if (!secret) throw new Error('RAZORPAY_WEBHOOK_SECRET not set');
  if (!signature) return false;
  return Razorpay.validateWebhookSignature(
    rawBody.toString(),
    signature,
    secret
  );
}
