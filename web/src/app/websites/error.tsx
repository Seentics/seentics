'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          Dashboard Error
        </h1>
        <p className="text-muted-foreground mb-2">
          Something went wrong while loading the dashboard.
        </p>
        <p className="text-sm text-muted-foreground/70 mb-8">
          {error.message || 'An unexpected error occurred.'}
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/websites"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-accent transition-colors"
          >
            <Home className="h-4 w-4" />
            All websites
          </Link>
        </div>
      </div>
    </div>
  );
}
