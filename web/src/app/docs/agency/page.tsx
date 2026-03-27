'use client';

import { useState } from 'react';
import { Building2, Users, KeyRound, Code2, Copy, Check, Globe, Shield, Webhook, BarChart3 } from 'lucide-react';

export default function AgencyAPIDocs() {
    return (
        <div className="space-y-16">
            {/* Header */}
            <header className="space-y-4">
                <div className="flex items-center gap-3">
                    <Building2 className="w-8 h-8 text-violet-500" />
                    <h1 className="text-3xl font-bold tracking-tight">Agency API</h1>
                </div>
                <p className="text-xl text-muted-foreground leading-relaxed">
                    Manage client accounts, provision workspaces, and access all data programmatically. Everything you need to run a white-label analytics platform for your clients.
                </p>
            </header>

            {/* Overview */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Overview</h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="p-6 rounded-lg border bg-card space-y-4">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-violet-500" />
                            <h3 className="font-semibold text-lg">Dashboard Management</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Create and manage clients from the{' '}
                            <span className="font-medium text-foreground">Agency → Client Accounts</span> page.
                            Invite clients, assign websites, configure feature access, and view all client data
                            from a single agency dashboard. No code required.
                        </p>
                    </div>

                    <div className="p-6 rounded-lg border bg-card space-y-4">
                        <div className="flex items-center gap-2">
                            <Code2 className="w-5 h-5 text-violet-500" />
                            <h3 className="font-semibold text-lg">Programmatic API</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Use your agency API key to automate everything via REST API. Full CRUD for client users
                            and websites — perfect for SaaS platforms, onboarding workflows, and automated provisioning pipelines.
                        </p>
                    </div>
                </div>
            </section>

            {/* Agency API Key */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Agency API Key</h2>
                <p className="text-muted-foreground leading-relaxed">
                    The agency API key is your master key for server-to-server automation. It is scoped to your entire agency account.
                </p>

                <div className="space-y-4">
                    {[
                        { step: '1', title: 'Go to Agency → API Keys', desc: 'Open your agency dashboard and navigate to the API Keys section in the left sidebar.' },
                        { step: '2', title: 'Create an agency key', desc: 'Click "New API Key", give it a name, and create it. This generates a key with the prefix snt_age_...' },
                        { step: '3', title: 'Use it in your requests', desc: 'Add the key to the Authorization header of every agency API request. The key is shown only once — save it securely.' },
                    ].map(({ step, title, desc }) => (
                        <div key={step} className="flex gap-4 p-6 rounded-lg border bg-card">
                            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 text-sm font-bold flex items-center justify-center">
                                {step}
                            </span>
                            <div className="space-y-1">
                                <p className="font-semibold">{title}</p>
                                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <CodeBlock code={`Authorization: Bearer snt_age_xxxxxxxxxxxxx`} />
            </section>

            {/* Client User Management — Dashboard endpoints */}
            <section className="space-y-8">
                <div className="space-y-2">
                    <h2 className="text-2xl font-semibold">Client User Management</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        These endpoints use your personal JWT token — the same credential you receive when you log in to the dashboard.
                        They are the same actions performed by the Agency → Client Accounts UI.
                    </p>
                </div>

                <div className="space-y-8">
                    {/* Create */}
                    <EndpointBlock
                        method="POST"
                        path="/user/agency/client-users"
                        description="Create a new client user account under your agency. Optionally set a password — if omitted, a secure temporary password is generated and returned once."
                        request={{
                            name: 'Jane Smith',
                            email: 'jane@client.com',
                            password: 'optional-if-not-set-auto-generated',
                            company: 'Acme Corp',
                            features: {
                                analytics: true,
                                heatmaps: true,
                                replays: false,
                                funnels: true,
                                automations: false,
                            },
                        }}
                        response={{
                            success: true,
                            data: {
                                client: { id: 'cli_abc', name: 'Jane Smith', status: 'active' },
                                user: { id: 'usr_xyz', email: 'jane@client.com', role: 'agency_client' },
                                tempPassword: 'Ax9#mPqR2k',
                            },
                        }}
                        note="tempPassword only appears if you did not set a password. Share it securely with your client — it will not be shown again."
                    />

                    {/* List */}
                    <EndpointBlock
                        method="GET"
                        path="/user/agency/client-users"
                        description="List all client users under your agency. Returns a paginated array of client and user metadata."
                        response={{
                            success: true,
                            data: [
                                { id: 'usr_xyz', email: 'jane@client.com', name: 'Jane Smith', company: 'Acme Corp', status: 'active', createdAt: '2026-01-15T10:00:00Z' },
                            ],
                            total: 1,
                        }}
                    />

                    {/* Get one */}
                    <EndpointBlock
                        method="GET"
                        path="/user/agency/client-users/:userId"
                        description="Retrieve full details for a specific client user including their websites, feature flags, and usage limits."
                        response={{
                            success: true,
                            data: {
                                id: 'usr_xyz',
                                email: 'jane@client.com',
                                name: 'Jane Smith',
                                company: 'Acme Corp',
                                status: 'active',
                                features: { analytics: true, heatmaps: true, replays: false, funnels: true, automations: false },
                                websites: [{ id: 'site_abc', name: 'Acme Site', domain: 'acme.com' }],
                            },
                        }}
                    />

                    {/* Delete */}
                    <EndpointBlock
                        method="DELETE"
                        path="/user/agency/client-users/:userId"
                        description="Permanently delete a client user and all associated data including websites, analytics, heatmaps, and recordings. This action is irreversible."
                        response={{ success: true }}
                    />

                    {/* Reset password */}
                    <EndpointBlock
                        method="POST"
                        path="/user/agency/client-users/:userId/reset-password"
                        description="Generate a new temporary password for a client user. The existing password is invalidated immediately. Share the new temporary password securely."
                        response={{
                            success: true,
                            data: { tempPassword: 'Nb4!xQy7wZ' },
                        }}
                    />
                </div>
            </section>

            {/* Programmatic API — Agency API Key */}
            <section className="space-y-8">
                <div className="space-y-2">
                    <h2 className="text-2xl font-semibold">Programmatic API (Agency API Key)</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Use your agency API key (<code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">snt_age_...</code>) for
                        server-to-server automation. These endpoints are designed for CI/CD pipelines, onboarding workflows, and any
                        server environment where a user JWT is not available.
                    </p>
                </div>

                <div className="space-y-8">
                    <EndpointBlock
                        method="POST"
                        path="/agency/api/users"
                        description="Create a client user via your agency API key. Same behavior as the dashboard endpoint — omit password to receive a generated tempPassword."
                        request={{
                            name: 'Jane Smith',
                            email: 'jane@acme.com',
                            company: 'Acme Corp',
                            features: { analytics: true, heatmaps: true, replays: false, funnels: true, automations: false },
                        }}
                        response={{
                            success: true,
                            data: {
                                client: { id: 'cli_abc', name: 'Jane Smith', status: 'active' },
                                user: { id: 'usr_xyz', email: 'jane@acme.com', role: 'agency_client' },
                                tempPassword: 'Ax9#mPqR2k',
                            },
                        }}
                    />

                    <EndpointBlock
                        method="GET"
                        path="/agency/api/users"
                        description="List all agency client users. Equivalent to the dashboard endpoint but authenticated via agency API key."
                        response={{
                            success: true,
                            data: [
                                { id: 'usr_xyz', email: 'jane@acme.com', name: 'Jane Smith', status: 'active' },
                            ],
                            total: 1,
                        }}
                    />

                    <EndpointBlock
                        method="GET"
                        path="/agency/api/users/:userId"
                        description="Get full details for a client user including features, limits, and associated websites."
                        response={{
                            success: true,
                            data: {
                                id: 'usr_xyz',
                                email: 'jane@acme.com',
                                name: 'Jane Smith',
                                features: { analytics: true, heatmaps: true },
                                websites: [{ id: 'site_abc', domain: 'acme.com' }],
                            },
                        }}
                    />

                    <EndpointBlock
                        method="DELETE"
                        path="/agency/api/users/:userId"
                        description="Delete a client user and all their data. Irreversible."
                        response={{ success: true }}
                    />

                    <EndpointBlock
                        method="POST"
                        path="/agency/api/users/:userId/websites"
                        description="Create a website and associate it with a specific client user. The client will see this website in their Seentics dashboard immediately."
                        request={{
                            name: 'My Client Site',
                            domain: 'client.example.com',
                        }}
                        response={{
                            success: true,
                            data: {
                                id: 'site_abc',
                                name: 'My Client Site',
                                domain: 'client.example.com',
                                createdAt: '2026-03-27T09:00:00Z',
                            },
                        }}
                    />

                    <EndpointBlock
                        method="GET"
                        path="/agency/api/users/:userId/websites"
                        description="List all websites associated with a specific client user."
                        response={{
                            success: true,
                            data: [
                                { id: 'site_abc', name: 'My Client Site', domain: 'client.example.com' },
                            ],
                        }}
                    />
                </div>
            </section>

            {/* Code Examples */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Code Examples</h2>
                <p className="text-muted-foreground leading-relaxed">
                    Full agency onboarding flow — create a client user and provision their first website in two API calls.
                </p>

                <div className="space-y-6">
                    <CodeExample
                        language="JavaScript"
                        code={`const BASE = 'https://your-instance.com/api/v1';
const AGENCY_KEY = 'snt_age_xxxxxxxxxxxxx';
const headers = {
  'Authorization': \`Bearer \${AGENCY_KEY}\`,
  'Content-Type': 'application/json',
};

// 1. Create a new client user
const { data: { client, user, tempPassword } } = await fetch(\`\${BASE}/agency/api/users\`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    name: 'Jane Smith',
    email: 'jane@acme.com',
    company: 'Acme Corp',
  }),
}).then(r => r.json());

// 2. Create a website for them
const { data: website } = await fetch(\`\${BASE}/agency/api/users/\${user.id}/websites\`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ name: 'Acme Site', domain: 'acme.com' }),
}).then(r => r.json());

console.log(\`Client \${user.email} created. Website ID: \${website.id}\`);
console.log(\`Temp password: \${tempPassword}\`);`}
                    />

                    <CodeExample
                        language="Python"
                        code={`import requests

BASE = 'https://your-instance.com/api/v1'
headers = {
    'Authorization': 'Bearer snt_age_xxxxxxxxxxxxx',
    'Content-Type': 'application/json',
}

# Create client user
client_res = requests.post(
    f'{BASE}/agency/api/users',
    headers=headers,
    json={'name': 'Jane Smith', 'email': 'jane@acme.com', 'company': 'Acme Corp'},
).json()
user_id = client_res['data']['user']['id']
temp_password = client_res['data']['tempPassword']

# Create website for client
site_res = requests.post(
    f'{BASE}/agency/api/users/{user_id}/websites',
    headers=headers,
    json={'name': 'Acme Site', 'domain': 'acme.com'},
).json()

print(f"Website ID: {site_res['data']['id']}")
print(f"Temp password: {temp_password}")`}
                    />
                </div>
            </section>

            {/* Feature Flags per Client */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Feature Flags per Client</h2>
                <p className="text-muted-foreground leading-relaxed">
                    When creating or updating a client user, pass a <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">features</code> object
                    to control exactly which modules the client can access. Unset flags default to the agency plan's global settings.
                </p>

                <CodeBlock code={JSON.stringify({
                    features: {
                        analytics: true,
                        heatmaps: true,
                        replays: false,
                        funnels: true,
                        automations: false,
                    },
                }, null, 2)} />

                <div className="rounded-lg border bg-card overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/40">
                                <th className="text-left px-4 py-3 font-semibold">Feature</th>
                                <th className="text-left px-4 py-3 font-semibold">Default</th>
                                <th className="text-left px-4 py-3 font-semibold">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-muted-foreground">
                            {[
                                { feature: 'analytics', def: 'true', desc: 'Core analytics dashboard: visitors, pageviews, sessions, referrers, countries' },
                                { feature: 'heatmaps', def: 'true', desc: 'Click, scroll, and move heatmap recordings' },
                                { feature: 'replays', def: 'false', desc: 'Full session replay recordings' },
                                { feature: 'funnels', def: 'false', desc: 'Conversion funnel builder and reporting' },
                                { feature: 'automations', def: 'false', desc: 'Automation rules: triggers, conditions, and actions' },
                            ].map(({ feature, def, desc }) => (
                                <tr key={feature}>
                                    <td className="px-4 py-3"><code className="bg-muted/60 px-1.5 py-0.5 rounded text-xs font-mono">{feature}</code></td>
                                    <td className="px-4 py-3 text-xs">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${def === 'true' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                                            {def}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">{desc}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Resource Limits per Client */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Resource Limits per Client</h2>
                <p className="text-muted-foreground leading-relaxed">
                    Override the agency plan's global resource limits for a specific client by passing a{' '}
                    <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">limits</code> object.
                    Set any value to <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">null</code> to fall back to the agency plan's default.
                </p>

                <CodeBlock code={JSON.stringify({
                    limits: {
                        maxMonthlyEvents: 50000,
                        maxReplays: 500,
                        maxHeatmaps: 10,
                        maxWebsites: 3,
                    },
                }, null, 2)} />

                <div className="rounded-lg border bg-card overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/40">
                                <th className="text-left px-4 py-3 font-semibold">Limit</th>
                                <th className="text-left px-4 py-3 font-semibold">Type</th>
                                <th className="text-left px-4 py-3 font-semibold">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-muted-foreground">
                            {[
                                { key: 'maxMonthlyEvents', type: 'number | null', desc: 'Maximum tracked events per calendar month' },
                                { key: 'maxReplays', type: 'number | null', desc: 'Maximum session recordings stored' },
                                { key: 'maxHeatmaps', type: 'number | null', desc: 'Maximum heatmap pages tracked simultaneously' },
                                { key: 'maxWebsites', type: 'number | null', desc: 'Maximum websites this client can add' },
                            ].map(({ key, type, desc }) => (
                                <tr key={key}>
                                    <td className="px-4 py-3"><code className="bg-muted/60 px-1.5 py-0.5 rounded text-xs font-mono">{key}</code></td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">{type}</td>
                                    <td className="px-4 py-3">{desc}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Client Login Flow */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Client Login Flow</h2>
                <p className="text-muted-foreground leading-relaxed">
                    Once a client user is created, here is the full end-to-end login experience:
                </p>

                <div className="space-y-4">
                    {[
                        { step: '1', title: 'Agency creates the client account', desc: 'Using the dashboard or the API, the agency provisions the client user and optionally their first website.' },
                        { step: '2', title: 'Client receives credentials', desc: 'The agency shares the email address and temporary password securely (e.g. via an encrypted email or onboarding flow).' },
                        { step: '3', title: 'Client visits the platform login page', desc: 'The client navigates to /signin on your white-labeled domain or the Seentics instance URL.' },
                        { step: '4', title: 'Client logs in normally', desc: 'The client enters their email and temporary password. Their account is automatically scoped — they only see their own websites and data.' },
                        { step: '5', title: 'Agency retains full oversight', desc: 'The agency can view, manage, and impersonate any client account from the Agency → Client Accounts dashboard at any time.' },
                    ].map(({ step, title, desc }) => (
                        <div key={step} className="flex gap-4 p-6 rounded-lg border bg-card">
                            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 text-sm font-bold flex items-center justify-center">
                                {step}
                            </span>
                            <div className="space-y-1">
                                <p className="font-semibold">{title}</p>
                                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* White Label */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">White Label</h2>
                <div className="p-6 rounded-lg border bg-card space-y-4">
                    <div className="flex items-center gap-2">
                        <Globe className="w-5 h-5 text-violet-500" />
                        <h3 className="font-semibold text-lg">Fully branded for your clients</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 font-medium">Agency & Agency Pro</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                        On Agency and Agency Pro plans, you can customize the entire platform for your clients so they never see the "Seentics" brand.
                        Navigate to <span className="font-medium text-foreground">Agency → White Label</span> in your dashboard to configure:
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        {[
                            'Brand name and logo shown in the navigation and email notifications',
                            'Primary color applied across the entire UI for your clients',
                            'Custom domain — host the platform on analytics.youragency.com',
                            'Support email shown in help sections and error pages',
                        ].map((item) => (
                            <li key={item} className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 flex-shrink-0" />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* Rate Limits */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Rate Limits</h2>
                <div className="p-6 rounded-lg border bg-card space-y-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Agency API requests are rate-limited to ensure fair usage across all agency accounts:
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        {[
                            { label: '500 requests/minute', desc: 'per agency API key, for all general endpoints' },
                            { label: '100 client creations/hour', desc: 'POST /agency/api/users and POST /user/agency/client-users combined' },
                            { label: '200 website creations/hour', desc: 'POST /agency/api/users/:userId/websites' },
                        ].map(({ label, desc }) => (
                            <li key={label} className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                                <span>
                                    <span className="font-semibold text-foreground">{label}</span> — {desc}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <p className="text-xs text-muted-foreground pt-2 border-t">
                        All responses include{' '}
                        <code className="bg-muted px-1 rounded">X-RateLimit-Remaining</code> and{' '}
                        <code className="bg-muted px-1 rounded">X-RateLimit-Reset</code> headers.
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
    note,
}: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    description: string;
    queryParams?: { name: string; type: string; desc: string }[];
    noAuth?: boolean;
    request?: Record<string, any>;
    response: Record<string, any>;
    note?: string;
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
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${methodBg} ${methodColor}`}>
                        {method}
                    </span>
                    <code className="font-mono text-sm text-foreground">{path}</code>
                    {noAuth && (
                        <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground font-medium">
                            No Auth*
                        </span>
                    )}
                </div>
                <p className="text-sm text-muted-foreground">{description}</p>
                {note && (
                    <div className="pt-2 border-t">
                        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-2 rounded">
                            {note}
                        </p>
                    </div>
                )}
                {queryParams && (
                    <div className="space-y-2 pt-2 border-t">
                        <p className="text-xs font-semibold text-foreground">Query Parameters:</p>
                        <ul className="space-y-1">
                            {queryParams.map((p) => (
                                <li key={p.name} className="text-xs text-muted-foreground">
                                    <code className="bg-muted/50 px-1 rounded">{p.name}</code>{' '}
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
