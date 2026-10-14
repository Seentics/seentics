import type { QueuedLead } from "../../leads/interfaces";
import type { LeadPayload } from "../interfaces";

/** First word is the first name, the rest the last: good enough for a single "name" box. */
export function splitName(name: string): { firstName: string; lastName: string } {
  const [first = "", ...rest] = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: first, lastName: rest.join(" ") };
}

/** A queued submission in the flat shape providers (and the outbox's JSON column) use. */
export function toLeadPayload(lead: QueuedLead): LeadPayload {
  const s = lead.submission;
  return {
    submissionId: lead.submissionId,
    email: s.email,
    name: s.name,
    ...splitName(s.name),
    phone: s.phone,
    consent: s.consent,
    fields: s.fields,
    prize: lead.prize ? { label: lead.prize.label, coupon_code: lead.prize.coupon_code } : null,
    popupId: s.automationId,
    variant: s.variant,
    pageUrl: s.pageUrl,
    referrer: s.referrer,
    submittedAt: lead.submittedAt,
  };
}
