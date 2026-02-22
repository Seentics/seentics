'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/stores/useAuthStore';
import api from '@/lib/api';

export interface UsageStatus {
  current: number;
  limit: number;
  canCreate: boolean;
}

export interface SubscriptionUsage {
  websites: UsageStatus;
  workflows: UsageStatus;
  funnels: UsageStatus;
  heatmaps: UsageStatus;
  replays: UsageStatus;
  monthlyEvents: UsageStatus;
}

export interface SubscriptionData {
  id: string;
  plan: 'starter' | 'growth' | 'pro' | 'enterprise';
  status: string;
  usage: SubscriptionUsage;
  features: string[];
  isActive: boolean;
  isCustomPlan?: boolean;
  priceMonthly?: number;
  currentPeriodEnd?: string;
}

export interface UseSubscriptionReturn {
  subscription: SubscriptionData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  canCreateWebsite: boolean;
  canCreateWorkflow: boolean;
  canCreateFunnel: boolean;
  canCreateHeatmap: boolean;
  canTrackEvents: (count?: number) => boolean;
  getUsagePercentage: (type: keyof SubscriptionUsage) => number;
  isNearLimit: (type: keyof SubscriptionUsage, threshold?: number) => boolean;
  hasReachedLimit: (type: keyof SubscriptionUsage) => boolean;
}

export const useSubscription = (): UseSubscriptionReturn => {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAuthenticated } = useAuth();

  const fetchSubscription = useCallback(async () => {
    // Demo Mode logic
    if (typeof window !== 'undefined' && (window.location.pathname.includes('/websites/demo') || !isAuthenticated)) {
      setSubscription({
        id: 'demo-user',
        plan: 'pro',
        status: 'active',
        usage: {
          websites: { current: 1, limit: 15, canCreate: true },
          workflows: { current: 3, limit: -1, canCreate: true },
          funnels: { current: 2, limit: -1, canCreate: true },
          heatmaps: { current: 1, limit: -1, canCreate: true },
          replays: { current: 4, limit: 50000, canCreate: true },
          monthlyEvents: { current: 45000, limit: 2000000, canCreate: true }
        },
        features: ['all'],
        isActive: true,
        currentPeriodEnd: new Date(Date.now() + 86400000 * 30).toISOString()
      });
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await api.get('/user/billing/usage');
      setSubscription(response.data.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch subscription:', err);
      setError(err.response?.data?.error || 'Failed to sync billing data');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Helper functions
  const canCreateWebsite = subscription?.usage?.websites?.canCreate ?? false;
  const canCreateWorkflow = subscription?.usage?.workflows?.canCreate ?? false;
  const canCreateFunnel = subscription?.usage?.funnels?.canCreate ?? false;
  const canCreateHeatmap = subscription?.usage?.heatmaps?.canCreate ?? false;

  const canTrackEvents = useCallback((count: number = 1): boolean => {
    if (!subscription) return false;
    return subscription.usage.monthlyEvents.current + count <= subscription.usage.monthlyEvents.limit;
  }, [subscription]);

  const getUsagePercentage = useCallback((type: keyof SubscriptionUsage): number => {
    if (!subscription || !subscription.usage[type]) return 0;
    const { current, limit } = subscription.usage[type];
    return limit > 0 ? (current / limit) * 100 : 0;
  }, [subscription]);

  const isNearLimit = useCallback((type: keyof SubscriptionUsage, threshold: number = 80): boolean => {
    return getUsagePercentage(type) >= threshold;
  }, [getUsagePercentage]);

  const hasReachedLimit = useCallback((type: keyof SubscriptionUsage): boolean => {
    if (!subscription || !subscription.usage[type]) return true;
    return !subscription.usage[type].canCreate;
  }, [subscription]);

  return {
    subscription,
    loading,
    error,
    refetch: fetchSubscription,
    canCreateWebsite,
    canCreateWorkflow,
    canCreateFunnel,
    canCreateHeatmap,
    canTrackEvents,
    getUsagePercentage,
    isNearLimit,
    hasReachedLimit,
  };
};
