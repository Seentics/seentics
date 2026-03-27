'use client';

import { useState } from 'react';
import {
  BookOpen, Rocket, BarChart3, Filter, Workflow, Zap, Code2,
  KeyRound, LayoutDashboard, Building2, Users, CreditCard, ShieldCheck,
  Copy, Check, Lock, Server, Globe, Shield, Cpu, Terminal,
  Settings, Palette, ArrowRight
} from 'lucide-react';
import Link from 'next/link';

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
    <div className="relative rounded-lg border border-border/50 bg-zinc-950 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-zinc-900/50">
        <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
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
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <CodeBlock code={code} language={language} />
    </div>
  );
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const methodColors: Record<HttpMethod, string> = {
  GET: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  POST: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  PUT: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  PATCH: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  DELETE: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

function EndpointBlock({
  method,
  path,
  description,
  request,
  response,
}: {
  method: HttpMethod;
  path: string;
  description?: string;
  request?: string;
  response?: string;
}) {
  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-card/60">
        <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${methodColors[method]}`}>
          {method}
        </span>
        <code className="text-sm font-mono text-foreground">{path}</code>
      </div>
      {description && (
        <div className="px-4 py-2 border-t border-border/30 text-sm text-muted-foreground bg-card/30">
          {description}
        </div>
      )}
      {request && (
        <div className="border-t border-border/30">
          <div className="px-4 pt-3 pb-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground/60">
            Request Body
          </div>
          <div className="px-4 pb-3">
            <CodeBlock code={request} language="json" />
          </div>
        </div>
      )}
      {response && (
        <div className="border-t border-border/30">
          <div className="px-4 pt-3 pb-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground/60">
            Response
          </div>
          <div className="px-4 pb-3">
            <CodeBlock code={response} language="json" />
          </div>
        </div>
      )}
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
      <section id="introduction" className="scroll-mt-24 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            Welcome to Seentics Docs
          </h1>
        </div>

        <p className="text-xl text-muted-foreground leading-relaxed">
          The privacy-first, high-performance analytics platform designed for modern product teams.
          Get detailed insights into user behavior without compromising on performance or privacy.
        </p>

        {/* Philosophy cards */}
        <div className="grid md:grid-cols-3 gap-6 pt-2">
          <div className="space-y-3 p-6 rounded-lg bg-card border border-border/50">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">Performance First</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sub-2ms event ingestion with idle-time dispatching ensures zero impact on your
              site's Core Web Vitals and SEO scores.
            </p>
          </div>

          <div className="space-y-3 p-6 rounded-lg bg-card border border-border/50">
            <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-indigo-500" />
            </div>
            <h3 className="font-semibold text-lg">Privacy by Design</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              No cookies, GDPR compliant by default. Session matching uses rotating
              cryptographic tokens — no PII ever stored.
            </p>
          </div>

          <div className="space-y-3 p-6 rounded-lg bg-card border border-border/50">
            <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-indigo-500" />
            </div>
            <h3 className="font-semibold text-lg">Actionable Insights</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Go beyond metrics with visual funnels, heatmaps, session replays, and
              automated behavior triggers that convert more visitors.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 pt-2">
          <a
            href="#quick-start"
            className="px-6 py-3 bg-primary text-primary-foreground rounded font-medium hover:opacity-90 transition flex items-center gap-2"
          >
            Quick Start <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="#tracker"
            className="px-6 py-3 bg-muted text-foreground border rounded font-medium hover:bg-muted/80 transition"
          >
            Install Tracker →
          </a>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* QUICK START                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section id="quick-start" className="scroll-mt-24 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Rocket className="w-5 h-5 text-emerald-500" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Quick Start</h2>
        </div>

        <p className="text-muted-foreground">
          Get up and running with Seentics in under 5 minutes.
        </p>

        <div className="space-y-4">
          {[
            {
              step: 1,
              title: 'Create Your Account',
              desc: 'Sign up at /signup and confirm your email address. Your account is ready instantly — no credit card required for the free plan.',
            },
            {
              step: 2,
              title: 'Add Your Website',
              desc: 'From your dashboard, click "Add Website", enter your site URL and name. Copy the Site ID shown on the next screen — you\'ll need it for the tracker.',
            },
            {
              step: 3,
              title: 'Install the Tracker',
              desc: 'Paste the script tag into your site\'s <head> or use one of the framework integrations below. See the Tracker Script section for details.',
            },
            {
              step: 4,
              title: 'View Analytics',
              desc: 'Visit /websites in your dashboard to see live data flowing in. Real-time visitor counts update every second.',
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex gap-5 p-5 rounded-lg bg-card border border-border/50">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-black text-sm flex items-center justify-center shrink-0">
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 text-blue-500" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
        </div>

        <p className="text-muted-foreground leading-relaxed">
          Seentics collects comprehensive visitor and engagement data without cookies or PII.
          All metrics are available in real-time and via the API.
        </p>

        <div className="rounded-lg border border-border/50 bg-card/30 p-5">
          <h3 className="font-semibold mb-3">What's tracked automatically</h3>
          <div className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
            {[
              'Pageviews', 'Unique visitors', 'Sessions', 'Bounce rate',
              'Avg. session duration', 'Top pages', 'Referrers',
              'Countries & cities', 'Devices & OS', 'Browsers',
            ].map(item => (
              <div key={item} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
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
            description="Get live visitor count updated every second."
            response={`{
  "active_visitors": 37,
  "pageviews_last_30m": 214,
  "top_pages": [
    { "path": "/pricing", "visitors": 12 },
    { "path": "/", "visitors": 9 }
  ]
}`}
          />

          <EndpointBlock
            method="GET"
            path="/analytics/top-pages/:website_id"
            description="Get ranked list of top pages by pageviews."
            response={`{
  "pages": [
    { "path": "/", "pageviews": 18420, "unique_visitors": 9231 },
    { "path": "/pricing", "pageviews": 7840, "unique_visitors": 5102 },
    { "path": "/docs", "pageviews": 4291, "unique_visitors": 3018 }
  ]
}`}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FUNNELS                                                             */}
      {/* ------------------------------------------------------------------ */}
      <section id="funnels" className="scroll-mt-24 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
            <Filter className="w-5 h-5 text-orange-500" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Funnels</h2>
        </div>

        <p className="text-muted-foreground leading-relaxed">
          Define multi-step conversion funnels and track drop-off at each step. Identify exactly
          where users abandon your key flows — signups, checkouts, onboarding, and more.
        </p>

        <div className="space-y-4">
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
            description="Create a new funnel with named steps."
            request={`{
  "name": "Checkout Flow",
  "website_id": "site_xyz",
  "steps": [
    { "name": "Viewed Pricing", "event": "page_view:/pricing" },
    { "name": "Clicked Upgrade", "event": "button_clicked:upgrade" },
    { "name": "Completed Checkout", "event": "purchase" }
  ]
}`}
            response={`{
  "id": "fnl_def456",
  "name": "Checkout Flow",
  "website_id": "site_xyz",
  "steps": [...],
  "created_at": "2026-03-27T10:00:00Z"
}`}
          />

          <EndpointBlock
            method="GET"
            path="/funnels/:id/analytics"
            description="Get conversion and drop-off data for each funnel step."
            response={`{
  "funnel_id": "fnl_def456",
  "steps": [
    { "name": "Viewed Pricing", "count": 5210, "conversion_rate": 1.0 },
    { "name": "Clicked Upgrade", "count": 1843, "conversion_rate": 0.354 },
    { "name": "Completed Checkout", "count": 612, "conversion_rate": 0.332 }
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
            <Workflow className="w-5 h-5 text-purple-500" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Automations</h2>
        </div>

        <p className="text-muted-foreground leading-relaxed">
          Trigger actions — webhooks, in-app notifications, email sequences — based on real user
          behavior. No code required for simple automations; full API access for advanced flows.
        </p>

        <div className="space-y-4">
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
            description="Create a new automation with a trigger and one or more actions."
            request={`{
  "name": "High-intent alert",
  "website_id": "site_xyz",
  "trigger": {
    "event": "page_view",
    "conditions": [
      { "field": "path", "op": "eq", "value": "/pricing" },
      { "field": "session_count", "op": "gte", "value": 3 }
    ]
  },
  "actions": [
    {
      "type": "webhook",
      "config": {
        "url": "https://your-crm.com/hooks/lead",
        "method": "POST"
      }
    },
    {
      "type": "email",
      "config": {
        "template": "high_intent_followup"
      }
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-cyan-500" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Tracker Script</h2>
        </div>

        <p className="text-muted-foreground">
          Install the tracker with a single script tag. Under 3 KB gzipped — no impact on performance.
        </p>

        <CodeBlock
          language="html"
          code={`<!-- Seentics Analytics -->
<script
  async
  src="https://cdn.seentics.com/tracker.js"
  data-site-id="YOUR_SITE_ID"
></script>`}
        />

        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Custom Event Tracking</h3>
          <CodeBlock
            language="javascript"
            code={`// Track a custom event
window.seentics?.track('button_clicked', { label: 'Get Started', page: '/pricing' });

// Track a conversion
window.seentics?.track('purchase', { value: 49, plan: 'pro' });`}
          />
        </div>

        {/* Attributes table */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Script Attributes</h3>
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-card/60">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-foreground/80">Attribute</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground/80">Default</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground/80">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {[
                  { attr: 'data-site-id', def: 'required', desc: "Your website's Site ID from the dashboard" },
                  { attr: 'data-auto-track', def: 'true', desc: 'Automatically track pageviews on navigation' },
                  { attr: 'data-mask-pii', def: 'true', desc: 'Strip emails, IDs, and phone numbers from URLs' },
                  { attr: 'data-debug', def: 'false', desc: 'Log tracking events to the browser console' },
                ].map(row => (
                  <tr key={row.attr} className="bg-card/20">
                    <td className="px-4 py-3 font-mono text-xs text-primary">{row.attr}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.def}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Framework tabs */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Framework Integration</h3>

          <div className="flex gap-1 p-1 rounded-lg bg-muted/50 border border-border/40 w-fit">
            {(['nextjs', 'react', 'vue'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setTrackerTab(tab)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  trackerTab === tab
                    ? 'bg-card text-foreground shadow-sm'
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
          src="https://cdn.seentics.com/tracker.js"
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
              code={`// main.tsx
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.seentics.com/tracker.js';
    script.setAttribute('data-site-id', 'YOUR_SITE_ID');
    script.async = true;
    document.head.appendChild(script);
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

const script = document.createElement('script');
script.src = 'https://cdn.seentics.com/tracker.js';
script.setAttribute('data-site-id', 'YOUR_SITE_ID');
script.async = true;
document.head.appendChild(script);

createApp(App).mount('#app');`}
            />
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* API REFERENCE                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section id="api-reference" className="scroll-mt-24 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Code2 className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">API Reference</h2>
        </div>

        <p className="text-muted-foreground">
          The Seentics REST API gives you programmatic access to all platform features.
          All requests use JSON and are authenticated with Bearer tokens.
        </p>

        {/* Auth + Base URL cards */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-lg border border-border/50 bg-card/40 space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">Authentication</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              All API requests require a Bearer token in the Authorization header.
            </p>
            <CodeBlock language="http" code="Authorization: Bearer snt_live_xxxxxxxxxxxxx" />
          </div>
          <div className="p-5 rounded-lg border border-border/50 bg-card/40 space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">Base URL</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              All endpoints are relative to the base URL below.
            </p>
            <CodeBlock language="http" code="https://api.seentics.com/v1" />
          </div>
        </div>

        {/* Login */}
        <EndpointBlock
          method="POST"
          path="/auth/login"
          description="Exchange credentials for a JWT access token."
          request={`{
  "email": "you@example.com",
  "password": "your_password"
}`}
          response={`{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 86400
}`}
        />

        {/* Analytics endpoints */}
        <h3 className="font-semibold text-lg pt-2">Analytics Endpoints</h3>
        <div className="space-y-4">
          <EndpointBlock
            method="GET"
            path="/analytics/overview?website_id=&start=&end="
            description="Get aggregated analytics for a date range."
          />
          <EndpointBlock
            method="GET"
            path="/analytics/realtime/:website_id"
            description="Get live active visitor count and recent pageviews."
          />
          <EndpointBlock
            method="GET"
            path="/analytics/top-pages/:website_id"
            description="Get ranked pages by pageviews and unique visitors."
          />
          <EndpointBlock
            method="GET"
            path="/analytics/top-referrers/:website_id"
            description="Get traffic sources ranked by session count."
          />
          <EndpointBlock
            method="GET"
            path="/analytics/top-countries/:website_id"
            description="Get visitor distribution by country."
          />
        </div>

        {/* Error codes */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Error Codes</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { code: '400', label: 'Bad Request', desc: 'Missing or invalid parameters' },
              { code: '401', label: 'Unauthorized', desc: 'Missing or invalid API key' },
              { code: '403', label: 'Forbidden', desc: 'Insufficient permissions for this resource' },
              { code: '404', label: 'Not Found', desc: 'Resource does not exist' },
              { code: '429', label: 'Rate Limited', desc: 'Too many requests — slow down' },
              { code: '500', label: 'Server Error', desc: 'Something went wrong on our end' },
            ].map(e => (
              <div key={e.code} className="p-4 rounded-lg bg-card/40 border border-border/50 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-primary font-mono">{e.code}</span>
                  <span className="text-sm font-semibold">{e.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{e.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Rate limits */}
        <div className="p-5 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Rate Limits</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Default: <strong className="text-foreground">1,000 requests/minute</strong> per API key.
            Burst up to 2,000 requests/minute. If you exceed the limit you'll receive a{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">429</code> response with a{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">Retry-After</code> header.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* API KEYS                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section id="api-keys" className="scroll-mt-24 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5 text-amber-500" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">API Keys</h2>
        </div>

        <p className="text-muted-foreground leading-relaxed">
          API keys authenticate requests to the Seentics API. Each key is scoped to specific
          permissions, so you can grant minimal access to third-party integrations.
        </p>

        {/* Creation steps */}
        <div className="p-5 rounded-lg bg-card/40 border border-border/50 space-y-3">
          <h3 className="font-semibold">Creating an API Key</h3>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Go to your Website Settings → API Keys tab</li>
            <li>Click "Create new key", give it a name, and select the scopes you need</li>
            <li>Copy the key immediately — it is shown only once</li>
          </ol>
        </div>

        {/* Scopes table */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Available Scopes</h3>
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-card/60">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-foreground/80">Scope</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground/80">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {[
                  { scope: 'analytics:read', desc: 'Read analytics data' },
                  { scope: 'heatmaps:read', desc: 'Read heatmap data' },
                  { scope: 'replays:read', desc: 'Read session recordings' },
                  { scope: 'funnels:read', desc: 'Read funnels' },
                  { scope: 'funnels:write', desc: 'Create and update funnels' },
                  { scope: 'automations:read', desc: 'Read automations' },
                  { scope: 'automations:write', desc: 'Create and update automations' },
                ].map(row => (
                  <tr key={row.scope} className="bg-card/20">
                    <td className="px-4 py-3 font-mono text-xs text-primary">{row.scope}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <CodeBlock language="http" code="Authorization: Bearer snt_live_xxxxxxxxxxxxx" />

        {/* CRUD endpoints */}
        <div className="space-y-4">
          <EndpointBlock
            method="GET"
            path="/user/websites/:websiteId/api-keys"
            description="List all API keys for a website."
          />
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
          <EndpointBlock
            method="DELETE"
            path="/user/websites/:websiteId/api-keys/:keyId"
            description="Revoke an API key immediately. This action cannot be undone."
          />
        </div>

        {/* Code examples */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Usage Examples</h3>
          <CodeExample
            label="JavaScript (fetch)"
            language="javascript"
            code={`const res = await fetch('https://api.seentics.com/v1/analytics/overview?website_id=site_xyz', {
  headers: {
    'Authorization': 'Bearer snt_live_xxxxxxxxxxxxx',
    'Content-Type': 'application/json',
  },
});
const data = await res.json();`}
          />
          <CodeExample
            label="Python (requests)"
            language="python"
            code={`import requests

headers = {"Authorization": "Bearer snt_live_xxxxxxxxxxxxx"}
res = requests.get(
    "https://api.seentics.com/v1/analytics/overview",
    params={"website_id": "site_xyz"},
    headers=headers,
)
data = res.json()`}
          />
          <CodeExample
            label="cURL"
            language="bash"
            code={`curl -X GET "https://api.seentics.com/v1/analytics/overview?website_id=site_xyz" \\
  -H "Authorization: Bearer snt_live_xxxxxxxxxxxxx"`}
          />
        </div>

        {/* Security best practices */}
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: Lock, title: 'Never expose keys client-side', desc: 'Store API keys in environment variables or a secrets manager. Never commit them to version control.' },
            { icon: Shield, title: 'Use minimal scopes', desc: 'Grant only the permissions an integration actually needs — not blanket read/write access.' },
            { icon: Server, title: 'Rotate keys regularly', desc: 'Rotate API keys every 90 days or immediately if you suspect a key has been compromised.' },
            { icon: Terminal, title: 'Monitor usage', desc: 'Check the API key usage logs in your dashboard for unexpected spikes or unauthorized requests.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-4 rounded-lg bg-card/40 border border-border/50 space-y-2">
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
            <LayoutDashboard className="w-5 h-5 text-indigo-500" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">UI Blocks</h2>
        </div>

        <p className="text-muted-foreground leading-relaxed">
          Drop pre-built analytics widgets directly into your own app or client portal.
          Built with React and Tailwind CSS — fully customizable.
        </p>

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

        {/* Available blocks */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Available Blocks</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { name: '<AnalyticsWidget />', desc: 'Visitors, pageviews, sessions, and bounce rate in a single summary card.' },
              { name: '<RealtimeCounter />', desc: 'Live visitor count that updates in real-time via WebSocket.' },
              { name: '<TopPagesWidget />', desc: 'Ranked list of your most-visited pages with traffic share bars.' },
              { name: '<HeatmapViewer pageUrl="" type="click|scroll" />', desc: 'Embedded click and scroll heatmap overlay for any page URL.' },
              { name: '<FunnelWidget funnelId="" />', desc: 'Visual conversion funnel with step-by-step drop-off rates.' },
              { name: '<EventsTimeline eventNames={[]} />', desc: 'Real-time stream of custom events as they happen.' },
            ].map(block => (
              <div key={block.name} className="p-4 rounded-lg bg-card/40 border border-border/50 space-y-2">
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
    primary: '#7c3aed',
    background: '#09090b',
    card: '#18181b',
    radius: '0.5rem',
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-violet-500" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Agency Overview</h2>
        </div>

        <p className="text-muted-foreground leading-relaxed">
          Agency plans let you manage analytics for multiple clients from a single account.
          Provision client accounts, assign websites, set resource limits, and white-label
          the platform — all without manual setup.
        </p>

        <div className="grid sm:grid-cols-2 gap-6">
          <div className="p-5 rounded-lg border border-border/50 bg-card/40 space-y-3">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4 text-violet-500" />
              <h3 className="font-semibold">Dashboard (No-code)</h3>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-violet-500/60 mt-1.5 shrink-0" />Invite clients via email from the Agency tab</li>
              <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-violet-500/60 mt-1.5 shrink-0" />Assign websites and manage feature access per client</li>
              <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-violet-500/60 mt-1.5 shrink-0" />Set recording and event limits per account</li>
            </ul>
          </div>

          <div className="p-5 rounded-lg border border-border/50 bg-card/40 space-y-3">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-violet-500" />
              <h3 className="font-semibold">Programmatic API (Full automation)</h3>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-violet-500/60 mt-1.5 shrink-0" />Create clients, provision websites, and set limits via API</li>
              <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-violet-500/60 mt-1.5 shrink-0" />Integrate into your own onboarding flows and billing systems</li>
              <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-violet-500/60 mt-1.5 shrink-0" />Authenticate with <code className="text-xs bg-muted px-1 rounded">snt_age_...</code> keys</li>
            </ul>
          </div>
        </div>

        {/* Getting Agency API key */}
        <div className="p-5 rounded-lg bg-card/40 border border-border/50 space-y-3">
          <h3 className="font-semibold">How to Get an Agency API Key</h3>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Upgrade to an Agency or Agency Pro plan from Billing</li>
            <li>Go to Settings → Agency → API Keys</li>
            <li>Click "Generate Agency Key" — copy it immediately, shown only once</li>
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* CLIENT MANAGEMENT                                                   */}
      {/* ------------------------------------------------------------------ */}
      <section id="client-management" className="scroll-mt-24 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-violet-400/10 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-violet-400" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Client Management</h2>
        </div>

        <p className="text-muted-foreground leading-relaxed">
          Create real user accounts for your clients. They receive login credentials and can
          access the Seentics dashboard directly — seeing only their own websites and data.
          All endpoints require a valid JWT token (your agency account).
        </p>

        <div className="space-y-4">
          <EndpointBlock
            method="POST"
            path="/user/agency/client-users"
            description="Create a new client account. A temporary password is generated and must be changed on first login."
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
    {
      "id": "usr_abc123",
      "email": "client@their-company.com",
      "name": "Acme Corp",
      "websites_count": 3,
      "status": "active"
    }
  ],
  "total": 1
}`}
          />

          <EndpointBlock
            method="GET"
            path="/user/agency/client-users/:userId"
            description="Get details for a specific client including feature flags and limits."
          />

          <EndpointBlock
            method="DELETE"
            path="/user/agency/client-users/:userId"
            description="Delete a client account and all associated data. Irreversible."
          />

          <EndpointBlock
            method="POST"
            path="/user/agency/client-users/:userId/reset-password"
            description="Reset a client's password and email them a temporary one."
            response={`{
  "message": "Password reset email sent to client@their-company.com",
  "tempPassword": "TmpP@ss!newX9"
}`}
          />
        </div>

        {/* Feature flags */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Feature Flags</h3>
          <p className="text-sm text-muted-foreground">
            Control which features each client can access. Set at creation time or update via PATCH.
          </p>
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-card/60">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-foreground/80">Flag</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground/80">Default</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground/80">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {[
                  { flag: 'heatmaps', def: 'true', desc: 'Click and scroll heatmap recording' },
                  { flag: 'session_recordings', def: 'true', desc: 'Full session replay recordings' },
                  { flag: 'funnels', def: 'true', desc: 'Conversion funnel builder and analytics' },
                  { flag: 'automations', def: 'false', desc: 'Behavior-triggered automation engine' },
                ].map(row => (
                  <tr key={row.flag} className="bg-card/20">
                    <td className="px-4 py-3 font-mono text-xs text-primary">{row.flag}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.def}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resource limits */}
        <div className="p-5 rounded-lg bg-card/40 border border-border/50 space-y-3">
          <h3 className="font-semibold">Resource Limits</h3>
          <p className="text-sm text-muted-foreground">
            Set per-client caps to prevent any single client from consuming your agency plan quota.
            Limits default to your plan's total if not specified.
          </p>
          <ul className="text-sm text-muted-foreground space-y-1.5">
            {['max_websites — maximum number of sites the client can add', 'monthly_events — monthly event ingestion cap', 'monthly_recordings — monthly session recording cap'].map(item => (
              <li key={item} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-500/60 mt-1.5 shrink-0" />
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-violet-300/10 flex items-center justify-center shrink-0">
            <Code2 className="w-5 h-5 text-violet-300" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Programmatic API</h2>
        </div>

        <p className="text-muted-foreground leading-relaxed">
          Fully automate client provisioning using the Agency API. Use your Agency API key
          (<code className="text-xs bg-muted px-1 py-0.5 rounded">snt_age_...</code>) to create
          clients, assign websites, and manage limits without touching the dashboard.
        </p>

        <CodeBlock language="http" code="Authorization: Bearer snt_age_xxxxxxxxxxxxx" />

        <div className="space-y-4">
          <EndpointBlock
            method="POST"
            path="/agency/api/users"
            description="Create a client user account programmatically."
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

          <EndpointBlock
            method="GET"
            path="/agency/api/users"
            description="List all clients managed through the programmatic API."
          />

          <EndpointBlock
            method="GET"
            path="/agency/api/users/:userId"
            description="Get a specific client's details, features, and limits."
          />

          <EndpointBlock
            method="DELETE"
            path="/agency/api/users/:userId"
            description="Delete a client account and all their data."
          />

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

          <EndpointBlock
            method="GET"
            path="/agency/api/users/:userId/websites"
            description="List all websites belonging to a specific client."
          />
        </div>

        {/* Full onboarding examples */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Full Onboarding Examples</h3>

          <CodeExample
            label="JavaScript — complete client onboarding"
            language="javascript"
            code={`const BASE = 'https://api.seentics.com/v1';
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

console.log('Client created:', userId, 'Temp password:', tempPassword);

// 2. Add a website for them
const site = await fetch(\`\${BASE}/agency/api/users/\${userId}/websites\`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ name: 'Client Website', url: 'https://newclient.com' }),
}).then(r => r.json());

console.log('Site created, tracker ID:', site.site_id);`}
          />

          <CodeExample
            label="Python — complete client onboarding"
            language="python"
            code={`import requests

BASE = "https://api.seentics.com/v1"
HEADERS = {
    "Authorization": "Bearer snt_age_xxxxxxxxxxxxx",
    "Content-Type": "application/json",
}

# 1. Create client
res = requests.post(f"{BASE}/agency/api/users", headers=HEADERS, json={
    "email": "newclient@example.com",
    "name": "New Client Co.",
    "features": {"heatmaps": True, "session_recordings": True},
    "limits": {"max_websites": 5, "monthly_events": 500000},
})
client = res.json()
user_id = client["id"]

# 2. Add website
site = requests.post(
    f"{BASE}/agency/api/users/{user_id}/websites",
    headers=HEADERS,
    json={"name": "Client Website", "url": "https://newclient.com"},
).json()

print(f"Site tracker ID: {site['site_id']}")`}
          />
        </div>

        {/* Rate limits */}
        <div className="p-5 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Agency API Rate Limits</h3>
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5 text-rose-500" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">White Label</h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded bg-violet-500/10 text-violet-500">
            Agency
          </span>
          <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded bg-violet-500/10 text-violet-500">
            Agency Pro
          </span>
          <span className="text-sm text-muted-foreground">plans only</span>
        </div>

        <p className="text-muted-foreground leading-relaxed">
          White-label the Seentics platform with your agency's branding. Your clients see your
          logo, colors, and domain — not Seentics.
        </p>

        <div className="rounded-lg border border-border/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card/60">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-foreground/80">Setting</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground/80">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {[
                { setting: 'Brand Name', desc: 'Shown in email notifications and browser page titles' },
                { setting: 'Logo URL', desc: "URL to your agency's logo (PNG or SVG, min 200px wide)" },
                { setting: 'Primary Color', desc: 'Hex color applied to buttons, links, and accent elements' },
                { setting: 'Support Email', desc: 'Where client support requests are routed' },
                { setting: 'Custom Domain', desc: 'Host the platform on your own domain (e.g., analytics.youragency.com)' },
                { setting: 'Hide Seentics', desc: 'Remove all Seentics branding from the UI and emails' },
              ].map(row => (
                <tr key={row.setting} className="bg-card/20">
                  <td className="px-4 py-3 font-semibold text-sm">{row.setting}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5 text-green-500" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Billing & Plans</h2>
        </div>

        <p className="text-muted-foreground">
          All plans include unlimited websites. Save 20% with annual billing.
        </p>

        <div className="rounded-lg border border-border/50 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-card/60">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-foreground/80">Plan</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground/80">Price</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground/80">Events/mo</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground/80">Recordings</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground/80">Team</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {[
                { plan: 'Free', price: '$0', events: '10K', recordings: '100', team: '1' },
                { plan: 'Starter', price: '$9', events: '100K', recordings: '1K', team: '3' },
                { plan: 'Growth', price: '$19', events: '500K', recordings: '10K', team: '5' },
                { plan: 'Pro', price: '$49', events: '2M', recordings: '50K', team: '10' },
                { plan: 'Agency', price: '$99', events: '5M', recordings: '100K', team: '—' },
                { plan: 'Agency Pro', price: '$249', events: '20M', recordings: '500K', team: '—' },
              ].map((row, i) => (
                <tr key={row.plan} className={i % 2 === 0 ? 'bg-card/20' : 'bg-card/10'}>
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

        <div className="space-y-4">
          <EndpointBlock
            method="GET"
            path="/user/billing/usage"
            description="Get current billing period usage and limits."
            response={`{
  "plan": "growth",
  "period": { "start": "2026-03-01", "end": "2026-03-31" },
  "events": { "used": 241892, "limit": 500000 },
  "recordings": { "used": 3482, "limit": 10000 }
}`}
          />

          <EndpointBlock
            method="POST"
            path="/user/billing/checkout"
            description="Create a Stripe checkout session to upgrade your plan."
            request={`{
  "plan": "pro",
  "billing": "yearly"
}`}
            response={`{
  "checkout_url": "https://checkout.stripe.com/..."
}`}
          />

          <EndpointBlock
            method="POST"
            path="/user/billing/portal"
            description="Get a Stripe customer portal link to manage payment methods and invoices."
            response={`{
  "portal_url": "https://billing.stripe.com/..."
}`}
          />

          <EndpointBlock
            method="POST"
            path="/user/billing/cancel"
            description="Cancel your subscription at the end of the current billing period."
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* PRIVACY & SECURITY                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section id="privacy" className="scroll-mt-24 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Privacy & Security</h2>
        </div>

        <p className="text-muted-foreground leading-relaxed">
          Seentics was built privacy-first from day one. No cookies, no fingerprinting,
          no PII — fully compliant with GDPR, CCPA, and PECR out of the box.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {[
            {
              icon: Shield,
              title: 'No Cookies',
              desc: 'Session matching uses rotating cryptographic tokens that expire and cannot be used for cross-site tracking. No consent banner required.',
              color: 'text-emerald-500',
              bg: 'bg-emerald-500/10',
            },
            {
              icon: ShieldCheck,
              title: 'GDPR Compliant',
              desc: 'Data export and deletion endpoints are built in. You can honor any visitor\'s right to access or erasure with a single API call.',
              color: 'text-blue-500',
              bg: 'bg-blue-500/10',
            },
            {
              icon: Globe,
              title: 'Data Residency',
              desc: 'Choose where your data is stored — EU (Frankfurt), US (Virginia), or APAC (Singapore). Data never leaves your chosen region.',
              color: 'text-indigo-500',
              bg: 'bg-indigo-500/10',
            },
            {
              icon: Lock,
              title: 'PII Masking',
              desc: 'The tracker automatically strips emails, phone numbers, and IDs from URLs before they ever reach our servers.',
              color: 'text-amber-500',
              bg: 'bg-amber-500/10',
            },
          ].map(({ icon: Icon, title, desc, color, bg }) => (
            <div key={title} className="p-5 rounded-lg bg-card/40 border border-border/50 space-y-3">
              <div className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-lg">GDPR Endpoints</h3>
          <EndpointBlock
            method="GET"
            path="/user/gdpr/export"
            description="Export all data associated with the authenticated account as a JSON archive."
            response={`{
  "export_url": "https://cdn.seentics.com/exports/usr_xxx_2026-03-27.json.gz",
  "expires_at": "2026-04-03T00:00:00Z"
}`}
          />
          <EndpointBlock
            method="POST"
            path="/user/gdpr/delete"
            description="Permanently delete all data for the authenticated account. Irreversible — account is deactivated immediately."
          />
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Privacy Settings per Website</h3>
          <EndpointBlock
            method="GET"
            path="/user/websites/:siteId/privacy"
            description="Get privacy configuration for a specific website."
            response={`{
  "mask_pii": true,
  "exclude_ip_ranges": [],
  "respect_dnt": true,
  "data_retention_days": 365,
  "region": "eu"
}`}
          />
          <EndpointBlock
            method="PUT"
            path="/user/websites/:siteId/privacy"
            description="Update privacy settings for a specific website."
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
