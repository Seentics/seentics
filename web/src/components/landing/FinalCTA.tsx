'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/stores/useAuthStore';

/** The last thing on the page: one ask, and the two questions that stop people asking. */
export default function FinalCTA() {
  const { isAuthenticated } = useAuth();

  return (
    <section className="landing-section">
      <div className="landing-container">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/[0.10] via-card to-card px-6 py-14 text-center sm:px-12 md:py-20">
          <h2 className="landing-h2 mx-auto mb-4 max-w-2xl">See what your website is really doing</h2>
          <p className="landing-lead mx-auto mb-8 max-w-xl">
            Free to start, no credit card, no cookies. Upgrade only when you outgrow it.
          </p>
          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href={isAuthenticated ? '/websites' : '/signup'}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#pricing"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-background px-8 text-base font-semibold text-foreground transition-colors hover:border-primary/40"
            >
              Compare plans
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
