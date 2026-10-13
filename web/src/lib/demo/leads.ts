/**
 * Demo leads for the Leads inbox (websiteId === "demo").
 *
 * Every address is on `example.com`, a domain reserved for documentation, so none of these
 * people exist and no real mailbox could ever receive anything. Submissions point at the two
 * demo popups in `demo/automations.ts`, so the attribution shown here matches a real route.
 */
import type {
  Contact, ContactDetail, ContactFilters, ContactPage, ContactStatus, ContactSubmission, LeadStats,
} from '@/features/leads/types';
import { demoDate } from './fixture-utils';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const DEMO_POPUPS = {
  wheel: { id: 'demo-auto-5', name: 'Spin to Win Wheel' },
  newsletter: { id: 'demo-auto-6', name: 'Exit-Intent Newsletter Signup' },
} as const;

type Seed = {
  name: string;
  slug: string;
  status: ContactStatus;
  consent: boolean;
  phone?: string;
  firstAgo: number;
  lastAgo: number;
  popup: keyof typeof DEMO_POPUPS;
  variant: 'a' | 'b';
  page: string;
  fields?: Record<string, string>;
  submissions: number;
};

const SEEDS: Seed[] = [
  { name: 'Ava Martin', slug: 'ava.martin', status: 'new', consent: true, firstAgo: 2 * HOUR, lastAgo: 2 * HOUR, popup: 'wheel', variant: 'a', page: '/pricing', fields: { prize: '20% off', coupon_code: 'SPIN20' }, submissions: 1 },
  { name: 'Noah Kim', slug: 'noah.kim', status: 'new', consent: true, firstAgo: 5 * HOUR, lastAgo: 5 * HOUR, popup: 'newsletter', variant: 'b', page: '/blog/getting-started', submissions: 1 },
  { name: 'Sofia Rossi', slug: 'sofia.rossi', status: 'new', consent: false, firstAgo: 9 * HOUR, lastAgo: 9 * HOUR, popup: 'newsletter', variant: 'a', page: '/features', submissions: 1 },
  { name: 'Liam Becker', slug: 'liam.becker', status: 'contacted', consent: true, phone: '+49 30 5550 142', firstAgo: 1 * DAY, lastAgo: 3 * HOUR, popup: 'wheel', variant: 'a', page: '/pricing', fields: { prize: 'Free shipping', coupon_code: 'SHIPFREE' }, submissions: 2 },
  { name: 'Mia Okafor', slug: 'mia.okafor', status: 'new', consent: true, firstAgo: 1.2 * DAY, lastAgo: 1.2 * DAY, popup: 'newsletter', variant: 'b', page: '/docs/introduction', submissions: 1 },
  { name: 'Ethan Walker', slug: 'ethan.walker', status: 'contacted', consent: true, firstAgo: 2 * DAY, lastAgo: 2 * DAY, popup: 'newsletter', variant: 'a', page: '/blog/getting-started', submissions: 1 },
  { name: 'Hana Sato', slug: 'hana.sato', status: 'new', consent: true, firstAgo: 2.4 * DAY, lastAgo: 2.4 * DAY, popup: 'wheel', variant: 'b', page: '/', fields: { prize: '10% off', coupon_code: 'SPIN10' }, submissions: 1 },
  { name: 'Lucas Dubois', slug: 'lucas.dubois', status: 'archived', consent: false, firstAgo: 3 * DAY, lastAgo: 3 * DAY, popup: 'newsletter', variant: 'a', page: '/pricing', submissions: 1 },
  { name: 'Zara Ahmed', slug: 'zara.ahmed', status: 'contacted', consent: true, phone: '+44 20 7946 0123', firstAgo: 4 * DAY, lastAgo: 1.5 * DAY, popup: 'newsletter', variant: 'b', page: '/features', fields: { company: 'Northwind Studio' }, submissions: 3 },
  { name: 'Oliver Nilsen', slug: 'oliver.nilsen', status: 'new', consent: true, firstAgo: 4.5 * DAY, lastAgo: 4.5 * DAY, popup: 'wheel', variant: 'a', page: '/pricing', fields: { prize: 'Try again', coupon_code: '' }, submissions: 1 },
  { name: 'Emma Garcia', slug: 'emma.garcia', status: 'contacted', consent: true, firstAgo: 5 * DAY, lastAgo: 5 * DAY, popup: 'newsletter', variant: 'a', page: '/blog/getting-started', submissions: 1 },
  { name: 'Yusuf Demir', slug: 'yusuf.demir', status: 'new', consent: false, firstAgo: 5.5 * DAY, lastAgo: 5.5 * DAY, popup: 'newsletter', variant: 'b', page: '/docs/introduction', submissions: 1 },
  { name: 'Chloe Bernard', slug: 'chloe.bernard', status: 'archived', consent: true, firstAgo: 6 * DAY, lastAgo: 6 * DAY, popup: 'wheel', variant: 'b', page: '/', fields: { prize: '10% off', coupon_code: 'SPIN10' }, submissions: 1 },
  { name: 'Arjun Mehta', slug: 'arjun.mehta', status: 'new', consent: true, firstAgo: 6.5 * DAY, lastAgo: 6.5 * DAY, popup: 'newsletter', variant: 'a', page: '/pricing', submissions: 1 },
  { name: 'Isla Murphy', slug: 'isla.murphy', status: 'contacted', consent: true, firstAgo: 9 * DAY, lastAgo: 9 * DAY, popup: 'newsletter', variant: 'b', page: '/features', submissions: 1 },
  { name: 'Mateo Silva', slug: 'mateo.silva', status: 'new', consent: true, firstAgo: 12 * DAY, lastAgo: 12 * DAY, popup: 'wheel', variant: 'a', page: '/pricing', fields: { prize: 'Free shipping', coupon_code: 'SHIPFREE' }, submissions: 1 },
];

