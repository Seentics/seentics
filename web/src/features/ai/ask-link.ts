/**
 * Links into AI mode with a question already typed.
 *
 * `/websites/:id/ai?q=…&ctx=…` opens a fresh chat with `q` in the composer — not sent, so
 * the visitor can read it, change it, or not ask at all. `ctx` is a short label for where
 * the question came from ("Top pages"), shown beside the composer.
 *
 * Pure functions, so the question each panel asks and the URL it builds are testable
 * without rendering a dashboard.
 */
import { aiEn, type AiMessages } from '@/lib/i18n/messages/ai-en';

/** Long enough for any question a panel writes; short enough to keep the URL sane. */
export const ASK_MAX_LENGTH = 500;
const CTX_MAX_LENGTH = 60;

export function buildAskAiHref(websiteId: string, question: string, context?: string, recommendationId?: string): string {
  const params = new URLSearchParams();
  params.set('q', question.trim().slice(0, ASK_MAX_LENGTH));
  const ctx = context?.trim().slice(0, CTX_MAX_LENGTH);
  if (ctx) params.set('ctx', ctx);
  // A recommendation's "Do it": carried with the chat so confirming its draft marks it applied.
  if (recommendationId && UUID.test(recommendationId)) params.set('rec', recommendationId);
  return `/websites/${encodeURIComponent(websiteId)}/ai?${params.toString()}`;
}

export interface AskParams {
  q: string;
  ctx: string | null;
  /** The recommendation the question came from, when it came from one. */
  rec?: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The prefill a URL asks for, or `null` when there is none.
 *
 * Clamped on the way in as well as the way out: the link is a URL anyone can hand-write,
 * and the composer has its own length ceiling a longer value would silently exceed.
 */
export function readAskParams(search: Pick<URLSearchParams, 'get'> | null | undefined): AskParams | null {
  const q = search?.get('q')?.trim().slice(0, ASK_MAX_LENGTH);
  if (!q) return null;
  const ctx = search?.get('ctx')?.trim().slice(0, CTX_MAX_LENGTH) || null;
  const rec = search?.get('rec')?.trim();
  return rec && UUID.test(rec) ? { q, ctx, rec } : { q, ctx };
}

/**
 * "7 days", "24 hours", "12 months" — the dashboard's range as a question reads it. `t` is
 * `useT().ai.ask.range` for the viewer's language; English without it.
 */
export function rangeLabel(days: number, t: AskMessages['range'] = aiEn.ask.range): string {
  if (!Number.isFinite(days) || days <= 1) return t.hours24;
  if (days === 365) return t.months12;
  return t.days(Math.round(days));
}

type AskMessages = AiMessages['ask'];

/**
 * The question each panel's "Ask AI" button asks, and the label it carries.
 *
 * Phrased as something the assistant's tools can actually answer for the range on screen,
 * rather than "tell me about this", which gets a description of the chart back. Each takes
 * `useT().ai.ask` last so the question is typed in the viewer's language (the assistant
 * answers in the language it is asked in); English without it.
 */
export const askAbout = {
  pages: (days: number, t: AskMessages = aiEn.ask) => ({ question: t.pages(rangeLabel(days, t.range)), context: t.pagesContext }),
  sources: (days: number, t: AskMessages = aiEn.ask) => ({ question: t.sources(rangeLabel(days, t.range)), context: t.sourcesContext }),
  devices: (days: number, t: AskMessages = aiEn.ask) => ({ question: t.devices(rangeLabel(days, t.range)), context: t.devicesContext }),
  geography: (days: number, t: AskMessages = aiEn.ask) => ({ question: t.geography(rangeLabel(days, t.range)), context: t.geographyContext }),
  utm: (days: number, t: AskMessages = aiEn.ask) => ({ question: t.utm(rangeLabel(days, t.range)), context: t.utmContext }),
  traffic: (days: number, t: AskMessages = aiEn.ask) => ({ question: t.traffic(rangeLabel(days, t.range)), context: t.trafficContext }),
  funnels: (days: number, t: AskMessages = aiEn.ask) => ({ question: t.funnels(rangeLabel(days, t.range)), context: t.funnelsContext }),
  funnel: (name: string, t: AskMessages = aiEn.ask) => ({ question: t.funnel(name), context: t.funnelContext(name) }),
  replays: (days: number, t: AskMessages = aiEn.ask) => ({ question: t.replays(rangeLabel(days, t.range)), context: t.replaysContext }),
  /** Names the session so the assistant can call `get_session_summary` with it. */
  session: (sessionId: string, t: AskMessages = aiEn.ask) => ({ question: t.session(sessionId), context: t.sessionContext }),
  heatmaps: (days: number, t: AskMessages = aiEn.ask) => ({ question: t.heatmaps(rangeLabel(days, t.range)), context: t.heatmapsContext }),
} as const;
