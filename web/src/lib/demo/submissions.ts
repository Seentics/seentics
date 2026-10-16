/**
 * Demo form submissions for the automation page's Submissions section (websiteId === "demo").
 *
 * Every address is on `example.com`, a domain reserved for documentation, so none of these
 * people exist and no real mailbox could ever receive anything. Submissions belong to the two
 * demo lead-capture popups in `demo/automations.ts`, and each carries the delivery state of the
 * destinations that popup is routed to (`DEMO_ROUTING`), consistent with `demo/integrations.ts`.
 */
import type {
  FormSummary, Submission, SubmissionDelivery, SubmissionFilters, SubmissionPage,
} from '@/features/leads/types';
import { DEMO_DESTINATIONS, DEMO_DESTINATION_NAMES, demoIso } from './integrations';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => demoIso(-ms);

export const DEMO_FORMS = {
  wheel: { id: 'demo-auto-5', name: 'Spin to Win Wheel' },
  newsletter: { id: 'demo-auto-6', name: 'Exit-Intent Newsletter Signup' },
} as const;

/** Which destinations each demo form sends to. The automation definitions use the same lists. */
export const DEMO_ROUTING: Record<string, string[]> = {
  'demo-auto-5': [DEMO_DESTINATIONS.crm, DEMO_DESTINATIONS.mailchimp],
  'demo-auto-6': [DEMO_DESTINATIONS.crm, DEMO_DESTINATIONS.slack],
};

type Seed = {
  name: string; slug: string; consent: boolean; phone?: string; agoMs: number;
  form: keyof typeof DEMO_FORMS; variant: 'a' | 'b'; page: string;
  fields?: Record<string, string>; prize?: { label: string; code: string };
};

// A repeat visitor (Liam, Zara) appears once per submission. Sorted newest first below.
const SEEDS: Seed[] = [
  { name: 'Ava Martin', slug: 'ava.martin', consent: true, agoMs: 2 * HOUR, form: 'wheel', variant: 'a', page: '/pricing', prize: { label: '20% off', code: 'SPIN20' } },
  { name: 'Liam Becker', slug: 'liam.becker', consent: true, phone: '+49 30 5550 142', agoMs: 3 * HOUR, form: 'wheel', variant: 'a', page: '/pricing', prize: { label: 'Free shipping', code: 'SHIPFREE' } },
  { name: 'Noah Kim', slug: 'noah.kim', consent: true, agoMs: 5 * HOUR, form: 'newsletter', variant: 'b', page: '/blog/getting-started' },
  { name: 'Sofia Rossi', slug: 'sofia.rossi', consent: false, agoMs: 9 * HOUR, form: 'newsletter', variant: 'a', page: '/features' },
  { name: 'Liam Becker', slug: 'liam.becker', consent: true, phone: '+49 30 5550 142', agoMs: 1 * DAY, form: 'wheel', variant: 'a', page: '/pricing', prize: { label: 'Free shipping', code: 'SHIPFREE' } },
  { name: 'Mia Okafor', slug: 'mia.okafor', consent: true, agoMs: 1.2 * DAY, form: 'newsletter', variant: 'b', page: '/docs/introduction' },
  { name: 'Ethan Walker', slug: 'ethan.walker', consent: true, agoMs: 2 * DAY, form: 'newsletter', variant: 'a', page: '/blog/getting-started' },
  { name: 'Hana Sato', slug: 'hana.sato', consent: true, agoMs: 2.4 * DAY, form: 'wheel', variant: 'b', page: '/', prize: { label: '10% off', code: 'SPIN10' } },
  { name: 'Lucas Dubois', slug: 'lucas.dubois', consent: false, agoMs: 3 * DAY, form: 'newsletter', variant: 'a', page: '/pricing' },
  { name: 'Zara Ahmed', slug: 'zara.ahmed', consent: true, phone: '+44 20 7946 0123', agoMs: 1.5 * DAY + 2 * HOUR, form: 'newsletter', variant: 'b', page: '/features', fields: { company: 'Northwind Studio' } },
  { name: 'Oliver Nilsen', slug: 'oliver.nilsen', consent: true, agoMs: 4.5 * DAY, form: 'wheel', variant: 'a', page: '/pricing', prize: { label: 'Try again', code: '' } },
  { name: 'Zara Ahmed', slug: 'zara.ahmed', consent: true, phone: '+44 20 7946 0123', agoMs: 4 * DAY, form: 'newsletter', variant: 'b', page: '/features', fields: { company: 'Northwind Studio' } },
  { name: 'Emma Garcia', slug: 'emma.garcia', consent: true, agoMs: 5 * DAY, form: 'newsletter', variant: 'a', page: '/blog/getting-started' },
  { name: 'Yusuf Demir', slug: 'yusuf.demir', consent: false, agoMs: 5.5 * DAY, form: 'newsletter', variant: 'b', page: '/docs/introduction' },
  { name: 'Chloe Bernard', slug: 'chloe.bernard', consent: true, agoMs: 6 * DAY, form: 'wheel', variant: 'b', page: '/', prize: { label: '10% off', code: 'SPIN10' } },
  { name: 'Arjun Mehta', slug: 'arjun.mehta', consent: true, agoMs: 6.5 * DAY, form: 'newsletter', variant: 'a', page: '/pricing' },
  { name: 'Isla Murphy', slug: 'isla.murphy', consent: true, agoMs: 9 * DAY, form: 'newsletter', variant: 'b', page: '/features' },
  { name: 'Mateo Silva', slug: 'mateo.silva', consent: true, agoMs: 12 * DAY, form: 'wheel', variant: 'a', page: '/pricing', prize: { label: 'Free shipping', code: 'SHIPFREE' } },
];

