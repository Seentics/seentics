import api from './api';

export interface Annotation {
  id: string;
  userId: string;
  websiteId: string;
  title: string;
  description?: string;
  color: string;
  occurredAt: string;
  createdAt: string;
}

export interface CreateAnnotationRequest {
  websiteId: string;
  title: string;
  description?: string;
  color?: string;
  occurredAt: string;
}

class AnnotationsAPI {
  async list(websiteId: string, from: string, to: string): Promise<Annotation[]> {
    const response = await api.get(`/user/annotations/website/${websiteId}?from=${from}&to=${to}`);
    const data = response.data?.data || response.data || [];
    return Array.isArray(data) ? data.map(this.mapAnnotation) : [];
  }

  async create(req: CreateAnnotationRequest): Promise<Annotation> {
    const response = await api.post('/user/annotations', req);
    const raw = response.data?.data || response.data;
    return this.mapAnnotation(raw);
  }

  async update(id: string, req: Partial<CreateAnnotationRequest>): Promise<void> {
    await api.put(`/user/annotations/${id}`, req);
  }

  async remove(id: string): Promise<void> {
    await api.delete(`/user/annotations/${id}`);
  }

  private mapAnnotation(raw: any): Annotation {
    return {
      id: raw.id,
      userId: raw.userId || raw.user_id || '',
      websiteId: raw.websiteId || raw.website_id || '',
      title: raw.title || '',
      description: raw.description || undefined,
      color: raw.color || 'blue',
      occurredAt: raw.occurredAt || raw.occurred_at || '',
      createdAt: raw.createdAt || raw.created_at || '',
    };
  }
}

export const annotationsAPI = new AnnotationsAPI();
