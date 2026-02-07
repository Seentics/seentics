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
  monthlyEvents: UsageStatus;
}

export interface SubscriptionData {
  id: string;
  plan: 'starter' | 'growth' | 'scale' | 'pro_plus';
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
  canCreateHeatmap: boolean;
  canTrackEvents: (count?: number) => boolean;
  getUsagePercentage: (type: keyof SubscriptionUsage) => number;
  isNearLimit: (type: keyof SubscriptionUsage, threshold?: number) => boolean;
  hasReachedLimit: (type: keyof SubscriptionUsage) => boolean;
}

export const useSubscription = (): UseSubscriptionReturn => {
  // ...existing code...
  const fetchSubscription = useCallback(async () => {
    // Demo Mode logic
    if (typeof window !== 'undefined' && (window.location.pathname.includes('/websites/demo') || !isAuthenticated)) {
      setSubscription({
        id: 'demo-user',
        plan: 'scale',
        status: 'active',
        usage: {
          websites: { current: 1, limit: 10, canCreate: true },
          workflows: { current: 3, limit: 100, canCreate: true },
          funnels: { current: 2, limit: 50, canCreate: true },
          heatmaps: { current: 1, limit: 20, canCreate: true },
          monthlyEvents: { current: 45000, limit: 1000000, canCreate: true }
        },
        features: ['all'],
        isActive: true,
        currentPeriodEnd: new Date(Date.now() + 86400000 * 30).toISOString()
      });
      setLoading(false);
      return;
    }
    // ...existing code...
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
    // ...existing code...
  }, [subscription]);

  const getUsagePercentage = useCallback((type: keyof SubscriptionUsage): number => {
    // ...existing code...
  }, [subscription]);

  const isNearLimit = useCallback((type: keyof SubscriptionUsage, threshold: number = 80): boolean => {
    // ...existing code...
  }, [getUsagePercentage, subscription]);

  const hasReachedLimit = useCallback((type: keyof SubscriptionUsage): boolean => {
    // ...existing code...
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
