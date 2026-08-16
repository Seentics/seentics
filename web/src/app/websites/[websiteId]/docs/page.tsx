'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Copy, Check, Zap, Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Code block with copy button
// ---------------------------------------------------------------------------
function CodeBlock({ code, lang = 'typescript' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group">
      <pre className="bg-muted/60 border border-border/60 rounded-lg px-4 py-3 overflow-x-auto text-[12px] leading-relaxed font-mono text-foreground/90 whitespace-pre">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded-lg bg-background border border-border/60 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section heading
// ---------------------------------------------------------------------------
function Section({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="h-4 w-4 text-primary" />}
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------
const TABS = ['Node.js', 'Go'] as const;
type Tab = typeof TABS[number];

// ---------------------------------------------------------------------------
// Snippets
// ---------------------------------------------------------------------------
const INSTALL: Record<Tab, string> = {
  'Node.js': `npm install @seentics/node`,
  'Go':      `go get github.com/seentics/go-sdk`,
};

const QUICKSTART: Record<Tab, string> = {
  'Node.js': `import { Seentics } from '@seentics/node';

const seentics = new Seentics({
  apiKey:    'sk_proj_YOUR_KEY',
  projectId: 'YOUR_PROJECT_ID',
  service:   'my-api',
  environment: process.env.NODE_ENV,
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await seentics.close();
  process.exit(0);
});`,
  'Go': `import seentics "github.com/seentics/go-sdk"

client := seentics.New(seentics.Config{
    APIKey:    "sk_proj_YOUR_KEY",
    ProjectID: "YOUR_PROJECT_ID",
    Service:   "my-api",
    Environment: os.Getenv("ENV"),
})
defer client.Shutdown(context.Background())`,
};


const NEXTJS_SNIPPET = `// instrumentation.ts  (Next.js 14 — placed in the project root)
import { Seentics } from '@seentics/node';

export const seentics = new Seentics({
  apiKey:    process.env.SEENTICS_API_KEY!,
  projectId: process.env.SEENTICS_PROJECT_ID!,
  service:   'next-app',
  environment: process.env.NODE_ENV,
});

export function register() {
  process.on('SIGTERM', () => seentics.close());
}

// app/api/[...route]/route.ts — wrap handlers
import { seentics } from '@/instrumentation';

export async function POST(req: Request) {
  const span = seentics.startSpan('POST /api/orders');
  try {
    const result = await processOrder(await req.json());
    span.setStatus('ok');
    return Response.json(result);
  } catch (err) {
    span.recordError(err as Error);
    seentics.captureError(err);
    throw err;
  } finally {
    span.end();
  }
}`;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function DocsPage() {
  const params    = useParams();
  const websiteId = params?.websiteId as string;
  const [tab, setTab] = useState<Tab>('Node.js');

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[900px] mx-auto">
      <DashboardPageHeader
        websiteId={websiteId}
        title="Documentation"
        description="Integrate Seentics into your services using the official SDKs."
      />

      {/* SDK tabs */}
      <div className="flex items-center gap-1 mb-8 bg-muted/40 border border-border/60 rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors',
              tab === t
                ? 'bg-background text-foreground shadow-sm border border-border/60'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Project IDs callout */}
      <Card className="border border-primary/20 bg-primary/5 mb-8">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Code2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-foreground">Your project credentials</p>
              <p className="text-muted-foreground">
                Project ID: <code className="font-mono bg-muted px-1.5 py-0.5 rounded-lg text-foreground">{websiteId}</code>
              </p>
              <p className="text-muted-foreground">
                Find your API key under <strong>Settings → Tracking</strong>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Installation */}
      <Section title="Installation" icon={Zap}>
        <CodeBlock code={INSTALL[tab]} lang={tab === 'Go' ? 'bash' : 'bash'} />
      </Section>

      {/* Quick start */}
      <Section title="Quick start" icon={Code2}>
        <CodeBlock code={QUICKSTART[tab]} lang={tab === 'Go' ? 'go' : 'typescript'} />
      </Section>

      {/* Next.js */}
      {tab === 'Node.js' && (
        <Section title="Next.js Integration">
          <p className="text-xs text-muted-foreground mb-2">
            Use Next.js 14 <code className="font-mono bg-muted px-1 rounded-lg">instrumentation.ts</code> to initialise the SDK once per process and share it across route handlers.
          </p>
          <CodeBlock code={NEXTJS_SNIPPET} lang="typescript" />
        </Section>
      )}

      {/* API reference */}
      <Section title="HTTP API Reference" icon={BookOpen}>
        <Card className="border border-border/60">
          <CardContent className="p-0">
            {[
              { method: 'POST', path: '/api/v1/collect',                        desc: 'Ingest pageview or custom event' },
              { method: 'GET',  path: '/api/v1/websites/:id/stats',             desc: 'Summary stats (visitors, pageviews, bounce rate, duration)' },
              { method: 'GET',  path: '/api/v1/websites/:id/pageviews',         desc: 'Pageview time series (granularity: hour|day|month)' },
              { method: 'GET',  path: '/api/v1/websites/:id/events',            desc: 'Custom event counts and property breakdowns' },
              { method: 'GET',  path: '/api/v1/websites/:id/goals',             desc: 'Goal list with conversion rates' },
              { method: 'GET',  path: '/api/v1/websites/:id/funnels/:funnelId', desc: 'Funnel step-by-step conversion data' },
              { method: 'GET',  path: '/api/v1/websites/:id/realtime',          desc: 'Live active visitor count and current pages' },
            ].map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 last:border-0">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] w-12 justify-center shrink-0 font-mono',
                    r.method === 'POST'  && 'border-blue-400/60 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-300',
                    r.method === 'GET'   && 'border-green-400/60 text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-300',
                  )}
                >
                  {r.method}
                </Badge>
                <code className="text-[11px] font-mono text-foreground flex-1 min-w-0 truncate">{r.path}</code>
                <span className="text-xs text-muted-foreground hidden md:block shrink-0 max-w-[260px] truncate">{r.desc}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground mt-3">
          All requests must include <code className="font-mono bg-muted px-1 rounded-lg">Authorization: Bearer &lt;apiKey&gt;</code>.
          The full OpenAPI reference is available in the dashboard under <strong>Developers &rarr; Docs</strong>.
        </p>
      </Section>
    </div>
  );
}
