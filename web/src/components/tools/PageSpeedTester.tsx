'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Gauge, Loader2, Smartphone, Monitor, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Strategy = 'mobile' | 'desktop';

type Metric = { id: string; label: string; value: string; score: number | null };
type Opportunity = { id: string; title: string; description: string; savingsMs: number | null };
type Report = {
  url: string;
  strategy: Strategy;
  scores: { performance: number; accessibility: number; bestPractices: number; seo: number };
  metrics: Metric[];
  opportunities: Opportunity[];
};

function scoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-500';
  if (score >= 50) return 'text-amber-500';
  return 'text-rose-500';
}

function scoreRingColor(score: number): string {
  if (score >= 90) return 'stroke-emerald-500';
  if (score >= 50) return 'stroke-amber-500';
  return 'stroke-rose-500';
}

function ScoreGauge({ label, score }: { label: string; score: number }) {
  const circumference = 2 * Math.PI * 26;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 60 60" className="h-16 w-16 -rotate-90">
          <circle cx="30" cy="30" r="26" strokeWidth="5" className="fill-none stroke-muted" />
          <circle
            cx="30"
            cy="30"
            r="26"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn('fill-none transition-all duration-700', scoreRingColor(score))}
          />
        </svg>
        <span className={cn('absolute inset-0 flex items-center justify-center text-sm font-bold', scoreColor(score))}>
          {score}
        </span>
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

export function PageSpeedTester() {
  const [url, setUrl] = useState('');
  const [strategy, setStrategy] = useState<Strategy>('mobile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let target = url.trim();
    if (!target) {
      setError('Enter a URL to test');
      return;
    }
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;

    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch('/api/tools/page-speed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target, strategy }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Something went wrong');
      setReport(body.data);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-container py-16 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Zap className="h-3.5 w-3.5 text-primary" />
          Free tool, no signup required
        </span>
        <h1 className="landing-h1 mt-4">Website Speed Test</h1>
        <p className="landing-lead mt-3">
          Paste any URL and get a real performance report — Core Web Vitals, load time, and the top
          fixes that would actually move the needle.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto mt-8 max-w-xl">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="text"
            inputMode="url"
            placeholder="yoursite.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            className="h-12 flex-1 text-base"
          />
          <Button type="submit" disabled={loading} className="h-12 px-6 font-semibold">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Test my page <ArrowRight className="h-4 w-4" /></>}
          </Button>
        </div>

        <div className="mt-3 flex items-center justify-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => setStrategy('mobile')}
            disabled={loading}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors',
              strategy === 'mobile' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Smartphone className="h-3.5 w-3.5" /> Mobile
          </button>
          <button
            type="button"
            onClick={() => setStrategy('desktop')}
            disabled={loading}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors',
              strategy === 'desktop' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Monitor className="h-3.5 w-3.5" /> Desktop
          </button>
        </div>

        {error && (
          <div role="alert" className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {loading && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Analyzing {url || 'the page'}… this usually takes 15–30 seconds.
          </p>
        )}
      </form>

      {report && (
        <div className="mx-auto mt-12 max-w-3xl space-y-8">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <p className="mb-5 truncate text-sm text-muted-foreground">
              Results for <span className="font-medium text-foreground">{report.url}</span> ({report.strategy})
            </p>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <ScoreGauge label="Performance" score={report.scores.performance} />
              <ScoreGauge label="Accessibility" score={report.scores.accessibility} />
              <ScoreGauge label="Best Practices" score={report.scores.bestPractices} />
              <ScoreGauge label="SEO" score={report.scores.seo} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
              <Gauge className="h-4 w-4 text-primary" /> Core Web Vitals
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {report.metrics.map((metric) => (
                <div key={metric.id} className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <p className={cn('mt-1 text-lg font-bold', metric.score != null ? scoreColor(metric.score) : 'text-foreground')}>
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {report.opportunities.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
              <h2 className="mb-4 text-base font-semibold text-foreground">Top opportunities</h2>
              <ul className="space-y-4">
                {report.opportunities.map((op) => (
                  <li key={op.id} className="border-l-2 border-primary/40 pl-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{op.title}</p>
                      {op.savingsMs != null && (
                        <span className="shrink-0 text-xs font-medium text-amber-600 dark:text-amber-400">
                          ~{(op.savingsMs / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{op.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-6 text-center sm:p-8">
            <h2 className="text-lg font-bold text-foreground">Want to catch regressions before your users do?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Seentics Uptime checks your site around the clock and alerts you the moment something
              breaks or slows down — free to start.
            </p>
            <Link href="/signup">
              <Button className="mt-5 h-10 rounded-lg px-5 text-sm font-semibold">
                Try Seentics free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
