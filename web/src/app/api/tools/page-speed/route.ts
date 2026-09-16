import { NextRequest, NextResponse } from 'next/server';

/**
 * Free public lead-gen tool: paste a URL, get a performance report. Backed by
 * Google's PageSpeed Insights API rather than running our own headless
 * Chrome — Google's servers do the actual fetch of the target page, so this
 * route never dials out to arbitrary user-supplied hosts itself (unlike a
 * self-hosted Lighthouse/Playwright run would, which is the SSRF shape
 * guarded against elsewhere in this suite — see uptime/server's
 * platform/ssrf-guard.ts). The only thing this route validates is that the
 * input is a well-formed http(s) URL, since a malformed one just wastes a
 * quota-limited API call.
 */

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

function isValidTargetUrl(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

type Strategy = 'mobile' | 'desktop';

type Metric = { id: string; label: string; value: string; score: number | null };

type Opportunity = { id: string; title: string; description: string; savingsMs: number | null };

type PageSpeedReport = {
  url: string;
  strategy: Strategy;
  scores: { performance: number; accessibility: number; bestPractices: number; seo: number };
  metrics: Metric[];
  opportunities: Opportunity[];
};

const METRIC_DEFS: { id: string; label: string }[] = [
  { id: 'largest-contentful-paint', label: 'Largest Contentful Paint' },
  { id: 'first-contentful-paint', label: 'First Contentful Paint' },
  { id: 'total-blocking-time', label: 'Total Blocking Time' },
  { id: 'cumulative-layout-shift', label: 'Cumulative Layout Shift' },
  { id: 'speed-index', label: 'Speed Index' },
];

function scoreOf(categories: any, key: string): number {
  const raw = categories?.[key]?.score;
  return typeof raw === 'number' ? Math.round(raw * 100) : 0;
}

function parseReport(url: string, strategy: Strategy, data: any): PageSpeedReport {
  const lighthouse = data.lighthouseResult;
  const categories = lighthouse?.categories ?? {};
  const audits = lighthouse?.audits ?? {};

  const metrics: Metric[] = METRIC_DEFS.map((def) => {
    const audit = audits[def.id];
    return {
      id: def.id,
      label: def.label,
      value: audit?.displayValue ?? '—',
      score: typeof audit?.score === 'number' ? Math.round(audit.score * 100) : null,
    };
  });

  const opportunities: Opportunity[] = Object.values(audits as Record<string, any>)
    .filter((audit) => audit?.details?.type === 'opportunity' && typeof audit?.numericValue === 'number' && audit.numericValue > 0)
    .sort((a: any, b: any) => b.numericValue - a.numericValue)
    .slice(0, 5)
    .map((audit: any) => ({
      id: audit.id,
      title: audit.title,
      description: audit.description?.replace(/\[.*?\]\(.*?\)/g, '').trim() ?? '',
      savingsMs: Math.round(audit.numericValue),
    }));

  return {
    url,
    strategy,
    scores: {
      performance: scoreOf(categories, 'performance'),
      accessibility: scoreOf(categories, 'accessibility'),
      bestPractices: scoreOf(categories, 'best-practices'),
      seo: scoreOf(categories, 'seo'),
    },
    metrics,
    opportunities,
  };
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests. Please try again in a few minutes.' }, { status: 429 });
  }

  let body: { url?: string; strategy?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const target = (body.url ?? '').trim();
  if (!target || !isValidTargetUrl(target)) {
    return NextResponse.json({ error: 'Enter a valid http(s) URL' }, { status: 400 });
  }
  const strategy: Strategy = body.strategy === 'desktop' ? 'desktop' : 'mobile';

  const params = new URLSearchParams({ url: target, strategy });
  for (const category of ['performance', 'accessibility', 'best-practices', 'seo']) {
    params.append('category', category);
  }
  if (process.env.GOOGLE_PAGESPEED_API_KEY) {
    params.set('key', process.env.GOOGLE_PAGESPEED_API_KEY);
  }

  try {
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`, {
      // PSI itself can take 20-30s on a slow target page — give it room
      // rather than timing out on genuinely slow (i.e. newsworthy) sites.
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      const message = errorBody?.error?.message || 'Could not analyze that URL. It may be unreachable or blocking automated requests.';
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json({ data: parseReport(target, strategy, data) });
  } catch (error: any) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return NextResponse.json(
      { error: timedOut ? 'The analysis took too long. Try again, or test a lighter page.' : 'Could not analyze that URL right now.' },
      { status: 502 },
    );
  }
}
