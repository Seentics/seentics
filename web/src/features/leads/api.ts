/**
 * Endpoint functions for the leads feature. No React, no hooks — just transport.
 *
 * The demo site answers from `lib/demo/leads`: sample contacts on the reserved example.com
 * domain, so nothing there is a real person's address.
 */
import api from '@/lib/api';
import { demoMutationGuard, isDemo } from '@/lib/demo';
import { demoContact, demoContacts, demoLeadStats } from '@/lib/demo/leads';
import type {
  ContactDetail,
  ContactFilters,
  ContactPage,
  ContactStatus,
  LeadStats,
} from './types';

export const leadsApi = {
  async listContacts(websiteId: string, filters: ContactFilters): Promise<ContactPage> {
    if (isDemo(websiteId)) return demoContacts(filters);
    const res = await api.get(`/leads/${websiteId}/contacts`, { params: filters });
    return { contacts: res.data?.data?.contacts ?? [], total: res.data?.data?.total ?? 0 };
  },

  async getContact(websiteId: string, contactId: string): Promise<ContactDetail | null> {
    if (isDemo(websiteId)) return demoContact(contactId);
    const res = await api.get(`/leads/${websiteId}/contacts/${contactId}`);
    return (res.data?.data as ContactDetail | undefined) ?? null;
  },

  async stats(websiteId: string): Promise<LeadStats> {
    if (isDemo(websiteId)) return demoLeadStats();
    const res = await api.get(`/leads/${websiteId}/stats`);
    return (res.data?.data as LeadStats | undefined) ?? { total: 0, last_7_days: 0, by_automation: [] };
  },

  async setStatus(websiteId: string, contactId: string, status: ContactStatus): Promise<void> {
    if (demoMutationGuard(websiteId)) return;
    await api.patch(`/leads/${websiteId}/contacts/${contactId}`, { status });
  },

  async deleteContact(websiteId: string, contactId: string): Promise<void> {
    if (demoMutationGuard(websiteId)) return;
    await api.delete(`/leads/${websiteId}/contacts/${contactId}`);
  },

  /** The CSV as a blob: the endpoint is authenticated, so a plain link cannot fetch it. */
  async exportCsv(websiteId: string): Promise<Blob> {
    const res = await api.get(`/leads/${websiteId}/export`, { responseType: 'blob' });
    return res.data as Blob;
  },
};
