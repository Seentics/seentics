'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';

const POLL_INTERVAL_MS = 2500;
const MAX_WAIT_MS = 60_000;

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'waiting' | 'done' | 'timeout'>('waiting');
  const initialPlan = useRef<string | null>(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await api.get('/user/billing/usage');
        const plan: string = (res.data?.data?.plan ?? 'starter').toLowerCase();

        if (initialPlan.current === null) {
          initialPlan.current = plan;
        }

        const planChanged = plan !== initialPlan.current;
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
              <div className="h-14 w-14 rounded-lg-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-7 w-7 text-primary animate-spin" />
              </div>
            </div>
            <h1 className="text-xl font-semibold mb-2">Activating your plan…</h1>
            <p className="text-sm text-muted-foreground">Confirming your subscription. This takes just a moment.</p>
          </>
        )}

        {status === 'done' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="h-14 w-14 rounded-lg-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="h-7 w-7 text-emerald-500" />
              </div>
            </div>
            <h1 className="text-xl font-semibold mb-2">You&apos;re all set!</h1>
            <p className="text-sm text-muted-foreground">Your plan is active. Taking you to your dashboard…</p>
          </>
        )}

        {status === 'timeout' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="h-14 w-14 rounded-lg-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-7 w-7 text-primary" />
              </div>
            </div>
            <h1 className="text-xl font-semibold mb-2">Payment received!</h1>
            <p className="text-sm text-muted-foreground">Your subscription will activate shortly. Taking you to your dashboard…</p>
          </>
        )}
      </div>
    </div>
  );
}
