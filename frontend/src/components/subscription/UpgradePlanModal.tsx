'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Zap, Crown, ArrowRight, X } from 'lucide-react';
import { useAuth } from '@/stores/useAuthStore';
import api from '@/lib/api';

interface UpgradePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: 'free' | 'standard' | 'pro';
  limitType: 'websites' | 'workflows' | 'funnels' | 'monthlyEvents';
  currentUsage: number;
  limit: number;
}

const planDetails = {
  standard: {
    name: 'Standard',
    price: '$19',
    period: 'per month',
    icon: Zap,
    color: 'blue',
    features: [
      '5 Websites',
      '100,000 Monthly Events',
      '10 Workflows',
      '10 Funnels',
      'Advanced Analytics',
      'Priority Support',
      'Custom Domains',
      'API Access'
    ]
  },
  pro: {
    name: 'Pro',
    price: '$49',
    period: 'per month',
    icon: Crown,
    color: 'purple',
    features: [
      '10 Websites',
      '500,000 Monthly Events',
      '30 Workflows',
      '30 Funnels',
      'Enterprise Analytics',
      '24/7 Priority Support',
      'White-label Options',
      'Advanced API Access',
      'Team Collaboration'
    ]
  }
};

const limitMessages = {
  websites: 'You\'ve reached your website limit',
  workflows: 'You\'ve reached your workflow limit',
  funnels: 'You\'ve reached your funnel limit',
  monthlyEvents: 'You\'ve reached your monthly events limit'
};

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

  // Determine which plans to show based on current plan
  const getRecommendedPlans = () => {
    if (currentPlan === 'free') {
      return ['standard', 'pro'] as const;
    } else if (currentPlan === 'standard') {
      return ['pro'] as const;
    }
    return [] as const;
  };

  const handleUpgrade = async (plan: 'standard' | 'pro') => {
    if (!isAuthenticated) {
      window.location.href = '/signin';
      return;
    }

    try {
      setLoading(true);
      
      const response = await api.post('/user/billing/checkout', { plan });
      
      if (response.data.success && response.data.data.checkoutUrl) {
        // Redirect to Lemon Squeezy checkout
        window.location.href = response.data.data.checkoutUrl;
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

  const recommendedPlans = getRecommendedPlans();

  if (recommendedPlans.length === 0) {
    return null; // Already on highest plan
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute right-0 top-0 h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
          <DialogTitle className="text-2xl font-bold text-center mb-2">
            Upgrade Your Plan
          </DialogTitle>
          <div className="text-center">
            <p className="text-lg text-red-600 dark:text-red-400 font-semibold mb-2">
              {limitMessages[limitType]}
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              You're using {currentUsage} of {limit} {limitType}. Upgrade to continue growing your business.
            </p>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {recommendedPlans.map((planKey) => {
            const plan = planDetails[planKey];
            const PlanIcon = plan.icon;
            const isRecommended = planKey === 'standard' && currentPlan === 'free';

            return (
              <div key={planKey} className="relative">
                {isRecommended && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-semibold">
                      Recommended
                    </div>
                  </div>
                )}
                
                <Card className={`h-full ${isRecommended ? 'ring-2 ring-blue-600 scale-105' : ''} hover:shadow-lg transition-all duration-300`}>
                  <CardHeader className="text-center pb-4">
                    <div className={`w-16 h-16 rounded flex items-center justify-center mx-auto mb-4 ${
                      plan.color === 'blue' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'
                    }`}>
                      <PlanIcon className="h-8 w-8" />
                    </div>
                    
                    <CardTitle className="text-xl font-bold mb-2">
                      {plan.name}
                    </CardTitle>
                    
                    <div className="mb-4">
                      <span className="text-3xl font-black">
                        {plan.price}
                      </span>
                      <span className="text-slate-600 dark:text-slate-400 ml-2">
                        {plan.period}
                      </span>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-3">
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                          <span className="text-slate-600 dark:text-slate-400 text-sm">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                    
                    <Button
                      onClick={() => handleUpgrade(planKey)}
                      disabled={loading}
                      className={`w-full py-3 font-semibold ${
                        plan.color === 'blue'
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      }`}
                    >
                      {loading ? (
                        'Processing...'
                      ) : (
                        <>
                          Upgrade to {plan.name}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>

        <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>✓ Cancel anytime • ✓ 30-day money back guarantee • ✓ Instant upgrade</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
