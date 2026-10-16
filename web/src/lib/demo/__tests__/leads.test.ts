import { describe, expect, it } from 'vitest';
import {
  demoContactDetail, demoContactsCsv, demoContactsPage, demoLeadForms, demoSiteSubmissionsCsv, demoSiteSubmissionsPage,
} from '@/lib/demo/leads';
import { demoAllSubmissions } from '@/lib/demo/submissions';

const contacts = { search: '', status: '' as const, tag: '', source: '' as const, sort: 'last_activity' as const, limit: 100, offset: 0 };
const submissions = { search: '', form: '', from: '', to: '', limit: 100, offset: 0 };

describe('demo leads', () => {
  it('lists every demo submission site-wide, each tied to its form and contact', () => {
    const page = demoSiteSubmissionsPage(submissions);
    expect(page.total).toBe(demoAllSubmissions().length);
    for (const s of page.submissions) {
      expect(s.form_name).toBeTruthy();
      expect(s.contact_id).toMatch(/^demo-contact-/);
      expect(s.email.endsWith('@example.com')).toBe(true);
    }
    expect(page.submissions.some((s) => s.has_replay)).toBe(true);
  });

  it('counts each form and narrows by form, search and date', () => {
    const forms = demoLeadForms();
    expect(forms.reduce((sum, f) => sum + f.count, 0)).toBe(demoAllSubmissions().length);
    const one = demoSiteSubmissionsPage({ ...submissions, form: forms[0]!.id });
    expect(one.total).toBe(forms[0]!.count);
    expect(demoSiteSubmissionsPage({ ...submissions, search: 'liam' }).total).toBe(2);
    expect(demoSiteSubmissionsPage({ ...submissions, from: '2999-01-01T00:00:00.000Z' }).total).toBe(0);
  });

  it('makes one contact per email, plus the hand-added and imported ones', () => {
    const page = demoContactsPage(contacts);
    const emails = new Set(demoAllSubmissions().map((s) => s.email));
    expect(page.contacts.filter((c) => c.source === 'form')).toHaveLength(emails.size);
    expect(page.contacts.some((c) => c.source === 'manual')).toBe(true);
    expect(page.contacts.some((c) => c.source === 'import')).toBe(true);
    // The status counts add up to everyone the other filters leave.
    expect(Object.values(page.statuses).reduce((a, b) => a + b, 0)).toBe(page.total);
    expect(demoContactsPage({ ...contacts, status: 'customer' }).contacts.every((c) => c.status === 'customer')).toBe(true);
    expect(demoContactsPage({ ...contacts, tag: 'vip' }).contacts.every((c) => c.tags.includes('vip'))).toBe(true);
  });

  it('opens a contact with all their submissions', () => {
    const liam = demoContactsPage({ ...contacts, search: 'liam' }).contacts[0]!;
    expect(liam.submission_count).toBe(2);
    const detail = demoContactDetail(liam.id)!;
    expect(detail.submissions).toHaveLength(2);
    expect(demoContactDetail('nope')).toBeNull();
  });

  it('exports what the lists show', () => {
    const subsCsv = demoSiteSubmissionsCsv(submissions).split('\n');
    expect(subsCsv[0]).toBe('submitted_at,email,name,phone,consent,form,channel,utm_campaign,page_url');
    expect(subsCsv).toHaveLength(demoAllSubmissions().length + 1);
    expect(demoContactsCsv({ ...contacts, status: 'customer' }).split('\n').slice(1).every((l) => l.includes(',customer,'))).toBe(true);
  });
});
