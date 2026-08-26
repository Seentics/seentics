'use client';

import { useState } from 'react';
import { LayoutDashboard, Copy, Check, Code2, Palette, Zap } from 'lucide-react';

export default function UIBlocksDocs() {
    return (
        <div className="space-y-16">
            {/* Header */}
            <header className="space-y-4">
                <div className="flex items-center gap-3">
                    <LayoutDashboard className="w-8 h-8 text-indigo-500" />
                    <h1 className="text-3xl font-bold tracking-tight">UI Blocks</h1>
                </div>
                <p className="text-xl text-muted-foreground leading-relaxed">
                    Embed Seentics analytics widgets directly into your own product. Show live metrics, charts, and insights to your users without building dashboards from scratch.
                </p>
            </header>

            {/* What are UI Blocks */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">What are UI Blocks</h2>
                <div className="p-6 rounded-lg border bg-card space-y-4">
                    <div className="flex items-center gap-2">
                        <LayoutDashboard className="w-5 h-5 text-indigo-500" />
                        <h3 className="font-semibold text-lg">Embeddable React Components</h3>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                        UI Blocks are pre-built, embeddable React components that connect directly to your Seentics data.
                        Embed them in your SaaS dashboard, admin panel, or customer-facing pages — and your users get
                        live analytics without you writing a single chart from scratch.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                        Every block is fully themeable, supports both API key and token authentication, and works with
                        Next.js App Router, Pages Router, Vite, and any other React environment.
                    </p>
                </div>
            </section>

            {/* Installation */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Installation</h2>
                <p className="text-muted-foreground leading-relaxed">
                    Install the UI Blocks package from npm:
                </p>
                <CodeBlock code={`npm install @seentics/ui-blocks\n# or\nyarn add @seentics/ui-blocks`} />
            </section>

            {/* Quick Start */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Quick Start</h2>
                <p className="text-muted-foreground leading-relaxed">
                    Wrap your app (or just the section that uses analytics) with{' '}
                    <code className="bg-muted px-1.5 py-0.5 rounded-lg text-sm font-mono">SeenticsProvider</code> and drop
                    in any block component:
                </p>
                <CodeExample
                    language="TypeScript (React)"
                    code={`import { SeenticsProvider, AnalyticsWidget } from '@seentics/ui-blocks';

export default function Dashboard() {
  return (
    <SeenticsProvider apiKey="snt_live_xxxxx" websiteId="your-site-id">
      <AnalyticsWidget />
    </SeenticsProvider>
  );
}`}
                />
            </section>

            {/* Available Blocks */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Available Blocks</h2>
                <p className="text-muted-foreground leading-relaxed">
                    All blocks pull data from the <code className="bg-muted px-1 rounded-lg text-sm font-mono">SeenticsProvider</code> context automatically — no extra props required for data fetching.
                </p>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* AnalyticsWidget */}
                    <div className="p-6 rounded-lg border bg-card space-y-4">
                        <div className="space-y-1">
                            <code className="text-sm font-mono font-semibold text-indigo-500">&lt;AnalyticsWidget /&gt;</code>
                            <p className="text-sm text-muted-foreground">Full analytics dashboard: visitors, pageviews, sessions, bounce rate.</p>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                            <p className="font-semibold text-foreground">Props:</p>
                            <p><code className="bg-muted/60 px-1 rounded-lg">dateRange</code> — custom date range object</p>
                            <p><code className="bg-muted/60 px-1 rounded-lg">theme</code> — theme override object</p>
                        </div>
                        <CodeBlock code={`<AnalyticsWidget dateRange={{ start: '2026-03-01', end: '2026-03-31' }} />`} />
                    </div>

                    {/* RealtimeCounter */}
                    <div className="p-6 rounded-lg border bg-card space-y-4">
                        <div className="space-y-1">
                            <code className="text-sm font-mono font-semibold text-indigo-500">&lt;RealtimeCounter /&gt;</code>
                            <p className="text-sm text-muted-foreground">Live visitor count with pulsing indicator. Auto-refreshes on an interval.</p>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                            <p className="font-semibold text-foreground">Props:</p>
                            <p><code className="bg-muted/60 px-1 rounded-lg">showPages</code> — boolean, show active pages list</p>
                            <p><code className="bg-muted/60 px-1 rounded-lg">refreshInterval</code> — ms between polls (default: 10000)</p>
                        </div>
                        <CodeBlock code={`<RealtimeCounter showPages refreshInterval={5000} />`} />
                    </div>

                    {/* TopPagesWidget */}
                    <div className="p-6 rounded-lg border bg-card space-y-4">
                        <div className="space-y-1">
                            <code className="text-sm font-mono font-semibold text-indigo-500">&lt;TopPagesWidget /&gt;</code>
                            <p className="text-sm text-muted-foreground">Top pages ranked by pageviews with optional bar chart visualization.</p>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                            <p className="font-semibold text-foreground">Props:</p>
                            <p><code className="bg-muted/60 px-1 rounded-lg">limit</code> — number of pages to show (default: 10)</p>
                            <p><code className="bg-muted/60 px-1 rounded-lg">showBars</code> — boolean, show relative bar indicators</p>
                        </div>
                        <CodeBlock code={`<TopPagesWidget limit={5} showBars />`} />
                    </div>

                    {/* HeatmapViewer */}
                    <div className="p-6 rounded-lg border bg-card space-y-4">
                        <div className="space-y-1">
                            <code className="text-sm font-mono font-semibold text-indigo-500">&lt;HeatmapViewer /&gt;</code>
                            <p className="text-sm text-muted-foreground">Embed a heatmap overlay for a specific page URL directly in your product.</p>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                            <p className="font-semibold text-foreground">Props:</p>
                            <p><code className="bg-muted/60 px-1 rounded-lg">pageUrl</code> — the page to render the heatmap for</p>
                            <p><code className="bg-muted/60 px-1 rounded-lg">type</code> — <code className="bg-muted/60 px-1 rounded-lg">"click"</code> | <code className="bg-muted/60 px-1 rounded-lg">"scroll"</code> | <code className="bg-muted/60 px-1 rounded-lg">"move"</code></p>
                        </div>
                        <CodeBlock code={`<HeatmapViewer pageUrl="/pricing" type="click" />`} />
                    </div>

                    {/* FunnelWidget */}
                    <div className="p-6 rounded-lg border bg-card space-y-4">
                        <div className="space-y-1">
                            <code className="text-sm font-mono font-semibold text-indigo-500">&lt;FunnelWidget /&gt;</code>
                            <p className="text-sm text-muted-foreground">Conversion funnel visualization with step-by-step breakdown.</p>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                            <p className="font-semibold text-foreground">Props:</p>
                            <p><code className="bg-muted/60 px-1 rounded-lg">funnelId</code> — the ID of a saved funnel</p>
                            <p><code className="bg-muted/60 px-1 rounded-lg">showDropOff</code> — boolean, highlight drop-off percentages</p>
                        </div>
                        <CodeBlock code={`<FunnelWidget funnelId="fnl_abc123" showDropOff />`} />
                    </div>

                    {/* EventsTimeline */}
                    <div className="p-6 rounded-lg border bg-card space-y-4">
                        <div className="space-y-1">
                            <code className="text-sm font-mono font-semibold text-indigo-500">&lt;EventsTimeline /&gt;</code>
                            <p className="text-sm text-muted-foreground">Live stream of custom events as they are tracked on your website.</p>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                            <p className="font-semibold text-foreground">Props:</p>
                            <p><code className="bg-muted/60 px-1 rounded-lg">eventNames</code> — string[], filter to specific event names</p>
                            <p><code className="bg-muted/60 px-1 rounded-lg">limit</code> — max events to display (default: 20)</p>
                        </div>
                        <CodeBlock code={`<EventsTimeline eventNames={['signup', 'upgrade']} limit={10} />`} />
                    </div>
                </div>
            </section>

            {/* Theme Customization */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Theme Customization</h2>
                <p className="text-muted-foreground leading-relaxed">
                    Every UI Block accepts a <code className="bg-muted px-1.5 py-0.5 rounded-lg text-sm font-mono">theme</code> prop
                    that overrides the default appearance. You can also set a global theme on{' '}
                    <code className="bg-muted px-1.5 py-0.5 rounded-lg text-sm font-mono">SeenticsProvider</code> and it will
                    cascade to all child blocks.
                </p>
                <CodeExample
                    language="TypeScript (React)"
                    code={`<AnalyticsWidget
  theme={{
    primary: '#6366f1',
    background: 'transparent',
    borderRadius: '12px',
    fontFamily: 'Inter, sans-serif',
  }}
/>`}
                />
                <div className="rounded-lg border bg-card overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/40">
                                <th className="text-left px-4 py-3 font-semibold">Token</th>
                                <th className="text-left px-4 py-3 font-semibold">Type</th>
                                <th className="text-left px-4 py-3 font-semibold">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-muted-foreground">
                            {[
                                { token: 'primary', type: 'string (CSS color)', desc: 'Accent color for charts and highlights' },
                                { token: 'background', type: 'string (CSS color)', desc: 'Widget background. Use "transparent" to inherit.' },
                                { token: 'borderRadius', type: 'string (CSS value)', desc: 'Corner radius for all widget cards' },
                                { token: 'fontFamily', type: 'string (CSS font stack)', desc: 'Font used inside the widget' },
                            ].map(({ token, type, desc }) => (
                                <tr key={token}>
                                    <td className="px-4 py-3"><code className="bg-muted/60 px-1.5 py-0.5 rounded-lg text-xs font-mono">{token}</code></td>
                                    <td className="px-4 py-3 text-xs">{type}</td>
                                    <td className="px-4 py-3 text-sm">{desc}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Authentication */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Authentication</h2>
                <p className="text-muted-foreground leading-relaxed">
                    UI Blocks require credentials to fetch data. Choose the method that fits your architecture:
                </p>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="p-6 rounded-lg border bg-card space-y-4">
                        <div className="flex items-center gap-2">
                            <Code2 className="w-5 h-5 text-indigo-500" />
                            <h3 className="font-semibold text-lg">API Key</h3>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium">Server Components</span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Pass your website API key to <code className="bg-muted px-1 rounded-lg text-xs">SeenticsProvider</code>.
                            Best used in React Server Components or when the key is loaded server-side and never exposed to the browser.
                        </p>
                        <CodeBlock code={`<SeenticsProvider apiKey="snt_live_xxxxx" websiteId="site-id">\n  {children}\n</SeenticsProvider>`} />
                    </div>

                    <div className="p-6 rounded-lg border bg-card space-y-4">
                        <div className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-indigo-500" />
                            <h3 className="font-semibold text-lg">User Token</h3>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Client Components</span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Pass a short-lived user JWT <code className="bg-muted px-1 rounded-lg text-xs">token</code> instead of{' '}
                            <code className="bg-muted px-1 rounded-lg text-xs">apiKey</code>. Obtain the token from your auth session
                            and scope it to only the data the logged-in user should see.
                        </p>
                        <CodeBlock code={`<SeenticsProvider token={session.analyticsToken} websiteId="site-id">\n  {children}\n</SeenticsProvider>`} />
                    </div>
                </div>
            </section>

            {/* Next.js Example */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Next.js Example</h2>
                <p className="text-muted-foreground leading-relaxed">
                    A full working page using Next.js App Router with a React Server Component wrapper and{' '}
                    <code className="bg-muted px-1.5 py-0.5 rounded-lg text-sm font-mono">Suspense</code> for streaming:
                </p>
                <CodeExample
                    language="TypeScript (Next.js App Router)"
                    code={`// app/dashboard/analytics/page.tsx
import { Suspense } from 'react';
import { SeenticsProvider, AnalyticsWidget, RealtimeCounter } from '@seentics/ui-blocks';

// API key is loaded server-side — never sent to the browser
const SEENTICS_API_KEY = process.env.SEENTICS_API_KEY!;
const WEBSITE_ID = process.env.SEENTICS_WEBSITE_ID!;

export default function AnalyticsPage() {
  return (
    <SeenticsProvider apiKey={SEENTICS_API_KEY} websiteId={WEBSITE_ID}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Suspense fallback={<div>Loading analytics…</div>}>
            <AnalyticsWidget />
          </Suspense>
        </div>
        <div>
          <RealtimeCounter showPages />
        </div>
      </div>
    </SeenticsProvider>
  );
}`}
                />
            </section>

            {/* Self-hosted / White Label */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Self-hosted / White Label</h2>
                <div className="p-6 rounded-lg border bg-card space-y-4">
                    <div className="flex items-center gap-2">
                        <Palette className="w-5 h-5 text-indigo-500" />
                        <h3 className="font-semibold text-lg">Agency & White Label</h3>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                        If you are on an Agency plan, you can rebrand UI Blocks with your own colors, logo, and domain.
                        Go to <span className="font-medium text-foreground">Agency → White Label</span> in your dashboard to configure:
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        {[
                            'Custom brand name and logo displayed inside every widget',
                            'Primary color that overrides the default indigo accent',
                            'Custom domain so API calls route through your own subdomain',
                            'Support email shown in error states inside blocks',
                        ].map((item) => (
                            <li key={item} className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Your clients will never see the "Seentics" brand inside embedded UI Blocks after white label is configured.
                    </p>
                </div>
            </section>
        </div>
    );
}

function CodeBlock({ code }: { code: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="relative bg-muted/50 rounded-lg p-3 border">
            <button
                onClick={copy}
                className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground hover:text-foreground"
            >
                {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <pre className="text-xs font-mono text-foreground/80 overflow-x-auto pr-8">
                <code>{code}</code>
            </pre>
        </div>
    );
}

function CodeExample({ language, code }: { language: string; code: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{language}</p>
                <button
                    onClick={copy}
                    className="text-xs px-2 py-1 rounded-lg hover:bg-muted transition text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 border overflow-x-auto">
                <pre className="text-xs font-mono text-foreground/80 leading-relaxed">
                    <code>{code}</code>
                </pre>
            </div>
        </div>
    );
}

function ErrorStatus({ code, message, desc }: { code: number; message: string; desc: string }) {
    return (
        <div className="p-4 rounded-lg border bg-card space-y-2">
            <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-base text-foreground">{code}</span>
                <span className="font-semibold text-foreground">{message}</span>
            </div>
            <p className="text-sm text-muted-foreground">{desc}</p>
        </div>
    );
}