const idOf = (index: number) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
const iso = (agoMs: number) => demoDate(-agoMs).toISOString();

const CONTACTS: Contact[] = SEEDS.map((s, i) => ({
  id: idOf(i),
  email: `${s.slug}@example.com`,
  name: s.name,
  phone: s.phone ?? '',
  status: s.status,
  consent: s.consent,
  submission_count: s.submissions,
  first_submitted_at: iso(s.firstAgo),
  last_submitted_at: iso(s.lastAgo),
}));

/** Newest activity first, like the real inbox. */
const SORTED = [...CONTACTS].sort((a, b) => b.last_submitted_at.localeCompare(a.last_submitted_at));

export function demoContacts(filters: ContactFilters): ContactPage {
  const term = filters.search.trim().toLowerCase();
  const matching = SORTED.filter((c) =>
    (!filters.status || c.status === filters.status) &&
    (!term || c.email.toLowerCase().includes(term) || c.name.toLowerCase().includes(term)));
  return { contacts: matching.slice(filters.offset, filters.offset + filters.limit), total: matching.length };
}

export function demoContact(contactId: string): ContactDetail | null {
  const index = CONTACTS.findIndex((c) => c.id === contactId);
  const seed = SEEDS[index];
  if (index < 0 || !seed) return null;

  const popup = DEMO_POPUPS[seed.popup];
  // A repeat visitor's earlier submissions are spread back from the latest one.
  const submissions: ContactSubmission[] = Array.from({ length: seed.submissions }, (_, n) => ({
    id: `${idOf(index)}-s${n}`,
    automation_id: popup.id,
    automation_name: popup.name,
    variant: seed.variant,
    fields: n === 0 ? { ...(seed.fields ?? {}) } : {},
    page_url: `https://seentics.com${seed.page}`,
    referrer: n % 2 === 0 ? 'https://www.google.com/' : '',
    created_at: iso(seed.lastAgo + n * ((seed.firstAgo - seed.lastAgo) / Math.max(1, seed.submissions - 1))),
  }));
  return { contact: CONTACTS[index]!, submissions };
}

export function demoLeadStats(): LeadStats {
  const weekAgo = demoDate(-7 * DAY).toISOString();
  const counts = new Map<string, number>();
  SEEDS.forEach((s) => counts.set(s.popup, (counts.get(s.popup) ?? 0) + s.submissions));
  return {
    total: CONTACTS.length,
    last_7_days: CONTACTS.filter((c) => c.first_submitted_at >= weekAgo).length,
    by_automation: [...counts.entries()]
      .map(([key, count]) => ({ automation_id: DEMO_POPUPS[key as keyof typeof DEMO_POPUPS].id, name: DEMO_POPUPS[key as keyof typeof DEMO_POPUPS].name, count }))
      .sort((a, b) => b.count - a.count),
  };
}
