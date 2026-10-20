'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/stores/useAuthStore';
import { useT } from '@/lib/i18n';

export default function ClosingCta() {
  const { isAuthenticated } = useAuth();
  const t = useT();
  return (
    <section className="lx-container py-28 sm:py-40">
      <div className="flex flex-col gap-8 border-t pt-16 lg:flex-row lg:items-end lg:justify-between" style={{ borderColor: 'var(--lx-line)' }}>
        <h2 className="lx-display text-[1.75rem] sm:text-4xl">
          {t.closing.titleA}
          <br />
          <span>{t.closing.titleB}</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={isAuthenticated ? '/websites' : '/signup'} className="lx-btn lx-btn-primary">
            {isAuthenticated ? t.common.openDashboard : t.common.startFree}
          </Link>
          <Link href="/websites/demo" className="lx-btn lx-btn-ghost">
            {t.common.exploreDemo} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
