'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Copy, Check, Zap, AlertTriangle, Network, Gauge, FileText, Code2 } from 'lucide-react';
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
        className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded bg-background border border-border/60 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
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

const LOGS: Record<Tab, string> = {
  'Node.js': `// Structured log methods — buffered and batched automatically
seentics.log.info('User signed up', { userId: '123', plan: 'pro' });
seentics.log.warn('Rate limit approaching', { endpoint: '/api/upload' });
seentics.log.error('Payment failed', { orderId: 'ord_42', code: 'card_declined' });

// All levels: debug | info | warn | error | fatal`,
  'Go': `// Direct log methods
client.Info("user signed up", seentics.LogOptions{
    Attributes: map[string]string{"user_id": "123", "plan": "pro"},
})
client.Warn("rate limit approaching")
client.Error("payment failed", seentics.LogOptions{
    Attributes: map[string]string{"order_id": "ord_42"},
})

// zerolog integration — logs forwarded as structured entries
log := zerolog.New(client.Writer()).With().Timestamp().Logger()
log.Info().Str("user_id", "123").Msg("user signed up")`,
};

const ERRORS: Record<Tab, string> = {
  'Node.js': `// Capture any error — stack trace extracted automatically
try {
  await processOrder(order);
} catch (err) {
  seentics.captureError(err, {
    userId:  req.user.id,
    release: process.env.npm_package_version,
    attributes: { orderId: order.id },
  });
  throw err;
}

// Express error middleware (mount after routes)
app.use(seentics.errorMiddleware());`,
  'Go': `// Capture errors with automatic stack trace
if err := processOrder(ctx, order); err != nil {
    client.CaptureError(err, seentics.ErrorOptions{
        UserID:     userID,
        Release:    version,
        Attributes: map[string]string{"order_id": order.ID},
    })
    return err
}

// Recover from panics
defer func() {
    if r := recover(); r != nil {
        client.CaptureError(fmt.Errorf("panic: %v", r))
    }
}()`,
};

const TRACES: Record<Tab, string> = {
  'Node.js': `// Root span (starts a new trace)
const span = seentics.startSpan('process-order', {
  attributes: { orderId: order.id },
});
try {
  // Child span (same trace ID)
  const dbSpan = seentics.startChildSpan(span, 'db.insert-order');
  await db.insert(order);
  dbSpan.setStatus('ok').end();

  span.setStatus('ok');
} catch (err) {
  span.recordError(err);
  throw err;
} finally {
  span.end();
}

// Express request tracing middleware
app.use(seentics.requestMiddleware());`,
  'Go': `// StartSpan returns an updated context and a span
ctx, span := client.StartSpan(ctx, "process-order")
defer span.End()

span.SetAttribute("order_id", order.ID)

// Child span — inherits trace ID from ctx
ctx, dbSpan := client.StartSpan(ctx, "db.insert-order")
if err := db.Insert(ctx, order); err != nil {
    dbSpan.RecordError(err)
    dbSpan.End()
    return err
}
dbSpan.End()

// Retrieve active span from context anywhere downstream
if s, ok := seentics.SpanFromContext(ctx); ok {
    s.SetAttribute("rows_affected", "1")
}`,
};

