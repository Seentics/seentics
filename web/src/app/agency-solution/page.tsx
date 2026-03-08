'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/stores/useAuthStore';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
    Users2, Globe, BarChart2, MousePointer2, Video,
    Filter, Workflow, Palette, Key, ArrowRight,
    CheckCircle2, Sparkles, Shield, Zap, Building2,
    ChevronRight, Code2, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import LandingHeader from '@/components/landing/LandingHeader';
import Footer from '@/components/landing/Footer';
import { cn } from '@/lib/utils';

const FEATURES = [
    {
        icon: Users2,
        color: 'bg-blue-500/10 text-blue-500',
        title: 'Client Management',
        desc: 'Onboard and manage unlimited client accounts from a single agency dashboard. Invite, suspend, or archive clients instantly.',
    },
    {
        icon: Palette,
        color: 'bg-violet-500/10 text-violet-500',
        title: 'White Label Branding',
        desc: 'Replace Seentics with your own brand name, logo, and primary color. Optional custom domain for a fully branded experience.',
    },
    {
        icon: Key,
        color: 'bg-amber-500/10 text-amber-500',
        title: 'Raw API Access',
        desc: 'Generate secure API keys to pull any client\'s analytics, heatmaps, replays, and funnel data into your own custom dashboard.',
    },
    {
        icon: Globe,
        color: 'bg-emerald-500/10 text-emerald-500',
        title: 'Multi-Website Overview',
        desc: 'See all your clients\' websites and their usage in one aggregated view. Spot issues across the portfolio at a glance.',
    },
    {
        icon: Shield,
        color: 'bg-rose-500/10 text-rose-500',
        title: 'Per-Client Feature Toggles',
        desc: 'Show or hide Analytics, Heatmaps, Replays, Funnels, or Automations per client. Give each client only what they need.',
    },
    {
        icon: BarChart2,
        color: 'bg-sky-500/10 text-sky-500',
        title: 'Aggregated Stats',
        desc: 'Total events, sessions, recordings, and heatmap pages rolled up across all your clients with drill-down per site.',
    },
];

const API_ENDPOINTS = [
    { method: 'GET', path: '/raw/analytics/overview', desc: 'Pageviews, sessions, bounce rate' },
    { method: 'GET', path: '/raw/analytics/timeseries', desc: 'Time-series by hour / day / week' },
    { method: 'GET', path: '/raw/analytics/top-pages', desc: 'Most visited pages + duration' },
    { method: 'GET', path: '/raw/analytics/sources', desc: 'Traffic sources & UTM attribution' },
    { method: 'GET', path: '/raw/analytics/geography', desc: 'Visitors by country / region' },
    { method: 'GET', path: '/raw/analytics/devices', desc: 'Browser, OS, device breakdown' },
    { method: 'GET', path: '/raw/heatmaps/clicks', desc: 'Raw click coordinates per page' },
    { method: 'GET', path: '/raw/replays', desc: 'Session list with metadata' },
    { method: 'GET', path: '/raw/funnels', desc: 'Funnel conversion steps' },
];

const ENTERPRISE_FEATURES = [
    'No Base Fee — Pure Pay-As-You-Go',
    '5 Websites Included, then $2/site/mo',
    '100K Events Included, then $1.50/1K events',
    '5K Recordings Included, then $5/1K recordings',
    'Unlimited Heatmaps & Funnels',
    'White Label Branding & Custom Domain',
    'Agency Management Portal',
    'Raw Server-to-Server API (12+ endpoints)',
    'Client-Level Feature Toggles',
    '7-Year Analytics Retention',
    '3-Month Recording Retention',
    'Dedicated Support Channel',
];

const METHOD_COLOR: Record<string, string> = {
    GET: 'text-emerald-500 bg-emerald-500/10',
    POST: 'text-blue-500 bg-blue-500/10',
};

