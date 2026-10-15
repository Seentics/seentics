import { span } from '../format';
import { maskPath, maskText } from '../privacy';

// The shapes a recorded visit is told from. The recordings module's session analysis has the same
// fields (it is passed straight in); declared here so this library depends on no module.
export type FrustrationSignal = {
  type: 'rage_click' | 'error_click' | 'form_abandon' | 'dead_click' | 'u_turn' | 'scroll_thrash';
  atMs: number;
  page: string;
  label?: string;
  count?: number;
  detail?: string;
};
export type SessionSummaryInput = {
  score: number;
  counts: Partial<Record<FrustrationSignal['type'], number>>;
  signals: FrustrationSignal[];
  timeline: {
    durationMs: number;
    pages: Array<{ path: string; atMs: number; dwellMs: number }>;
    clicks: Array<{ atMs: number; page: string; label: string }>;
    errorCount: number;
    failedRequests: number;
    fieldsTouched: number;
    goal: { reached: boolean; page?: string; atMs?: number };
  };
};
export type SessionSummary = {
  text: string;
  intent: string;
  outcome: 'succeeded' | 'struggled' | 'abandoned';
  moments: Array<{ atMs: number; label: string }>;
};

/**
 * A summary written from the analysis alone: for calm sessions (where a model would add nothing),
 * and whenever no model answered usefully — not configured, over the daily allowance, unreachable.
 *
 * It tells the visit as a short story: the route through the site, what the visitor most likely
 * came to do (read from the kinds of page they reached), what went wrong, and how it ended.
 * Every phrase comes from stored fields, so it can never say something the data does not.
 */

const PHRASE: Record<FrustrationSignal['type'], string> = {
  rage_click: 'rage-clicked',
  error_click: 'hit an error after clicking',
  form_abandon: 'filled in a form without submitting it on',
  dead_click: 'clicked something that did not respond:',
  u_turn: 'left and came straight back from',
  scroll_thrash: 'scrolled back and forth on',
};

/** Worst first, then earliest: the order the moments and the sentence list them in. */
const SEVERITY: FrustrationSignal['type'][] = ['error_click', 'rage_click', 'form_abandon', 'dead_click', 'u_turn', 'scroll_thrash'];

const times = (n: number | undefined) => (n && n > 1 ? ` ${n} times` : '');

/** One signal as a clause: "rage-clicked button "Apply" 5 times on /cart". `it`: the element was just named. */
function describe(s: FrustrationSignal, withPage = true, it = false): string {
  const target = it ? ' it' : s.label ? ` ${maskText(s.label, 60)}` : '';
  const page = maskPath(s.page);
  switch (s.type) {
    case 'rage_click':
    case 'error_click':
    case 'dead_click':
      return `${PHRASE[s.type]}${target}${times(s.count)}${withPage ? ` on ${page}` : ''}`;
    default:
      return `${PHRASE[s.type]} ${page}`;
  }
}

// ─── What kind of page, and so what the visitor was after ──────────────────────

type Stage = 'checkout' | 'cart' | 'signup' | 'pricing' | 'contact' | 'login' | 'product' | 'docs' | 'blog' | 'search' | 'account';

/** Matched against each path segment; the first stage whose pattern matches wins. */
const STAGE_PATTERNS: Array<[Stage, RegExp]> = [
  ['checkout', /^(checkout|payment|pay|billing|place-order|order-review)$/],
  ['cart', /^(cart|basket|bag|trolley)$/],
  ['signup', /^(signup|sign-up|register|registration|join|create-account|get-started|start|trial|free-trial|onboarding)$/],
  ['pricing', /^(pricing|prices|plans?|upgrade|subscribe|subscription|compare)$/],
  ['contact', /^(contact|contact-us|demo|book-a-demo|book|quote|get-a-quote|sales|talk-to-sales)$/],
  ['login', /^(login|log-in|signin|sign-in|auth|sso)$/],
  ['product', /^(products?|items?|shop|store|catalog|catalogue|collections?|p|features?)$/],
  ['docs', /^(docs|documentation|help|guides?|faq|support|kb|knowledge-base|tutorials?|learn)$/],
  ['blog', /^(blog|articles?|news|posts?|stories|resources)$/],
  ['search', /^(search|results)$/],
  ['account', /^(account|settings|profile|dashboard|my-account|orders)$/],
];

