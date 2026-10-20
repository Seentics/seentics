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
  LeadsOverview,
  SiteLeadQueries,
  SiteSubmissionQuery,
  SiteSubmissionRow,
  SiteSubmissionView,
} from "../interfaces";
import { utmOf } from "../lib/utm";
import { exportContacts, getContact, listContacts, newContactsSince, tagCounts } from "../repositories/contact.repository";
import {
  exportSiteSubmissions,
  formCounts,
  listSiteSubmissions,
  submissionCountSince,
  submissionOrigins,
  submissionsForEmail,
} from "../repositories/submission.repository";

/** How many of a contact's submissions their page shows. */
const CONTACT_TIMELINE_LIMIT = 100;
/** The most failed submissions the "failed to send" filter narrows to; far beyond a page of them. */
const FAILED_LIMIT = 5_000;
/** The most submissions the overview reads to say where they came from; the count itself is exact. */
const OVERVIEW_ORIGINS_CAP = 10_000;
const DAY_MS = 86_400_000;

export type SiteLeadDeps = {
  automations: Pick<AutomationDirectory, "names">;
  recordings: RecordingPresence;
  channels: TrafficChannelClassifier;
  sink: Pick<LeadSink, "statuses" | "failedSubmissionIds">;
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
      // Stored when the contact was created (075); an older row is classified here, as before.
      first_channel: row.first_channel ?? (touched ? this.channelOf(row.first_page_url, row.first_referrer) : null),
      first_campaign: row.first_campaign ?? (row.first_page_url ? utmOf(row.first_page_url).campaign : null),
      first_page_url: row.first_page_url || null,
      first_referrer: row.first_referrer || null,
    };
  }

  /** The submissions the `delivery` filter keeps, from the integrations module; null when unfiltered. */
  private async narrowedTo(websiteId: string, q: SiteSubmissionQuery): Promise<string[] | null> {
    return q.delivery === "failed" ? this.deps.sink.failedSubmissionIds(websiteId, null, FAILED_LIMIT) : null;
  }

  async listSubmissions(websiteId: string, q: SiteSubmissionQuery) {
    const { rows, total } = await listSiteSubmissions(websiteId, q, await this.narrowedTo(websiteId, q));
    return { submissions: await this.views(websiteId, rows), total };
  }

  async exportSubmissions(websiteId: string, q: SiteSubmissionQuery, limit: number) {
    return this.views(websiteId, await exportSiteSubmissions(websiteId, q, limit, await this.narrowedTo(websiteId, q)));
  }

  /**
   * The leads page's numbers. Channels and campaigns are worked out from each submission's page
   * and referrer, as the inbox shows them; failed means at least one destination could not take it.
   */
  async overview(websiteId: string, days: number): Promise<LeadsOverview> {
    const since = new Date(Date.now() - days * DAY_MS);
    const [submissions, origins, contacts, failed] = await Promise.all([
      submissionCountSince(websiteId, since),
      submissionOrigins(websiteId, since, OVERVIEW_ORIGINS_CAP),
      newContactsSince(websiteId, since),
      this.deps.sink.failedSubmissionIds(websiteId, since, OVERVIEW_ORIGINS_CAP),
    ]);
    const channels = new Map<LeadChannel, number>();
    const campaigns = new Map<string, number>();
    for (const o of origins) {
      const channel = this.channelOf(o.page_url, o.referrer);
      channels.set(channel, (channels.get(channel) ?? 0) + 1);
      const campaign = utmOf(o.page_url).campaign;
      if (campaign) campaigns.set(campaign, (campaigns.get(campaign) ?? 0) + 1);
    }
    const most = <K>(m: Map<K, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
    return {
      days,
      submissions,
      new_contacts: contacts.total,
      customers: contacts.customers,
      by_channel: most(channels).map(([channel, count]) => ({ channel, count })),
      by_campaign: most(campaigns).slice(0, 5).map(([campaign, count]) => ({ campaign, count })),
      failed_deliveries: failed.length,
    };
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
