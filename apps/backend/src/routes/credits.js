import express from 'express';
import Stripe from 'stripe';
import database from '../config/database.js';
import { getCredits, grantCredits } from '../services/creditService.js';
import { CREDIT_PACKS } from '../config/pricing.config.js';

const router = express.Router();

// Validate and create Stripe instance once at module load
function createStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key === 'sk_test_...' || key.length < 20) {
    console.warn('WARNING: STRIPE_SECRET_KEY is missing or is a placeholder. Credit purchases will fail.');
    return null;
  }
  return new Stripe(key);
}

const stripe = createStripeClient();

// Guard for routes that need Stripe
function requireStripe(req, res, next) {
  if (!stripe) {
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

// GET /api/credits/packs — available packs (no Stripe IDs exposed)
router.get('/packs', (req, res) => {
  const packs = CREDIT_PACKS.map(({ id, name, credits, priceUsd, popular }) => ({
    id, name, credits, priceUsd, popular
  }));
  res.json({ success: true, data: packs });
});

// POST /api/credits/checkout — create Stripe checkout session
router.post('/checkout', requireStripe, async (req, res) => {
  try {
    const { packId } = req.body;
    const pack = CREDIT_PACKS.find(p => p.id === packId);
    if (!pack) return res.status(400).json({ success: false, message: 'Invalid pack' });
    if (!pack.stripePriceId) return res.status(500).json({ success: false, message: 'Stripe price not configured' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: pack.stripePriceId, quantity: 1 }],
      metadata: { userId: req.headers['x-user-id'], packId, credits: String(pack.credits) },
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/credits?success=true&credits=${pack.credits}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/credits?cancelled=true`,
    });

    res.json({ success: true, data: { url: session.url } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/credits/webhook — Stripe webhook (raw body required, handled in server.js)
router.post('/webhook', requireStripe, express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).json({ success: false, message: `Webhook error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, credits } = session.metadata;
    const userRow = await database.get('SELECT id FROM users WHERE uuid = ?', [userId]);
    if (userRow) {
      await grantCredits(userRow.id, parseInt(credits, 10));
      console.log(`Granted ${credits} credits to user ${userId}`);
    }
  }

  res.json({ received: true });
});

export default router;
