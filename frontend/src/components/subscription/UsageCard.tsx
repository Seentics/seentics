'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, TrendingUp, Zap, Infinity } from 'lucide-react';
import { useSubscription, SubscriptionUsage } from '@/hooks/useSubscription';
import { UpgradePlanModal } from './UpgradePlanModal';
import { hasFeature, isOpenSource } from '@/lib/features';

interface UsageCardProps {
  type: keyof SubscriptionUsage;
  title: string;
  icon: React.ElementType;
  description?: string;
}

const typeLabels = {
  websites: 'Websites',
  workflows: 'Workflows', 
  funnels: 'Funnels',
  monthlyEvents: 'Monthly Events',
  heatmaps: 'Heatmaps',
  replays: 'Session Recordings'
};

export const UsageCard: React.FC<UsageCardProps> = ({
  type,
  title,
  icon: Icon,
  description
}) => {
  const { subscription, hasReachedLimit, isNearLimit, getUsagePercentage } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);

  // Hide usage limits in open source version
  if (!hasFeature('USAGE_LIMITS_UI')) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {title}
          </CardTitle>
          <Infinity className="h-4 w-4 text-green-600 dark:text-green-400" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                ∞
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Unlimited
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Open source deployment - no limits applied
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!subscription?.usage?.[type]) {
    return null;
  }

  const usage = subscription.usage[type];
  const percentage = getUsagePercentage(type);
  const isAtLimit = hasReachedLimit(type);
  const isNearLimitThreshold = isNearLimit(type, 80);

  const getProgressColor = () => {
    if (isAtLimit) return 'bg-red-500';
    if (isNearLimitThreshold) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusColor = () => {
    if (isAtLimit) return 'text-red-600 dark:text-red-400';
    if (isNearLimitThreshold) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <>
      <Card className={`transition-all duration-300 ${isAtLimit ? 'border-red-200 dark:border-red-800' : isNearLimitThreshold ? 'border-yellow-200 dark:border-yellow-800' : ''}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {title}
          </CardTitle>
          {(isAtLimit || isNearLimitThreshold) && (
            <AlertTriangle className={`h-4 w-4 ${getStatusColor()}`} />
          )}
        </CardHeader>
        
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {formatNumber(usage.current)}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                of {formatNumber(usage.limit)}
              </span>
            </div>
            
            <Progress 
              value={percentage} 
              className="w-full h-2"
              // Custom progress color based on usage
            />
            
            <div className="flex items-center justify-between text-xs">
              <span className={getStatusColor()}>
                {percentage.toFixed(0)}% used
              </span>
              {subscription.plan !== 'pro_plus' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUpgradeModal(true)}
                  className="h-6 px-2 text-xs"
                >
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Upgrade
                </Button>
              )}
            </div>
            
            {description && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
            
            {isAtLimit && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs">
                    <p className="font-medium text-red-800 dark:text-red-200 mb-1">
                      Limit Reached
                    </p>
                    <p className="text-red-600 dark:text-red-400 mb-2">
                      You can't create more {typeLabels[type].toLowerCase()}. Upgrade your plan to continue.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setShowUpgradeModal(true)}
                      className="bg-red-600 hover:bg-red-700 text-white h-7 px-3 text-xs"
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      Upgrade Now
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
