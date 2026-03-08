'use client';

import { useState, useEffect } from 'react';
import { X, Zap } from 'lucide-react';
import Link from 'next/link';

export default function LifetimeBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY < 200);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (dismissed) return null;

  return (
    <div
      className={`hidden sm:block fixed top-0 left-0 right-0 z-[110] bg-primary dark:bg-slate-800 text-primary-foreground transition-transform duration-300 ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-center gap-3 py-2 text-sm pr-8">
          <Zap size={14} className="shrink-0" fill="currentColor" />
          <p className="font-medium text-center">
            <span className="font-bold">Lifetime Deal</span>
            {' '}&mdash; Full access for a one-time{' '}
            <span className="font-black">$99</span>
            <span className="hidden sm:inline opacity-60 line-through ml-1 text-xs">$299</span>
            {' '}
            <span className="opacity-80 font-semibold text-xs">(Limited slots)</span>
          </p>
          <Link
            href="#lifetime-deal"
            className="shrink-0 ml-1 px-3 py-1 rounded-full bg-primary-foreground text-primary text-xs font-bold hover:opacity-90 transition-opacity"
          >
            Grab it
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded hover:opacity-70 transition-opacity"
            aria-label="Dismiss banner"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
