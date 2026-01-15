'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/stores/useAuthStore';
import { hasFeature, isOpenSource } from '@/lib/features';
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
  monthlyEvents: UsageStatus;
}

export interface SubscriptionData {
  id: string;
  plan: 'free' | 'standard' | 'pro' | 'enterprise';
  status: string;
  usage: SubscriptionUsage;
  features: string[];
  isActive: boolean;
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
  canTrackEvents: (count?: number) => boolean;
  getUsagePercentage: (type: keyof SubscriptionUsage) => number;
  isNearLimit: (type: keyof SubscriptionUsage, threshold?: number) => boolean;
  hasReachedLimit: (type: keyof SubscriptionUsage) => boolean;
}

export const useSubscription = (): UseSubscriptionReturn => {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAuthenticated } = useAuth();

  const fetchSubscription = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // In open source mode, return unlimited usage
      if (isOpenSource()) {
        setSubscription({
          id: user.id,
          plan: 'free',
          status: 'active',
          usage: {
            websites: { current: 0, limit: -1, canCreate: true },
            workflows: { current: 0, limit: -1, canCreate: true },
            funnels: { current: 0, limit: -1, canCreate: true },
            monthlyEvents: { current: 0, limit: -1, canCreate: true }
          },
          features: ['unlimited_everything'],
          isActive: true
        });
        setLoading(false);
        return;
      }

      // Cloud mode - fetch from API
      const response = await api.get('/user/billing/usage');

      if (response.data.success) {
        setSubscription({
          id: user.id,
          plan: response.data.data.plan,
          status: 'active',
          usage: response.data.data.usage,
          features: response.data.data.features || [],
          isActive: true
        });
      } else {
        throw new Error(response.data.message || 'Failed to fetch subscription');
      }
    } catch (err: any) {
      console.error('Error fetching subscription:', err);

      // In open source mode, fallback to unlimited on API error
      if (isOpenSource()) {
        setSubscription({
          id: user.id,
          plan: 'free',
          status: 'active',
          usage: {
            websites: { current: 0, limit: -1, canCreate: true },
            workflows: { current: 0, limit: -1, canCreate: true },
            funnels: { current: 0, limit: -1, canCreate: true },
            monthlyEvents: { current: 0, limit: -1, canCreate: true }
          },
          features: ['unlimited_everything'],
          isActive: true
        });
      } else {
        setError(err.response?.data?.message || err.message || 'Unknown error occurred');
      }
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

  const canTrackEvents = useCallback((count: number = 1): boolean => {
    if (!subscription?.usage?.monthlyEvents) return false;
    const { current, limit } = subscription.usage.monthlyEvents;
    // Always allow if unlimited
    if (limit === -1) return true;
    return (current + count) <= limit;
  }, [subscription]);

  const getUsagePercentage = useCallback((type: keyof SubscriptionUsage): number => {
    if (!subscription?.usage?.[type]) return 0;
    const { current, limit } = subscription.usage[type];
    // Handle unlimited (-1) limits
    if (limit === -1) return 0;
    return Math.min((current / limit) * 100, 100);
  }, [subscription]);

  const isNearLimit = useCallback((type: keyof SubscriptionUsage, threshold: number = 80): boolean => {
    if (!subscription?.usage?.[type]) return false;
    const { limit } = subscription.usage[type];
    // Never near limit if unlimited
    if (limit === -1) return false;
    return getUsagePercentage(type) >= threshold;
  }, [getUsagePercentage, subscription]);

  const hasReachedLimit = useCallback((type: keyof SubscriptionUsage): boolean => {
    if (!subscription?.usage?.[type]) return false;
    const { current, limit } = subscription.usage[type];
    // Never reached limit if unlimited
    if (limit === -1) return false;
    return current >= limit;
  }, [subscription]);

  return {
    subscription,
    loading,
    error,
    refetch: fetchSubscription,
    canCreateWebsite,
    canCreateWorkflow,
    canCreateFunnel,
    canTrackEvents,
    getUsagePercentage,
    isNearLimit,
    hasReachedLimit,
  };
};
