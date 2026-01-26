'use client';

import { ShieldCheck, Lock, EyeOff, Scale, FileText, CheckCircle2 } from 'lucide-react';

export default function PrivacyDocs() {
    return (
        <div className="space-y-12">
            <header className="space-y-4">
                <div className="flex items-center gap-3 text-blue-500">
                    <ShieldCheck className="w-8 h-8" />
                    <h1 className="text-3xl font-bold tracking-tight">Privacy & Security</h1>
                </div>
                <p className="text-xl text-muted-foreground leading-relaxed">
                    At Seentics, privacy isn't a feature—it's the foundation. We build tools that respect
                    user rights and simplify regulatory compliance.
                </p>
            </header>

            <section className="grid sm:grid-cols-2 gap-8">
                <div className="space-y-4 p-8 rounded-3xl border bg-card/50">
                    <EyeOff className="w-6 h-6 text-primary" />
                    <h2 className="text-xl font-semibold">Zero PII Storage</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        By default, Seentics masks all potential personally identifiable information.
                        IP addresses are hashed and never stored in plain text, and we automatically
                        strip emails from URL parameters.
                    </p>
                </div>
                <div className="space-y-4 p-8 rounded-3xl border bg-card/50">
                    <Lock className="w-6 h-6 text-primary" />
                    <h2 className="text-xl font-semibold">Data Encryption</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        All data is encrypted at rest using AES-256 and in transit via TLS 1.3.
                        Our infrastructure is isolated and monitored 24/7 for security anomalies.
                    </p>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Compliance Readiness</h2>
                <div className="space-y-2">
                    {[
                        { title: 'GDPR (Europe)', desc: 'Full support for Right to be Forgotten and Data Portability requests.' },
                        { title: 'CCPA (California)', desc: 'Clear opt-out mechanisms and transparent data usage disclosures.' },
                        { title: 'PECR (UK)', desc: 'Cookie-less tracking options to avoid complex consent banners.' },
                    ].map((law, i) => (
                        <div key={i} className="flex gap-4 p-4 rounded-xl hover:bg-muted/30 transition-colors border-b last:border-0">
                            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-medium">{law.title}</h4>
                                <p className="text-sm text-muted-foreground">{law.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="p-8 rounded-2xl bg-muted/20 border-2 border-dashed text-center space-y-4">
                <Scale className="w-10 h-10 text-muted-foreground mx-auto" />
                <h3 className="text-xl font-semibold">Data Processing Agreement</h3>
                <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                    Need a signed DPA for your legal team? Our standard DPA is integrated into our Terms of Service
                    and applies to all customers automatically.
                </p>
                <a href="/terms" className="inline-flex items-center gap-2 text-primary font-medium hover:underline">
                    Read Terms & DPA <FileText className="w-4 h-4" />
                </a>
            </section>
        </div>
    );
}
