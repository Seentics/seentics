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
  senderName: string;
  senderType: string;
  createdAt: string;
}

class SupportAPI {
  async getTickets(): Promise<{ success: boolean; data: SupportTicket[] }> {
    const response = await api.get('/user/support/tickets');
    return response.data;
  }

  async getTicket(id: string): Promise<{ success: boolean; data: SupportTicket }> {
    const response = await api.get(`/user/support/tickets/${id}`);
    return response.data;
  }

  async createTicket(ticket: { subject: string; description: string; priority: string }): Promise<{ success: boolean; data: SupportTicket }> {
    const response = await api.post('/user/support/tickets', ticket);
    return response.data;
  }

  async replyToTicket(id: string, message: string): Promise<{ success: boolean; data: TicketReply }> {
    const response = await api.post(`/user/support/tickets/${id}/replies`, { message });
    return response.data;
  }
}

export const supportAPI = new SupportAPI();
