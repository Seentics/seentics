'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useState } from 'react';

import { ReportPage } from '@/components/ui/linear-list';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Copy, Check, Zap, Code2 } from 'lucide-react';
import { useT } from '@/lib/i18n';
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
      <pre className="bg-muted/60 border border-border rounded-lg px-4 py-3 overflow-x-auto text-[12px] leading-relaxed font-mono text-foreground/90 whitespace-pre">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded-lg bg-background border border-border text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
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
  const params = { websiteId: usePathSegment(1) ?? '' };
  const websiteId = params?.websiteId as string;
  const [tab, setTab] = useState<Tab>('Node.js');
  const d = useT().developers.sdkDocs;

  return (
    <ReportPage
      title={d.title}
      description={d.description}
      websiteId={websiteId}
      width="max-w-[900px]"
    >

      {/* SDK tabs */}
      <div className="flex items-center gap-1 mb-8 bg-muted/40 border border-border rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors',
              tab === t
                ? 'bg-background text-foreground shadow-sm border border-border'
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
              <p className="font-semibold text-foreground">{d.credentials}</p>
              <p className="text-muted-foreground">
                {d.projectId} <code className="font-mono bg-muted px-1.5 py-0.5 rounded-lg text-foreground">{websiteId}</code>
              </p>
              <p className="text-muted-foreground">
                {d.findKeyBefore} <strong>{d.findKeyPlace}</strong>{d.findKeyAfter}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Installation */}
      <Section title={d.installation} icon={Zap}>
        <CodeBlock code={INSTALL[tab]} lang={tab === 'Go' ? 'bash' : 'bash'} />
      </Section>

      {/* Quick start */}
      <Section title={d.quickStart} icon={Code2}>
        <CodeBlock code={QUICKSTART[tab]} lang={tab === 'Go' ? 'go' : 'typescript'} />
      </Section>

      {/* Next.js */}
      {tab === 'Node.js' && (
        <Section title={d.nextjs}>
          <p className="text-xs text-muted-foreground mb-2">
            {d.nextjsBefore} <code className="font-mono bg-muted px-1 rounded-lg">instrumentation.ts</code> {d.nextjsAfter}
          </p>
          <CodeBlock code={NEXTJS_SNIPPET} lang="typescript" />
        </Section>
      )}

      {/* API reference */}
      <Section title={d.apiReference} icon={BookOpen}>
        <Card className="border border-border">
          <CardContent className="p-0">
            {[
              { method: 'POST', path: '/api/v1/collect',                        desc: d.endpoints.collect },
              { method: 'GET',  path: '/api/v1/websites/:id/stats',             desc: d.endpoints.stats },
              { method: 'GET',  path: '/api/v1/websites/:id/pageviews',         desc: d.endpoints.pageviews },
              { method: 'GET',  path: '/api/v1/websites/:id/events',            desc: d.endpoints.events },
              { method: 'GET',  path: '/api/v1/websites/:id/goals',             desc: d.endpoints.goals },
              { method: 'GET',  path: '/api/v1/websites/:id/funnels/:funnelId', desc: d.endpoints.funnel },
            ].map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0">
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
          {d.authBefore} <code className="font-mono bg-muted px-1 rounded-lg">Authorization: Bearer &lt;apiKey&gt;</code>{d.authAfter}
          {' '}{d.openApiBefore} <strong>{d.openApiPlace}</strong>{d.openApiAfter}
        </p>
      </Section>
    </ReportPage>
  );
}
