'use client';

import { Rocket, CheckCircle2, ChevronRight, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function QuickStart() {
    const steps = [
        {
            title: 'Create Your Workspace',
            desc: 'Sign up and create your first website workspace. You will receive a unique Site ID.',
            link: '/signup',
            linkText: 'Register Now'
        },
        {
            title: 'Install the Tracker',
            desc: 'Copy and paste our lightweight tracking script into your site header.',
            link: '/docs/tracker',
            linkText: 'View Instructions'
        },
        {
            title: 'Define Goals',
            desc: 'Set up your first conversion funnel or behavior-based automation.',
            link: '/docs/funnels',
            linkText: 'Learn About Funnels'
        },
        {
            title: 'Analyze Data',
            desc: 'Watch as real-time events begin populating your dashboard.',
            link: '/websites',
            linkText: 'View Dashboard'
        }
    ];

    return (
        <div className="space-y-12">
            <header className="space-y-4">
                <div className="flex items-center gap-3 text-primary">
                    <Rocket className="w-8 h-8" />
                    <h1 className="text-3xl font-bold tracking-tight">Quick Start Guide</h1>
                </div>
                <p className="text-xl text-muted-foreground leading-relaxed">
                    Get Seentics up and running in less than 5 minutes. Follow these simple steps
                    to unlock the power of real-time insights.
                </p>
            </header>

            <div className="relative space-y-12">
                <div className="absolute left-6 top-12 bottom-12 w-px bg-border hidden md:block" />

                {steps.map((step, i) => (
                    <div key={i} className="relative flex flex-col md:flex-row gap-8 items-start group">
                        <div className="md:w-12 md:h-12 w-10 h-10 rounded-full bg-background border-2 border-primary flex items-center justify-center shrink-0 z-10 md:mt-2 shadow-lg shadow-primary/10">
                            <span className="text-lg font-bold text-primary">{i + 1}</span>
                        </div>
                        <div className="flex-1 p-8 rounded border bg-card hover:bg-muted/10 transition-all duration-300">
                            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                {step.title}
                                <CheckCircle2 className="w-5 h-5 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </h3>
                            <p className="text-muted-foreground leading-relaxed mb-6">
                                {step.desc}
                            </p>
                            <Link
                                href={step.link}
                                className="inline-flex items-center gap-2 text-primary font-medium hover:underline"
                            >
                                {step.linkText} <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-8 rounded bg-primary text-white text-center space-y-4 overflow-hidden relative">
                <div className="relative z-10">
                    <h2 className="text-2xl font-bold">You're all set!</h2>
                    <p className="text-primary-foreground/90 font-medium">Ready to explore deep insights?</p>
                    <div className="pt-4">
                        <Link href="/websites" className="px-8 py-3 bg-white text-primary rounded font-bold hover:bg-opacity-90 transition inline-block">
                            Go to Dashboard
                        </Link>
                    </div>
                </div>
                <Rocket className="absolute -bottom-8 -right-8 w-48 h-48 text-white/10 -rotate-12" />
            </div>
        </div>
    );
}