/** Deepest first: a visit that reached checkout was about buying, whatever else it read. */
const STAGE_ORDER: Stage[] = ['checkout', 'cart', 'signup', 'pricing', 'contact', 'login', 'product', 'docs', 'blog', 'search', 'account'];

const INTENT: Record<Stage, string> = {
  checkout: 'Buy something (got as far as checkout)',
  cart: 'Buy something (put items in the cart)',
  signup: 'Sign up',
  pricing: 'Compare plans and prices',
  contact: 'Get in touch or book a demo',
  login: 'Log in to their account',
  product: 'Look at products',
  docs: 'Find an answer in the docs',
  blog: 'Read an article',
  search: 'Search for something',
  account: 'Manage their account',
};

/** Where a visit that stopped at this stage stopped short of. */
const UNFINISHED: Partial<Record<Stage, string>> = {
  checkout: 'without completing the order',
  cart: 'without checking out',
  signup: 'without finishing signing up',
  pricing: 'without choosing a plan',
  contact: 'without sending the form',
};

export function stageOf(path: string): Stage | null {
  const segments = path.toLowerCase().split(/[/?#]/).filter(Boolean);
  for (const [stage, re] of STAGE_PATTERNS) {
    if (segments.some((s) => re.test(s))) return stage;
  }
  return null;
}

/** A click that says what the visitor meant to do: "Add to cart", "Sign up", "Buy now". */
const KEY_CLICK = /\b(add to (cart|bag|basket)|buy|checkout|check out|place order|pay|subscribe|sign ?up|register|start (free )?trial|get started|book|request( a)? demo|contact|download|upgrade)\b/i;

// ─── The summary ───────────────────────────────────────────────────────────────

export function ruleOutcome(input: SessionSummaryInput): SessionSummary['outcome'] {
  const t = input.timeline;
  if (t.goal.reached) return input.score >= 40 ? 'struggled' : 'succeeded';
  if ((input.counts.form_abandon ?? 0) > 0) return 'abandoned';
  if (input.score >= 30) return 'struggled';
  if (t.pages.length <= 1 && t.durationMs < 30_000) return 'abandoned';
  return 'succeeded';
}

/** The route: "Went from / to /products/x to /cart in 40s." */
function journey(pages: string[], durationMs: number): string {
  const distinct = [...new Set(pages)];
  const time = span(durationMs);
  if (!distinct.length) return `The visitor was recorded for ${time}.`;
  if (distinct.length === 1) return `The visitor stayed on ${distinct[0]} for ${time}${durationMs < 15_000 ? ' and left' : ''}.`;
  if (distinct.length <= 4) return `The visitor went from ${pages.join(' to ')} in ${time}.`;
  return `The visitor viewed ${distinct.length} pages in ${time}, from ${pages[0]} to ${pages[pages.length - 1]}.`;
}

/** The trouble: the worst two signals, joined so a repeat on the same page reads as one place. */
function trouble(ordered: FrustrationSignal[]): string | null {
  const worst = ordered.slice(0, 2);
  if (!worst.length) return null;
  const samePage = worst.length === 2 && worst[0]!.page === worst[1]!.page && worst.every((s) => s.type !== 'u_turn' && s.type !== 'form_abandon' && s.type !== 'scroll_thrash');
  if (samePage) {
    const sameTarget = !!worst[0]!.label && worst[0]!.label === worst[1]!.label && worst[1]!.type !== 'dead_click';
    return `On ${maskPath(worst[0]!.page)} they ${describe(worst[0]!, false)}, then ${describe(worst[1]!, false, sameTarget)}.`;
  }
  return `They ${worst.map((s) => describe(s)).join(', and ')}.`;
}

/** Errors and failed requests the signals did not already tell: "6 failed requests were recorded." */
function problems(t: SessionSummaryInput['timeline'], hasErrorClick: boolean): string | null {
  const counts: Array<[number, string]> = [];
  if (t.errorCount > 0 && !hasErrorClick) counts.push([t.errorCount, 'JavaScript error']);
  if (t.failedRequests > 0) counts.push([t.failedRequests, 'failed request']);
  if (!counts.length) return null;
  const single = counts.length === 1 && counts[0]![0] === 1;
  return `${counts.map(([n, what]) => `${n} ${what}${n === 1 ? '' : 's'}`).join(' and ')} ${single ? 'was' : 'were'} recorded.`;
}

function ending(input: SessionSummaryInput, deepest: Stage | null, last: string | undefined): string | null {
  const t = input.timeline;
  if (t.goal.reached && t.goal.page) return `They reached ${maskPath(t.goal.page)}, so the visit ended in a conversion.`;
  if ((input.counts.form_abandon ?? 0) > 0 && t.fieldsTouched > 0) {
    return `They typed into ${t.fieldsTouched} form field${t.fieldsTouched === 1 ? '' : 's'} but never submitted.`;
  }
  const unfinished = deepest ? UNFINISHED[deepest] : undefined;
  if (unfinished && last) return `They left from ${last} ${unfinished}.`;
  if (!input.signals.length && t.errorCount === 0 && t.failedRequests === 0) return 'Nothing in the recording suggests they ran into problems.';
  return null;
}

export function ruleSummary(input: SessionSummaryInput): SessionSummary {
  const t = input.timeline;
  const pages = t.pages.map((p) => maskPath(p.path));
  const last = pages[pages.length - 1];
  const stages = new Set(pages.map(stageOf).filter((s): s is Stage => s !== null));
  const deepest = STAGE_ORDER.find((s) => stages.has(s)) ?? null;

  const ordered = [...input.signals].sort((a, b) => SEVERITY.indexOf(a.type) - SEVERITY.indexOf(b.type) || a.atMs - b.atMs);
  const keyClick = t.clicks.find((c) => KEY_CLICK.test(c.label));

  // An unsent form is told by the ending, with how much was typed: not twice.
  const told = (input.counts.form_abandon ?? 0) > 0 && t.fieldsTouched > 0 && !t.goal.reached;
  const sentences = [
    journey(pages, t.durationMs),
    trouble(told ? ordered.filter((s) => s.type !== 'form_abandon') : ordered),
    problems(t, ordered.some((s) => s.type === 'error_click')),
    ending(input, deepest, last),
  ].filter((s): s is string => !!s);
  // A calm visit has room to say what they did.
  if (keyClick && sentences.length < 4) {
    sentences.splice(1, 0, `They clicked ${maskText(keyClick.label, 60)} on ${maskPath(keyClick.page)}.`);
  }

  const longest = [...t.pages].sort((a, b) => b.dwellMs - a.dwellMs)[0];
  const intent = deepest
    ? INTENT[deepest]
    : t.goal.reached && t.goal.page
      ? `Reach ${maskPath(t.goal.page)}`
      : longest
        ? `Unclear; most time was spent on ${maskPath(longest.path)}`
        : 'Unclear from the recording';

  return {
    text: sentences.slice(0, 4).join(' '),
    intent,
    outcome: ruleOutcome(input),
    moments: ordered.slice(0, 3).map((s) => ({ atMs: s.atMs, label: describe(s).replace(/^./, (c) => c.toUpperCase()).slice(0, 100) })),
  };
}

/**
 * Whether a model would add anything to the template: only when there is a story to read — some
 * friction, an error or a failed request — across more than a glance. A calm visit or a bounce is
 * told as well by the template, so it costs nothing.
 */
export function worthModel(input: SessionSummaryInput): boolean {
  const t = input.timeline;
  const trouble = input.signals.length > 0 || t.errorCount > 0 || t.failedRequests > 0;
  const glance = t.pages.length <= 1 && t.durationMs < 15_000;
  return trouble && !glance;
}
