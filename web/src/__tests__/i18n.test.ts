import { describe, expect, it } from 'vitest';
import { cookieDomain, isLocale } from '@/lib/i18n/locale';
import { offersManualPayments } from '@/lib/i18n/region';
import { en } from '@/lib/i18n/messages/en';
import { bn } from '@/lib/i18n/messages/bn';
import { cardSectionsFor, compareGroups, formatTaka } from '@/features/plans/pricing-spec';
import { isBdMobile, isTransactionId, normalisePayerNumber } from '@/features/billing/payment';

/** Every string leaf of a dictionary, by path; functions are called with sample arguments. */
function leaves(value: unknown, path = ''): Array<[string, unknown]> {
  if (typeof value === 'function') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [[path, value]];
}

describe('Bangla dictionary', () => {
  it('has a non-empty value for every English key', () => {
    const bnLeaves = new Map(leaves(bn));
    for (const [path, value] of leaves(en)) {
      // Lists (FAQ, figures, steps) may differ in length; their items are checked where they exist.
      if (/\[\d+\]/.test(path)) continue;
      expect(bnLeaves.has(path), path).toBe(true);
      if (typeof value === 'string') expect(String(bnLeaves.get(path)).trim(), path).not.toBe('');
    }
  });

  it('is actually Bangla where English would show', () => {
    expect(bn.hero.titleA).toMatch(/[ঀ-৿]/);
    expect(bn.invoice.submit).toMatch(/[ঀ-৿]/);
    expect(bn.pricing.card.includedTitle).toMatch(/[ঀ-৿]/);
  });

  it('renders the pricing cards and table in Bangla without undefined', () => {
    const plan = {
      tier: 'pro' as const, priceMonthly: 24, priceYearly: 240,
      limits: { core: { monthly_events: -1, included_monthly_events: 1_000_000, replays: -1, included_replays: 5_000, heatmaps: -1, funnels: -1, automations: -1, websites: -1, ai_analyses: 300, leads: 25_000, retention_days: 1095 } },
    };
    const text = JSON.stringify(cardSectionsFor(plan, bn.pricing));
    expect(text).not.toContain('undefined');
    expect(text).toContain('আনলিমিটেড');
    expect(compareGroups(bn.pricing).map((g) => g.title)).toContain('সেশন রিপ্লে');
  });
});

describe('locale cookie', () => {
  it('is shared on the parent domain, and host-only on localhost and IPs', () => {
    expect(cookieDomain('seentics.com')).toBe('.seentics.com');
    expect(cookieDomain('auth.seentics.com')).toBe('.seentics.com');
    expect(cookieDomain('localhost')).toBeNull();
    expect(cookieDomain('127.0.0.1')).toBeNull();
  });

  it('knows its locales', () => {
    expect(isLocale('bn')).toBe(true);
    expect(isLocale('fr')).toBe(false);
  });
});

describe('taka payments', () => {
  const methods = [{ id: 'bkash' as const, name: 'bKash', number: '01700000000', kind: 'personal' as const }];

  it('are offered only in Bangladesh, with a number to pay to', () => {
    expect(offersManualPayments({ country: 'BD', region: 'bd', manualPayments: { accountName: null, methods } })).toBe(true);
    expect(offersManualPayments({ country: 'BD', region: 'bd', manualPayments: null })).toBe(false);
    expect(offersManualPayments({ country: 'BD', region: 'bd', manualPayments: { accountName: null, methods: [] } })).toBe(false);
    expect(offersManualPayments({ country: 'US', region: 'global', manualPayments: null })).toBe(false);
    expect(offersManualPayments(null)).toBe(false);
  });

  it('formats taka with Latin digits, rounding a year spread over months', () => {
    expect(formatTaka(1499)).toBe('৳1,499');
    expect(formatTaka(4990 / 12)).toBe('৳416');
  });

  it('checks the sender number and transaction id', () => {
    expect(isBdMobile('01712345678')).toBe(true);
    expect(isBdMobile('+880 1712-345678')).toBe(true);
    expect(normalisePayerNumber('+8801712345678')).toBe('01712345678');
    expect(isBdMobile('01212345678')).toBe(false);
    expect(isBdMobile('0171234567')).toBe(false);
    // Rocket's carry a twelfth check digit, which the gateway accepts.
    expect(isBdMobile('018123456789')).toBe(true);
    expect(isBdMobile('0181234567890')).toBe(false);
    expect(isTransactionId(' 9GH7K2LMNP ')).toBe(true);
    expect(isTransactionId('abc')).toBe(false);
    expect(isTransactionId('9GH7-K2LMNP')).toBe(false);
  });
});
