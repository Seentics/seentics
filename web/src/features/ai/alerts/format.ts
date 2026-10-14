/**
 * Pure helpers for anomaly alerts: ordering, what the dashboard banner shows, labels and
 * links. No React, so each is testable without rendering the banner.
 */
import { buildAskAiHref } from '../ask-link';
import { evidenceHref } from '../insights/card-state';
import type {
  AlertSensitivity, AlertSettingsResponse, AlertSeverity, AlertView, AlertsResponse,
} from './types';

const SEVERITIES: readonly AlertSeverity[] = ['low', 'medium', 'high', 'critical'];
const SENSITIVITIES: readonly AlertSensitivity[] = ['low', 'normal', 'high'];
const TYPES = ['traffic_drop', 'traffic_spike', 'tracking_outage', 'error_surge', 'conversion_drop'] as const;

/** Higher is worse. Unknown severities sort last. */
export function severityRank(s: string): number {
  return SEVERITIES.indexOf(s as AlertSeverity);
}

export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical',
};

/** Tailwind classes for the dot beside an alert. */
export const SEVERITY_DOT: Record<AlertSeverity, string> = {
  low: 'bg-muted-foreground/50',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-destructive',
};

export const SENSITIVITY_OPTIONS: ReadonlyArray<{ value: AlertSensitivity; label: string; hint: string }> = [
  { value: 'low', label: 'Low', hint: 'Only large, sustained changes. Fewest alerts.' },
  { value: 'normal', label: 'Normal', hint: 'Clear departures from what is usual for that hour of the week.' },
  { value: 'high', label: 'High', hint: 'Smaller changes too. More alerts, some of them minor.' },
];

const ts = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : 0;
};

/** Open first, then worst severity, then newest. Does not mutate. */
export function sortAlerts(alerts: readonly AlertView[]): AlertView[] {
  return [...alerts].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
    const sev = severityRank(b.severity) - severityRank(a.severity);
    if (sev !== 0) return sev;
    return ts(b.status === 'open' ? b.detectedAt : b.resolvedAt) - ts(a.status === 'open' ? a.detectedAt : a.resolvedAt);
  });
}

export const RESOLVED_SHOWN_MS = 24 * 60 * 60 * 1000;
export const BANNER_MAX = 3;

/**
 * What the dashboard banner lists: every open alert, and those back to normal within the last
 * day (so an owner who saw the email can see it is over), worst first, at most `max`.
 */
export function bannerAlerts(alerts: readonly AlertView[], now = Date.now(), max = BANNER_MAX): { shown: AlertView[]; hidden: number } {
  const relevant = alerts.filter((a) =>
    // Snoozed from the assistant: still listed on the alerts page, not in the banner.
    !(ts(a.snoozedUntil) > now) &&
    (a.status === 'open' || (a.status === 'resolved' && now - ts(a.resolvedAt) <= RESOLVED_SHOWN_MS && ts(a.resolvedAt) > 0)));
  const sorted = sortAlerts(relevant);
  return { shown: sorted.slice(0, max), hidden: Math.max(0, sorted.length - max) };
}

/** "just now", "12 min ago", "3 h ago", "2 d ago". */
export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  const t = ts(iso);
  if (!t) return '';
  const min = Math.max(0, Math.round((now - t) / 60_000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

/** The page an alert points at, or `null` when its path is not a safe dashboard link. `''` is the overview. */
export function alertHref(websiteId: string, path: string | null | undefined): string | null {
  // Core sends a bare suffix; anything that starts like an absolute or protocol-relative URL is refused outright.
  if ((path ?? '').trim().startsWith('/')) return null;
  return evidenceHref(websiteId, path);
}

/** Link label for the page an alert points at. */
export function alertLinkLabel(path: string): string {
  const p = path.replace(/^\/+/, '');
  if (p.startsWith('errors')) return 'View errors';
  if (p.startsWith('goals')) return 'View goals';
  if (p.startsWith('settings/tracking') || p.startsWith('settings/features') || p.startsWith('settings/websites')) return 'Check tracking';
  return 'Open';
}

/** "Ask AI why": the alert's own question, or one built from its title when it has none. */
export function askWhyHref(websiteId: string, alert: Pick<AlertView, 'askPrompt' | 'title'>): string {
  const question = alert.askPrompt?.trim() || `Why did this happen: ${alert.title}?`;
  return buildAskAiHref(websiteId, question, 'Alert');
}

// ─── Response parsing ─────────────────────────────────────────────────────────

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function parseAlertSettings(raw: unknown): AlertSettingsResponse {
  const r = (raw ?? {}) as Record<string, unknown>;
  const sensitivity = SENSITIVITIES.includes(r.sensitivity as AlertSensitivity) ? (r.sensitivity as AlertSensitivity) : 'normal';
  return { enabled: r.enabled !== false, sensitivity, canManage: r.canManage === true };
}

function parseAlert(raw: unknown): AlertView | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const id = str(r.id);
  const title = str(r.title).trim();
  if (!id || !title || !TYPES.includes(r.type as (typeof TYPES)[number])) return null;
  const severity = SEVERITIES.includes(r.severity as AlertSeverity) ? (r.severity as AlertSeverity) : 'medium';
  return {
    id,
    type: r.type as AlertView['type'],
    severity,
    status: r.status === 'resolved' ? 'resolved' : 'open',
    title,
    summary: str(r.summary),
    explanation: typeof r.explanation === 'string' && r.explanation.trim() ? r.explanation : null,
    explanationSource: r.explanationSource === 'ai' || r.explanationSource === 'rules' ? r.explanationSource : null,
    metric: (['pageviews', 'visitors', 'errors', 'conversions'] as const).includes(r.metric as AlertView['metric'])
      ? (r.metric as AlertView['metric']) : 'pageviews',
    observed: num(r.observed),
    expected: num(r.expected),
    changePct: typeof r.changePct === 'number' && Number.isFinite(r.changePct) ? r.changePct : null,
    windowStart: str(r.windowStart),
    windowEnd: str(r.windowEnd),
    detectedAt: str(r.detectedAt),
    lastSeenAt: str(r.lastSeenAt),
    resolvedAt: typeof r.resolvedAt === 'string' ? r.resolvedAt : null,
    path: str(r.path),
    askPrompt: str(r.askPrompt),
  };
}

/** Tolerant of a missing or partial body: a malformed alert is dropped, not rendered half-empty. */
export function parseAlertsResponse(raw: unknown): AlertsResponse {
  const r = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(r.alerts) ? r.alerts : [];
  const settings = parseAlertSettings(r.settings);
  return {
    alerts: list.map(parseAlert).filter((a): a is AlertView => a !== null),
    settings: { enabled: settings.enabled, sensitivity: settings.sensitivity },
    canManage: r.canManage === true,
  };
}
