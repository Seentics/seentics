'use client';

import React from 'react';
import { useSubscription, SubscriptionUsage } from '@/hooks/useSubscription';
import { UpgradePlanModal } from './UpgradePlanModal';

interface UseUpgradePromptReturn {
  showUpgradeModal: (type: keyof SubscriptionUsage) => void;
  canCreate: (type: keyof SubscriptionUsage) => boolean;
  UpgradeModal: React.FC;
}

export const useUpgradePrompt = (): UseUpgradePromptReturn => {
  const { subscription, hasReachedLimit } = useSubscription();
  const [upgradeModalState, setUpgradeModalState] = React.useState<{
    isOpen: boolean;
    type: keyof SubscriptionUsage;
  }>({
    isOpen: false,
    type: 'websites'
  });

  const showUpgradeModal = React.useCallback((type: keyof SubscriptionUsage) => {
    setUpgradeModalState({
      isOpen: true,
      type
    });
  }, []);

  const canCreate = React.useCallback((type: keyof SubscriptionUsage) => {
    if (!subscription?.usage?.[type]) return false;
    return subscription.usage[type].canCreate;
  }, [subscription]);

  const UpgradeModal: React.FC = React.useCallback(() => {
    if (!subscription || !upgradeModalState.isOpen) return null;

    const usage = subscription.usage[upgradeModalState.type];
    if (!usage) return null;

    return (
      <UpgradePlanModal
        isOpen={upgradeModalState.isOpen}
        onClose={() => setUpgradeModalState(prev => ({ ...prev, isOpen: false }))}
        currentPlan={subscription.plan}
        limitType={upgradeModalState.type}
        currentUsage={usage.current}
        limit={usage.limit}
      />
    );
  }, [subscription, upgradeModalState]);

  return {
    showUpgradeModal,
    canCreate,
    UpgradeModal
  };
};
