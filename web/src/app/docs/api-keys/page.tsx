'use client';

import { useState } from 'react';
import { KeyRound, Copy, Check, Shield, Lock, Code2, Plus, Trash2 } from 'lucide-react';

export default function APIKeysDocs() {
    return (
        <div className="space-y-16">
            {/* Header */}
            <header className="space-y-4">
                <div className="flex items-center gap-3">
                    <KeyRound className="w-8 h-8 text-amber-500" />
                    <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
                </div>
                <p className="text-xl text-muted-foreground leading-relaxed">
                    Create and manage API keys to authenticate programmatic access to your website analytics data.
                </p>
            </header>

            {/* What are API Keys */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">What are API Keys</h2>
                <div className="p-6 rounded-lg border bg-card space-y-4">
                    <div className="flex items-center gap-2">
                        <KeyRound className="w-5 h-5 text-amber-500" />
                        <h3 className="font-semibold text-lg">API Key Authentication</h3>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                        API keys let you access your website's analytics data from your own backend, scripts, or third-party tools.
                        Each key is scoped to specific permissions and tied to a specific website. Unlike JWT tokens that expire,
                        API keys are long-lived credentials intended for server-to-server communication.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                        Use API keys when you need to query analytics data from automated scripts, cron jobs, CI pipelines, or
                        any integration that runs outside of a user browser session.
                    </p>
                </div>
            </section>

            {/* Creating an API Key */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Creating an API Key</h2>
                <p className="text-muted-foreground leading-relaxed">
                    API keys are created per website. Follow these steps to generate one:
                </p>

                <div className="space-y-4">
                    {[
                        { step: '1', title: 'Navigate to your website dashboard', desc: 'Open your website in the Seentics dashboard, then click the Developers tab in the sidebar.' },
                        { step: '2', title: 'Create a new key', desc: 'Click "New API Key", give it a descriptive name (e.g. "Analytics Dashboard"), and select the permission scopes your integration needs.' },
                        { step: '3', title: 'Copy the key immediately', desc: 'The full key is only shown once at creation time. Copy it to a secure location — you will not be able to retrieve it again.' },
                    ].map(({ step, title, desc }) => (
                        <div key={step} className="flex gap-4 p-6 rounded-lg border bg-card">
                            <span className="flex-shrink-0 w-8 h-8 rounded-lg-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm font-bold flex items-center justify-center">
                                {step}
                            </span>
                            <div className="space-y-1">
                                <p className="font-semibold">{title}</p>
                                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Scopes table */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Available Scopes</h3>
                    <div className="rounded-lg border bg-card overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/40">
                                    <th className="text-left px-4 py-3 font-semibold text-foreground">Scope</th>
                                    <th className="text-left px-4 py-3 font-semibold text-foreground">Description</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {[
                                    { scope: 'analytics:read', desc: 'Read analytics data (pageviews, sessions, events)' },
                                    { scope: 'heatmaps:read', desc: 'Read heatmap recordings' },
                                    { scope: 'replays:read', desc: 'Read session recordings' },
                                    { scope: 'funnels:read', desc: 'Read funnel data' },
                                    { scope: 'funnels:write', desc: 'Create/update funnels' },
                                    { scope: 'automations:read', desc: 'Read automation rules' },
                                    { scope: 'automations:write', desc: 'Create/update automation rules' },
                                ].map(({ scope, desc }) => (
                                    <tr key={scope}>
                                        <td className="px-4 py-3">
                                            <code className="text-xs bg-muted/60 px-1.5 py-0.5 rounded-lg font-mono text-foreground">{scope}</code>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">{desc}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* Authenticating with an API Key */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Authenticating with an API Key</h2>
                <p className="text-muted-foreground leading-relaxed">
                    There are two ways to send your API key with each request:
                </p>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="p-6 rounded-lg border bg-card space-y-4">
                        <div className="flex items-center gap-2">
                            <Lock className="w-5 h-5 text-primary" />
                            <h3 className="font-semibold text-lg">Authorization Header</h3>
                            <span className="text-xs px-2 py-0.5 rounded-lg-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">Recommended</span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Pass the key as a Bearer token in the Authorization header. This is the preferred method as it keeps the key out of logs and URLs.
                        </p>
                        <CodeBlock code={`Authorization: Bearer snt_live_xxxxxxxxxxxxx`} />
                    </div>

                    <div className="p-6 rounded-lg border bg-card space-y-4">
                        <div className="flex items-center gap-2">
                            <Code2 className="w-5 h-5 text-muted-foreground" />
                            <h3 className="font-semibold text-lg">Query Parameter</h3>
                            <span className="text-xs px-2 py-0.5 rounded-lg-full bg-muted text-muted-foreground font-medium">Less Secure</span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Append the key as a query parameter. Avoid this in production — the key will appear in server logs and browser history.
                        </p>
                        <CodeBlock code={`GET /api/v1/analytics/overview?api_key=snt_live_xxxxxxxxxxxxx`} />
                    </div>
                </div>
            </section>

            {/* API Key Endpoints */}
            <section className="space-y-8">
                <h2 className="text-2xl font-semibold">API Key Endpoints</h2>
                <p className="text-muted-foreground leading-relaxed">
                    Manage API keys programmatically via these endpoints. All require your JWT token (dashboard authentication).
                </p>

                <div className="space-y-8">
                    <EndpointBlock
                        method="GET"
                        path="/user/websites/:websiteId/api-keys"
                        description="List all API keys for a website. Returns key metadata — the actual key value is never returned after creation."
                        response={{
                            success: true,
                            data: [
                                {
                                    id: 'key_abc123',
                                    name: 'My Dashboard App',
                                    keyPrefix: 'snt_live_xxxx',
                                    scopes: ['analytics:read', 'heatmaps:read'],
                                    isActive: true,
                                    lastUsedAt: '2026-03-26T14:22:00Z',
                                    createdAt: '2026-01-15T10:00:00Z',
                                },
                            ],
                        }}
                    />

                    <EndpointBlock
                        method="POST"
                        path="/user/websites/:websiteId/api-keys"
                        description="Create a new API key for a website. The full key value is returned only in this response — store it securely immediately."
                        request={{
                            name: 'My App',
                            scopes: ['analytics:read'],
                        }}
                        response={{
                            success: true,
                            data: {
                                id: 'key_abc123',
                                name: 'My App',
                                key: 'snt_live_xxxxxxxxxxxxxxxxxxxxxxxx',
                                keyPrefix: 'snt_live_xxxx',
                                scopes: ['analytics:read'],
                                isActive: true,
                                lastUsedAt: null,
                                createdAt: '2026-03-27T09:00:00Z',
                            },
                        }}
                    />

                    <EndpointBlock
                        method="DELETE"
                        path="/user/websites/:websiteId/api-keys/:keyId"
                        description="Revoke an API key immediately. All requests using this key will return 401 after revocation."
                        response={{
                            success: true,
                        }}
                    />
                </div>
            </section>

            {/* Code Examples */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Code Examples</h2>
                <p className="text-muted-foreground leading-relaxed">
                    Fetch analytics data using your API key from any language or environment.
                </p>

                <div className="space-y-6">
                    <CodeExample
                        language="JavaScript"
                        code={`const res = await fetch(
  'https://your-instance.com/api/v1/analytics/overview?website_id=abc123&start=2026-03-01&end=2026-03-31',
  {
    headers: { 'Authorization': 'Bearer snt_live_xxxxxxxxxxxxx' },
  }
);
const data = await res.json();
console.log(data);`}
                    />

                    <CodeExample
                        language="Python"
                        code={`import requests

headers = {'Authorization': 'Bearer snt_live_xxxxxxxxxxxxx'}
params = {
    'website_id': 'abc123',
    'start': '2026-03-01',
    'end': '2026-03-31',
}
r = requests.get(
    'https://your-instance.com/api/v1/analytics/overview',
    headers=headers,
    params=params,
)
data = r.json()
print(data)`}
                    />

                    <CodeExample
                        language="cURL"
                        code={`curl https://your-instance.com/api/v1/analytics/overview \\
  -H "Authorization: Bearer snt_live_xxxxxxxxxxxxx" \\
  -G -d "website_id=abc123&start=2026-03-01&end=2026-03-31"`}
                    />
                </div>
            </section>

            {/* Security Best Practices */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Security Best Practices</h2>
                <p className="text-muted-foreground leading-relaxed">
                    API keys are powerful credentials. Follow these guidelines to keep your data safe.
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                    {[
                        {
                            icon: Lock,
                            title: 'Never expose keys in frontend code',
                            desc: 'API keys must only be used in backend environments — servers, serverless functions, or scripts. Never bundle them in browser JavaScript or mobile apps.',
                        },
                        {
                            icon: KeyRound,
                            title: 'Rotate keys periodically',
                            desc: 'Revoke and recreate your API keys every 90 days as a precaution, even if no breach is suspected. Old keys continue to work until you revoke them.',
                        },
                        {
                            icon: Shield,
                            title: 'Use minimal scopes',
                            desc: 'Grant only the scopes your integration actually needs. A read-only analytics integration should never have write scopes.',
                        },
                        {
                            icon: Code2,
                            title: 'Monitor last used',
                            desc: 'Check the "Last used" timestamp in the Developers tab regularly. Revoke any keys that have not been used recently or that you no longer recognize.',
                        },
                    ].map(({ icon: Icon, title, desc }) => (
                        <div key={title} className="p-6 rounded-lg border bg-card space-y-3">
                            <div className="flex items-center gap-2">
                                <Icon className="w-5 h-5 text-amber-500" />
                                <h3 className="font-semibold">{title}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                        </div>
                    ))}
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

function EndpointBlock({
    method,
    path,
    description,
    queryParams,
    noAuth,
    request,
    response,
}: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    description: string;
    queryParams?: { name: string; type: string; desc: string }[];
    noAuth?: boolean;
    request?: Record<string, any>;
    response: Record<string, any>;
}) {
    const methodColor =
        method === 'GET'
            ? 'text-blue-600 dark:text-blue-400'
            : method === 'DELETE'
            ? 'text-red-600 dark:text-red-400'
            : 'text-emerald-600 dark:text-emerald-400';
    const methodBg =
        method === 'GET'
            ? 'bg-blue-500/10'
            : method === 'DELETE'
            ? 'bg-red-500/10'
            : 'bg-emerald-500/10';
    return (
        <div className="space-y-4">
            <div className="space-y-3 p-6 rounded-lg border bg-card">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${methodBg} ${methodColor}`}>
                        {method}
                    </span>
                    <code className="font-mono text-sm text-foreground">{path}</code>
                    {noAuth && (
                        <span className="text-xs px-2 py-1 rounded-lg bg-muted text-muted-foreground font-medium">
                            No Auth*
                        </span>
                    )}
                </div>
                <p className="text-sm text-muted-foreground">{description}</p>
                {queryParams && (
                    <div className="space-y-2 pt-2 border-t">
                        <p className="text-xs font-semibold text-foreground">Query Parameters:</p>
                        <ul className="space-y-1">
                            {queryParams.map((p) => (
                                <li key={p.name} className="text-xs text-muted-foreground">
                                    <code className="bg-muted/50 px-1 rounded-lg">{p.name}</code>{' '}
                                    <span className="text-xs text-primary">({p.type})</span> – {p.desc}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                {request && (
                    <div className="space-y-2">
                        <p className="text-sm font-semibold">Request</p>
                        <CodeBlock code={JSON.stringify(request, null, 2)} />
                    </div>
                )}
                <div className="space-y-2">
                    <p className="text-sm font-semibold">Response</p>
                    <CodeBlock code={JSON.stringify(response, null, 2)} />
                </div>
            </div>
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
