import Link from 'next/link';
import { C, Callout, CodeBlock, DocPage, DocSection, Li, P, RefTable, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'Observability · Seentics docs',
  description: 'Logs, traces, metrics, errors and alerts for your services, from one ingest key.',
};

const ENDPOINT = 'https://api.seentics.com/api/v1/observability/ingest';

export default function ObservabilityPage() {
  return (
    <DocPage
      eyebrow="Products"
      title="Observability"
      lead="Logs, traces, metrics and errors from your backend services, next to the analytics of the site they power. Send with our Node.js, Go or Python SDK, or any OpenTelemetry exporter."
    >
      <Callout kind="note" title="Full Observability documentation">
        Setup, SDK guides, deployment and the reference live at{' '}
        <Link href="https://observe.seentics.com/docs" className="font-medium text-primary hover:underline">
          observe.seentics.com/docs
        </Link>
        .
      </Callout>

      <DocSection title="How it is organised">
        <P>
          Observe lives at <C>observe.seentics.com</C> and uses your Seentics account. Every website
          in your account is also an Observe project — its own ingest key, its own data, and the
          same team and roles as the website.
        </P>
        <Ul>
          <Li><strong className="font-medium text-foreground">Home</strong> — service health: request rate, failure rate, slow requests, log volume and the top error groups.</Li>
          <Li><strong className="font-medium text-foreground">Logs</strong> — search, filter and break down every log line.</Li>
          <Li><strong className="font-medium text-foreground">Errors</strong> — failures grouped by their cause, with stack traces.</Li>
          <Li><strong className="font-medium text-foreground">Traces</strong> — requests followed across services, span by span.</Li>
          <Li><strong className="font-medium text-foreground">Metrics</strong> — counters, histograms and gauges, charted and split by label.</Li>
          <Li><strong className="font-medium text-foreground">Alerts</strong> — rules over any of the above, sent to the channels you choose.</Li>
        </Ul>
      </DocSection>

      <DocSection title="1. Get the ingest key">
        <P>
          Open the project&apos;s <strong className="font-medium text-foreground">Setup</strong> page.
          The ingest key is shown <strong className="font-medium text-foreground">once</strong>, the
          first time the page is opened — copy it into your secrets store then. Only its hash is
          kept; a lost key is replaced, not recovered.
        </P>
        <Callout kind="note" title="The key can only write">
          An ingest key adds telemetry to one project. It cannot read anything, so it is safe to give
          to the services that send data — but treat it as a secret all the same.
        </Callout>
      </DocSection>

      <DocSection title="Pick your SDK">
        <P>
          Every SDK sends logs, traces and metrics to the same endpoint with that one key — no
          collector to run. Each guide covers install, setup, logs, traces, metrics and what to do
          before a short script exits.
        </P>
        <RefTable
          columns={['Language', 'Package', 'Guide']}
          rows={[
            ['Node.js 18.19+ (and Bun)', <C key="n">@seentics/observe</C>, <Link key="nl" href="https://observe.seentics.com/docs/sdks/node" className="font-medium text-primary hover:underline">Node.js guide</Link>],
            ['Go 1.24+', <C key="g">github.com/seentics/observe-go</C>, <Link key="gl" href="https://observe.seentics.com/docs/sdks/go" className="font-medium text-primary hover:underline">Go guide</Link>],
            ['Python 3.8+', <C key="p">seentics-observe</C>, <Link key="pl" href="https://observe.seentics.com/docs/sdks/python" className="font-medium text-primary hover:underline">Python guide</Link>],
          ]}
        />
        <P>
          Running more than one service or server on a key? See{' '}
          <Link href="https://observe.seentics.com/docs/guides/deployment" className="font-medium text-primary hover:underline">
            Services, servers and deployment
          </Link>{' '}
          for what to set on a bare VM, in Docker, Docker Compose or Kubernetes.
        </P>
      </DocSection>

      <DocSection title="2a. Send from Node.js">
        <CodeBlock language="bash" code="npm install @seentics/observe" />
        <P>Set the key and a service name, and load the SDK before your app:</P>
        <CodeBlock
          language="bash"
          filename=".env"
          code={`SEENTICS_INGEST_KEY=so_...
SEENTICS_SERVICE_NAME=checkout-service
SEENTICS_ENVIRONMENT=production`}
        />
        <CodeBlock language="bash" code="node --import @seentics/observe/register server.js" />
        <P>
          That alone traces every incoming and outgoing HTTP request and <C>fetch</C>, carries the
          trace across services, and reports Node runtime metrics. Then, wherever you need them:
        </P>
        <CodeBlock
          language="ts"
          code={`import { logger, metrics, withSpan } from '@seentics/observe';

logger.info('order placed', { orderId: 81423, total: 42.5 });

try {
  await withSpan('payment.authorise', async (span) => {
    span.setAttribute('order.id', order.id);
    await charge(order);
  });
} catch (err) {
  logger.error('payment failed', err, { orderId: order.id }); // grouped in Errors
}

const ordersPlaced = metrics.createCounter('orders.placed');
ordersPlaced.add(1, { status: 'success' });`}
        />
        <P>
          The full walkthrough is in the{' '}
          <Link href="https://observe.seentics.com/docs/sdks/node" className="font-medium text-primary hover:underline">Node.js guide</Link>;
          Go and Python have their own, linked above.
        </P>
        <Ul>
          <Li>Every field you log becomes a searchable column — <C>orderId:81423</C> in the Logs search.</Li>
          <Li>A log line written during a request carries its <C>trace_id</C>, so you can jump from the line to the request and back.</Li>
          <Li>Keys like <C>password</C>, <C>token</C>, <C>authorization</C> and <C>cookie</C> are masked before anything is sent.</Li>
          <Li>With no key set, logs print to the terminal and nothing is sent — local development needs no setup.</Li>
        </Ul>
      </DocSection>

      <DocSection title="2b. Send from anything else">
        <P>
          Observe accepts OTLP over HTTP, so any OpenTelemetry SDK or Collector works. Point the
          exporter at the ingest endpoint with the key as a bearer token:
        </P>
        <CodeBlock
          language="bash"
          filename=".env"
          code={`OTEL_EXPORTER_OTLP_ENDPOINT=${ENDPOINT}
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer so_...
OTEL_SERVICE_NAME=checkout-service`}
        />
        <P>For something that cannot speak OpenTelemetry, post plain JSON log lines (up to 5,000 per request):</P>
        <CodeBlock
          language="bash"
          code={`curl -X POST ${ENDPOINT}/logs \\
  -H "Authorization: Bearer so_..." \\
  -H "Content-Type: application/json" \\
  -d '[{"service":"billing-cron","severity":"error","message":"invoice run failed","run_id":"81422"}]'`}
        />
        <P>
          Self-hosting? The Setup page shows the endpoint of your own installation, with your key
          already in every snippet.
        </P>
      </DocSection>

      <DocSection title="Logs">
        <Ul>
          <Li>Search by field — <C>service:checkout-service</C>, <C>orderId:A-1002</C> — or by text.</Li>
          <Li>Filter by severity (<C>trace</C> to <C>fatal</C>) with one click, and include or exclude a service from the field breakdown.</Li>
          <Li>Open a line to see all of its fields and its trace.</Li>
        </Ul>
      </DocSection>

      <DocSection title="Errors">
        <P>
          Error-level lines are grouped by service and message, with numbers and ids normalised
          out — so 300 failures of one bug are one group, not 300 — and each group is named after
          its exception type. Each shows its stack trace, how often it happens, and a sample trace.
        </P>
        <P>
          Mark a group <strong className="font-medium text-foreground">Resolved</strong> or{' '}
          <strong className="font-medium text-foreground">Ignored</strong>; reopen it from the
          Resolved tab if it comes back.
        </P>
      </DocSection>

      <DocSection title="Traces">
        <P>
          The W3C <C>traceparent</C> header joins a request across services, so a call from your
          checkout service to your inventory service is one trace. The Traces page lists operations
          with their call counts, error rates and p50/p95/p99, plus individual requests; a request
          opens as a waterfall, and a failed span shows the exception it recorded.
        </P>
      </DocSection>

      <DocSection title="Metrics">
        <P>
          Pick any reported metric, choose an aggregation (average, sum, min, max, p50/p95/p99,
          rate) and split it by a label. Names appear as stored, with dots as underscores —{' '}
          <C>orders.placed</C> is <C>orders_placed</C>. The board below the explorer charts request
          duration, status codes and runtime health for the services that report them.
        </P>
      </DocSection>

      <DocSection title="Alerts">
        <RefTable
          columns={['Signal', 'Fires when']}
          rows={[
            ['Log volume', 'More matching log lines than the threshold in the window (optionally one service, or fatal lines only)'],
            ['New error groups', 'A new error group appears'],
            ['Trace volume', 'More spans than the threshold in the window'],
            ['Metric value', 'A metric, aggregated over the window, crosses the threshold'],
          ]}
        />
        <P>
          Rules are evaluated every minute. Notify Slack, Discord, email, PagerDuty or a webhook;
          every firing is kept in the rule&apos;s history. Webhook endpoints must be public{' '}
          <C>https://</C> URLs.
        </P>
      </DocSection>

      <DocSection title="Plans and retention">
        <P>
          Logs and errors are included on every plan. Traces and metrics need Observe Pro or above.
          Data is kept for your plan&apos;s retention period and removed automatically after it.
        </P>
      </DocSection>
    </DocPage>
  );
}
