'use client';

import { CreditCard, ShieldCheck, Zap, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function BillingDocs() {
    return (
        <div className="space-y-12">
            <header className="space-y-4">
                <div className="flex items-center gap-3 text-green-500">
                    <CreditCard className="w-8 h-8" />
                    <h1 className="text-3xl font-bold tracking-tight">Billing & Plans</h1>
                </div>
                <p className="text-xl text-muted-foreground leading-relaxed">
                    Seentics grows with you. Choose the plan that fits your traffic and automation needs.
                </p>
            </header>

            <section className="space-y-6">
                <h2 className="text-2xl font-semibold text-foreground">Usage Tracking</h2>
                <p className="text-muted-foreground leading-relaxed">
                    Every plan has specific soft and hard limits. You can monitor your current usage in real-time
                    on the <span className="font-medium text-foreground italic">Billing Dashboard</span> for each website.
                </p>

                <div className="grid md:grid-cols-3 gap-6">
                    <UsageCard icon={Activity} title="Events" desc="Total pageviews and custom tracked events." />
                    <UsageCard icon={Filter} title="Funnels" desc="Active conversion journeys being tracked." />
                    <UsageCard icon={Workflow} title="Workflows" desc="Running behavioral automation sequences." />
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-2xl font-semibold">Tiered Limits</h2>
                <div className="rounded border bg-card overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted/50 border-b">
                                <th className="p-4 text-left font-semibold">Resource</th>
                                <th className="p-4 text-center font-semibold">Starter ($0)</th>
                                <th className="p-4 text-center font-semibold">Growth ($29)</th>
                                <th className="p-4 text-center font-semibold text-primary">Pro ($79)</th>
                                <th className="p-4 text-center font-semibold">Enterprise ($399)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b">
                                <td className="p-4 font-medium">Monthly Events</td>
                                <td className="p-4 text-center text-muted-foreground">10K</td>
                                <td className="p-4 text-center text-muted-foreground">200K</td>
                                <td className="p-4 text-center font-bold text-primary">2M</td>
                                <td className="p-4 text-center text-muted-foreground">15M</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-4 font-medium">Session Recordings</td>
                                <td className="p-4 text-center text-muted-foreground">100</td>
                                <td className="p-4 text-center text-muted-foreground">10K</td>
                                <td className="p-4 text-center font-bold text-primary">50K</td>
                                <td className="p-4 text-center text-muted-foreground">200K</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-4 font-medium">Funnels</td>
                                <td className="p-4 text-center text-muted-foreground">1</td>
                                <td className="p-4 text-center text-muted-foreground">10</td>
                                <td className="p-4 text-center font-bold text-primary">Unlimited</td>
                                <td className="p-4 text-center text-muted-foreground">Unlimited</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-4 font-medium">Analytics Retention</td>
                                <td className="p-4 text-center text-muted-foreground">30 Days</td>
                                <td className="p-4 text-center text-muted-foreground">2 Years</td>
                                <td className="p-4 text-center font-bold text-primary">5 Years</td>
                                <td className="p-4 text-center text-muted-foreground">7 Years</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-medium">Recording Retention</td>
                                <td className="p-4 text-center text-muted-foreground">30 Days</td>
                                <td className="p-4 text-center text-muted-foreground">3 Months</td>
                                <td className="p-4 text-center font-bold text-primary">3 Months</td>
                                <td className="p-4 text-center text-muted-foreground">3 Months</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="p-10 rounded bg-card border flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="space-y-3 max-w-xl text-center md:text-left">
                    <h3 className="text-2xl font-bold">Managing Subscriptions</h3>
                    <p className="text-muted-foreground">
                        Update payment methods, download invoices, and upgrade tiers instantly through
                        our secure checkout powered by Lemon Squeezy.
                    </p>
                </div>
                <Link href="/pricing" className="px-8 py-3 bg-primary text-primary-foreground rounded font-bold hover:scale-105 transition active:scale-95 shadow-xl shadow-primary/20 shrink-0">
                    View Upgrade Options
                </Link>
            </section>
        </div>
    );
}

function UsageCard({ icon: Icon, title, desc }: any) {
    return (
        <div className="p-6 rounded border bg-muted/20 space-y-2">
            <Icon className="w-5 h-5 text-primary mb-2" />
            <h4 className="font-semibold">{title}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
        </div>
    );
}

const Activity = (props: any) => (<svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>);
const Filter = (props: any) => (<svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>);
const Workflow = (props: any) => (<svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><path d="M10 6h4" /><path d="M6 10v4" /><path d="M14 10V6" /><path d="M10 18H6" /></svg>);
