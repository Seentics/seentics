'use client';

import { Zap, Code2, Globe, Shield, Terminal, Cpu } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TrackerDocs() {
    return (
        <div className="space-y-12">
            <header className="space-y-4">
                <div className="flex items-center gap-3 text-cyan-500">
                    <Zap className="w-8 h-8" />
                    <h1 className="text-3xl font-bold tracking-tight">Tracker Integration</h1>
                </div>
                <p className="text-xl text-muted-foreground leading-relaxed">
                    Install the lightweight Seentics script to begin collecting insights. Our tracker is
                    built for the modern web—modular, asynchronous, and fast.
                </p>
            </header>

            <section className="space-y-8">
                <h2 className="text-2xl font-semibold">Standard Installation</h2>
                <p className="text-muted-foreground">
                    Paste this script into the <code>{`<head>`}</code> of your website. Replace
                    {' '}<code className="text-foreground">YOUR_SITE_ID</code> with your actual Site ID.
                </p>
                <div className="rounded-xl border bg-slate-950 overflow-hidden shadow-2xl">
                    <div className="px-4 py-2 border-b border-white/10 bg-white/5 flex items-center justify-between">
                        <span className="text-xs font-mono text-white/40 italic flex items-center gap-2">
                            <Code2 className="w-3 h-3" /> main-tracker.html
                        </span>
                    </div>
                    <pre className="p-6 text-sm font-mono overflow-x-auto text-cyan-500">
                        <code>
                            {`<!-- Seentics Analytics -->
<script 
  async 
  src="https://api.seentics.com/track/v2.js" 
  data-site-id="YOUR_SITE_ID"
></script>`}
                        </code>
                    </pre>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Technical Architecture</h2>
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="flex gap-4 p-4 rounded-xl border bg-card">
                            <div className="mt-1"><Cpu className="w-5 h-5 text-primary" /></div>
                            <div className="space-y-1">
                                <h4 className="font-medium">Zero Main-thread Block</h4>
                                <p className="text-xs text-muted-foreground">Ues <code>requestIdleCallback</code> to ensure tracking never interferes with user interactions.</p>
                            </div>
                        </div>
                        <div className="flex gap-4 p-4 rounded-xl border bg-card">
                            <div className="mt-1"><Globe className="w-5 h-5 text-primary" /></div>
                            <div className="space-y-1">
                                <h4 className="font-medium">Batch Processing</h4>
                                <p className="text-xs text-muted-foreground">Auto-aggregates high-frequency events to reduce HTTP overhead and battery drain.</p>
                            </div>
                        </div>
                        <div className="flex gap-4 p-4 rounded-xl border bg-card">
                            <div className="mt-1"><Terminal className="w-5 h-5 text-primary" /></div>
                            <div className="space-y-1">
                                <h4 className="font-medium">SPA Support Built-in</h4>
                                <p className="text-xs text-muted-foreground">Works out of the box with Next.js, React, Vue, and Angular without additional config.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-muted/20 border rounded-2xl p-8 flex flex-col justify-center text-center space-y-4">
                        <Shield className="w-16 h-16 text-primary/40 mx-auto" />
                        <h3 className="font-semibold">Privacy First</h3>
                        <p className="text-sm text-muted-foreground">
                            We never store persistent cookies. Our session matching uses cryptographic signatures
                            that expire every 24 hours.
                        </p>
                    </div>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-2xl font-semibold text-center">Script Options</h2>
                <div className="rounded-xl border bg-card">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/30">
                                <th className="p-4 text-left font-medium">Attribute</th>
                                <th className="p-4 text-left font-medium">Description</th>
                                <th className="p-4 text-left font-medium">Default</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b">
                                <td className="p-4 font-mono text-primary">data-auto-track</td>
                                <td className="p-4 text-muted-foreground">Automatically track pageviews on load</td>
                                <td className="p-4">true</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-4 font-mono text-primary">data-mask-pii</td>
                                <td className="p-4 text-muted-foreground">Strip potential emails/numbers from URLs</td>
                                <td className="p-4">true</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-mono text-primary">data-debug</td>
                                <td className="p-4 text-muted-foreground">Log events to browser console for dev</td>
                                <td className="p-4">false</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
