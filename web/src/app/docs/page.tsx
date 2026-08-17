'use client';

import { useState } from 'react';
import {
  BookOpen, Rocket, BarChart3, Filter, Workflow, Zap, Code2,
  KeyRound, LayoutDashboard, Building2, Users, CreditCard, ShieldCheck,
  Copy, Check, Lock, Server, Globe, Shield, Cpu, Terminal,
  Settings, ArrowRight, Video, Flame, Eye, MousePointer
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helper Components
// ---------------------------------------------------------------------------

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-lg bg-zinc-950 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/80">
        <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 text-sm font-mono text-zinc-200 overflow-x-auto leading-relaxed whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function CodeExample({ label, language, code }: { label: string; language: string; code: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground/80">{label}</p>
      <CodeBlock code={code} language={language} />
    </div>
  );
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const methodColors: Record<HttpMethod, string> = {
  GET:    'bg-emerald-500/10 text-emerald-500',
  POST:   'bg-blue-500/10    text-blue-500',
  PUT:    'bg-amber-500/10   text-amber-500',
  PATCH:  'bg-orange-500/10  text-orange-500',
  DELETE: 'bg-red-500/10     text-red-500',
};

function EndpointBlock({
  method, path, description, request, response,
}: {
  method: HttpMethod;
  path: string;
  description?: string;
  request?: string;
  response?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/20 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
        <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-lg ${methodColors[method]}`}>
          {method}
        </span>
        <code className="text-sm font-mono text-foreground/80">{path}</code>
      </div>
      {description && (
        <div className="px-4 py-2.5 text-sm text-muted-foreground">
          {description}
        </div>
      )}
      {request && (
        <div className="px-4 pb-4 pt-1 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">Request Body</p>
          <CodeBlock code={request} language="json" />
        </div>
      )}
      {response && (
        <div className="px-4 pb-4 pt-1 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">Response</p>
          <CodeBlock code={response} language="json" />
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon: Icon, color, title }: { icon: React.ElementType; color: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center shrink-0`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DocsPage() {
  const [trackerTab, setTrackerTab] = useState<'nextjs' | 'react' | 'vue'>('nextjs');

  return (
    <div className="space-y-24">

      {/* ------------------------------------------------------------------ */}
      {/* INTRODUCTION                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section id="introduction" className="scroll-mt-24 space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <BookOpen className="w-4.5 h-4.5 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Welcome to Seentics Docs</h1>
          </div>
          <p className="text-xl text-muted-foreground leading-relaxed">
            The privacy-first analytics platform that goes beyond pageviews — session replays,
            heatmaps, behavioral automations, and a full REST API, all in one product.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              icon: Zap,
              color: 'bg-primary/10 text-primary',
              title: 'Performance First',
              desc: 'Sub-2ms event ingestion with idle-time dispatching. Zero impact on Core Web Vitals or SEO.',
            },
            {
              icon: ShieldCheck,
              color: 'bg-indigo-500/10 text-indigo-500',
              title: 'Privacy by Design',
              desc: 'No cookies, no fingerprinting, no PII. GDPR compliant without a consent banner for basic analytics.',
            },
            {
              icon: Rocket,
              color: 'bg-violet-500/10 text-violet-500',
              title: 'Actionable Insights',
              desc: 'Funnels, heatmaps, replays, and automated triggers — turn data into growth, not just charts.',
            },
          ].map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="p-5 rounded-lg bg-muted/25 space-y-3">
              <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center`}>
                <Icon className="w-4 h-4" />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href="#quick-start"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition text-sm"
          >
            Quick Start <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="#tracker"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-muted/50 text-foreground rounded-lg font-medium hover:bg-muted/70 transition text-sm"
          >
            Install Tracker
          </a>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* QUICK START                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section id="quick-start" className="scroll-mt-24 space-y-6">
        <SectionHeader icon={Rocket} color="bg-emerald-500/10 text-emerald-500" title="Quick Start" />

        <p className="text-muted-foreground">
          Get Seentics tracking your site in under 5 minutes.
        </p>

        <div className="space-y-3">
          {[
            {
              step: 1,
              title: 'Create Your Account',
              desc: 'Sign up and log in. No credit card required for the free plan.',
            },
            {
              step: 2,
              title: 'Add Your Website',
              desc: 'Click "Add Website", enter your site URL and name. Copy the Site ID shown — you\'ll need it for the tracker.',
            },
            {
              step: 3,
              title: 'Install the Tracker',
              desc: 'Paste the script tag into your site\'s <head>. Use the framework examples below for Next.js, React, or Vue.',
            },
            {
              step: 4,
              title: 'View Live Analytics',
              desc: 'Open your dashboard and watch real-time visitor data flow in. The tracker starts reporting within seconds.',
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex gap-4 p-5 rounded-lg bg-muted/20">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                {step}
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* ANALYTICS                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section id="analytics" className="scroll-mt-24 space-y-6">
        <SectionHeader icon={BarChart3} color="bg-blue-500/10 text-blue-500" title="Analytics" />

        <p className="text-muted-foreground leading-relaxed">
          Seentics collects comprehensive visitor and engagement data without cookies or PII.
          All metrics update in real time and are accessible via the API.
        </p>

        <div className="rounded-lg bg-muted/20 p-5">
          <h3 className="font-semibold mb-3 text-sm">Tracked automatically</h3>
          <div className="grid sm:grid-cols-2 gap-y-2 gap-x-4 text-sm text-muted-foreground">
            {[
              'Pageviews', 'Unique visitors', 'Sessions', 'Bounce rate',
              'Avg. session duration', 'Top pages', 'Referrers & UTM params',
              'Countries & cities', 'Devices & OS', 'Browsers',
            ].map(item => (
              <div key={item} className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-primary/60 shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <EndpointBlock
            method="GET"
            path="/analytics/overview?website_id=&start=&end="
            description="Get aggregated analytics for a date range. start and end are ISO 8601 dates."
            response={`{
  "pageviews": 48291,
  "unique_visitors": 12847,
  "sessions": 19043,
  "bounce_rate": 0.42,
  "avg_session_duration": 183,
  "period": { "start": "2026-03-01", "end": "2026-03-27" }
}`}
          />
          <EndpointBlock
            method="GET"
            path="/analytics/realtime/:website_id"
            description="Live visitor count and recent pageviews. Poll every 5–10 seconds."
            response={`{
  "active_visitors": 37,
  "pageviews_last_30m": 214,
  "top_pages": [
    { "path": "/pricing", "visitors": 12 },
    { "path": "/docs",    "visitors": 9 }
  ]
}`}
          />
          <EndpointBlock
            method="GET"
            path="/analytics/top-pages/:website_id"
            description="Ranked list of pages by pageviews and unique visitors."
            response={`{
  "pages": [
    { "path": "/",        "pageviews": 18420, "unique_visitors": 9231 },
    { "path": "/pricing", "pageviews": 7840,  "unique_visitors": 5102 },
    { "path": "/docs",    "pageviews": 4291,  "unique_visitors": 3018 }
  ]
}`}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SESSION REPLAYS                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section id="session-replays" className="scroll-mt-24 space-y-6">
        <SectionHeader icon={Video} color="bg-pink-500/10 text-pink-500" title="Session Replays" />

        <p className="text-muted-foreground leading-relaxed">
          Watch full recordings of real visitor sessions — mouse movements, clicks, scrolls,
          and form interactions. Every session is stored and searchable. Find rage clicks,
          broken flows, and drop-off moments without guessing.
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          {[
            {
              icon: Eye,
              title: 'Full session playback',
              desc: 'Replay any session at 1×, 2×, or 4× speed. Skip idle periods automatically. Jump to rage clicks or errors.',
            },
            {
              icon: Shield,
              title: 'PII masking',
              desc: 'Text inputs, passwords, and sensitive fields are masked in the recording before leaving the browser. Nothing personal hits the server.',
            },
            {
              icon: MousePointer,
              title: 'Click & rage-click detection',
              desc: 'Rage clicks (3+ rapid clicks on the same element) are flagged automatically so you can find frustration points fast.',
            },
            {
              icon: Video,
              title: 'Searchable & filterable',
              desc: 'Filter sessions by page, device, country, duration, or custom event. Find the exact sessions that matter.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-4 rounded-lg bg-muted/20 space-y-2">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-pink-500" />
                <h4 className="font-semibold text-sm">{title}</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-muted/20 p-5 space-y-2">
          <h3 className="font-semibold text-sm">How recordings are stored</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Recordings are chunked and streamed to S3-compatible storage (Cloudflare R2 in
            production, MinIO locally). The tracker uses <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded-lg">rrweb</code> under
            the hood — a full DOM snapshot followed by incremental mutations. Chunks are
            reassembled on playback. No video files, no screenshots — pure DOM serialization.
          </p>
        </div>

        <div className="space-y-3">
          <EndpointBlock
            method="GET"
            path="/replays?website_id=&start=&end="
            description="List session recordings for a website. Supports pagination and date filtering."
            response={`{
  "replays": [
    {
      "id": "rpl_abc123",
      "started_at": "2026-03-27T09:12:44Z",
      "duration_ms": 84200,
      "page_count": 4,
      "rage_clicks": 2,
      "country": "US",
      "device": "desktop",
      "browser": "Chrome"
    }
  ],
  "total": 1482,
  "page": 1
}`}
          />
          <EndpointBlock
            method="GET"
            path="/replays/:replayId"
            description="Get metadata and a playback URL for a specific session recording."
            response={`{
  "id": "rpl_abc123",
  "started_at": "2026-03-27T09:12:44Z",
  "duration_ms": 84200,
  "playback_url": "https://your-s3-bucket.com/replays/rpl_abc123/chunks.json",
  "events": [
    { "type": "page_view", "path": "/pricing", "ts": 0 },
    { "type": "rage_click", "selector": "#upgrade-btn", "ts": 12400 }
  ]
}`}
          />
          <EndpointBlock
            method="DELETE"
            path="/replays/:replayId"
            description="Delete a specific session recording. Use this to honor GDPR erasure requests."
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* HEATMAPS                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section id="heatmaps" className="scroll-mt-24 space-y-6">
        <SectionHeader icon={Flame} color="bg-red-500/10 text-red-500" title="Heatmaps" />

        <p className="text-muted-foreground leading-relaxed">
          Aggregate thousands of sessions into a single visual layer showing where users click,
          how far they scroll, and what they interact with. Filter by device, date range, or
          page variant to understand behavior at a glance.
        </p>

        <div className="grid sm:grid-cols-3 gap-3">
          {[
            {
              title: 'Click heatmap',
              desc: 'See exactly where users click. Hot zones show high-engagement areas; cold zones reveal ignored content.',
            },
            {
              title: 'Scroll depth map',
              desc: 'Shows how far down the page visitors scroll. Identify where most users stop reading.',
            },
            {
              title: 'Move map',
              desc: 'Tracks cursor movement — a strong proxy for eye movement and attention.',
            },
          ].map(({ title, desc }) => (
            <div key={title} className="p-4 rounded-lg bg-muted/20 space-y-2">
              <h4 className="font-semibold text-sm">{title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-muted/20 p-5 space-y-2">
          <h3 className="font-semibold text-sm">How heatmaps work</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Click and scroll coordinates are collected by the tracker on every pageview and
            stored as lightweight coordinate events. The heatmap is rendered on-demand by
            aggregating these events across sessions — no pre-rendered images. Filter by
            device type (desktop / tablet / mobile) to see separate heatmaps per viewport.
          </p>
        </div>

        <div className="space-y-3">
          <EndpointBlock
            method="GET"
            path="/heatmaps?website_id=&url=&type=click&start=&end="
            description="Get aggregated heatmap data for a specific page URL. type can be click, scroll, or move."
            response={`{
  "type": "click",
  "url": "/pricing",
  "period": { "start": "2026-03-01", "end": "2026-03-27" },
  "total_sessions": 4821,
  "points": [
    { "x": 0.52, "y": 0.18, "count": 843 },
    { "x": 0.48, "y": 0.61, "count": 212 }
  ]
}`}
          />
          <EndpointBlock
            method="GET"
            path="/heatmaps/pages?website_id="
            description="List all pages that have collected heatmap data, with session counts."
            response={`{
  "pages": [
    { "url": "/",        "sessions": 18420, "last_recorded": "2026-03-27" },
    { "url": "/pricing", "sessions": 7840,  "last_recorded": "2026-03-27" }
  ]
}`}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FUNNELS                                                             */}
      {/* ------------------------------------------------------------------ */}
      <section id="funnels" className="scroll-mt-24 space-y-6">
        <SectionHeader icon={Filter} color="bg-orange-500/10 text-orange-500" title="Funnels" />

        <p className="text-muted-foreground leading-relaxed">
          Define multi-step conversion paths and instantly see where users drop off. Works with
          pageview events, custom events, or any combination.
        </p>

        <div className="space-y-3">
          <EndpointBlock
            method="GET"
            path="/funnels?website_id="
            description="List all funnels for a website."
            response={`{
  "funnels": [
    { "id": "fnl_abc123", "name": "Signup Flow", "steps": 3, "created_at": "2026-01-12" }
  ]
}`}
          />
          <EndpointBlock
            method="POST"
            path="/funnels"
            description="Create a funnel. Steps can match page views or custom events."
            request={`{
  "name": "Checkout Flow",
  "website_id": "site_xyz",
  "steps": [
    { "name": "Viewed Pricing",     "event": "page_view:/pricing" },
    { "name": "Clicked Upgrade",    "event": "button_clicked:upgrade" },
    { "name": "Completed Checkout", "event": "purchase" }
  ]
}`}
            response={`{
  "id": "fnl_def456",
  "name": "Checkout Flow",
  "steps": 3,
  "created_at": "2026-03-27T10:00:00Z"
}`}
          />
          <EndpointBlock
            method="GET"
            path="/funnels/:id/analytics"
            description="Get conversion and drop-off data for each step."
            response={`{
  "funnel_id": "fnl_def456",
  "steps": [
    { "name": "Viewed Pricing",     "count": 5210, "conversion_rate": 1.0   },
    { "name": "Clicked Upgrade",    "count": 1843, "conversion_rate": 0.354 },
    { "name": "Completed Checkout", "count": 612,  "conversion_rate": 0.332 }
  ],
  "overall_conversion_rate": 0.117
}`}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* AUTOMATIONS                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section id="automations" className="scroll-mt-24 space-y-6">
        <SectionHeader icon={Workflow} color="bg-purple-500/10 text-purple-500" title="Automations" />

        <p className="text-muted-foreground leading-relaxed">
          Trigger webhooks, in-app messages, or custom JavaScript based on real visitor behavior.
          Rules are evaluated in real time on every incoming event.
        </p>

        <div className="rounded-lg bg-muted/20 p-5 space-y-2">
          <h3 className="font-semibold text-sm">Available triggers</h3>
          <div className="grid sm:grid-cols-2 gap-y-1.5 gap-x-4 text-sm text-muted-foreground">
            {['Page view', 'Custom event', 'Time on page', 'Exit intent', 'Scroll depth', 'Session end'].map(t => (
              <div key={t} className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-purple-500/60 shrink-0" />
                {t}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <EndpointBlock
            method="GET"
            path="/automations?website_id="
            description="List all automations for a website."
            response={`{
  "automations": [
    {
      "id": "auto_001",
      "name": "Re-engage idle users",
      "trigger": { "event": "session_end" },
      "actions": [{ "type": "webhook" }],
      "active": true
    }
  ]
}`}
          />
          <EndpointBlock
            method="POST"
            path="/automations"
            description="Create an automation with one trigger and one or more actions."
            request={`{
  "name": "High-intent alert",
  "website_id": "site_xyz",
  "trigger": {
    "event": "page_view",
    "conditions": [
      { "field": "path",          "op": "eq",  "value": "/pricing" },
      { "field": "session_count", "op": "gte", "value": 3 }
    ]
  },
  "actions": [
    {
      "type": "webhook",
      "config": { "url": "https://your-crm.com/hooks/lead", "method": "POST" }
    }
  ]
}`}
            response={`{
  "id": "auto_002",
  "name": "High-intent alert",
  "active": true,
  "created_at": "2026-03-27T10:00:00Z"
}`}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* TRACKER SCRIPT                                                      */}
      {/* ------------------------------------------------------------------ */}
      <section id="tracker" className="scroll-mt-24 space-y-6">
        <SectionHeader icon={Zap} color="bg-cyan-500/10 text-cyan-500" title="Tracker Script" />

        <p className="text-muted-foreground">
          A single script tag is all you need. Under 5 KB gzipped — no performance impact.
        </p>

        <CodeBlock
          language="html"
          code={`<!-- Add to your site's <head> -->
<script
  async
  src="https://your-domain.com/trackers/seentics.min.js"
  data-site-id="YOUR_SITE_ID"
></script>`}
        />

        <div className="rounded-lg bg-muted/20 p-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Self-hosted:</span> the tracker is served from your own deployment at{' '}
          <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded-lg">/trackers/seentics.min.js</code>.
          Replace <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded-lg">your-domain.com</code> with your actual domain.
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold">Custom Event Tracking</h3>
          <CodeBlock
            language="javascript"
            code={`// Track a custom event
window.seentics?.track('button_clicked', { label: 'Get Started', page: '/pricing' });

// Track a purchase / conversion
window.seentics?.track('purchase', { value: 49, plan: 'pro' });`}
          />
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold">Script Attributes</h3>
          <div className="rounded-lg overflow-hidden bg-muted/20">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30">
                  <th className="text-left px-4 py-3 font-semibold text-foreground/70 text-xs uppercase tracking-wider">Attribute</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground/70 text-xs uppercase tracking-wider">Default</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground/70 text-xs uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted/40">
                {[
                  { attr: 'data-site-id',    def: 'required', desc: "Your Site ID from the dashboard" },
                  { attr: 'data-auto-track', def: 'true',     desc: 'Automatically track pageviews on navigation' },
                  { attr: 'data-mask-pii',   def: 'true',     desc: 'Strip emails, IDs, and phone numbers from URLs' },
                  { attr: 'data-debug',      def: 'false',    desc: 'Log tracking events to the browser console' },
                ].map(row => (
                  <tr key={row.attr}>
                    <td className="px-4 py-3 font-mono text-xs text-primary">{row.attr}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.def}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">Framework Integration</h3>

          <div className="flex gap-1 p-1 rounded-lg bg-muted/30 w-fit">
            {(['nextjs', 'react', 'vue'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setTrackerTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  trackerTab === tab
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'nextjs' ? 'Next.js' : tab === 'react' ? 'React' : 'Vue 3'}
              </button>
            ))}
          </div>

          {trackerTab === 'nextjs' && (
            <CodeBlock
              language="tsx"
              code={`// app/layout.tsx
import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <Script
          src="https://your-domain.com/trackers/seentics.min.js"
          data-site-id="YOUR_SITE_ID"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}`}
            />
          )}
          {trackerTab === 'react' && (
            <CodeBlock
              language="tsx"
              code={`// App.tsx
import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    const s = document.createElement('script');
    s.src = 'https://your-domain.com/trackers/seentics.min.js';
    s.setAttribute('data-site-id', 'YOUR_SITE_ID');
    s.async = true;
    document.head.appendChild(s);
  }, []);

  return <YourApp />;
}`}
            />
          )}
          {trackerTab === 'vue' && (
            <CodeBlock
              language="ts"
              code={`// main.ts
import { createApp } from 'vue';
import App from './App.vue';

const s = document.createElement('script');
s.src = 'https://your-domain.com/trackers/seentics.min.js';
s.setAttribute('data-site-id', 'YOUR_SITE_ID');
s.async = true;
document.head.appendChild(s);

createApp(App).mount('#app');`}
            />
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* API REFERENCE                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section id="api-reference" className="scroll-mt-24 space-y-6">
        <SectionHeader icon={Code2} color="bg-primary/10 text-primary" title="API Reference" />

        <p className="text-muted-foreground">
          The Seentics REST API gives programmatic access to all platform features.
          All requests use JSON and are authenticated with Bearer tokens.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-lg bg-muted/25 space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Authentication</h3>
            </div>
            <p className="text-sm text-muted-foreground">Include your API key as a Bearer token.</p>
            <CodeBlock language="http" code="Authorization: Bearer YOUR_API_KEY" />
          </div>
          <div className="p-5 rounded-lg bg-muted/25 space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Base URL</h3>
            </div>
            <p className="text-sm text-muted-foreground">All endpoints are relative to your deployment URL.</p>
            <CodeBlock language="http" code="https://your-domain.com/api/v1" />
          </div>
        </div>

        <EndpointBlock
          method="POST"
          path="/user/auth/login"
          description="Exchange email and password for a JWT access token."
          request={`{
  "email": "you@example.com",
  "password": "your_password"
}`}
          response={`{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "...",
  "expiresIn": 3600
}`}
        />

        <h3 className="font-semibold">Analytics Endpoints</h3>
        <div className="space-y-3">
          <EndpointBlock method="GET" path="/analytics/overview?website_id=&start=&end="    description="Aggregated analytics for a date range." />
          <EndpointBlock method="GET" path="/analytics/realtime/:website_id"                description="Live active visitor count and recent pageviews." />
          <EndpointBlock method="GET" path="/analytics/top-pages/:website_id"              description="Pages ranked by pageviews and unique visitors." />
          <EndpointBlock method="GET" path="/analytics/top-referrers/:website_id"          description="Traffic sources ranked by session count." />
          <EndpointBlock method="GET" path="/analytics/top-countries/:website_id"          description="Visitor distribution by country." />
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold">Error Codes</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { code: '400', label: 'Bad Request',    desc: 'Missing or invalid parameters' },
              { code: '401', label: 'Unauthorized',   desc: 'Missing or invalid token' },
              { code: '403', label: 'Forbidden',      desc: 'Insufficient permissions or plan limit reached' },
              { code: '404', label: 'Not Found',      desc: 'Resource does not exist' },
              { code: '429', label: 'Rate Limited',   desc: 'Too many requests — slow down' },
              { code: '500', label: 'Server Error',   desc: 'Something went wrong on our end' },
            ].map(e => (
              <div key={e.code} className="p-4 rounded-lg bg-muted/20 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-primary font-mono">{e.code}</span>
                  <span className="text-sm font-medium">{e.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{e.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-lg bg-primary/5 space-y-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Rate Limits</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Default: <strong className="text-foreground">1,000 requests/minute</strong> per API key.
            Exceed the limit and you'll receive a{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded-lg">429</code> with a{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded-lg">Retry-After</code> header.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* API KEYS                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section id="api-keys" className="scroll-mt-24 space-y-6">
        <SectionHeader icon={KeyRound} color="bg-amber-500/10 text-amber-500" title="API Keys" />

        <p className="text-muted-foreground leading-relaxed">
          API keys authenticate your requests. Each key is scoped to specific permissions
          so you can grant minimal access to integrations and third-party tools.
        </p>

        <div className="rounded-lg bg-muted/20 p-5 space-y-3">
          <h3 className="font-semibold text-sm">Creating an API Key</h3>
          <ol className="space-y-1.5 text-sm text-muted-foreground list-decimal list-inside">
            <li>Go to Website Settings → API Keys tab</li>
            <li>Click "Create new key", give it a name, and select the scopes you need</li>
            <li>Copy the key immediately — it is shown only once</li>
          </ol>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold">Available Scopes</h3>
          <div className="rounded-lg overflow-hidden bg-muted/20">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30">
                  <th className="text-left px-4 py-3 font-semibold text-foreground/70 text-xs uppercase tracking-wider">Scope</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground/70 text-xs uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted/40">
                {[
                  { scope: 'analytics:read',    desc: 'Read analytics data' },
                  { scope: 'heatmaps:read',     desc: 'Read heatmap data' },
                  { scope: 'replays:read',      desc: 'Read session recordings' },
                  { scope: 'funnels:read',      desc: 'Read funnels' },
                  { scope: 'funnels:write',     desc: 'Create and update funnels' },
                  { scope: 'automations:read',  desc: 'Read automations' },
                  { scope: 'automations:write', desc: 'Create and update automations' },
                ].map(row => (
                  <tr key={row.scope}>
                    <td className="px-4 py-2.5 font-mono text-xs text-primary">{row.scope}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <EndpointBlock method="GET"    path="/user/websites/:websiteId/api-keys"         description="List all API keys for a website." />
          <EndpointBlock
            method="POST"
            path="/user/websites/:websiteId/api-keys"
            description="Create a new API key with specified scopes."
            request={`{
  "name": "Read-only dashboard integration",
  "scopes": ["analytics:read", "heatmaps:read"]
}`}
            response={`{
  "id": "key_abc123",
  "name": "Read-only dashboard integration",
  "key": "snt_live_xxxxxxxxxxxxx",
  "scopes": ["analytics:read", "heatmaps:read"],
  "created_at": "2026-03-27T10:00:00Z"
}`}
          />
          <EndpointBlock method="DELETE" path="/user/websites/:websiteId/api-keys/:keyId"  description="Revoke a key immediately. Cannot be undone." />
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">Usage Examples</h3>
          <CodeExample
            label="JavaScript (fetch)"
            language="javascript"
            code={`const res = await fetch('https://your-domain.com/api/v1/analytics/overview?website_id=site_xyz', {
  headers: { 'Authorization': 'Bearer snt_live_xxxxxxxxxxxxx' },
});
const data = await res.json();`}
          />
          <CodeExample
            label="Python (requests)"
            language="python"
            code={`import requests

headers = {"Authorization": "Bearer snt_live_xxxxxxxxxxxxx"}
res = requests.get(
    "https://your-domain.com/api/v1/analytics/overview",
    params={"website_id": "site_xyz"},
    headers=headers,
)
data = res.json()`}
          />
          <CodeExample
            label="cURL"
            language="bash"
            code={`curl "https://your-domain.com/api/v1/analytics/overview?website_id=site_xyz" \\
  -H "Authorization: Bearer snt_live_xxxxxxxxxxxxx"`}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { icon: Lock,     title: 'Never expose keys client-side', desc: 'Store API keys in environment variables. Never commit them to version control.' },
            { icon: Shield,   title: 'Use minimal scopes',            desc: 'Grant only what an integration actually needs — not blanket read/write access.' },
            { icon: Server,   title: 'Rotate keys regularly',         desc: 'Rotate every 90 days or immediately if you suspect a key has been leaked.' },
            { icon: Terminal, title: 'Monitor usage',                 desc: 'Check API key usage logs in your dashboard for unexpected spikes.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-4 rounded-lg bg-muted/20 space-y-2">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-amber-500" />
                <h4 className="font-semibold text-sm">{title}</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* UI BLOCKS                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section id="ui-blocks" className="scroll-mt-24 space-y-6">
        <SectionHeader icon={LayoutDashboard} color="bg-indigo-500/10 text-indigo-500" title="UI Blocks" />

        <p className="text-muted-foreground leading-relaxed">
          Drop pre-built analytics widgets into your own app or client portal.
          Built with React and Tailwind — fully themeable.
        </p>

        <div className="rounded-lg bg-amber-500/5 p-4 text-sm text-muted-foreground">
          <span className="font-medium text-amber-500">Coming soon</span> — the{' '}
          <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded-lg">@seentics/ui-blocks</code> package is in development.
          The API below reflects the planned interface.
        </div>

        <CodeBlock language="bash" code="npm install @seentics/ui-blocks" />

        <CodeExample
          label="Quick Start"
          language="tsx"
          code={`import { SeenticsProvider, AnalyticsWidget } from '@seentics/ui-blocks';

export default function Dashboard() {
  return (
    <SeenticsProvider apiKey="snt_live_xxxxx" websiteId="your-site-id">
      <AnalyticsWidget />
    </SeenticsProvider>
  );
}`}
        />

        <div className="space-y-3">
          <h3 className="font-semibold">Available Blocks</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { name: '<AnalyticsWidget />',                          desc: 'Visitors, pageviews, sessions, and bounce rate in a summary card.' },
              { name: '<RealtimeCounter />',                          desc: 'Live visitor count that updates in real-time.' },
              { name: '<TopPagesWidget />',                           desc: 'Ranked list of most-visited pages with traffic share bars.' },
              { name: '<HeatmapViewer pageUrl="" type="click" />',    desc: 'Embedded click or scroll heatmap for any page URL.' },
              { name: '<FunnelWidget funnelId="" />',                 desc: 'Visual funnel with step-by-step drop-off rates.' },
              { name: '<EventsTimeline eventNames={[]} />',           desc: 'Real-time stream of custom events as they happen.' },
            ].map(block => (
              <div key={block.name} className="p-4 rounded-lg bg-muted/20 space-y-2">
                <code className="text-xs font-mono text-primary break-all">{block.name}</code>
                <p className="text-xs text-muted-foreground leading-relaxed">{block.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <CodeExample
          label="Theme Customization"
          language="tsx"
          code={`<SeenticsProvider
  apiKey="snt_live_xxxxx"
  websiteId="your-site-id"
  theme={{
    primary:    '#7c3aed',
    background: '#09090b',
    card:       '#18181b',
    radius:     '0.5rem',
    fontFamily: 'Inter, sans-serif',
  }}
>
  <AnalyticsWidget />
</SeenticsProvider>`}
        />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* AGENCY OVERVIEW                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section id="agency-overview" className="scroll-mt-24 space-y-6">
        <SectionHeader icon={Building2} color="bg-violet-500/10 text-violet-500" title="Agency Overview" />

        <p className="text-muted-foreground leading-relaxed">
          Agency plans let you manage analytics for multiple clients from a single account.
          Provision accounts, assign websites, control feature access, and white-label the
          platform — with or without writing code.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-lg bg-muted/20 space-y-3">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4 text-violet-500" />
              <h3 className="font-semibold text-sm">Dashboard (No-code)</h3>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              {[
                'Invite clients via email from the Agency tab',
                'Assign websites and manage feature access per client',
                'Set recording and event limits per account',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-violet-500/60 mt-2 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-5 rounded-lg bg-muted/20 space-y-3">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-violet-500" />
              <h3 className="font-semibold text-sm">Programmatic API</h3>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              {[
                'Create clients and provision websites via API',
                'Integrate into your own onboarding and billing flows',
                'Authenticate with snt_age_... keys',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-violet-500/60 mt-2 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-lg bg-muted/20 p-5 space-y-3">
          <h3 className="font-semibold text-sm">Getting an Agency API Key</h3>
          <ol className="space-y-1.5 text-sm text-muted-foreground list-decimal list-inside">
            <li>Upgrade to an Agency or Agency Pro plan from Billing</li>
            <li>Go to Settings → Agency → API Keys</li>
            <li>Click "Generate Agency Key" — copy immediately, shown only once</li>
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* CLIENT MANAGEMENT                                                   */}
      {/* ------------------------------------------------------------------ */}
      <section id="client-management" className="scroll-mt-24 space-y-6">
        <SectionHeader icon={Users} color="bg-violet-400/10 text-violet-400" title="Client Management" />

        <p className="text-muted-foreground leading-relaxed">
          Create real user accounts for your clients. They log in directly and see only their own
          websites and data. All endpoints below require your agency JWT token.
        </p>

        <div className="space-y-3">
          <EndpointBlock
            method="POST"
            path="/user/agency/client-users"
            description="Create a new client account with feature flags and resource limits."
            request={`{
  "email": "client@their-company.com",
  "name": "Acme Corp",
  "features": {
    "heatmaps": true,
    "session_recordings": true,
    "funnels": true,
    "automations": false
  },
  "limits": {
    "max_websites": 5,
    "monthly_events": 500000,
    "monthly_recordings": 10000
  }
}`}
            response={`{
  "id": "usr_abc123",
  "email": "client@their-company.com",
  "name": "Acme Corp",
  "tempPassword": "TmpP@ss!k9x2",
  "created_at": "2026-03-27T10:00:00Z"
}`}
          />
          <EndpointBlock
            method="GET"
            path="/user/agency/client-users"
            description="List all client accounts managed by your agency."
            response={`{
  "clients": [
    { "id": "usr_abc123", "email": "client@their-company.com", "name": "Acme Corp", "websites_count": 3, "status": "active" }
  ],
  "total": 1
}`}
          />
          <EndpointBlock method="GET"    path="/user/agency/client-users/:userId"                description="Get a specific client's details, features, and limits." />
          <EndpointBlock method="DELETE" path="/user/agency/client-users/:userId"                description="Delete a client account and all associated data. Irreversible." />
          <EndpointBlock
            method="POST"
            path="/user/agency/client-users/:userId/reset-password"
            description="Reset a client's password and send them a temporary one."
          />
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold">Feature Flags</h3>
          <div className="rounded-lg overflow-hidden bg-muted/20">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30">
                  <th className="text-left px-4 py-3 font-semibold text-foreground/70 text-xs uppercase tracking-wider">Flag</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground/70 text-xs uppercase tracking-wider">Default</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground/70 text-xs uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted/40">
                {[
                  { flag: 'heatmaps',           def: 'true',  desc: 'Click and scroll heatmap recording' },
                  { flag: 'session_recordings', def: 'true',  desc: 'Full session replay recordings' },
                  { flag: 'funnels',            def: 'true',  desc: 'Conversion funnel builder and analytics' },
                  { flag: 'automations',        def: 'false', desc: 'Behavior-triggered automation engine' },
                ].map(row => (
                  <tr key={row.flag}>
                    <td className="px-4 py-2.5 font-mono text-xs text-primary">{row.flag}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{row.def}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg bg-muted/20 p-5 space-y-2">
          <h3 className="font-semibold text-sm">Resource Limits</h3>
          <p className="text-sm text-muted-foreground">
            Prevent any single client from consuming your agency quota. Defaults to your plan's
            total if not specified.
          </p>
          <ul className="text-sm text-muted-foreground space-y-1.5 mt-2">
            {[
              'max_websites — maximum sites the client can add',
              'monthly_events — monthly event ingestion cap',
              'monthly_recordings — monthly session recording cap',
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-violet-500/60 mt-2 shrink-0" />
                <code className="text-xs">{item}</code>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* AGENCY API (PROGRAMMATIC)                                           */}
      {/* ------------------------------------------------------------------ */}
      <section id="agency-api" className="scroll-mt-24 space-y-6">
        <SectionHeader icon={Code2} color="bg-violet-300/10 text-violet-300" title="Programmatic API" />

        <p className="text-muted-foreground leading-relaxed">
          Fully automate client provisioning. Use your Agency API key to create clients, assign
          websites, and set limits without touching the dashboard.
        </p>

        <CodeBlock language="http" code="Authorization: Bearer snt_age_xxxxxxxxxxxxx" />

        <div className="space-y-3">
          <EndpointBlock
            method="POST"
            path="/agency/api/users"
            description="Create a client account programmatically."
            request={`{
  "email": "client@example.com",
  "name": "Example Client",
  "features": { "heatmaps": true, "session_recordings": true },
  "limits": { "max_websites": 3, "monthly_events": 200000 }
}`}
            response={`{
  "id": "usr_xyz789",
  "email": "client@example.com",
  "tempPassword": "TmpP@ss!abc1",
  "created_at": "2026-03-27T10:00:00Z"
}`}
          />
          <EndpointBlock method="GET"    path="/agency/api/users"              description="List all clients managed through the programmatic API." />
          <EndpointBlock method="GET"    path="/agency/api/users/:userId"      description="Get a client's details, features, and limits." />
          <EndpointBlock method="DELETE" path="/agency/api/users/:userId"      description="Delete a client account and all their data." />
          <EndpointBlock
            method="POST"
            path="/agency/api/users/:userId/websites"
            description="Add a website to a client account."
            request={`{
  "name": "My Client's Blog",
  "url": "https://clientblog.com"
}`}
            response={`{
  "id": "site_new123",
  "name": "My Client's Blog",
  "url": "https://clientblog.com",
  "site_id": "sc_liveXXXXXX",
  "created_at": "2026-03-27T10:00:00Z"
}`}
          />
          <EndpointBlock method="GET"    path="/agency/api/users/:userId/websites" description="List all websites belonging to a client." />
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">Full Onboarding Examples</h3>
          <CodeExample
            label="JavaScript — complete client onboarding"
            language="javascript"
            code={`const BASE = 'https://your-domain.com/api/v1';
const AGENCY_KEY = 'snt_age_xxxxxxxxxxxxx';
const headers = {
  'Authorization': \`Bearer \${AGENCY_KEY}\`,
  'Content-Type': 'application/json',
};

// 1. Create client account
const { id: userId, tempPassword } = await fetch(\`\${BASE}/agency/api/users\`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    email: 'newclient@example.com',
    name: 'New Client Co.',
    features: { heatmaps: true, session_recordings: true, funnels: true },
    limits: { max_websites: 5, monthly_events: 500000 },
  }),
}).then(r => r.json());

// 2. Add a website for them
const site = await fetch(\`\${BASE}/agency/api/users/\${userId}/websites\`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ name: 'Client Website', url: 'https://newclient.com' }),
}).then(r => r.json());

console.log('Tracker ID:', site.site_id, '  Temp password:', tempPassword);`}
          />
          <CodeExample
            label="Python — complete client onboarding"
            language="python"
            code={`import requests

BASE = "https://your-domain.com/api/v1"
HEADERS = {
    "Authorization": "Bearer snt_age_xxxxxxxxxxxxx",
    "Content-Type": "application/json",
}

# 1. Create client
client = requests.post(f"{BASE}/agency/api/users", headers=HEADERS, json={
    "email": "newclient@example.com",
    "name": "New Client Co.",
    "features": {"heatmaps": True, "session_recordings": True},
    "limits": {"max_websites": 5, "monthly_events": 500000},
}).json()

# 2. Add website
site = requests.post(
    f"{BASE}/agency/api/users/{client['id']}/websites",
    headers=HEADERS,
    json={"name": "Client Website", "url": "https://newclient.com"},
).json()

print(f"Tracker ID: {site['site_id']}")`}
          />
        </div>

        <div className="p-5 rounded-lg bg-primary/5 space-y-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Agency API Rate Limits</h3>
          </div>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>500 requests / minute per agency key</li>
            <li>100 client accounts created / hour</li>
            <li>200 websites provisioned / hour</li>
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* WHITE LABEL                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section id="white-label" className="scroll-mt-24 space-y-6">
        <SectionHeader icon={Settings} color="bg-rose-500/10 text-rose-500" title="White Label" />

        <div className="flex items-center gap-2">
          {['Agency', 'Agency Pro'].map(plan => (
            <span key={plan} className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400">
              {plan}
            </span>
          ))}
          <span className="text-sm text-muted-foreground">plans only</span>
        </div>

        <p className="text-muted-foreground leading-relaxed">
          Present the platform under your agency's brand. Clients see your logo, colors, and
          domain — Seentics stays invisible.
        </p>

        <div className="rounded-lg overflow-hidden bg-muted/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30">
                <th className="text-left px-4 py-3 font-semibold text-foreground/70 text-xs uppercase tracking-wider">Setting</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground/70 text-xs uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/40">
              {[
                { setting: 'Brand Name',      desc: 'Shown in email notifications and browser tab titles' },
                { setting: 'Logo URL',        desc: 'Your agency logo (PNG or SVG, min 200 px wide)' },
                { setting: 'Primary Color',   desc: 'Hex color applied to buttons, links, and accent elements' },
                { setting: 'Support Email',   desc: 'Where client support requests are forwarded' },
                { setting: 'Custom Domain',   desc: 'Host the platform on your domain (e.g. analytics.youragency.com)' },
                { setting: 'Hide Seentics',   desc: 'Remove all Seentics branding from the UI and emails' },
              ].map(row => (
                <tr key={row.setting}>
                  <td className="px-4 py-2.5 font-medium text-sm">{row.setting}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-sm">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3">
          <EndpointBlock
            method="GET"
            path="/user/agency/white-label"
            description="Get the current white-label configuration."
            response={`{
  "brand_name": "Acme Analytics",
  "logo_url": "https://cdn.acme.com/logo.svg",
  "primary_color": "#7c3aed",
  "support_email": "support@acme.com",
  "custom_domain": "analytics.acme.com",
  "hide_seentics_branding": true
}`}
          />
          <EndpointBlock
            method="PATCH"
            path="/user/agency/white-label"
            description="Update white-label settings. Only include fields you want to change."
            request={`{
  "brand_name": "Acme Analytics",
  "primary_color": "#7c3aed",
  "hide_seentics_branding": true
}`}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* BILLING & PLANS                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section id="billing" className="scroll-mt-24 space-y-6">
        <SectionHeader icon={CreditCard} color="bg-green-500/10 text-green-500" title="Billing & Plans" />

        <p className="text-muted-foreground">
          Subscriptions are managed via Lemon Squeezy. Save 20% with annual billing.
        </p>

        <div className="rounded-lg overflow-x-auto bg-muted/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30">
                <th className="text-left px-4 py-3 font-semibold text-foreground/70 text-xs uppercase tracking-wider">Plan</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground/70 text-xs uppercase tracking-wider">Price</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground/70 text-xs uppercase tracking-wider">Events/mo</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground/70 text-xs uppercase tracking-wider">Recordings</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground/70 text-xs uppercase tracking-wider">Seats</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/40">
              {[
                { plan: 'Free',       price: '$0',   events: '10K',  recordings: '100',  team: '1' },
                { plan: 'Starter',    price: '$9',   events: '100K', recordings: '1K',   team: '3' },
                { plan: 'Growth',     price: '$19',  events: '500K', recordings: '10K',  team: '5' },
                { plan: 'Pro',        price: '$49',  events: '2M',   recordings: '50K',  team: '10' },
                { plan: 'Agency',     price: '$99',  events: '5M',   recordings: '100K', team: 'Unlimited' },
                { plan: 'Agency Pro', price: '$249', events: '20M',  recordings: '500K', team: 'Unlimited' },
              ].map(row => (
                <tr key={row.plan}>
                  <td className="px-4 py-3 font-semibold">{row.plan}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.price}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.events}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.recordings}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.team}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3">
          <EndpointBlock
            method="GET"
            path="/user/billing/usage"
            description="Get current billing period usage against your plan limits."
            response={`{
  "plan": "growth",
  "period": { "start": "2026-03-01", "end": "2026-03-31" },
  "events":     { "used": 241892, "limit": 500000 },
  "recordings": { "used": 3482,   "limit": 10000  }
}`}
          />
          <EndpointBlock
            method="POST"
            path="/user/billing/checkout"
            description="Get a Lemon Squeezy checkout URL to upgrade your plan."
            request={`{
  "plan": "pro",
  "billing": "yearly"
}`}
            response={`{
  "checkout_url": "https://seentics.lemonsqueezy.com/checkout/..."
}`}
          />
          <EndpointBlock
            method="POST"
            path="/user/billing/portal"
            description="Get a link to manage payment methods and invoices via the billing portal."
            response={`{
  "portal_url": "https://app.lemonsqueezy.com/my-orders/..."
}`}
          />
          <EndpointBlock
            method="POST"
            path="/user/billing/cancel"
            description="Cancel your subscription at end of the current billing period."
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* PRIVACY & SECURITY                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section id="privacy" className="scroll-mt-24 space-y-6">
        <SectionHeader icon={ShieldCheck} color="bg-emerald-500/10 text-emerald-500" title="Privacy & Security" />

        <p className="text-muted-foreground leading-relaxed">
          Seentics was built privacy-first from day one. No cookies, no fingerprinting, no PII —
          compliant with GDPR, CCPA, and ePrivacy out of the box.
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          {[
            {
              icon: Shield,
              title: 'No Cookies',
              desc: 'Session matching uses rotating cryptographic tokens that expire. No cross-site tracking, no consent banner required for basic analytics.',
              color: 'text-emerald-500', bg: 'bg-emerald-500/10',
            },
            {
              icon: ShieldCheck,
              title: 'GDPR Compliant',
              desc: 'Data export and deletion endpoints built in. Honor any visitor\'s right to access or erasure with a single API call.',
              color: 'text-blue-500', bg: 'bg-blue-500/10',
            },
            {
              icon: Lock,
              title: 'PII Masking',
              desc: 'The tracker automatically strips emails, phone numbers, and IDs from URLs before they ever reach the server.',
              color: 'text-amber-500', bg: 'bg-amber-500/10',
            },
            {
              icon: Server,
              title: 'Self-Hosted',
              desc: 'All data lives on your own infrastructure. Nothing is shared with third parties or sent to external analytics services.',
              color: 'text-indigo-500', bg: 'bg-indigo-500/10',
            },
          ].map(({ icon: Icon, title, desc, color, bg }) => (
            <div key={title} className="p-5 rounded-lg bg-muted/20 space-y-3">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <h3 className="font-semibold text-sm">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold">GDPR Endpoints</h3>
          <EndpointBlock
            method="GET"
            path="/user/gdpr/export"
            description="Export all data for the authenticated account as a JSON archive."
            response={`{
  "export_url": "https://your-domain.com/exports/usr_xxx_2026-03-27.json.gz",
  "expires_at": "2026-04-03T00:00:00Z"
}`}
          />
          <EndpointBlock
            method="POST"
            path="/user/gdpr/delete"
            description="Permanently delete all data for the authenticated account. Account is deactivated immediately. Irreversible."
          />
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold">Privacy Settings per Website</h3>
          <EndpointBlock
            method="GET"
            path="/user/websites/:siteId/privacy"
            description="Get the privacy configuration for a website."
            response={`{
  "mask_pii": true,
  "exclude_ip_ranges": [],
  "respect_dnt": true,
  "data_retention_days": 365
}`}
          />
          <EndpointBlock
            method="PUT"
            path="/user/websites/:siteId/privacy"
            description="Update privacy settings for a website."
            request={`{
  "mask_pii": true,
  "respect_dnt": true,
  "data_retention_days": 180,
  "exclude_ip_ranges": ["192.168.0.0/24"]
}`}
          />
        </div>
      </section>

    </div>
  );
}
