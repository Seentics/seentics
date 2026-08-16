'use client';

import dynamic from 'next/dynamic';

// ssr:false must live in a Client Component — not allowed in Server Components
const DashboardPreview = dynamic(() => import('./HeroDashboardPreview'), {
  ssr: false,
  loading: () => <div className="h-[460px] rounded-lg border border-border/40 bg-card/30" />,
});

export function HeroDashboardPreviewLazy() {
  return <DashboardPreview />;
}
