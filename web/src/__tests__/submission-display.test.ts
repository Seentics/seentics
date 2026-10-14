import { describe, expect, it } from 'vitest';
import {
  avatarTone, countDeliveries, deliverySummary, hostOf, humanizeKey, initials, pathOf, topVariant,
} from '@/lib/submission-display';

describe('initials', () => {
  it('uses the first and last word of the name, else the email', () => {
    expect(initials('Ava Marie Martin', 'a@example.com')).toBe('AM');
    expect(initials('Noah', 'n@example.com')).toBe('NO');
    expect(initials('', 'zara.ahmed@example.com')).toBe('ZA');
    expect(initials('', '@example.com')).toBe('?');
  });
});

describe('avatarTone', () => {
  it('is stable per address', () => {
    expect(avatarTone('a@example.com')).toBe(avatarTone('a@example.com'));
  });
});

describe('pathOf / hostOf / humanizeKey', () => {
  it('shortens urls and keys', () => {
    expect(pathOf('https://example.com/pricing?x=1')).toBe('/pricing');
    expect(pathOf('not a url')).toBe('not a url');
    expect(hostOf('https://www.google.com/search')).toBe('google.com');
    expect(hostOf('')).toBe('');
    expect(humanizeKey('company_name')).toBe('Company name');
  });
});

describe('deliveries', () => {
  const d = (...statuses: ('success' | 'pending' | 'failed' | 'skipped')[]) => statuses.map((status) => ({ status }));

  it('counts each state', () => {
    expect(countDeliveries(d('success', 'success', 'failed', 'pending', 'skipped'))).toEqual({ delivered: 2, pending: 1, failed: 1, skipped: 1 });
  });

  it('summarises with the worst news first', () => {
    expect(deliverySummary([])).toBe('Not sent anywhere');
    expect(deliverySummary(d('success', 'failed', 'pending'))).toBe('1 failed');
    expect(deliverySummary(d('success', 'pending'))).toBe('1 waiting');
    expect(deliverySummary(d('success', 'success', 'skipped'))).toBe('2 sent, 1 skipped');
    expect(deliverySummary(d('skipped'))).toBe('1 skipped');
  });
});

describe('topVariant', () => {
  it('picks the busiest named variant, or none', () => {
    expect(topVariant([{ variant: 'a', count: 3 }, { variant: 'b', count: 9 }])).toEqual({ label: 'Variant B', count: 9 });
    expect(topVariant([{ variant: null, count: 5 }])).toBeNull();
    expect(topVariant([])).toBeNull();
  });
});
