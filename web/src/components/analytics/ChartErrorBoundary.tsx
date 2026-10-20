'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useT } from '@/lib/i18n';

interface State { hasError: boolean; error?: Error }

/** The fallback is a function component so it can read the current language. */
function ChartErrorFallback({ label, onRetry }: { label?: string; onRetry: () => void }) {
  const t = useT().analytics.errorBoundary;
  return (
    <div className="h-full flex items-center justify-center rounded-lg border border-border bg-muted/20">
      <div className="text-center space-y-2 px-6 py-8">
        <AlertTriangle className="h-8 w-8 text-muted-foreground/40 mx-auto" />
        <p className="text-sm font-medium text-muted-foreground">
          {t.failed(label ?? t.thisChart)}
        </p>
        <button
          onClick={onRetry}
          className="text-xs text-primary hover:underline"
        >
          {t.tryAgain}
        </button>
      </div>
    </div>
  );
}

export class ChartErrorBoundary extends React.Component<
  { children: React.ReactNode; label?: string },
  State
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return <ChartErrorFallback label={this.props.label} onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
