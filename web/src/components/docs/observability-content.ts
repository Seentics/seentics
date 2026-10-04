/**
 * Content for the public Observability docs (/docs/observability/*).
 *
 * Copied from observability/web's settings page (docs-content.ts), which is the
 * in-product version of the same guides. They are separate deployments, so the text
 * lives in both: when an SDK option or default changes, change both. Everything here
 * is taken from the SDKs themselves (sdks/node, sdks/go, sdks/python).
 */

export type Snippet = { filename?: string; language: string; code: string };

export type Step = {
  title: string;
  /** Plain prose under the title; backticked words render as code. */
  body?: string;
  snippets?: Snippet[];
};

export type SdkGuide = {
  id: 'node' | 'go' | 'python';
  label: string;
  /** The package as its registry names it, and what it needs to run. */
  pkg: string;
  requires: string;
  summary: string;
  steps: Step[];
};

export const SDK_GUIDES: SdkGuide[] = [
  {
    id: 'node',
    label: 'Node.js',
    pkg: '@seentics/observe',
    requires: 'Node.js 18.19 or newer · also runs on Bun',
    summary:
      'Logs, traces and metrics in one package, with HTTP and fetch traced automatically and Node runtime metrics (event loop, GC, heap) included.',
    steps: [
      {
        title: '1 · Install',
        snippets: [
          { language: 'bash', code: 'npm install @seentics/observe' },
          {
            filename: 'optional — also trace Express, NestJS, pg, Redis, MongoDB, Kafka…',
            language: 'bash',
            code: 'npm install @opentelemetry/auto-instrumentations-node',
          },
        ],
      },
      {
        title: '2 · Set up',
        body: 'Environment variables are the whole setup: HTTP requests, outgoing calls and runtime metrics are traced and measured with no code change. The --import flag loads the SDK before your app, which is what lets ES modules be instrumented.',
        snippets: [
          {
            filename: '.env',
            language: 'env',
            code: `SEENTICS_INGEST_KEY=<your ingest key>
SEENTICS_SERVICE_NAME=checkout-service
SEENTICS_ENVIRONMENT=production`,
          },
          { language: 'bash', code: 'node --import @seentics/observe/register server.js' },
          {
            filename: 'or, in a Dockerfile',
            language: 'bash',
            code: 'ENV NODE_OPTIONS="--import @seentics/observe/register"',
          },
        ],
      },
      {
        title: 'Or configure in code',
        body: 'When the key comes from a secrets manager, or you want to set options. Import it before express, pg and the rest so they can be patched.',
        snippets: [
          {
            filename: 'instrument.ts',
            language: 'ts',
            code: `import { configure } from '@seentics/observe';

configure({
  ingestKey: await secrets.get('seentics-ingest-key'),
  service: 'checkout-service',
  serviceVersion: process.env.GIT_SHA,
  environment: 'production',
});`,
          },
        ],
      },
      {
        title: '3 · Logs',
        body: 'Every key in the fields object becomes a searchable column — orderId:81423 in the query box, no schema to register. A line written inside a request carries its trace_id, so you can go from a log line to its trace and back.',
        snippets: [
          {
            language: 'ts',
            code: `import { logger } from '@seentics/observe';

logger.info('order placed', { orderId: 81423, total: 42.5 });
logger.warn('payment provider slow', { provider: 'stripe', latencyMs: 2400 });

try {
  await charge(order);
} catch (err) {
  logger.error('charge failed', err, { orderId: order.id }); // grouped in Errors
}

// one logger per request, with its fields on every line
const log = logger.child({ requestId, userId });`,
          },
        ],
      },
      {
        title: '4 · Traces',
        body: 'Incoming and outgoing HTTP and fetch are traced for you, and the W3C traceparent header joins services into one trace. Wrap your own work in a span with withSpan.',
        snippets: [
          {
            language: 'ts',
            code: `import { withSpan, activeSpan } from '@seentics/observe';

const receipt = await withSpan('checkout.charge', async (span) => {
  span.setAttribute('order.id', order.id);
  return stripe.charges.create({ amount: order.total });
});

// add detail to the span the request already has
activeSpan()?.setAttributes({ 'user.id': user.id });`,
          },
        ],
      },
      {
        title: '5 · Metrics',
        snippets: [
          {
            language: 'ts',
            code: `import { metrics } from '@seentics/observe';

const orders = metrics.createCounter('orders.processed');
orders.add(1, { status: 'success', region: 'eu' });

const duration = metrics.createHistogram('checkout.duration', { unit: 'ms' });
duration.record(elapsedMs, { 'payment.method': 'card' });`,
          },
        ],
        body: 'Keep attribute values low-cardinality — status, region, route. User and order ids belong on logs and spans.',
      },
      {
        title: '6 · Serverless and short scripts',
        body: 'Exiting normally, SIGTERM and crashes all flush for you. Where the process can be frozen the moment the handler returns, flush first. If you end a script with process.exit(), await shutdown() before it.',
        snippets: [
          {
            language: 'ts',
            code: `import { flush } from '@seentics/observe';

export const handler = async (event) => {
  try {
    return await process(event);
  } finally {
    await flush(); // never throws; gives up after flushTimeoutMs
  }
};`,
          },
        ],
      },
    ],
  },
  {
    id: 'go',
    label: 'Go',
    pkg: 'github.com/seentics/observe-go',
    requires: 'Go 1.24 or newer · standard library for host metrics',
    summary:
      'Structured logs, plus traces and metrics on the real OpenTelemetry Go SDK. net/http middleware and a log/slog handler included.',
    steps: [
      {
        title: '1 · Install',
        snippets: [{ language: 'bash', code: 'go get github.com/seentics/observe-go@latest' }],
      },
      {
        title: '2 · Set up',
        body: 'Set the key and service name in the environment, then wrap your handler and shut down on exit. With the key in the environment, traces and metrics start at import and Configure is optional.',
        snippets: [
          {
            filename: '.env',
            language: 'env',
            code: `SEENTICS_INGEST_KEY=<your ingest key>
SEENTICS_SERVICE_NAME=checkout-service
SEENTICS_ENVIRONMENT=production`,
          },
          {
            filename: 'main.go',
            language: 'go',
            code: `import observe "github.com/seentics/observe-go"

func main() {
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		observe.Shutdown(ctx) // sends what is still buffered
	}()

	// Already on log/slog? Every record is sent too, with its trace.
	slog.SetDefault(slog.New(observe.SlogHandler(slog.NewJSONHandler(os.Stdout, nil))))

	mux := http.NewServeMux()
	mux.HandleFunc("GET /orders/{id}", getOrder)
	http.ListenAndServe(":8080", observe.Middleware(mux)) // a span and a duration per request
}`,
          },
        ],
      },
      {
        title: 'Or configure in code',
        snippets: [
          {
            language: 'go',
            code: `err := observe.Configure(observe.Options{
	IngestKey:   key,
	Service:     "checkout-service",
	Environment: "production",
})`,
          },
        ],
      },
      {
        title: '3 · Logs',
        body: 'Fields become searchable columns. WithContext links a line to the request’s trace. Fatal logs at the "fatal" severity and never calls os.Exit.',
        snippets: [
          {
            language: 'go',
            code: `observe.Log.Info("order placed", observe.Fields{"orderId": 81423, "total": 42.5})

// linked to the request's trace (trace_id, span_id)
observe.Log.WithContext(r.Context()).Warn("payment provider slow", observe.Fields{"latencyMs": 2400})

// a caught error: its Error() becomes the line, plus error.message and error.type
observe.Log.Error(err, observe.Fields{"orderId": order.ID})

// fields on every line from this logger
orders := observe.Log.With(observe.Fields{"component": "orders"})`,
          },
        ],
      },
      {
        title: '4 · Traces and metrics',
        body: 'Tracer and Meter are the standard OpenTelemetry ones. The middleware already records http.server.request.duration; skip health checks with MiddlewareOptions.Skip.',
        snippets: [
          {
            language: 'go',
            code: `ctx, span := observe.Tracer().Start(ctx, "process-order")
defer span.End()

orders, _ := observe.Meter().Int64Counter("orders.processed")
orders.Add(ctx, 1, metric.WithAttributes(attribute.String("status", "success")))

// continue the trace into a service you call
otel.GetTextMapPropagator().Inject(ctx, propagation.HeaderCarrier(req.Header))`,
          },
        ],
      },
    ],
  },
  {
    id: 'python',
    label: 'Python',
    pkg: 'seentics-observe',
    requires: 'Python 3.8 or newer',
    summary:
      'Structured logs with no OpenTelemetry dependency, plus traces and metrics on the real OpenTelemetry SDK. It does not instrument libraries or report host metrics by itself.',
    steps: [
      {
        title: '1 · Install',
        snippets: [{ language: 'bash', code: 'pip install seentics-observe' }],
      },
      {
        title: '2 · Set up',
        body: 'Configure once at startup. Or set SEENTICS_INGEST_KEY and SEENTICS_SERVICE_NAME and skip configure() — the logger reads them on its first call, and the tracer and meter start from the environment at import.',
        snippets: [
          {
            language: 'python',
            code: `import os
from seentics_observe import configure, logger, tracer, meter

configure(
    ingest_key=os.environ["SEENTICS_INGEST_KEY"],
    service="checkout-service",
    environment="production",
)`,
          },
        ],
      },
      {
        title: '3 · Logs',
        body: 'Fields as keyword arguments, or as a fields= dict. A caught exception works directly. fatal() is a severity, not an exit — it never calls sys.exit.',
        snippets: [
          {
            language: 'python',
            code: `logger.info("order placed", order_id=81423, total=42.5)
logger.warn("payment provider slow", provider="stripe", latency_ms=2400)

try:
    charge(order)
except Exception as exc:
    logger.error(exc, order_id=order.id)`,
          },
        ],
      },
      {
        title: '4 · Traces and metrics',
        body: 'Nested spans are parented automatically, across await in asyncio too.',
        snippets: [
          {
            language: 'python',
            code: `with tracer.start_as_current_span("process-order") as span:
    span.set_attribute("order.id", order.id)
    charge(order)

orders = meter.create_counter("orders.processed")
orders.add(1, {"status": "success"})

duration = meter.create_histogram("http.server.duration", unit="ms")
duration.record(duration_ms, {"http.route": "/checkout"})`,
          },
        ],
      },
      {
        title: '5 · Before a short script exits',
        body: 'Logs are buffered on a background thread. Call flush() before a short script ends or a serverless handler returns, and shutdown() to flush traces and metrics too.',
        snippets: [{ language: 'python', code: 'logger.flush()' }],
      },
    ],
  },
];