// The global LemonSqueezy interface is already defined elsewhere in the project.
export default function AgencySolutionPage() {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const [loading, setLoading] = useState(false);

    const handleSubscribe = async () => {
        if (!isAuthenticated) {
            window.location.href = '/signup';
            return;
        }
        try {
            setLoading(true);
            const response = await api.post('/user/billing/checkout', {
                plan: 'enterprise',
            });

            if (response.data.success && response.data.data.checkoutUrl) {
                let checkoutUrl = response.data.data.checkoutUrl;
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    if (!checkoutUrl.includes('test=1')) checkoutUrl += (checkoutUrl.includes('?') ? '&' : '?') + 'test=1';
                }
                const successUrl = encodeURIComponent('https://seentics.com');
                if (!checkoutUrl.includes('checkout[success_url]')) {
                    checkoutUrl += (checkoutUrl.includes('?') ? '&' : '?') + `checkout[success_url]=${successUrl}`;
                }

                window.location.href = checkoutUrl;
            }
        } catch {
            toast.error('Failed to initialize checkout. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <LandingHeader />

            {/* Hero */}
            <section className="relative pt-32 pb-20 md:pt-40 md:pb-24 overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-primary/10 blur-[150px] rounded-full" />
                </div>

                <div className="container mx-auto px-6 relative z-10">
                    <div className="max-w-5xl mx-auto text-center">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5 }}
                            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-sm font-bold tracking-wide text-amber-500 mb-8"
                        >
                            <Building2 className="h-4 w-4" />
                            THE ENTERPRISE AGENCY PLATFORM
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, duration: 0.6 }}
                            className="text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1] mb-6"
                        >
                            Analytics{' '}
                            <span className="text-primary">
                                for agencies
                            </span>
                            {' '}that mean business.
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.6 }}
                            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed font-medium"
                        >
                            Manage all your clients' websites from one beautiful dashboard. White-label the entire platform and deliver insights to your clients under your own trusted brand.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3, duration: 0.6 }}
                            className="flex flex-col sm:flex-row items-center justify-center gap-4"
                        >
                            <Button
                                size="lg"
                                onClick={() => document.getElementById('agency-pricing')?.scrollIntoView({ behavior: 'smooth' })}
                                className="h-12 px-8 text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform"
                            >
                                View Enterprise Plan
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Social proof */}
            <section className="border-y border-border/40 bg-card py-6">
                <div className="container mx-auto px-6">
                    <div className="flex flex-wrap items-center justify-center gap-10 text-sm font-medium text-muted-foreground/80">
                        {[
                            'Pay-As-You-Go Pricing',
                            'No Base Fee',
                            'White Label Ready',
                            'Raw Server API',
                            'Dedicated Support',
                        ].map(item => (
                            <div key={item} className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                                {item}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features grid */}
            <section className="py-32">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <motion.h2
                            initial={{ opacity: 0, y: 8 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="text-3xl md:text-4xl font-bold tracking-tight text-foreground"
                        >
                            Built for scale & control.
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0, y: 8 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 }}
                            viewport={{ once: true }}
                            className="text-lg text-muted-foreground mt-4 max-w-xl mx-auto"
                        >
                            The Agency plan extends Seentics into a complete, white-labeled client operations portal.
                        </motion.p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                        {FEATURES.map((f, i) => (
                            <motion.div
                                key={f.title}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.08 }}
                                viewport={{ once: true }}
                                className="bg-card border border-border/60 rounded-3xl p-8 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300"
                            >
                                <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center mb-6', f.color)}>
                                    <f.icon className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground mb-3">{f.title}</h3>
                                <p className="text-base text-muted-foreground leading-relaxed">{f.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Raw API section */}
            <section className="py-32 bg-muted/30 border-y border-border/40">
                <div className="container mx-auto px-6">
                    <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-bold uppercase tracking-widest mb-6">
                                <Code2 className="h-3.5 w-3.5" /> Developer First
                            </div>
                            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-5 leading-tight">
                                Build your own dashboard — <br />or embed ours.
                            </h2>
                            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                                Generate secure API keys to systematically pull any client's analytics, heatmaps, session replay metadata, and funnel conversion data directly into your own product or internal tools.
                            </p>
                            <div className="bg-card border border-border/50 text-sm font-mono text-muted-foreground p-4 rounded-xl mb-6 shadow-sm">
                                $ curl -H "Auth: Bearer sk_age_123" /api/v1/raw/analytics
                            </div>
                        </div>

                        {/* Endpoint list */}
                        <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-xl shadow-foreground/5">
                            <div className="px-6 py-4 border-b border-border/40 bg-zinc-950/5 flex items-center gap-2">
                                <Zap className="h-4 w-4 text-emerald-500" />
                                <span className="text-sm font-bold text-foreground">Available Endpoints</span>
                            </div>
                            <div className="divide-y divide-border/40">
                                {API_ENDPOINTS.map(ep => (
                                    <div key={ep.path} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                                        <span className={cn(
                                            'text-[11px] font-bold px-2 py-0.5 rounded border font-mono shrink-0',
                                            METHOD_COLOR[ep.method] || 'text-muted-foreground bg-muted border-border'
                                        )}>
                                            {ep.method}
                                        </span>
                                        <code className="text-[13px] font-mono font-medium text-foreground flex-1 truncate">{ep.path}</code>
                                    </div>
                                ))}
                                <div className="px-6 py-4 text-sm font-semibold text-emerald-600 bg-emerald-500/5 cursor-pointer flex items-center justify-center gap-2 hover:bg-emerald-500/10 transition-colors">
                                    View Full API Reference <ArrowRight className="h-4 w-4" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Feature control section */}
            <section className="py-32">
                <div className="container mx-auto px-6">
                    <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
                        {/* UI preview mock */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            className="bg-card border border-border rounded-3xl overflow-hidden shadow-2xl shadow-primary/5"
                        >
                            <div className="px-6 py-5 border-b border-border/40 bg-muted/20">
                                <p className="text-base font-bold text-foreground">Client Feature Customization</p>
                                <p className="text-sm text-muted-foreground mt-1">Configure exactly what "Acme Corp" can see</p>
                            </div>
                            <div className="divide-y divide-border/30 p-2">
                                {[
                                    { label: 'Analytics Insights', icon: BarChart2, enabled: true },
                                    { label: 'Click & Scroll Heatmaps', icon: MousePointer2, enabled: true },
                                    { label: 'Session Replays', icon: Video, enabled: false },
                                    { label: 'Conversion Funnels', icon: Filter, enabled: true },
                                    { label: 'No-Code Automations', icon: Workflow, enabled: false },
                                ].map(item => (
                                    <div key={item.label} className="flex items-center justify-between px-6 py-4 hover:bg-muted/10 rounded-xl transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className={cn("p-2 rounded-lg bg-background border", item.enabled ? "border-primary/20 text-primary" : "border-border text-muted-foreground")}>
                                                <item.icon className="h-5 w-5" />
                                            </div>
                                            <span className={cn("text-base font-semibold", item.enabled ? "text-foreground" : "text-muted-foreground")}>{item.label}</span>
                                        </div>
                                        <div className={cn(
                                            'h-6 w-11 rounded-full relative transition-colors shrink-0 shadow-inner',
                                            item.enabled ? 'bg-primary' : 'bg-muted border border-border'
                                        )}>
                                            <div className={cn(
                                                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all',
                                                item.enabled ? 'left-5' : 'left-0.5'
                                            )} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 text-xs font-bold uppercase tracking-widest mb-6">
                                <Shield className="h-3.5 w-3.5" /> Granular Toggles
                            </div>
                            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-5 leading-tight">
                                Show each client <br />exactly what they need.
                            </h2>
                            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                                Toggle Analytics, Heatmaps, Session Replays, Funnels, and Automations on or off per client. Keep dashboards clean and relevant — avoiding noise and unnecessary support questions.
                            </p>
                            <ul className="space-y-4">
                                {[
                                    'Independent visibility rules per client account',
                                    'Changes apply instantly — zero deployment required',
                                    'Clients only see the tools you allow them to use',
                                ].map(point => (
                                    <li key={point} className="flex items-start gap-4 text-base font-medium text-muted-foreground">
                                        <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                        </div>
                                        {point}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing CTA */}
            <section id="agency-pricing" className="py-32 bg-card border-y border-border/40 relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/5 blur-[120px] rounded-full" />
                </div>

                <div className="container mx-auto px-6 relative z-10">
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 tracking-tight">
                            No base fee, usage-based pricing.
                        </h2>
                        <p className="text-lg text-muted-foreground">
                            Everything your agency needs, billed based on usage as you scale client websites.
                        </p>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="max-w-xl mx-auto"
                    >
                        <div className="relative p-8 md:p-10 rounded-3xl bg-background border-2 border-amber-500/50 shadow-2xl shadow-amber-500/10">
                            {/* Badge */}
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-amber-500 text-amber-950 text-sm font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20">
                                <Sparkles className="h-4 w-4" />
                                ENTERPRISE PLAN
                            </div>

                            <div className="text-center mb-8 pt-4">
                                <p className="text-5xl font-extrabold text-foreground mb-4 tracking-tight">
                                    $0 base + usage
                                </p>
                                <p className="text-sm font-medium text-muted-foreground">$2/site/mo · $1.50/1K events · $5/1K recordings. Generous included quotas.</p>
                            </div>

                            <div className="space-y-4 mb-10 bg-muted/20 rounded-2xl p-6 border border-border/40">
                                {ENTERPRISE_FEATURES.map(f => (
                                    <div key={f} className="flex items-start gap-3">
                                        <CheckCircle2 className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                        <span className="text-sm font-semibold text-foreground/90">{f}</span>
                                    </div>
                                ))}
                            </div>

                            <Button
                                onClick={handleSubscribe}
                                disabled={loading}
                                className="w-full h-14 text-base font-bold bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02]"
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Subscribe to Enterprise'}
                            </Button>
                        </div>
                    </motion.div>
                </div>
            </section>

            <Footer />
        </div>
    );
}