let seq = 1;
const delivery = (id: string, status: SubmissionDelivery['status'], agoMs: number, over: Partial<SubmissionDelivery> = {}): SubmissionDelivery => ({
  id: `demo-delivery-${id}-${seq++}`, connection_id: id, connection_name: DEMO_DESTINATION_NAMES[id]!.name, provider: DEMO_DESTINATION_NAMES[id]!.provider,
  status, attempt_count: 1, error: null, completed_at: status === 'pending' ? null : ago(agoMs - 4_000), ...over,
});

/** What happened to a submission at each destination its form routes to. */
function deliveriesFor(seed: Seed, index: number): SubmissionDelivery[] {
  const out: SubmissionDelivery[] = [delivery(DEMO_DESTINATIONS.crm, 'success', seed.agoMs)];
  if (seed.form === 'wheel') {
    const id = DEMO_DESTINATIONS.mailchimp;
    if (!seed.consent) out.push(delivery(id, 'skipped', seed.agoMs, { error: 'No marketing consent given' }));
    else if (index === 0) out.push(delivery(id, 'pending', seed.agoMs, { attempt_count: 2, error: 'Mailchimp returned 503 (service unavailable)' }));
    else out.push(delivery(id, 'success', seed.agoMs));
  } else {
    const id = DEMO_DESTINATIONS.slack;
    // The Slack hook was removed a day ago: newer submissions failed there, older ones arrived.
    out.push(seed.agoMs < 1 * DAY ? delivery(id, 'failed', seed.agoMs, { error: 'Webhook returned 410 (gone)' }) : delivery(id, 'success', seed.agoMs));
  }
  return out;
}

const ALL: (Submission & { form_id: string })[] = [...SEEDS].sort((a, b) => a.agoMs - b.agoMs).map((s, i) => ({
  form_id: DEMO_FORMS[s.form].id,
  id: `demo-sub-${i + 1}`,
  email: `${s.slug}@example.com`,
  name: s.name,
  phone: s.phone ?? '',
  consent: s.consent,
  fields: { ...(s.fields ?? {}) },
  prize: s.prize ? { id: String(i % 4), label: s.prize.label, coupon_code: s.prize.code || null } : null,
  variant: s.variant,
  page_url: `https://seentics.com${s.page}`,
  referrer: i % 2 === 0 ? 'https://www.google.com/' : '',
  created_at: ago(s.agoMs),
  deliveries: deliveriesFor(s, i),
}));

const forForm = (automationId: string) => ALL.filter((s) => s.form_id === automationId);
const strip = ({ form_id: _form, ...submission }: Submission & { form_id: string }): Submission => submission;

export function demoSubmissionsPage(automationId: string, filters: SubmissionFilters): SubmissionPage {
  const term = filters.search.trim().toLowerCase();
  const matching = forForm(automationId).filter((s) => !term || s.email.toLowerCase().includes(term) || s.name.toLowerCase().includes(term));
  return { submissions: matching.slice(filters.offset, filters.offset + filters.limit).map(strip), total: matching.length };
}

export function demoFormSummary(automationId: string): FormSummary {
  const rows = forForm(automationId);
  const weekAgo = ago(7 * DAY);
  const monthAgo = ago(30 * DAY);
  const counts = new Map<string | null, number>();
  rows.forEach((r) => counts.set(r.variant, (counts.get(r.variant) ?? 0) + 1));
  return {
    total: rows.length,
    last_7_days: rows.filter((r) => r.created_at >= weekAgo).length,
    last_30_days: rows.filter((r) => r.created_at >= monthAgo).length,
    by_variant: [...counts.entries()].map(([variant, count]) => ({ variant, count })).sort((a, b) => b.count - a.count),
    with_prize: rows.filter((r) => r.prize).length,
  };
}

/** Same columns as the server's export, for the demo's Export button. */
export function demoSubmissionsCsv(automationId: string): string {
  const header = ['submitted_at', 'email', 'name', 'phone', 'consent', 'variant', 'page_url', 'prize'];
  const lines = forForm(automationId).map((s) => [s.created_at, s.email, s.name, s.phone, s.consent, s.variant ?? '', s.page_url, s.prize?.label ?? ''].join(','));
  return [header.join(','), ...lines].join('\n');
}

/** Every demo submission with the form it came from, newest first — the Leads page builds on these. */
export function demoAllSubmissions(): ReadonlyArray<Submission & { form_id: string }> {
  return ALL;
}
