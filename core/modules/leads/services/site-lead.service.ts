import type { TrafficChannelClassifier } from "../../analytics/interfaces";
import type { AutomationDirectory } from "../../automations/interfaces";
import type { RecordingPresence } from "../../recordings/interfaces";
import type {
  ContactListQuery,
  ContactRow,
  ContactStatus,
  ContactView,
  FormOption,
  LeadChannel,
  LeadSink,
  SiteLeadQueries,
  SiteSubmissionQuery,
  SiteSubmissionRow,
  SiteSubmissionView,
} from "../interfaces";
import { utmOf } from "../lib/utm";
import { exportContacts, getContact, listContacts, tagCounts } from "../repositories/contact.repository";
import {
  exportSiteSubmissions,
  formCounts,
  listSiteSubmissions,
  submissionsForEmail,
} from "../repositories/submission.repository";

/** How many of a contact's submissions their page shows. */
const CONTACT_TIMELINE_LIMIT = 100;

export type SiteLeadDeps = {
  automations: Pick<AutomationDirectory, "names">;
  recordings: RecordingPresence;
  channels: TrafficChannelClassifier;
  sink: Pick<LeadSink, "statuses">;
};

/**
 * The site-wide inbox and contacts.
 *
 * Reads the leads module's own tables and asks the other modules what it may not query
 * itself: a form's name (automations), whether a session was recorded (recordings), which
 * channel an arrival counts under (analytics) and how each delivery is doing (integrations).
 */
export class SiteLeadService implements SiteLeadQueries {
  constructor(private readonly deps: SiteLeadDeps) {}

  private channelOf(pageUrl: string, referrer: string): LeadChannel {
    const utm = utmOf(pageUrl);
    return this.deps.channels.classify({
      referrer: referrer || null,
      page: pageUrl || null,
      utmSource: utm.source,
      utmMedium: utm.medium,
    });
  }

  private async views(websiteId: string, rows: SiteSubmissionRow[]): Promise<SiteSubmissionView[]> {
    if (rows.length === 0) return [];
    const formIds = [...new Set(rows.map((r) => r.automation_id).filter((id): id is string => !!id))];
    const [names, recorded, deliveries] = await Promise.all([
      formIds.length ? this.deps.automations.names(websiteId, formIds) : Promise.resolve(new Map<string, string>()),
      this.deps.recordings.recorded(websiteId, rows.map((r) => r.session_id).filter((id): id is string => !!id)),
      this.deps.sink.statuses(websiteId, rows.map((r) => r.id)),
    ]);
    return rows.map((r) => {
      const utm = utmOf(r.page_url);
      return {
        ...r,
        form_name: r.automation_id ? (names.get(r.automation_id) ?? null) : null,
        has_replay: !!r.session_id && recorded.has(r.session_id),
        channel: this.channelOf(r.page_url, r.referrer),
        utm_source: utm.source,
        utm_campaign: utm.campaign,
        deliveries: deliveries.get(r.id) ?? [],
      };
    });
  }

  private contactView(row: ContactRow): ContactView {
    const touched = !!(row.first_page_url || row.first_referrer);
    return {
      ...row,
      first_channel: touched ? this.channelOf(row.first_page_url, row.first_referrer) : null,
      first_page_url: row.first_page_url || null,
      first_referrer: row.first_referrer || null,
    };
  }

  async listSubmissions(websiteId: string, q: SiteSubmissionQuery) {
    const { rows, total } = await listSiteSubmissions(websiteId, q);
    return { submissions: await this.views(websiteId, rows), total };
  }

  async exportSubmissions(websiteId: string, q: SiteSubmissionQuery, limit: number) {
    return this.views(websiteId, await exportSiteSubmissions(websiteId, q, limit));
  }

  async forms(websiteId: string): Promise<FormOption[]> {
    const counts = await formCounts(websiteId);
    if (counts.length === 0) return [];
    const names = await this.deps.automations.names(websiteId, counts.map((c) => c.id));
    // A form that has since been deleted still has submissions; it is listed under a plain label.
    return counts.map((c) => ({ id: c.id, name: names.get(c.id) ?? "Deleted form", count: c.count }));
  }

  async listContacts(websiteId: string, q: ContactListQuery) {
    const { rows, total, statuses } = await listContacts(websiteId, q);
    return { contacts: rows.map((r) => this.contactView(r)), total, statuses: statuses as Record<ContactStatus, number> };
  }

  async exportContacts(websiteId: string, q: ContactListQuery, limit: number) {
    return (await exportContacts(websiteId, q, limit)).map((r) => this.contactView(r));
  }

  async contact(websiteId: string, id: string) {
    const row = await getContact(websiteId, id);
    if (!row) return null;
    const submissions = await this.views(websiteId, await submissionsForEmail(websiteId, row.email, CONTACT_TIMELINE_LIMIT));
    return { contact: this.contactView(row), submissions };
  }

  tags(websiteId: string) {
    return tagCounts(websiteId);
  }

  /** One contact by id, as a view — for the mutation service's responses. */
  async contactOnly(websiteId: string, id: string): Promise<ContactView | null> {
    const row = await getContact(websiteId, id);
    return row ? this.contactView(row) : null;
  }
}
