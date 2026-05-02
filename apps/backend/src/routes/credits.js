import express from 'express';
import database from '../config/database.js';
import { getCredits, grantCredits } from '../services/creditService.js';
import { CREDIT_PACKS, CURRENCY } from '../config/pricing.config.js';
import {
  createOrder,
  verifyWebhookSignature,
  isConfigured,
  getKeyId,
} from '../services/razorpayService.js';

const router = express.Router();

function requireRazorpay(req, res, next) {
  if (!isConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'Payment service is not configured. Please contact support.',
    });
  }
  next();
}

// GET /api/credits/balance
router.get('/balance', async (req, res) => {
  try {
    const userRow = await database.get('SELECT id FROM users WHERE uuid = ?', [req.headers['x-user-id']]);
    if (!userRow) return res.status(401).json({ success: false, message: 'User not found' });
    const balance = await getCredits(userRow.id);
    res.json({ success: true, data: { balance } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/credits/packs — public-shape pack list (no provider IDs leaked)
router.get('/packs', (req, res) => {
  const packs = CREDIT_PACKS.map(({ id, name, credits, priceInr, popular }) => ({
    id, name, credits, priceInr, currency: CURRENCY, popular,
  }));
  res.json({ success: true, data: packs });
});

// POST /api/credits/checkout — create a Razorpay Order; frontend opens Checkout JS modal with this
router.post('/checkout', requireRazorpay, async (req, res) => {
  try {
    const { packId } = req.body;
    const pack = CREDIT_PACKS.find(p => p.id === packId);
    if (!pack) return res.status(400).json({ success: false, message: 'Invalid pack' });

    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });

    // 40-char receipt cap on Razorpay; truncate the user uuid + timestamp safely.
    const receipt = `c_${Date.now()}_${userId.slice(-12)}`.slice(0, 40);

    const order = await createOrder({
      amountPaise: pack.amountPaise,
      currency: CURRENCY,
      receipt,
      notes: {
        userId,
        packId: pack.id,
        credits: String(pack.credits),
      },
    });

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: getKeyId(),
        packId: pack.id,
      },
    });
  } catch (error) {
    console.error('Razorpay order creation failed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Razorpay webhook handler — exported for direct mount in server.js.
// MUST be mounted with express.raw() BEFORE express.json() so req.body is the raw Buffer
// needed for HMAC signature verification.
export async function razorpayWebhookHandler(req, res) {
  if (!isConfigured()) {
    return res.status(503).json({ success: false, message: 'Payment service not configured' });
  }

  const signature = req.headers['x-razorpay-signature'];
  const eventId = req.headers['x-razorpay-event-id'];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  let valid = false;
  try {
    valid = verifyWebhookSignature(req.body, signature, secret);
  } catch (err) {
    console.error('Webhook signature verify error:', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
  if (!valid) {
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }

  // Parse only after signature is valid.
  let event;
  try {
    event = JSON.parse(req.body.toString());
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Malformed JSON' });
  }

  // Idempotency — Razorpay may retry the same event. Each delivery has a unique
  // x-razorpay-event-id; INSERT-OR-IGNORE swallows duplicates atomically.
  if (eventId) {
    const result = await database.run(
      'INSERT OR IGNORE INTO processed_payment_events (event_id, provider) VALUES (?, ?)',
      [eventId, 'razorpay']
    );
    if (result.changes === 0) {
      console.log(`Duplicate webhook ignored: ${eventId}`);
      return res.json({ received: true, duplicate: true });
    }
  }

  if (event.event === 'payment.captured') {
    const payment = event.payload?.payment?.entity;
    const notes = payment?.notes || {};
    const { userId, credits } = notes;

    if (!userId || !credits) {
      console.warn('payment.captured missing notes.userId / notes.credits', { paymentId: payment?.id });
      return res.json({ received: true, ignored: 'missing-notes' });
    }

    const userRow = await database.get('SELECT id FROM users WHERE uuid = ?', [userId]);
    if (!userRow) {
      console.warn(`payment.captured for unknown user ${userId}`);
      return res.json({ received: true, ignored: 'unknown-user' });
    }

    const credAmt = parseInt(credits, 10);
    await grantCredits(userRow.id, credAmt);
    console.log(`Granted ${credAmt} credits to user ${userId} (payment ${payment.id})`);
  }

  res.json({ received: true });
}

export default router;
