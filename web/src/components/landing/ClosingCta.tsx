'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/stores/useAuthStore';

export default function ClosingCta() {
  const { isAuthenticated } = useAuth();
  return (
    <section className="lx-container py-28 sm:py-40">
      <div className="flex flex-col gap-8 border-t pt-16 lg:flex-row lg:items-end lg:justify-between" style={{ borderColor: 'var(--lx-line)' }}>
        <h2 className="lx-display text-[2.25rem] sm:text-6xl">
          Know why.
          <br />
          <span className="lx-dim">Start in two minutes.</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={isAuthenticated ? '/websites' : '/signup'} className="lx-btn lx-btn-primary">
            {isAuthenticated ? 'Open dashboard' : 'Start for free'}
          </Link>
          <Link href="/websites/demo" className="lx-btn lx-btn-ghost">
            Explore the demo <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
