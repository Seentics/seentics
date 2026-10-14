import { describe, expect, it } from 'vitest';
import { readAskParams } from '@/features/ai/ask-link';
import {
  alertHref, alertLinkLabel, askWhyHref, bannerAlerts, parseAlertSettings, parseAlertsResponse,
  relativeTime, severityRank, sortAlerts,
} from '@/features/ai/alerts/format';
import type { AlertView } from '@/features/ai/alerts/types';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();

const alert = (over: Partial<AlertView> = {}): AlertView => ({
  id: 'a1', type: 'traffic_drop', severity: 'medium', status: 'open',
  title: 'Pageviews down 62%', summary: '120 pageviews against a usual 320.',
  explanation: null, explanationSource: null, metric: 'pageviews',
  observed: 120, expected: 320, changePct: -62,
  windowStart: ago(75), windowEnd: ago(15), detectedAt: ago(10), lastSeenAt: ago(10), resolvedAt: null,
  path: '', askPrompt: 'Why did pageviews drop in the last hour?', ...over,
});

describe('ordering', () => {
  it('ranks severities, unknown last', () => {
    expect(severityRank('critical')).toBeGreaterThan(severityRank('high'));
    expect(severityRank('low')).toBe(0);
    expect(severityRank('weird')).toBe(-1);
  });

  it('puts open first, then the worst, then the newest', () => {
    const list = [
      alert({ id: 'resolved-critical', status: 'resolved', severity: 'critical', resolvedAt: ago(5) }),
      alert({ id: 'old-high', severity: 'high', detectedAt: ago(120) }),
      alert({ id: 'new-high', severity: 'high', detectedAt: ago(5) }),
      alert({ id: 'critical', severity: 'critical', detectedAt: ago(300) }),
    ];
    expect(sortAlerts(list).map((a) => a.id)).toEqual(['critical', 'new-high', 'old-high', 'resolved-critical']);
    expect(list[0]!.id).toBe('resolved-critical');
  });
});

describe('bannerAlerts', () => {
  it('shows open alerts and those resolved within a day, capped, counting the rest', () => {
    const list = [
      alert({ id: 'o1', severity: 'low' }),
      alert({ id: 'o2', severity: 'critical' }),
      alert({ id: 'r-recent', status: 'resolved', resolvedAt: ago(60) }),
      alert({ id: 'r-old', status: 'resolved', resolvedAt: ago(25 * 60) }),
      alert({ id: 'o3', severity: 'high' }),
    ];
    const { shown, hidden } = bannerAlerts(list, NOW);
    expect(shown.map((a) => a.id)).toEqual(['o2', 'o3', 'o1']);
    expect(hidden).toBe(1);
  });

  it('is empty when everything is long resolved', () => {
    expect(bannerAlerts([alert({ status: 'resolved', resolvedAt: ago(3000) })], NOW).shown).toEqual([]);
    expect(bannerAlerts([alert({ status: 'resolved', resolvedAt: null })], NOW).shown).toEqual([]);
  });
});

describe('labels and links', () => {
  it('formats relative times', () => {
    expect(relativeTime(ago(0), NOW)).toBe('just now');
    expect(relativeTime(ago(12), NOW)).toBe('12 min ago');
    expect(relativeTime(ago(180), NOW)).toBe('3 h ago');
    expect(relativeTime(ago(2 * 24 * 60), NOW)).toBe('2 d ago');
    expect(relativeTime('nope', NOW)).toBe('');
  });

  it('links only to safe dashboard paths', () => {
    expect(alertHref('w1', 'errors')).toBe('/websites/w1/errors');
    expect(alertHref('w1', 'settings/tracking')).toBe('/websites/w1/settings/tracking');
    expect(alertHref('w1', '')).toBeNull();
    expect(alertHref('w1', 'https://evil.test')).toBeNull();
    expect(alertHref('w1', '//evil.test')).toBeNull();
    expect(alertHref('w1', '../admin')).toBeNull();
    expect(alertHref('w1', 'javascript:alert(1)')).toBeNull();
  });

  it('names the link after its page', () => {
    expect(alertLinkLabel('errors')).toBe('View errors');
    expect(alertLinkLabel('goals')).toBe('View goals');
    expect(alertLinkLabel('settings/tracking')).toBe('Check tracking');
    expect(alertLinkLabel('pages')).toBe('Open');
  });

  it('asks the alert question in AI mode, falling back to the title', () => {
    const href = askWhyHref('w1', alert());
    expect(href.startsWith('/websites/w1/ai?')).toBe(true);
    expect(readAskParams(new URLSearchParams(href.split('?')[1]))).toEqual({ q: 'Why did pageviews drop in the last hour?', ctx: 'Alert' });
    const fallback = askWhyHref('w1', { askPrompt: ' ', title: 'Errors surged' });
    expect(readAskParams(new URLSearchParams(fallback.split('?')[1]))?.q).toBe('Why did this happen: Errors surged?');
  });
});

describe('response parsing', () => {
  it('reads alerts, settings and role', () => {
    const r = parseAlertsResponse({ alerts: [alert()], settings: { enabled: false, sensitivity: 'high' }, canManage: true });
    expect(r.alerts).toHaveLength(1);
    expect(r.alerts[0]!.changePct).toBe(-62);
    expect(r.settings).toEqual({ enabled: false, sensitivity: 'high' });
    expect(r.canManage).toBe(true);
  });

  it('drops malformed alerts and defaults what is missing', () => {
    const r = parseAlertsResponse({
      alerts: [{ id: 'x', type: 'unknown', title: 't' }, { type: 'error_surge', title: 'no id' }, { ...alert(), severity: 'mega', changePct: null }],
    });
    expect(r.alerts.map((a) => a.severity)).toEqual(['medium']);
    expect(r.alerts[0]!.changePct).toBeNull();
    expect(r.settings).toEqual({ enabled: true, sensitivity: 'normal' });
    expect(r.canManage).toBe(false);
    expect(parseAlertsResponse(undefined).alerts).toEqual([]);
  });

  it('reads settings defensively', () => {
    expect(parseAlertSettings({ enabled: false, sensitivity: 'low', canManage: true })).toEqual({ enabled: false, sensitivity: 'low', canManage: true });
    expect(parseAlertSettings({ sensitivity: 'extreme' })).toEqual({ enabled: true, sensitivity: 'normal', canManage: false });
  });
});
