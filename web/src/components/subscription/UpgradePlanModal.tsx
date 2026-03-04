'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Zap, Crown, ArrowRight, X, Sparkles, Rocket } from 'lucide-react';
import { useAuth } from '@/stores/useAuthStore';
import api from '@/lib/api';
import { isEnterprise } from '@/lib/features';
import { cn } from '@/lib/utils';

interface UpgradePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: 'free' | 'basic' | 'pro' | 'enterprise';
  limitType: 'websites' | 'workflows' | 'funnels' | 'heatmaps' | 'replays' | 'monthlyEvents';
  currentUsage: number;
  limit: number;
}

const planDetails = {
  basic: {
    name: 'Basic',
    price: '$15',
    period: '/mo',
    icon: Rocket,
    color: 'teal',
    features: [
      "3 Websites",
      "100,000 Monthly Events", 
      "3,000 Session Recordings",
      "20 Heatmap Pages",
      "10 Funnels",
      "10 Automations",
      "1 Month Recording Retention",
      "1 Year Analytics Retention",
      "Email Support"
    ],
    buttonText: 'Upgrade to Basic'
  },
  pro: {
    name: 'Pro',
    price: '$49',
    period: '/mo',
    icon: Crown,
    color: 'purple',
    features: [
      "15 Websites",
      "1,000,000 Monthly Events",
      "25,000 Session Recordings",
      "Unlimited Heatmaps",
      "Unlimited Funnels",
      "Unlimited Automations",
      "3 Month Recording Retention",
      "3 Year Analytics Retention",
      "Priority Support"
    ],
    buttonText: 'Upgrade to Pro'
  },
  enterprise: {
    name: 'Enterprise',
    price: '$0 base + usage',
    period: 'Pay-as-you-go',
    icon: Sparkles,
    color: 'amber',
    features: [
      'No Base Fee — Pure Pay-As-You-Go',
      '5 Websites Included, then $2/site/mo',
      '100K Events Included, then $1.50/1K events',
      '5K Recordings Included, then $5/1K recordings',
      "Unlimited Heatmaps",
      "Unlimited Funnels & Automations",
      "7 Year Analytics Retention",
      "3 Month Recording Retention",
      "White Label & Client Management",
      "Dedicated Support"
    ],
    buttonText: 'Start Usage-Based'
  }
};

const limitMessages: Record<string, string> = {
  websites: 'You\'ve reached your website limit',
  workflows: 'You\'ve reached your automation limit',
  funnels: 'You\'ve reached your funnel limit',
  heatmaps: 'You\'ve reached your heatmap limit',
  replays: 'You\'ve reached your session recording limit',
  monthlyEvents: 'You\'ve reached your monthly events limit'
};

const limitLabels: Record<string, string> = {
  websites: 'websites',
  workflows: 'automations',
  funnels: 'funnels',
  heatmaps: 'heatmap pages',
  replays: 'session recordings',
  monthlyEvents: 'monthly events',
};

const formatNum = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString();
};

declare global {
  interface Window {
    createLemonSqueezy?: () => void;
    LemonSqueezy?: {
      Url: {
        Open: (url: string) => void;
      };
      Setup: () => void;
    };
  }
}

