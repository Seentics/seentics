'use client';

import dynamic from 'next/dynamic';

// ssr:false must live in a Client Component — not allowed in Server Components
const DashboardPreview = dynamic(() => import('./HeroDashboardPreview'), {
  ssr: false,
  loading: () => <div className="h-[420px]" />,
});

export function HeroDashboardPreviewLazy() {
  return <DashboardPreview />;
}
