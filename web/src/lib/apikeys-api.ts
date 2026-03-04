import api from './api';

export interface APIKey {
  id: string;
  name: string;
  keyPrefix: string;
  key?: string; // Only returned on creation
  lastUsed: string | null;
  createdAt: string;
}

class APIKeysAPI {
  async list(): Promise<APIKey[]> {
    const response = await api.get('/user/agency/api-keys');
    const data = response.data?.data || response.data || [];
    return Array.isArray(data) ? data.map(this.mapKey) : [];
  }

  async create(name: string): Promise<APIKey> {
    const response = await api.post('/user/agency/api-keys', { name });
    const raw = response.data?.data || response.data;
    return this.mapKey(raw);
  }

  async remove(id: string): Promise<void> {
    await api.delete(`/user/agency/api-keys/${id}`);
  }

  private mapKey(raw: any): APIKey {
    return {
      id: raw.id,
      name: raw.name,
      keyPrefix: raw.keyPrefix || raw.key_prefix || '',
      key: raw.key || raw.plainKey || undefined,
      lastUsed: raw.lastUsed || raw.last_used || null,
      createdAt: raw.createdAt || raw.created_at || '',
    };
  }
}

export const apiKeysAPI = new APIKeysAPI();