/* ---------------------------------------------------------------------------------- */
/* Naming services and servers                                                          */
/* ---------------------------------------------------------------------------------- */

export type IdentityRow = { what: string; setBy: string; fallback: string };

/**
 * One ingest key serves a whole project, so the key says nothing about which service or
 * server a record came from. Each SDK stamps that on every log, span and metric itself, as
 * OpenTelemetry resource attributes (sdks/node: config.ts, hostmetrics.ts).
 */
export const IDENTITY_ROWS: IdentityRow[] = [
  { what: 'Project', setBy: 'The ingest key — one key for every service and server in the project.', fallback: 'Required' },
  { what: 'Service', setBy: 'SEENTICS_SERVICE_NAME (service.name)', fallback: 'unknown-service — every unnamed app is merged into one' },
  { what: 'Environment', setBy: 'SEENTICS_ENVIRONMENT (deployment.environment)', fallback: 'NODE_ENV in Node, otherwise unset' },
  { what: 'Server', setBy: 'OTEL_RESOURCE_ATTRIBUTES=host.name=<server> (host.name)', fallback: 'The machine’s hostname — in a container, its random ID' },
  { what: 'Instance', setBy: 'Automatic (service.instance.id)', fallback: 'hostname:pid — tells replicas of one service apart' },
];

