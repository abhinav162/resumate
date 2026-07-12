import { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useCredits } from '../contexts/CreditContext';
import { formatCredits } from '../lib/format';
import { creditsApi, type CreditPack } from '../lib/api';
import { useCreditPacks, useCreateCheckout } from '../hooks/useCreditsApi';
import { loadRazorpayCheckout } from '../lib/razorpay';

type FlashState =
  | { kind: 'idle' }
  | { kind: 'success'; credits: number }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

const POLL_INTERVAL_MS = 1000;
const POLL_MAX_MS = 12_000;

async function pollUntilCreditsIncrease(
  startBalance: number | null,
  refresh: () => Promise<void>,
  fetchBalance: () => Promise<number>,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < POLL_MAX_MS) {
    await refresh();
    try {
      const current = await fetchBalance();
      if (startBalance == null || current > startBalance) return true;
    } catch {
      // ignore transient errors and keep polling
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return false;
}

export default function CreditsPage() {
  const { data: packs = [] } = useCreditPacks();
  const [loading, setLoading] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashState>({ kind: 'idle' });
  const { balance, refresh } = useCredits();
  const { user } = useUser();
  const checkout = useCreateCheckout();

  async function handleBuy(pack: CreditPack) {
    setLoading(pack.id);
    setFlash({ kind: 'idle' });

    try {
      const session = await checkout.mutateAsync(pack.id);
      const Razorpay = await loadRazorpayCheckout();
      const balanceBefore = balance;

      const rzp = new Razorpay({
        key: session.keyId,
        amount: session.amount,
        currency: session.currency,
        order_id: session.orderId,
        name: 'Resumate',
        description: `${pack.name} pack — ${pack.credits} credits`,
        prefill: {
          email: user?.primaryEmailAddress?.emailAddress,
          name: user?.fullName ?? undefined,
        },
        notes: { packId: pack.id },
        theme: { color: '#4f46e5' },
        modal: {
          ondismiss: () => {
            setLoading(null);
            setFlash({ kind: 'cancelled' });
          },
        },
        handler: async () => {
          // Modal closed after payment captured. Webhook will grant credits within
          // a few seconds — poll for the balance bump so we can confirm.
          const credited = await pollUntilCreditsIncrease(
            balanceBefore,
            refresh,
            async () => (await creditsApi.getBalance()).balance,
          );
          setLoading(null);
          if (credited) {
            setFlash({ kind: 'success', credits: pack.credits });
          } else {
            setFlash({
              kind: 'error',
              message:
                'Payment captured, but credits have not appeared yet. Refresh in a moment — if the balance still hasn’t updated, contact support.',
            });
          }
        },
      });
      rzp.open();
    } catch (err) {
      setLoading(null);
      setFlash({ kind: 'error', message: (err as { message?: string })?.message ?? 'Checkout failed to start' });
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold text-ink-primary">Buy Credits</h1>
        <p className="text-ink-secondary mt-1">
          Current balance:{' '}
          <span className="font-mono font-semibold">{formatCredits(balance)}</span> credits
        </p>
      </div>

      {flash.kind === 'success' && (
        <div className="bg-success-bg border border-success-border rounded-lg px-4 py-3 text-success-text text-sm font-medium">
          ✓ {flash.credits} credits added successfully!
        </div>
      )}
      {flash.kind === 'cancelled' && (
        <div className="bg-paper-bg border border-paper-border rounded-lg px-4 py-3 text-ink-secondary text-sm">
          Checkout cancelled — no charge was made.
        </div>
      )}
      {flash.kind === 'error' && (
        <div className="bg-error-bg border border-error-border rounded-lg px-4 py-3 text-error-text text-sm">
          {flash.message}
        </div>
      )}

      <div className="text-xs text-ink-muted bg-paper-bg border border-paper-border rounded-lg p-3 space-y-1">
        <p className="font-semibold text-ink-secondary">What costs credits?</p>
        <p>
          • Score resume: 1 credit &nbsp;·&nbsp; Tailor to job: 2 credits &nbsp;·&nbsp;
          Download PDF: free
        </p>
        <p>
          • GitHub repo analysis: first 10 repos free, then 0.2 credits per repo
          (re-analyzing an unchanged repo is always free)
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {packs.map((pack) => (
          <Card
            key={pack.id}
            className={`p-5 space-y-4 relative ${
              pack.popular ? 'border-indigo-300 ring-1 ring-indigo-200' : ''
            }`}
          >
            {pack.popular && (
              <Badge variant="indigo" className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                Most Popular
              </Badge>
            )}
            <div>
              <p className="font-heading font-semibold text-ink-primary">{pack.name}</p>
              <p className="font-mono text-2xl font-bold text-ink-primary mt-1">
                {pack.credits}
                <span className="text-sm font-normal text-ink-muted ml-1">credits</span>
              </p>
            </div>
            <p className="text-2xl font-heading font-bold text-indigo-600">₹{pack.priceInr}</p>
            <Button
              className="w-full"
              variant={pack.popular ? 'primary' : 'secondary'}
              loading={loading === pack.id}
              onClick={() => handleBuy(pack)}
            >
              Buy {pack.name}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
