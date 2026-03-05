'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface State { hasError: boolean; error?: Error }

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
      return (
        <div className="h-full flex items-center justify-center rounded-lg border border-border/40 bg-muted/20">
          <div className="text-center space-y-2 px-6 py-8">
            <AlertTriangle className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-medium text-muted-foreground">
              {this.props.label ?? 'This chart'} failed to render
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="text-xs text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
