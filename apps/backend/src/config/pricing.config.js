export const SIGNUP_CREDITS = 5;

// Razorpay amounts are in paise (₹1 = 100 paise).
export const CREDIT_PACKS = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 20,
    priceInr: 399,
    amountPaise: 39900,
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 50,
    priceInr: 799,
    amountPaise: 79900,
    popular: true,
  },
  {
    id: 'max',
    name: 'Max',
    credits: 120,
    priceInr: 1499,
    amountPaise: 149900,
    popular: false,
  },
];

export const CURRENCY = 'INR';
