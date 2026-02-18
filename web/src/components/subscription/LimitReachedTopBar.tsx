'use client';

import React from 'react';
import { X, AlertTriangle, Crown, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { UpgradePlanModal } from './UpgradePlanModal';
import { isEnterprise } from '@/lib/features';

interface LimitReachedTopBarProps {
  limitType?: 'websites' | 'workflows' | 'funnels' | 'monthlyEvents';
  onClose?: () => void;
  className?: string;
}

export const LimitReachedTopBar: React.FC<LimitReachedTopBarProps> = ({
  limitType,
  onClose,
  className = ''
}) => {
  if (!isEnterprise) return null;
  const { subscription, hasReachedLimit } = useSubscription();
  const [isVisible, setIsVisible] = React.useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);

  // Auto-detect which limit is reached if not specified
  const getReachedLimit = () => {
    if (limitType && hasReachedLimit(limitType)) {
      return limitType;
    }
    
    // Check all limits to find which one is reached
    if (!subscription) return undefined;
    const limits: Array<keyof typeof subscription.usage> = ['websites', 'workflows', 'funnels', 'monthlyEvents'];
    return limits.find(limit => hasReachedLimit(limit));
  };

  const reachedLimit = getReachedLimit();

  // Don't show if no limit is reached or if manually closed
  if (!subscription || !reachedLimit || !isVisible) {
    return null;
  }

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  const handleUpgrade = () => {
    console.log('Upgrade button clicked');
    try {
      // Use window.location.href to navigate in the same tab to avoid popup blockers
      window.location.href = 'https://seentics.lemonsqueezy.com/buy/39b59b36-94d3-40a5-821c-e31b6836345c';
    } catch (error) {
      console.error('Error opening checkout URL:', error);
    }
  };

  const limitMessages = {
    websites: {
      title: 'Website limit reached',
      description: 'You\'ve reached your website limit. Upgrade to create more websites.',
      icon: <AlertTriangle className="h-4 w-4" />
    },
    workflows: {
      title: 'Workflow limit reached', 
      description: 'You\'ve reached your workflow limit. Upgrade to create more workflows.',
      icon: <AlertTriangle className="h-4 w-4" />
    },
    funnels: {
      title: 'Funnel limit reached',
      description: 'You\'ve reached your funnel limit. Upgrade to create more funnels.',
      icon: <AlertTriangle className="h-4 w-4" />
    },
    monthlyEvents: {
      title: 'Monthly events limit reached',
      description: 'You\'ve reached your monthly events limit. Upgrade for higher limits.',
      icon: <AlertTriangle className="h-4 w-4" />
    },
    heatmaps: {
      title: 'Heatmap limit reached',
      description: 'You\'ve reached your heatmap limit. Upgrade to record more sessions.',
      icon: <AlertTriangle className="h-4 w-4" />
    }
  };

  const message = limitMessages[reachedLimit];
  const PlanIcon = subscription.plan === 'pro_plus' ? Crown : Zap;

  return (
    <>
      <div className={`bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-amber-200 dark:border-amber-800 ${className}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 text-amber-600 dark:text-amber-400">
                {message.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  {message.title}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  {message.description}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {subscription.plan !== 'pro_plus' && (
                <Button
                  size="sm"
                  onClick={handleUpgrade}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1.5 h-auto"
                >
                  <PlanIcon className="h-3 w-3 mr-1" />
                  Upgrade
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 h-auto p-1"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showUpgradeModal && subscription && (
        <UpgradePlanModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          currentPlan={subscription.plan}
          limitType={reachedLimit}
          currentUsage={subscription.usage[reachedLimit].current}
          limit={subscription.usage[reachedLimit].limit}
        />
      )}
    </>
  );
};
