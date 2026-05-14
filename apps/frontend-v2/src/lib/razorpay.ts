/**
 * Razorpay Standard Checkout JS loader.
 * Loads the script once and resolves to the global Razorpay constructor.
 */

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

type RazorpayInstance = {
  open: () => void;
  close: () => void;
};

type RazorpayHandlerResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  prefill?: { email?: string; contact?: string; name?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpayHandlerResponse) => void;
  modal?: {
    ondismiss?: () => void;
    confirm_close?: boolean;
    escape?: boolean;
  };
};

type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let loaderPromise: Promise<RazorpayConstructor> | null = null;

export function loadRazorpayCheckout(): Promise<RazorpayConstructor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error('Razorpay script loaded but window.Razorpay missing'));
    };
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error('Failed to load Razorpay Checkout script'));
    };
    document.body.appendChild(script);
  });

  return loaderPromise;
}
