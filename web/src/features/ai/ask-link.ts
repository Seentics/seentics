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

/** "7 days", "24 hours", "12 months" — the dashboard's range as a question reads it. */
export function rangeLabel(days: number): string {
  if (!Number.isFinite(days) || days <= 1) return '24 hours';
  if (days === 365) return '12 months';
  return `${Math.round(days)} days`;
}

/**
 * The question each panel's "Ask AI" button asks, and the label it carries.
 *
 * Phrased as something the assistant's tools can actually answer for the range on screen,
 * rather than "tell me about this", which gets a description of the chart back.
 */
export const askAbout = {
  pages: (days: number) => ({
    question: `Which of my top pages changed the most in the last ${rangeLabel(days)}, and why?`,
    context: 'Top pages',
  }),
  sources: (days: number) => ({
    question: `Which traffic sources grew or dropped the most in the last ${rangeLabel(days)}, and why?`,
    context: 'Traffic sources',
  }),
  devices: (days: number) => ({
    question: `How do visitors on different devices, browsers and operating systems behave in the last ${rangeLabel(days)}? Is any of them doing noticeably worse?`,
    context: 'Devices',
  }),
  geography: (days: number) => ({
    question: `Which countries changed the most in the last ${rangeLabel(days)}, and what is driving it?`,
    context: 'Locations',
  }),
  utm: (days: number) => ({
    question: `Which UTM campaigns performed best and worst in the last ${rangeLabel(days)}?`,
    context: 'UTM breakdown',
  }),
  traffic: (days: number) => ({
    question: `Explain my traffic trend over the last ${rangeLabel(days)}.`,
    context: 'Traffic overview',
  }),
  funnels: (days: number) => ({
    question: `Which of my funnels converts worst over the last ${rangeLabel(days)}, and where do people drop off?`,
    context: 'Funnels',
  }),
  funnel: (name: string) => ({
    question: `Where do people drop off in the ${name} funnel and what should I fix?`,
    context: `${name} funnel`,
  }),
  replays: (days: number) => ({
    question: `Which session recordings from the last ${rangeLabel(days)} should I watch first, and why?`,
    context: 'Session replays',
  }),
  /** Names the session so the assistant can call `get_session_summary` with it. */
  session: (sessionId: string) => ({
    question: `Why did this visitor struggle in session ${sessionId}? What went wrong, and what should I fix?`,
    context: 'Session replay',
  }),
  heatmaps: (days: number) => ({
    question: `What do my heatmaps from the last ${rangeLabel(days)} say about where people click and how far they scroll? What should I change?`,
    context: 'Heatmaps',
  }),
} as const;
