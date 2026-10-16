import { describe, expect, it } from 'vitest';
import { formatValue, isMeasurementId, isPixelId, matchTip, percent } from '@/components/conversions/conversion-format';
import { cleanConfig, defaultConfig } from '@/components/conversions/EventMappingFields';

describe('conversion formatting', () => {
  it('works out shares safely', () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 0)).toBe(0);
  });

  it('formats a value with its currency, or a dash', () => {
    expect(formatValue(49.9, 'USD')).toBe('$49.90');
    expect(formatValue(1200, 'EUR')).toBe('€1,200.00');
    expect(formatValue(null, 'USD')).toBe('—');
    expect(formatValue(10, 'NOTACURRENCY')).toContain('10.00');
  });

  it('recognises a pixel id and a GA4 measurement id', () => {
    expect(isPixelId('104851239920392')).toBe(true);
    expect(isPixelId('pixel-1')).toBe(false);
    expect(isMeasurementId('G-7QX2LM4K9P')).toBe(true);
    expect(isMeasurementId(' g-abc123 ')).toBe(true);
    expect(isMeasurementId('UA-1234-1')).toBe(false);
  });

  it('suggests sending the email only when it is the weak link, and only with enough data', () => {
    expect(matchTip({ total: 20, email: 4, click_id: 15 })).toMatch(/email/);
    expect(matchTip({ total: 20, email: 15, click_id: 15 })).toBeNull();
    expect(matchTip({ total: 3, email: 0, click_id: 0 })).toBeNull();
  });
});

describe('event mapping', () => {
  it('starts from the platform’s standard names', () => {
    expect(defaultConfig('meta').events).toEqual({ purchase: 'Purchase', lead: 'Lead', sign_up: 'CompleteRegistration' });
    expect(defaultConfig('ga4').events).toEqual({ purchase: 'purchase', lead: 'generate_lead', sign_up: 'sign_up' });
  });

  it('cleans before saving: blank names fall back to the default, off stays off, half-filled custom rows go', () => {
    const cleaned = cleanConfig('meta', {
      events: { purchase: '  ', lead: null, sign_up: ' SignUp ' },
      custom: [{ name: ' checkout_started ', platform_event: 'InitiateCheckout' }, { name: 'x', platform_event: '' }],
    });
    expect(cleaned.events).toEqual({ purchase: 'Purchase', lead: null, sign_up: 'SignUp' });
    expect(cleaned.custom).toEqual([{ name: 'checkout_started', platform_event: 'InitiateCheckout' }]);
  });
});
