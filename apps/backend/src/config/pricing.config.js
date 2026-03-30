export const SIGNUP_CREDITS = 5;

export const CREDIT_PACKS = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 20,
    priceUsd: 10,
    stripePriceId: process.env.STRIPE_PRICE_STARTER,
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 50,
    priceUsd: 20,
    stripePriceId: process.env.STRIPE_PRICE_PRO,
    popular: true,
  },
  {
    id: 'max',
    name: 'Max',
    credits: 120,
    priceUsd: 40,
    stripePriceId: process.env.STRIPE_PRICE_MAX,
    popular: false,
  },
];
