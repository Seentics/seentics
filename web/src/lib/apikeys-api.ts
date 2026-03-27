import api from './api';

export interface APIKey {
  id: string;
  name: string;
  keyPrefix: string;
  key?: string; // Only returned on creation (raw, once only)
  scopes: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreateAPIKeyResponse extends APIKey {
  key: string; // Raw key, shown once
}

class APIKeysAPI {
  async list(websiteId: string): Promise<APIKey[]> {
    const response = await api.get(`/user/websites/${websiteId}/api-keys`);
    const data = response.data?.keys || response.data?.data?.keys || [];
    return Array.isArray(data) ? data.map(this.mapKey) : [];
  }

  async create(
    websiteId: string,
    name: string,
    scopes: string[],
    expiresAt?: string,
  ): Promise<CreateAPIKeyResponse> {
    const payload: Record<string, unknown> = { name, scopes };
    if (expiresAt) payload.expires_at = expiresAt;
    const response = await api.post(`/user/websites/${websiteId}/api-keys`, payload);
    const raw = response.data?.data || response.data;
    return this.mapKey(raw) as CreateAPIKeyResponse;
  }

  async revoke(websiteId: string, keyId: string): Promise<{ status: string }> {
    const response = await api.delete(`/user/websites/${websiteId}/api-keys/${keyId}`);
    return response.data?.data || response.data || { status: 'revoked' };
  }

  private mapKey(raw: any): APIKey {
    return {
      id: raw.id,
      name: raw.name,
      keyPrefix: raw.key_prefix || raw.keyPrefix || '',
      key: raw.key || undefined,
      scopes: raw.scopes || [],
      isActive: raw.is_active ?? raw.isActive ?? true,
      lastUsedAt: raw.last_used_at || raw.lastUsedAt || null,
      expiresAt: raw.expires_at || raw.expiresAt || null,
      createdAt: raw.created_at || raw.createdAt || '',
    };
  }
}

export const apiKeysAPI = new APIKeysAPI();
