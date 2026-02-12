'use client';

import { Code2, Terminal, Shield, Lock, Activity, Server } from 'lucide-react';

export default function APIDocs() {
    return (
        <div className="space-y-12">
            <header className="space-y-4">
                <div className="flex items-center gap-3 text-secondary-foreground">
                    <Code2 className="w-8 h-8" />
                    <h1 className="text-3xl font-bold tracking-tight">API Reference</h1>
                </div>
                <p className="text-xl text-muted-foreground leading-relaxed">
                    Automate your workspace, export raw data, and integrate Seentics with your
                    internal tools using our REST API.
                </p>
            </header>

            <section className="space-y-6">
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold">Authentication</h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            API requests are authenticated using Bearer Tokens. You can generate API Keys
                            in your <span className="font-medium text-foreground">Account Settings</span>.
                            Treat these keys as passwords.
                        </p>
                        <div className="p-4 rounded bg-muted/50 border flex items-center gap-3">
                            <Lock className="w-5 h-5 text-primary" />
                            <code className="text-xs">Authorization: Bearer YOUR_API_KEY</code>
                        </div>
                    </div>
                    <div className="p-8 rounded bg-secondary/10 border relative overflow-hidden flex flex-col justify-center">
                        <Server className="absolute -top-4 -right-4 w-32 h-32 text-secondary/40" />
                        <h3 className="font-semibold mb-2">Base URL</h3>
                        <code className="text-lg text-primary font-bold">https://api.seentics.com/v1</code>
                    </div>
                </div>
            </section>

            <section className="space-y-8">
                <h2 className="text-2xl font-semibold">Common Endpoints</h2>

                <Endpoint
                    method="GET"
                    path="/websites"
                    desc="Retrieve a list of all websites you have access to."
                />
                <Endpoint
                    method="GET"
                    path="/analytics/summary"
                    desc="Fetch high-level metrics for a specific time range."
                />
                <Endpoint
                    method="POST"
                    path="/notifications/send"
                    desc="Trigger a custom in-app notification for a specific user ID."
                />
            </section>

            <div className="rounded border-2 border-dashed p-12 text-center space-y-4">
                <Activity className="w-12 h-12 text-muted-foreground mx-auto" />
                <h3 className="text-xl font-semibold">Real-time Webhooks</h3>
                <p className="text-muted-foreground max-w-lg mx-auto">
                    Coming Soon: Receive instant updates when a user converts or a major traffic spike occurs.
                    Sign up for our developer beta to gain early access.
                </p>
            </div>
        </div>
    );
}

function Endpoint({ method, path, desc }: { method: string, path: string, desc: string }) {
    const color = method === 'GET' ? 'text-blue-500' : 'text-green-500';
    return (
        <div className="p-6 rounded border bg-card space-y-4">
            <div className="flex items-center gap-3">
                <span className={`font-black text-xs px-2 py-1 rounded bg-muted ${color}`}>{method}</span>
                <code className="text-sm font-semibold">{path}</code>
            </div>
            <p className="text-sm text-muted-foreground">{desc}</p>
        </div>
    );
}
