'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useT } from '@/lib/i18n';

const POLL_INTERVAL_MS = 2500;
const MAX_WAIT_MS = 60_000;

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const t = useT();
  const [status, setStatus] = useState<'waiting' | 'done' | 'timeout'>('waiting');
  const initialPlan = useRef<string | null>(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await api.get('/user/billing/usage');
        const plan: string = (res.data?.data?.plan ?? 'free').toLowerCase();
        const planId: string = String(res.data?.data?.planId ?? '').toLowerCase();

        if (initialPlan.current === null) {
          initialPlan.current = plan;
        }

        // The gateway sends customers back with the plan they bought, so this is done the moment the
        // webhook has switched them to it (it may already have, by the time they are back here).
        const bought = new URLSearchParams(window.location.search).get('plan')?.toLowerCase();
        const planChanged = bought ? planId === bought : plan !== initialPlan.current;
        const elapsed = Date.now() - startedAt.current;

        if (planChanged) {
          setStatus('done');
          setTimeout(() => router.replace('/websites'), 1500);
          return;
        }

        if (elapsed >= MAX_WAIT_MS) {
          setStatus('timeout');
          setTimeout(() => router.replace('/websites'), 3000);
          return;
        }

        timer = setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        // not authenticated or network error — redirect anyway
        router.replace('/websites');
      }
    }

    poll();
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-sm px-6">
        {status === 'waiting' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-7 w-7 text-primary animate-spin" />
              </div>
            </div>
            <h1 className="text-xl font-semibold mb-2">{t.checkout.activating}</h1>
            <p className="text-sm text-muted-foreground">{t.checkout.confirming}</p>
          </>
        )}

        {status === 'done' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="h-7 w-7 text-emerald-500" />
              </div>
            </div>
            <h1 className="text-xl font-semibold mb-2">{t.checkout.allSet}</h1>
            <p className="text-sm text-muted-foreground">{t.checkout.active}</p>
          </>
        )}

        {status === 'timeout' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-7 w-7 text-primary" />
              </div>
            </div>
            <h1 className="text-xl font-semibold mb-2">{t.checkout.received}</h1>
            <p className="text-sm text-muted-foreground">{t.checkout.soon}</p>
          </>
        )}
      </div>
    </div>
  );
}
