'use client';

import React, { useState } from 'react';
import { CheckCircle, Zap, Crown, Rocket, Star, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { createCheckout } from '@/lib/billing-api';
import { toast } from 'sonner';

const plans = [
    {
        id: 'starter',
        name: 'Starter',
        price: '0',
        description: 'Perfect for exploring our unique analytics power.',
        icon: Star,
        color: 'blue',
        features: [
            '10,000 monthly events',
            '1 conversion funnel',
            '1 automation rule',
            'Basic analytics dashboard',
            'No Heatmap data',
            '1 connected domain',
            'Community support'
        ]
    },
    {
        id: 'growth',
        name: 'Growth',
        price: '15',
        description: 'Scaling fast? Get the deep insights you need.',
        icon: Zap,
        color: 'emerald',
        recommended: true,
        features: [
            '200,000 monthly events',
            '5 conversion funnels',
            '5 automation rules',
            '1 Heatmap per site',
            'Advanced funnel insights',
            'Email support',
            '3 connected domains'
        ]
    },
    {
        id: 'scale',
        name: 'Scale',
        price: '39',
        description: 'Advanced features for scaling agencies and businesses.',
        icon: Rocket,
        color: 'purple',
        features: [
            '1,000,000 monthly events',
            'Unlimited funnels',
            'Unlimited automation rules',
            'Unlimited Heatmaps',
            'Custom event tracking',
            'Priority email support',
            '10 connected domains',
            'CSV data export'
        ]
    },
    {
        id: 'pro_plus',
        name: 'Pro+',
        price: '99',
        description: 'Elite features for high-traffic enterprises.',
        icon: Crown,
        color: 'amber',
        features: [
            '10,000,000 monthly events',
            'Unlimited funnels & rules',
            'Unlimited Heatmaps',
            'Multi-user team access',
            'Premium chat/email support',
            'Custom integrations',
            'Priority roadmap influence',
            'Unlimited domains'
        ]
    }
];

export default function PricingPage() {
    const [isYearly, setIsYearly] = useState(false);
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

    const handleCheckout = async (planId: string) => {
        try {
            setLoadingPlan(planId);
            if (planId === 'starter') {
                window.location.href = '/websites'; // or dashboard
                return;
            }
            const checkoutUrl = await createCheckout(planId);
            window.location.href = checkoutUrl;
        } catch (error) {
            toast.error('Failed to initialize checkout. Please try again.');
        } finally {
            setLoadingPlan(null);
        }
    };

    return (
        <div className="min-h-screen bg-background py-20 px-6">
            <div className="max-w-7xl mx-auto">
                <div className="text-center space-y-4 mb-20 animate-in fade-in slide-in-from-top-4 duration-700">
                    <h1 className="text-5xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white">
                        Simple <br />
                        <span className="text-primary italic">pricing.</span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl mx-auto font-medium">
                        Start for free. No credit card required. Upgrade when you're ready for more power.
                    </p>

                    <div className="flex items-center justify-center gap-4 pt-8">
                        <Label htmlFor="billing-toggle" className={isYearly ? 'text-muted-foreground' : 'font-bold'}>Monthly</Label>
                        <Switch
                            id="billing-toggle"
                            checked={isYearly}
                            onCheckedChange={setIsYearly}
                        />
                        <Label htmlFor="billing-toggle" className={!isYearly ? 'text-muted-foreground' : 'font-bold'}>
                            Yearly <span className="text-emerald-500 ml-1">(-20%)</span>
                        </Label>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {plans.map((plan, index) => {
                        const Icon = plan.icon;
                        const price = isYearly ? Math.floor(parseInt(plan.price) * 0.8) : plan.price;

                        return (
                            <Card
                                key={plan.id}
                                className={`relative border-muted-foreground/10 bg-background/50 backdrop-blur-sm rounded-[2.5rem] p-2 flex flex-col transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 group ${plan.recommended ? 'ring-2 ring-primary shadow-xl shadow-primary/10' : ''
                                    }`}
                                style={{ animationDelay: `${index * 100}ms` }}
                            >
                                {plan.recommended && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                        <Badge className="bg-primary text-white font-black text-[10px] px-4 py-1 rounded-full uppercase tracking-widest border-0">
                                            Most Popular
                                        </Badge>
                                    </div>
                                )}

                                <CardHeader className="pb-8">
                                    <div className={`h-14 w-14 rounded bg-card border border-border flex items-center justify-center mb-6 text-primary group-hover:scale-110 transition-transform`}>
                                        <Icon size={28} />
                                    </div>
                                    <CardTitle className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{plan.name}</CardTitle>
                                    <CardDescription className="text-sm font-medium leading-relaxed">{plan.description}</CardDescription>
                                </CardHeader>

                                <CardContent className="flex-1 space-y-8">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-5xl font-black tracking-tight">${price}</span>
                                        <span className="text-muted-foreground font-bold text-sm uppercase tracking-widest">{plan.id === 'starter' ? '/forever' : '/mo'}</span>
                                    </div>

                                    <ul className="space-y-4">
                                        {plan.features.map((feature, i) => (
                                            <li key={i} className="flex items-center gap-3 text-sm font-semibold text-slate-600 dark:text-slate-400">
                                                <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>

                                    <Button
                                        variant={plan.recommended ? "brand" : "outline"}
                                        disabled={loadingPlan !== null}
                                        onClick={() => handleCheckout(plan.id)}
                                        className={`w-full h-16 rounded-xl font-bold text-lg gap-2 transition-all ${plan.recommended ? 'shadow-xl shadow-primary/25' : 'hover:bg-slate-100 dark:hover:bg-slate-900'
                                            }`}
                                    >
                                        {loadingPlan === plan.id ? (
                                            <Loader2 size={24} className="animate-spin" />
                                        ) : (
                                            <>
                                                {plan.id === 'starter' ? 'Start for free' : plan.id === 'growth' ? 'Join Growth plan' : 'Select Plan'}
                                                <ArrowRight size={20} />
                                            </>
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* FAQ or Comparison Teaser */}
                <div className="mt-32 text-center">
                    <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-xs mb-8">Trusted by teams at</p>
                    <div className="flex flex-wrap justify-center items-center gap-12 opacity-40 grayscale contrast-200">
                        {/* Fake Logos for UI excellence */}
                        <div className="text-2xl font-black italic">TECH FLOW</div>
                        <div className="text-2xl font-black tracking-tighter">DATA<span className="text-primary italic">CORE</span></div>
                        <div className="text-2xl font-black underline decoration-emerald-500 underline-offset-4">SAAS.LY</div>
                        <div className="text-2xl font-black tracking-widest">GROWTH</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
