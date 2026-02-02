import api from './api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface ABVariant {
  id?: string;
  test_id?: string;
  name: string;
  weight: number;
  config?: Record<string, any>;
}

export type ABTestStatus = 'draft' | 'running' | 'paused' | 'completed';

export interface ABTest {
  id?: string;
  website_id: string;
  name: string;
  description?: string;
  status: ABTestStatus;
  goal_event_type?: string;
  goal_path?: string;
  created_at?: string;
  updated_at?: string;
  variants?: ABVariant[];
}

export interface ABTestResult {
  variant_id: string;
  variant_name: string;
  visitors: number;
  conversions: number;
  conversion_rate: number;
  is_winner: boolean;
  improvement?: number;
}

export const getABTests = async (websiteId: string): Promise<ABTest[]> => {
  if (websiteId === 'demo') {
    return [
      {
        id: 'demo-1',
        website_id: 'demo',
        name: 'Landing Page CTA Colors',
        status: 'running',
        created_at: new Date().toISOString(),
        variants: [
          { name: 'Red Button', weight: 50 },
          { name: 'Blue Button', weight: 50 }
        ]
      },
      {
        id: 'demo-2',
        website_id: 'demo',
        name: 'Headline Variation',
        status: 'completed',
        created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
        variants: [
          { name: 'Control', weight: 50 },
          { name: 'Variant A', weight: 50 }
        ]
      }
    ];
  }
  const response = await api.get(`/websites/${websiteId}/ab-tests`);
  return response.data;
};

export const getABTest = async (websiteId: string, id: string): Promise<ABTest> => {
  const response = await api.get(`/websites/${websiteId}/ab-tests/${id}`);
  return response.data.data;
};

export const createABTest = async (websiteId: string, test: ABTest, variants: ABVariant[]): Promise<ABTest> => {
  const response = await api.post(`/websites/${websiteId}/ab-tests`, { test, variants });
  return response.data.data;
};

export const updateABTestStatus = async (websiteId: string, id: string, status: ABTestStatus): Promise<void> => {
  await api.put(`/websites/${websiteId}/ab-tests/${id}/status`, { status });
};

export const deleteABTest = async (websiteId: string, id: string): Promise<void> => {
  await api.delete(`/websites/${websiteId}/ab-tests/${id}`);
};

export const getABTestResults = async (websiteId: string, id: string): Promise<ABTestResult[]> => {
  const response = await api.get(`/websites/${websiteId}/ab-tests/${id}/results`);
  return response.data.data;
};

// Hooks
export const useABTests = (websiteId: string) => {
  return useQuery({
    queryKey: ['abTests', websiteId],
    queryFn: () => getABTests(websiteId),
    enabled: !!websiteId,
  });
};

export const useABTestResults = (websiteId: string, id: string) => {
  return useQuery({
    queryKey: ['abTestResults', id],
    queryFn: () => getABTestResults(websiteId, id),
    enabled: !!id,
  });
};