export type DeployGuide = {
  id: 'vm' | 'docker' | 'compose' | 'kubernetes';
  label: string;
  /** What you must do here, and what you can skip. */
  body: string;
  snippets: Snippet[];
};

export const DEPLOY_GUIDES: DeployGuide[] = [
  {
    id: 'vm',
    label: 'Bare VM',
    body: 'The SDK reads the machine’s own hostname, so the server is already named. Give each machine a distinct hostname, and set the service name and key in the service’s environment. Several services on one VM share the server and differ by service name.',
    snippets: [
      {
        filename: 'name the machine (once)',
        language: 'bash',
        code: 'sudo hostnamectl set-hostname web-1',
      },
      {
        filename: '/etc/systemd/system/checkout.service',
        language: 'bash',
        code: `[Service]
Environment=SEENTICS_INGEST_KEY=<your ingest key>
Environment=SEENTICS_SERVICE_NAME=checkout-service
Environment=SEENTICS_ENVIRONMENT=production
ExecStart=/usr/bin/node --import @seentics/observe/register /srv/checkout/server.js`,
      },
    ],
  },
  {
    id: 'docker',
    label: 'Docker',
    body: 'Inside a container the hostname is a random ID that changes on every redeploy, so each container would show up as its own server. Name the server with --hostname, or with host.name in OTEL_RESOURCE_ATTRIBUTES.',
    snippets: [
      {
        language: 'bash',
        code: `docker run -d \
  --hostname web-1 \
  -e SEENTICS_INGEST_KEY=<your ingest key> \
  -e SEENTICS_SERVICE_NAME=checkout-service \
  -e SEENTICS_ENVIRONMENT=production \
  -e NODE_OPTIONS="--import @seentics/observe/register" \
  checkout:latest`,
      },
      {
        filename: 'or, without --hostname',
        language: 'bash',
        code: '-e OTEL_RESOURCE_ATTRIBUTES=host.name=web-1',
      },
    ],
  },
  {
    id: 'compose',
    label: 'Docker Compose',
    body: 'Give every service its own SEENTICS_SERVICE_NAME, and the same hostname on every service that runs on the same machine, so they report as one server. Without hostname, each container is a separate server.',
    snippets: [
      {
        filename: 'docker-compose.yml',
        language: 'yaml',
        code: `x-seentics: &seentics
  hostname: web-1                          # the server — same for every service on this machine
  environment: &seentics-env
    SEENTICS_INGEST_KEY: \${SEENTICS_INGEST_KEY}
    SEENTICS_ENVIRONMENT: production
    NODE_OPTIONS: --import @seentics/observe/register

services:
  checkout:
    <<: *seentics
    image: checkout:latest
    environment:
      <<: *seentics-env
      SEENTICS_SERVICE_NAME: checkout-service   # the service — unique per service

  payments:
    <<: *seentics
    image: payments:latest
    environment:
      <<: *seentics-env
      SEENTICS_SERVICE_NAME: payments-service`,
      },
    ],
  },
  {
    id: 'kubernetes',
    label: 'Kubernetes',
    body: 'A pod’s hostname is the pod name, which changes on every rollout. Report the node as the server, and keep the service name fixed per Deployment. Replicas of one service stay apart by their instance id.',
    snippets: [
      {
        filename: 'deployment.yaml (container spec)',
        language: 'yaml',
        code: `env:
  - name: SEENTICS_INGEST_KEY
    valueFrom: { secretKeyRef: { name: seentics, key: ingest-key } }
  - name: SEENTICS_SERVICE_NAME
    value: checkout-service
  - name: SEENTICS_ENVIRONMENT
    value: production
  - name: NODE_NAME
    valueFrom: { fieldRef: { fieldPath: spec.nodeName } }
  - name: OTEL_RESOURCE_ATTRIBUTES
    value: host.name=$(NODE_NAME)`,
      },
    ],
  },
];

export const NAMING_PITFALLS: string[] = [
  'Set SEENTICS_SERVICE_NAME on every app. Two apps left on unknown-service are merged into one.',
  'Use a different service name for each app. Two apps both called api are merged.',
  'Replicas of one service share its name on purpose. Don’t add a number to the name; the instance id tells them apart.',
  'Staging and production can share a key and be told apart by SEENTICS_ENVIRONMENT, but a separate project per environment keeps them fully apart.',
];