const METRICS: Record<Tab, string> = {
  'Node.js': `// Gauge   — point-in-time value (memory, connections, queue depth)
seentics.gauge('server.memory_mb', process.memoryUsage().rss / 1e6);

// Counter — cumulative increment (requests, bytes, errors)
seentics.counter('api.requests', 1, { method: 'POST', path: '/orders' });

// Histogram — distribution sample (latency, payload size)
const start = Date.now();
await handler(req, res);
seentics.histogram('api.latency_ms', Date.now() - start, { route: '/orders' });`,
  'Go': `// Gauge — point-in-time value
client.Gauge("server.goroutines", float64(runtime.NumGoroutine()))

// Counter — cumulative increment
client.Counter("api.requests", 1, map[string]string{
    "method": r.Method,
    "path":   r.URL.Path,
})

// Histogram — latency distribution
start := time.Now()
handler(w, r)
client.Histogram("api.latency_ms",
    float64(time.Since(start).Milliseconds()),
    map[string]string{"route": r.URL.Path},
)`,
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
        title="Documentation"
        description="Integrate Seentics into your services using the official SDKs."
        icon={BookOpen}
      />

      {/* SDK tabs */}
      <div className="flex items-center gap-1 mb-8 bg-muted/40 border border-border/60 rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 text-xs font-semibold rounded-md transition-colors',
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
                Project ID: <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">{websiteId}</code>
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

      {/* Logs */}
      <Section title="Structured Logging" icon={FileText}>
        <p className="text-xs text-muted-foreground">
          Log entries are buffered and sent in batches every 5 seconds (or immediately when the buffer reaches 100 items).
          All five severity levels are supported: <code className="font-mono bg-muted px-1 rounded">debug</code>, <code className="font-mono bg-muted px-1 rounded">info</code>, <code className="font-mono bg-muted px-1 rounded">warn</code>, <code className="font-mono bg-muted px-1 rounded">error</code>, <code className="font-mono bg-muted px-1 rounded">fatal</code>.
        </p>
        <CodeBlock code={LOGS[tab]} lang={tab === 'Go' ? 'go' : 'typescript'} />
      </Section>

      {/* Errors */}
      <Section title="Error Tracking" icon={AlertTriangle}>
        <p className="text-xs text-muted-foreground">
          Errors are grouped by a fingerprint derived from <code className="font-mono bg-muted px-1 rounded">service</code> + <code className="font-mono bg-muted px-1 rounded">error_type</code> + message.
          Each group tracks occurrence count, first/last seen, and can be resolved or ignored from the dashboard.
        </p>
        <CodeBlock code={ERRORS[tab]} lang={tab === 'Go' ? 'go' : 'typescript'} />
      </Section>

      {/* Traces */}
      <Section title="Distributed Tracing" icon={Network}>
        <p className="text-xs text-muted-foreground">
          Spans are correlated via <code className="font-mono bg-muted px-1 rounded">trace_id</code> and visualised as a waterfall in the Traces page.
          Parent–child relationships are tracked automatically through the context or span references.
        </p>
        <CodeBlock code={TRACES[tab]} lang={tab === 'Go' ? 'go' : 'typescript'} />
      </Section>

      {/* Metrics */}
      <Section title="Custom Metrics" icon={Gauge}>
        <div className="grid grid-cols-3 gap-3 mb-3">
          {[
            { type: 'gauge',     desc: 'Point-in-time value (memory, connections)' },
            { type: 'counter',   desc: 'Monotonically increasing count (requests)' },
            { type: 'histogram', desc: 'Distribution sample (latency, sizes)' },
          ].map(m => (
            <Card key={m.type} className="border border-border/60">
              <CardContent className="p-3">
                <Badge variant="secondary" className="text-[10px] mb-1">{m.type}</Badge>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <CodeBlock code={METRICS[tab]} lang={tab === 'Go' ? 'go' : 'typescript'} />
      </Section>

      {/* Next.js */}
      {tab === 'Node.js' && (
        <Section title="Next.js Integration">
          <p className="text-xs text-muted-foreground mb-2">
            Use Next.js 14 <code className="font-mono bg-muted px-1 rounded">instrumentation.ts</code> to initialise the SDK once per process and share it across route handlers.
          </p>
          <CodeBlock code={NEXTJS_SNIPPET} lang="typescript" />
        </Section>
      )}

      {/* API reference */}
      <Section title="HTTP API Reference" icon={BookOpen}>
        <Card className="border border-border/60">
          <CardContent className="p-0">
            {[
              { method: 'POST', path: '/api/v1/observability/logs/ingest',           desc: 'Ingest up to 10,000 log entries per request' },
              { method: 'POST', path: '/api/v1/observability/errors/ingest',         desc: 'Ingest up to 1,000 error events per request' },
              { method: 'POST', path: '/api/v1/observability/traces/ingest',         desc: 'Ingest up to 10,000 spans per request' },
              { method: 'POST', path: '/api/v1/observability/metrics/ingest',        desc: 'Ingest up to 50,000 metric points per request' },
              { method: 'GET',  path: '/api/v1/observability/logs',                  desc: 'Query logs (project_id, service, level, search, from, to)' },
              { method: 'GET',  path: '/api/v1/observability/errors/groups',         desc: 'List error groups (project_id, service, status)' },
              { method: 'GET',  path: '/api/v1/observability/traces',                desc: 'List traces (project_id, service, from, to)' },
              { method: 'GET',  path: '/api/v1/observability/traces/:trace_id',      desc: 'Get all spans for a trace' },
              { method: 'GET',  path: '/api/v1/observability/metrics',               desc: 'Query metrics (project_id, name, granularity: minute|hour|day)' },
              { method: 'PATCH',path: '/api/v1/observability/errors/groups/:fp/status', desc: 'Update error group status (open | resolved | ignored)' },
            ].map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 last:border-0">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] w-12 justify-center shrink-0 font-mono',
                    r.method === 'POST'  && 'border-blue-400/60 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-300',
                    r.method === 'GET'   && 'border-green-400/60 text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-300',
                    r.method === 'PATCH' && 'border-yellow-400/60 text-yellow-600 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-300',
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
          All requests must include <code className="font-mono bg-muted px-1 rounded">Authorization: Bearer &lt;apiKey&gt;</code>.
          Ingest endpoints respond with <code className="font-mono bg-muted px-1 rounded">202 Accepted</code> — events are durably buffered via Redis Streams before being batch-written to ClickHouse.
        </p>
      </Section>
    </div>
  );
}
