'use client';

import { Code2, Terminal, Shield, Lock, Activity, Server, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function APIDocs() {
    return (
        <div className="space-y-16">
            {/* Header */}
            <header className="space-y-4">
                <div className="flex items-center gap-3 text-primary">
                    <Code2 className="w-8 h-8" />
                    <h1 className="text-3xl font-bold tracking-tight">API Reference</h1>
                </div>
                <p className="text-xl text-muted-foreground leading-relaxed">
                    Complete REST API documentation. Query analytics, track events, and integrate Seentics into your applications and services.
                </p>
            </header>

            {/* Getting Started */}
            <section className="space-y-8">
                <h2 className="text-2xl font-semibold">Getting Started</h2>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Auth */}
                    <div className="p-6 rounded-lg border bg-card space-y-4">
                        <div className="flex items-center gap-2">
                            <Lock className="w-5 h-5 text-primary" />
                            <h3 className="font-semibold text-lg">Authentication</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            All API requests require a JWT token in the Authorization header.
                        </p>
                        <CodeBlock code={`Authorization: Bearer YOUR_JWT_TOKEN`} />
                        <p className="text-xs text-muted-foreground">
                            Learn how to obtain a token in the <span className="font-medium text-foreground">Authentication</span> section below.
                        </p>
                    </div>

                    {/* Base URL */}
                    <div className="p-6 rounded-lg border bg-card space-y-4">
                        <div className="flex items-center gap-2">
                            <Server className="w-5 h-5 text-primary" />
                            <h3 className="font-semibold text-lg">Base URL</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            All endpoints are relative to this base URL:
                        </p>
                        <CodeBlock code={`https://your-instance.com/api/v1`} />
                        <p className="text-xs text-muted-foreground">
                            Replace <code className="bg-muted px-1 rounded">your-instance.com</code> with your deployment domain.
                        </p>
                    </div>
                </div>
            </section>

            {/* Authentication Details */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Authentication</h2>
                <p className="text-muted-foreground leading-relaxed">
                    Requests to protected endpoints must include a valid JWT token. Tokens are obtained by signing in with your credentials.
                </p>

                <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Login</h3>
                    <EndpointBlock
                        method="POST"
                        path="/auth/login"
                        description="Obtain a JWT token using your credentials."
                        request={{
                            email: 'user@example.com',
                            password: 'your-password',
                        }}
                        response={{
                            token: 'eyJhbGciOiJIUzI1NiIs...',
                            user: {
                                id: 'user_123',
                                email: 'user@example.com',
                                name: 'John Doe',
                            },
                        }}
                    />
                </div>
            </section>

            {/* Tracker API - Public */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Event Tracking</h2>
                <p className="text-muted-foreground leading-relaxed">
                    Public endpoints for tracking user events. No authentication required.
                </p>

                <EndpointBlock
                    method="POST"
                    path="/tracker/collect"
                    description="Ingest pageviews, custom events, and user interactions."
                    noAuth
                    request={{
                        type: 'pageview',
                        site_id: 'abc123',
                        url: 'https://yourapp.com/pricing',
                        referrer: 'https://google.com',
                        user_agent: 'Mozilla/5.0...',
                    }}
                    response={{
                        success: true,
                        event_id: 'evt_456',
                    }}
                />
            </section>

            {/* Analytics API - Protected */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Analytics Queries</h2>
                <p className="text-muted-foreground leading-relaxed">
                    Protected endpoints for querying analytics data. Requires authentication.
                </p>

                <div className="space-y-8">
                    <EndpointBlock
                        method="GET"
                        path="/analytics/dashboard/:website_id"
                        description="Fetch dashboard overview stats: visitors, pageviews, sessions, bounce rate, etc."
                        queryParams={[
                            { name: 'start_date', type: 'string', desc: 'ISO 8601 date (2026-03-01)' },
                            { name: 'end_date', type: 'string', desc: 'ISO 8601 date (2026-03-17)' },
                        ]}
                        response={{
                            visitors: 12840,
                            pageviews: 38210,
                            sessions: 15600,
                            bounce_rate: 42.3,
                            avg_session_duration: 184,
                        }}
                    />

                    <EndpointBlock
                        method="GET"
                        path="/analytics/realtime/:website_id"
                        description="Get real-time visitor count for the last 5 minutes."
                        response={{
                            active_visitors: 47,
                            active_pages: [
                                { path: '/pricing', visitors: 18 },
                                { path: '/docs', visitors: 15 },
                                { path: '/', visitors: 14 },
                            ],
                        }}
                    />

                    <EndpointBlock
                        method="GET"
                        path="/analytics/top-pages/:website_id"
                        description="Retrieve the most visited pages ranked by pageviews or unique visitors."
                        queryParams={[
                            { name: 'limit', type: 'number', desc: 'Max results (default: 10)' },
                        ]}
                        response={{
                            pages: [
                                { path: '/', pageviews: 9210, visitors: 6340 },
                                { path: '/pricing', pageviews: 4870, visitors: 3120 },
                                { path: '/docs', pageviews: 3940, visitors: 2780 },
                            ],
                        }}
                    />

                    <EndpointBlock
                        method="GET"
                        path="/analytics/top-referrers/:website_id"
                        description="See which external sources are driving traffic."
                        response={{
                            referrers: [
                                { source: 'google.com', visitors: 5120, pageviews: 9210 },
                                { source: 'twitter.com', visitors: 1840, pageviews: 2130 },
                                { source: 'linkedin.com', visitors: 920, pageviews: 1450 },
                            ],
                        }}
                    />

                    <EndpointBlock
                        method="GET"
                        path="/analytics/top-countries/:website_id"
                        description="Geographic visitor breakdown by country."
                        response={{
                            countries: [
                                { country: 'US', flag: '🇺🇸', visitors: 6210, percentage: 48.4 },
                                { country: 'GB', flag: '🇬🇧', visitors: 2140, percentage: 16.7 },
                                { country: 'CA', flag: '🇨🇦', visitors: 1840, percentage: 14.3 },
                            ],
                        }}
                    />
                </div>
            </section>

            {/* Code Examples */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Code Examples</h2>

                <div className="space-y-6">
                    <CodeExample
                        language="JavaScript"
                        code={`const response = await fetch('https://your-instance.com/api/v1/analytics/dashboard/abc123', {
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
  },
});
const data = await response.json();
console.log(data);`}
                    />

                    <CodeExample
                        language="Python"
                        code={`import requests

headers = {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
}

response = requests.get(
    'https://your-instance.com/api/v1/analytics/dashboard/abc123',
    headers=headers
)
data = response.json()
print(data)`}
                    />

                    <CodeExample
                        language="cURL"
                        code={`curl -X GET https://your-instance.com/api/v1/analytics/dashboard/abc123 \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"`}
                    />
                </div>
            </section>

            {/* Error Handling */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Error Handling</h2>
                <p className="text-muted-foreground leading-relaxed">
                    The API uses standard HTTP status codes and returns error details in the response body.
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                    <ErrorStatus code={400} message="Bad Request" desc="Invalid parameters or malformed request." />
                    <ErrorStatus code={401} message="Unauthorized" desc="Missing or invalid authentication token." />
                    <ErrorStatus code={403} message="Forbidden" desc="Insufficient permissions for the requested resource." />
                    <ErrorStatus code={404} message="Not Found" desc="Requested resource does not exist." />
                    <ErrorStatus code={429} message="Rate Limited" desc="Too many requests. Wait before retrying." />
                    <ErrorStatus code={500} message="Server Error" desc="Internal server error. Try again later." />
                </div>
            </section>

            {/* Rate Limiting */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Rate Limits</h2>
                <div className="p-6 rounded-lg border bg-card space-y-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        API requests are rate-limited to protect service stability:
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            <span><span className="font-semibold text-foreground">1000 requests/minute</span> per API key</span>
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            <span><span className="font-semibold text-foreground">Headers</span> include <code className="bg-muted px-1 rounded text-xs">X-RateLimit-Remaining</code> and <code className="bg-muted px-1 rounded text-xs">X-RateLimit-Reset</code></span>
                        </li>
                    </ul>
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
        <div className="relative bg-muted/50 rounded p-3 border">
            <button
                onClick={copy}
                className="absolute top-2 right-2 p-1.5 rounded hover:bg-muted transition text-muted-foreground hover:text-foreground"
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
    const methodColor = method === 'GET' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400';
    const methodBg = method === 'GET' ? 'bg-blue-500/10' : 'bg-emerald-500/10';
    return (
        <div className="space-y-4">
            <div className="space-y-3 p-6 rounded-lg border bg-card">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${methodBg} ${methodColor}`}>
                        {method}
                    </span>
                    <code className="font-mono text-sm text-foreground">{path}</code>
                    {noAuth && <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground font-medium">No Auth*</span>}
                </div>
                <p className="text-sm text-muted-foreground">{description}</p>
                {queryParams && (
                    <div className="space-y-2 pt-2 border-t">
                        <p className="text-xs font-semibold text-foreground">Query Parameters:</p>
                        <ul className="space-y-1">
                            {queryParams.map((p) => (
                                <li key={p.name} className="text-xs text-muted-foreground">
                                    <code className="bg-muted/50 px-1 rounded">{p.name}</code> <span className="text-xs text-primary">({p.type})</span> – {p.desc}
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
                    className="text-xs px-2 py-1 rounded hover:bg-muted transition text-muted-foreground hover:text-foreground flex items-center gap-1"
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
