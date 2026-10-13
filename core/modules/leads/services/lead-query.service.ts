import type { AutomationDirectory } from "../../automations/interfaces";
import type {
  Contact,
  ContactListQuery,
  ContactStatus,
  ContactSubmission,
  LeadMutations,
  LeadQueries,
  LeadStats,
} from "../interfaces";
import {
  deleteContact,
  exportContacts,
  getContact,
  leadStats,
  listContacts,
  updateContactStatus,
} from "../repositories/lead.repository";

/**
 * Dashboard reads and writes for the leads inbox.
 *
 * Takes an already-resolved website id: the controller checks membership, and every
 * statement here is scoped by the website regardless, because a contact id is a UUID a
 * member of another site could be handed and must not be able to read through.
 */
export class LeadQueryService implements LeadQueries {
  constructor(private readonly automations: AutomationDirectory) {}

  listContacts(websiteId: string, q: ContactListQuery): Promise<{ contacts: Contact[]; total: number }> {
    return listContacts(websiteId, q);
  }

  async getContact(
    websiteId: string,
    contactId: string,
  ): Promise<{ contact: Contact; submissions: ContactSubmission[] } | null> {
    const found = await getContact(websiteId, contactId);
    if (!found) return null;
    const names = await this.namesFor(websiteId, found.submissions.map((s) => s.automation_id));
    return {
      contact: found.contact,
      submissions: found.submissions.map((s) => ({
        ...s,
        automation_name: s.automation_id ? (names.get(s.automation_id) ?? null) : null,
      })),
    };
  }

  async stats(websiteId: string): Promise<LeadStats> {
    const stats = await leadStats(websiteId);
    const names = await this.namesFor(websiteId, stats.by_automation.map((a) => a.automation_id));
    return {
      ...stats,
      by_automation: stats.by_automation.map((a) => ({
        ...a,
        name: a.automation_id ? (names.get(a.automation_id) ?? null) : null,
      })),
    };
  }

  /** A deleted automation leaves its submissions behind; they simply have no name. */
  private namesFor(websiteId: string, ids: readonly (string | null)[]): Promise<Map<string, string>> {
    return this.automations.names(websiteId, [...new Set(ids.filter((id): id is string => !!id))]);
  }

  exportContacts(websiteId: string, limit: number): Promise<Contact[]> {
    return exportContacts(websiteId, limit);
  }
}

export class LeadMutationService implements LeadMutations {
  setStatus(websiteId: string, contactId: string, status: ContactStatus): Promise<boolean> {
    return updateContactStatus(websiteId, contactId, status);
  }

  deleteContact(websiteId: string, contactId: string): Promise<boolean> {
    return deleteContact(websiteId, contactId);
  }
}
