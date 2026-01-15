'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, Workflow, Filter, BarChart3, Crown, Zap, Infinity } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { UsageCard } from './UsageCard';
import { Button } from '@/components/ui/button';
import { UpgradePlanModal } from './UpgradePlanModal';
import { hasFeature, isOpenSource } from '@/lib/features';

export const UsageDashboard: React.FC = () => {
  const { subscription, loading } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="space-y-0 pb-2">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Show open source version
  if (!hasFeature('USAGE_LIMITS_UI')) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Infinity className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span>Open Source</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              You're running the open source version with unlimited usage.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UsageCard type="websites" title="Websites" icon={Globe} />
          <UsageCard type="monthlyEvents" title="Monthly Events" icon={BarChart3} />
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-slate-500 dark:text-slate-400">
            Unable to load subscription data
          </p>
        </CardContent>
      </Card>
    );
  }

  const planColors = {
    free: 'text-slate-600 dark:text-slate-400',
    standard: 'text-blue-600 dark:text-blue-400',
    pro: 'text-purple-600 dark:text-purple-400'
  };

  const planIcons = {
    free: BarChart3,
    standard: Zap,
    pro: Crown
  };

  const PlanIcon = planIcons[subscription.plan];

  return (
    <div className="space-y-6">
      {/* Plan Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PlanIcon className={`h-5 w-5 ${planColors[subscription.plan]}`} />
              <span className="capitalize">{subscription.plan} Plan</span>
            </div>
            {subscription.plan !== 'pro' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUpgradeModal(true)}
                className="text-xs"
              >
                Upgrade
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {subscription.plan === 'free' && 'Perfect for getting started with basic features'}
            {subscription.plan === 'standard' && 'Great for growing businesses with advanced features'}
            {subscription.plan === 'pro' && 'Enterprise-grade features for scaling teams'}
          </p>
        </CardContent>
      </Card>

      {/* Usage Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <UsageCard
          type="websites"
          title="Websites"
          icon={Globe}
          description="Active websites in your account"
        />
        
        <UsageCard
          type="workflows"
          title="Workflows"
          icon={Workflow}
          description="Automation workflows created"
        />
        
        <UsageCard
          type="funnels"
          title="Funnels"
          icon={Filter}
          description="Conversion funnels set up"
        />
        
        <UsageCard
          type="monthlyEvents"
          title="Monthly Events"
          icon={BarChart3}
          description="Events tracked this month"
        />
      </div>

      <UpgradePlanModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentPlan={subscription.plan}
        limitType="websites"
        currentUsage={subscription.usage.websites?.current || 0}
        limit={subscription.usage.websites?.limit || 0}
      />
    </div>
  );
};
