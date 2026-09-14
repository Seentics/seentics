/** Domain types for the alerts feature. */

import api from '@/lib/api';

export type ConditionType = 'traffic_spike' | 'traffic_drop' | 'usage_limit' | 'anomaly';

export type Channel = 'email' | 'in_app';

export interface AlertRule {
  id: string;
  userId: string;
  websiteId?: string;
  name: string;
  conditionType: ConditionType;
  threshold: number;
  timeWindow: string;
  channels: Channel[];
  enabled: boolean;
  cooldownMinutes: number;
  lastTriggered?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  userId: string;
  triggeredValue: number;
  message: string;
  channels: string[];
  createdAt: string;
}

export interface CreateAlertRuleRequest {
  websiteId?: string;
  name: string;
  conditionType: ConditionType;
  threshold: number;
  timeWindow?: string;
  channels?: Channel[];
  cooldownMinutes?: number;
}

export interface UpdateAlertRuleRequest {
  name?: string;
  threshold?: number;
  timeWindow?: string;
  channels?: Channel[];
  enabled?: boolean;
  cooldownMinutes?: number;
}
