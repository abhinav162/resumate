import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useCredits } from '../contexts/CreditContext';
import { creditsApi } from '../lib/api';

type Pack = { id: string; name: string; credits: number; priceUsd: number; popular: boolean };

export default function CreditsPage() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const { balance, refresh } = useCredits();
  const [params] = useSearchParams();

  useEffect(() => {
    creditsApi.getPacks().then(setPacks);
    if (params.get('success')) refresh();
  }, [params, refresh]);

  async function handleBuy(packId: string) {
    setLoading(packId);
    try {
      const { url } = await creditsApi.createCheckout(packId);
      window.location.href = url;
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold text-ink-primary">Buy Credits</h1>
        <p className="text-ink-secondary mt-1">
          Current balance:{' '}
          <span className="font-mono font-semibold">{balance ?? '–'}</span> credits
        </p>
      </div>

      {params.get('success') && (
        <div className="bg-success-bg border border-success-border rounded-lg px-4 py-3 text-success-text text-sm font-medium">
          ✓ Credits added successfully!
        </div>
      )}

      <div className="text-xs text-ink-muted bg-paper-bg border border-paper-border rounded-lg p-3 space-y-1">
        <p className="font-semibold text-ink-secondary">What costs credits?</p>
        <p>
          • Score resume: 1 credit &nbsp;·&nbsp; Tailor to job: 2 credits &nbsp;·&nbsp;
          Download PDF: free
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
            <p className="text-2xl font-heading font-bold text-indigo-600">${pack.priceUsd}</p>
            <Button
              className="w-full"
              variant={pack.popular ? 'primary' : 'secondary'}
              loading={loading === pack.id}
              onClick={() => handleBuy(pack.id)}
            >
              Buy {pack.name}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