export const UpgradePlanModal: React.FC<UpgradePlanModalProps> = ({
  isOpen,
  onClose,
  currentPlan,
  limitType,
  currentUsage,
  limit
}) => {
  if (!isEnterprise) return null;

  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (window.createLemonSqueezy) {
      window.createLemonSqueezy();
    }
  }, [isOpen]);

  // HIDDEN: 'enterprise' removed — uncomment to re-enable
  const upgradePlans = ['basic', 'pro'] as const;

  const handleUpgrade = async (plan: 'basic' | 'pro' /* | 'enterprise' */) => {
    if (!isAuthenticated) {
      window.location.href = '/signin';
      return;
    }

    try {
      setLoading(true);

      const response = await api.post('/user/billing/checkout', { plan });

      if (response.data.success && response.data.data.checkoutUrl) {
        let checkoutUrl = response.data.data.checkoutUrl;

        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          if (!checkoutUrl.includes('test=1')) {
            checkoutUrl += (checkoutUrl.includes('?') ? '&' : '?') + 'test=1';
          }
        }

        if (!checkoutUrl.includes('embed=1')) {
          checkoutUrl += (checkoutUrl.includes('?') ? '&' : '?') + 'embed=1';
        }

        const successUrl = encodeURIComponent(`${window.location.origin}/websites`);
        if (!checkoutUrl.includes('checkout[success_url]')) {
          checkoutUrl += `&checkout[success_url]=${successUrl}`;
        }

        if (window.LemonSqueezy) {
          onClose();
          setTimeout(() => {
            window.LemonSqueezy?.Url.Open(checkoutUrl);
          }, 100);
        } else {
          window.location.href = checkoutUrl;
        }
      } else {
        throw new Error(response.data.message || 'Failed to create checkout session');
      }
    } catch (error: any) {
      console.error('Upgrade error:', error);
      alert(error.response?.data?.message || 'Failed to start upgrade process. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const colorMap: Record<string, { bg: string; hover: string; check: string; border: string }> = {
    teal: { bg: 'bg-teal-500', hover: 'hover:bg-teal-600', check: 'text-teal-500', border: 'border-teal-500' },
    indigo: { bg: 'bg-indigo-500', hover: 'hover:bg-indigo-600', check: 'text-indigo-500', border: 'border-indigo-500' },
    purple: { bg: 'bg-purple-500', hover: 'hover:bg-purple-600', check: 'text-purple-500', border: 'border-purple-500' },
    amber: { bg: 'bg-amber-500', hover: 'hover:bg-amber-600', check: 'text-amber-500', border: 'border-amber-500' },
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto w-[95vw]">
        <DialogHeader className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute right-0 top-0 h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
          <DialogTitle className="text-xl font-semibold text-center mb-2">
            Upgrade Your Plan
          </DialogTitle>
          <div className="text-center">
            <p className="text-sm text-red-500 font-medium mb-1">
              {limitMessages[limitType]}
            </p>
            <p className="text-xs text-muted-foreground">
              You're using{' '}
              <span className="font-medium text-foreground">{formatNum(currentUsage)} of {formatNum(limit)}</span>{' '}
              {limitLabels[limitType] ?? limitType}. Upgrade to continue growing.
            </p>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
          {upgradePlans.map((planKey) => {
            const plan = planDetails[planKey];
            const PlanIcon = plan.icon;
            const isRecommended = planKey === 'basic';
            const isCurrent = currentPlan === planKey;
            const colors = colorMap[plan.color];

            return (
              <div key={planKey} className="relative">
                {isRecommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full text-white", colors.bg)}>
                      Recommended
                    </span>
                  </div>
                )}

                <div className={cn(
                  "h-full flex flex-col rounded-xl border bg-card p-6 transition-all duration-300",
                  isCurrent ? 'border-primary/20 bg-primary/5' :
                  isRecommended ? `border-2 ${colors.border} shadow-md` : 'border-border/60'
                )}>
                  <div className="text-center mb-5">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3", `${colors.bg}/10`)}>
                      <PlanIcon className={cn("h-5 w-5", colors.check)} />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-3xl font-bold tracking-tight">{plan.price}</span>
                      <span className="text-sm text-muted-foreground">{plan.period}</span>
                    </div>
                  </div>

                  <ul className="space-y-2.5 flex-1 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", colors.check)} />
                        <span className="text-xs text-muted-foreground leading-tight">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleUpgrade(planKey)}
                    disabled={loading || isCurrent}
                    className={cn(
                      "w-full gap-1.5 text-xs font-medium",
                      !isCurrent && `${colors.bg} ${colors.hover} text-white shadow-md`
                    )}
                    variant={isCurrent ? "outline" : "default"}
                  >
                    {loading ? 'Processing...' : isCurrent ? 'Current Plan' : (
                      <>{plan.buttonText} <ArrowRight className="h-3.5 w-3.5" /></>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-border/50 text-center">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-4 flex-wrap">
            <span>Cancel anytime</span>
            <span className="opacity-30">|</span>
            <span>30-day money back guarantee</span>
            <span className="opacity-30">|</span>
            <span>Instant upgrade</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
