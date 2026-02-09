'use client';

import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Zap, X } from 'lucide-react';
import { useSubscription, SubscriptionUsage } from '@/hooks/useSubscription';
import { UpgradePlanModal } from './UpgradePlanModal';

interface LimitReachedAlertProps {
  type: keyof SubscriptionUsage;
  title: string;
  message?: string;
  showUpgradeButton?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const defaultMessages = {
  websites: 'You\'ve reached your website limit. Upgrade to add more websites.',
  workflows: 'You\'ve reached your workflow limit. Upgrade to create more automation workflows.',
  funnels: 'You\'ve reached your funnel limit. Upgrade to build more conversion funnels.',
  monthlyEvents: 'You\'ve reached your monthly events limit. Upgrade to track more events.',
  heatmaps: 'You\'ve reached your heatmap limit. Upgrade to record more heatmap sessions.'
};

export const LimitReachedAlert: React.FC<LimitReachedAlertProps> = ({
  type,
  title,
  message,
  showUpgradeButton = true,
  onDismiss,
  className = ''
}) => {
  const { subscription, hasReachedLimit } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);
  const [isDismissed, setIsDismissed] = React.useState(false);

  // Don't show if not at limit or already dismissed
  if (!hasReachedLimit(type) || isDismissed || !subscription) {
    return null;
  }

  const usage = subscription.usage[type];
  const displayMessage = message || defaultMessages[type];

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <>
      <Alert className={`border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 ${className}`}>
        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
        <AlertDescription className="flex items-center justify-between w-full">
          <div className="flex-1">
            <div className="font-medium text-red-800 dark:text-red-200 mb-1">
              {title}
            </div>
            <div className="text-red-600 dark:text-red-400 text-sm">
              {displayMessage}
            </div>
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            {showUpgradeButton && subscription.plan !== 'pro_plus' && (
              <Button
                size="sm"
                onClick={() => setShowUpgradeModal(true)}
                className="bg-red-600 hover:bg-red-700 text-white h-8 px-3 text-xs"
              >
                <Zap className="h-3 w-3 mr-1" />
                Upgrade
              </Button>
            )}
            
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-8 w-8 p-0 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>

      <UpgradePlanModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentPlan={subscription.plan}
        limitType={type}
        currentUsage={usage.current}
        limit={usage.limit}
      />
    </>
  );
};
