'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Zap, Crown, ArrowRight, X, Sparkles } from 'lucide-react';
import { useAuth } from '@/stores/useAuthStore';
import api from '@/lib/api';

interface UpgradePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: 'free' | 'starter' | 'growth' | 'scale' | 'pro_plus';
  limitType: 'websites' | 'workflows' | 'funnels' | 'heatmaps' | 'replays' | 'monthlyEvents';
  currentUsage: number;
  limit: number;
}

const planDetails = {
  growth: {
    name: 'Growth',
    price: '$29',
    period: 'per month',
    icon: Zap,
    color: 'blue',
    features: [
      "5 Websites",
      "200,000 Monthly Events",
      "500 Session Recordings",
      "10 Active Heatmaps",
      "20 Conversion Funnels",
      "20 Active Automations",
      "1 Year Data Retention",
      "Priority Email Support"
    ],
    buttonText: 'Upgrade to Growth'
  },
  scale: {
    name: 'Scale',
    price: '$89',
    period: 'per month',
    icon: Crown,
    color: 'purple',
    features: [
      "15 Websites",
      "1,000,000 Monthly Events",
      "2,500 Session Recordings",
      "50 Active Heatmaps",
      "100 Active Automations",
      "100 Conversion Funnels",
      "2 Years Data Retention",
      "24/7 Priority Support"
    ],
    buttonText: 'Upgrade to Scale'
  },
  pro_plus: {
    name: 'Pro+',
    price: '$99',
    period: 'per month',
    icon: Sparkles,
    color: 'amber',
    features: [
      "50 Websites",
      "10,000,000 Monthly Events",
      "Unlimited Everything",
      "Custom Data Retention",
      "White-label Reports",
      "Dedicated Success Manager",
      "SSO & Custom Security"
    ],
    buttonText: 'Upgrade to Pro+'
  }
};

const limitMessages = {
  websites: 'You\'ve reached your website limit',
  workflows: 'You\'ve reached your workflow limit',
  funnels: 'You\'ve reached your funnel limit',
  heatmaps: 'You\'ve reached your heatmap limit',
  replays: 'You\'ve reached your session recording limit',
  monthlyEvents: 'You\'ve reached your monthly events limit'
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
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    // Initialize Lemon Squeezy if script is loaded
    if (window.createLemonSqueezy) {
      window.createLemonSqueezy();
    }
  }, [isOpen]);

  // We show all major upgrade plans: Growth, Scale, Pro+
  const upgradePlans = ['growth', 'scale', 'pro_plus'] as const;

  const handleUpgrade = async (plan: 'growth' | 'scale' | 'pro_plus') => {
    if (!isAuthenticated) {
      window.location.href = '/signin';
      return;
    }

    try {
      setLoading(true);
      
      const response = await api.post('/user/billing/checkout', { plan });
      
      if (response.data.success && response.data.data.checkoutUrl) {
        let checkoutUrl = response.data.data.checkoutUrl;
        
        // Debug log to see what the backend returned
        console.log('[DEBUG] Backend checkoutUrl:', checkoutUrl);

        // Force test=1 if on localhost
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          if (!checkoutUrl.includes('test=1')) {
            checkoutUrl += (checkoutUrl.includes('?') ? '&' : '?') + 'test=1';
          }
        }

        // Ensure embed parameter is present for the overlay
        if (!checkoutUrl.includes('embed=1')) {
          checkoutUrl += (checkoutUrl.includes('?') ? '&' : '?') + 'embed=1';
        }

        console.log('[DEBUG] Final Opening URL:', checkoutUrl);

        // Use Lemon Squeezy overlay if available
        if (window.LemonSqueezy) {
          onClose(); // Close modal first
          // Small delay to ensure Dialog has fully cleaned up focus traps/body locking
          setTimeout(() => {
            window.LemonSqueezy?.Url.Open(checkoutUrl);
          }, 100);
        } else {
          // Fallback to direct redirect
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto w-[95vw]">
        <DialogHeader className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute right-0 top-0 h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
          <DialogTitle className="text-3xl font-black text-center mb-2 uppercase tracking-tight">
            Upgrade Your Plan
          </DialogTitle>
          <div className="text-center">
            <p className="text-xl text-red-600 dark:text-red-400 font-black mb-1 uppercase tracking-tight">
              {limitMessages[limitType]}
            </p>
            <p className="text-slate-600 dark:text-slate-400 font-medium">
              You're using <span className="font-bold text-slate-900 dark:text-white">{currentUsage} of {limit}</span> {limitType}. Upgrade to continue growing your business.
            </p>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {upgradePlans.map((planKey) => {
            const plan = planDetails[planKey];
            const PlanIcon = plan.icon;
            const isRecommended = planKey === 'growth';
            const isCurrent = currentPlan.toLowerCase() === planKey;

            return (
              <div key={planKey} className="relative">
                {isRecommended && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-lg">
                      Recommended
                    </div>
                  </div>
                )}
                
                <Card className={`h-full border-2 ${
                  isCurrent ? 'border-primary/20 bg-primary/5' : 
                  isRecommended ? 'border-blue-600 shadow-xl shadow-blue-500/10' : 'border-border/50'
                } hover:shadow-2xl transition-all duration-500 group overflow-hidden`}>
                  <CardHeader className="text-center pb-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-transform group-hover:scale-110 duration-500 ${
                      plan.color === 'blue' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 
                      plan.color === 'purple' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 
                      'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                    }`}>
                      <PlanIcon className="h-7 w-7" />
                    </div>
                    
                    <CardTitle className="text-2xl font-black mb-1">
                      {plan.name}
                    </CardTitle>
                    
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-black tracking-tighter">
                        {plan.price}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-sm font-bold">
                        {plan.period}
                      </span>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-8">
                    <ul className="space-y-4">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <CheckCircle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                             plan.color === 'blue' ? 'text-blue-600' : 
                             plan.color === 'purple' ? 'text-purple-600' : 'text-amber-500'
                          }`} />
                          <span className="text-slate-600 dark:text-slate-400 text-[13px] font-bold leading-tight">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                    
                    <Button
                      onClick={() => handleUpgrade(planKey)}
                      disabled={loading || isCurrent}
                      className={`w-full py-6 font-black uppercase tracking-widest text-[11px] rounded-xl transition-all ${
                        isCurrent 
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed' :
                        plan.color === 'blue'
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20'
                          : plan.color === 'purple'
                          ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/20'
                          : 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20'
                      }`}
                    >
                      {loading ? (
                        'Processing...'
                      ) : isCurrent ? (
                        'Current Plan'
                      ) : (
                        <>
                          {plan.buttonText}
                          <ArrowRight className="ml-2 h-3 w-3" />
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>

        <div className="mt-8 pt-6 border-t border-border/50 text-center">
          <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center justify-center gap-4 flex-wrap">
            <span>✓ Cancel anytime</span>
            <span className="opacity-20">•</span>
            <span>✓ 30-day money back guarantee</span>
            <span className="opacity-20">•</span>
            <span>✓ Instant upgrade</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
