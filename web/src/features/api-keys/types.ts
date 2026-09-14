/** Domain types for the api-keys feature. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface ApiKey {
  id: string;
  name: string;
  /** First 16 characters — enough to recognise a key in a log. */
  prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
}

/** What creation returns: the key, plus the one and only sight of its secret. */
export interface CreatedApiKey extends ApiKey {
  secret: string;
}

export interface ApiScopeInfo {
  scope: string;
  description: string;
}

export interface ApiParam {
  name: string;
  description: string;
  default?: string;
}

export interface ApiEndpoint {
  path: string;
  method: 'GET';
  group: string;
  summary: string;
  scope: string;
  params: ApiParam[];
}

export interface ApiCatalogue {
  meta: { base_path: string; auth: string; count: number };
  data: ApiEndpoint[];
}
