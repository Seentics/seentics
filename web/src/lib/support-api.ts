import api from './api';

export interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  updatedAt: string;
  replies?: TicketReply[];
}

export interface TicketReply {
  id: string;
  ticketId: string;
  message: string;
  userName: string;
  isPrivate: boolean;
  createdAt: string;
}

class SupportAPI {
  async getTickets(): Promise<{ success: boolean; data: SupportTicket[] }> {
    const response = await api.get('/user/support/tickets');
    const raw = response.data;
    if (Array.isArray(raw)) return { success: true, data: raw };
    return raw;
  }

  async getTicket(id: string): Promise<{ success: boolean; data: SupportTicket }> {
    const response = await api.get(`/user/support/tickets/${id}`);
    const raw = response.data;
    if (raw && raw.id) return { success: true, data: raw };
    return raw;
  }

  async createTicket(ticket: { subject: string; description: string; priority: string }): Promise<{ success: boolean; data: SupportTicket }> {
    const response = await api.post('/user/support/tickets', ticket);
    const raw = response.data;
    if (raw && raw.id) return { success: true, data: raw };
    return raw;
  }

  async replyToTicket(id: string, message: string): Promise<{ success: boolean; data: TicketReply }> {
    const response = await api.post(`/user/support/tickets/${id}/replies`, { message });
    const raw = response.data;
    if (raw && raw.id) return { success: true, data: raw };
    return raw;
  }

  async deleteTicket(id: string): Promise<{ success: boolean }> {
    const response = await api.delete(`/user/support/tickets/${id}`);
    return response.data;
  }
}

export const supportAPI = new SupportAPI();
