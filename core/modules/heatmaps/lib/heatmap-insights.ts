import type {
  HeatmapInsightFinding,
  HeatmapClickStats,
  HeatmapClickTarget,
  HeatmapDeviceAnalysis,
  HeatmapInsightDevice,
  HeatmapPageAnalysis,
  HeatmapScrollStats,
  HeatmapSignal,
} from "../interfaces";

/**
 * One page's heatmap, analysed. Pure: rows in, numbers and signals out.
 *
 * The rows are already aggregated by SQL (`heatmap-insights.repository`), so this works on
 * a few hundred rows however busy the page is:
 *
 * - a scroll row is "this many page views went this deep", with the viewport and document
 *   height last recorded for that depth — so the fold is viewport / document height;
 * - a click row is "this element took this many clicks in this tenth of the page", with
 *   its tag, ARIA role and whether it is fixed or sticky.
 *
 * Both positions are fractions of the document height, which is what lets a click's
 * position be compared with how far page views scrolled.
 */

export type ScrollRow = {
  device: string;
  /** Deepest point of the view, % of page height, 0–100. */
  depth: number;
  /** Viewport / document height for these views, % 0–100; null when not recorded. */
  fold: number | null;
  views: number;
  viewportPx: number | null;
  documentPx: number | null;
};

export type ClickRow = {
  device: string;
  selector: string;
  /** Tenth of the page height the clicks landed in, 0 (top) to 9. */
  band: number;
  clicks: number;
  /** Sum of each click's position (0–10000 of page height) × its count, for a weighted mean. */
  yWeighted: number;
  tag: string | null;
  role: string | null;
  /** The element carries `data-seentics-id`: marked by the site, so not called dead. */
  annotated: boolean;
  pinned: boolean;
};

/** Below these, a device's numbers say more about chance than about the page. */
export const MIN_VIEWS = 30;
export const MIN_CLICKS = 30;
export const DEFAULT_DAYS = 30;
const DEVICES = ["desktop", "tablet", "mobile"] as const;

/** What the data cannot tell, and why — shown with every analysis. */
export const HEATMAP_INSIGHT_LIMITS = [
  "Rage clicks are not in heatmap data: clicks are stored as daily counts per position, without the time or session that would show repeated clicks.",
  "Time spent on each part of the page is not stored: the tracker measures it, but only the deepest scroll point of a page view is kept.",
  "Figures count page views, not unique visitors.",
  "A dead click is a candidate: a script can make any element clickable, and the tracker cannot see that.",
  "What happened after a click (a page change, a conversion) is not linked to the click.",
];

/** Tags that are interactive by themselves. */
export const INTERACTIVE_TAGS = new Set([
  "a", "button", "input", "select", "textarea", "label", "summary", "option", "details", "video", "audio",
]);
/** ARIA roles that promise interaction. */
export const INTERACTIVE_ROLES = new Set([
  "button", "link", "menuitem", "menuitemcheckbox", "menuitemradio", "tab", "checkbox", "radio",
  "switch", "option", "combobox", "textbox", "searchbox", "slider", "spinbutton", "treeitem", "gridcell",
]);
/** What reads as a call to action: a link or a button. */
const CTA_TAGS = new Set(["a", "button"]);
const CTA_ROLES = new Set(["button", "link"]);

const round = (n: number) => Math.round(n);
const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

/**
 * Tag from a stored selector, for rows from before the tracker sent a locator:
 * `button#buy` → button, `a.nav` → a. Attribute selectors name no tag.
 */
export function tagFromSelector(selector: string): string | null {
  const m = /^([a-z][a-z0-9-]*)(?:[#.]|$)/i.exec(selector.trim());
  return m ? m[1]!.toLowerCase() : null;
}

/** Whether an element is something a person can expect to act on. `null`: cannot say. */
export function isInteractive(tag: string | null, role: string | null, annotated: boolean): boolean | null {
  const r = (role ?? "").trim().toLowerCase();
  if (r && INTERACTIVE_ROLES.has(r)) return true;
  if (tag && INTERACTIVE_TAGS.has(tag)) return true;
  // Marked by the site itself: assume it is meant to be there, whatever it is.
  if (annotated) return null;
  return tag ? false : null;
}

function isCta(t: HeatmapClickTarget): boolean {
  return t.interactive === true && ((!!t.tag && CTA_TAGS.has(t.tag)) || (!!t.role && CTA_ROLES.has(t.role.toLowerCase())));
}

/** A selector short enough to quote. */
export function displaySelector(selector: string): string {
  const s = selector.replace(/\s+/g, " ").trim();
  return s.length > 60 ? `${s.slice(0, 59)}…` : s || "(unnamed element)";
}

function byDevice<T extends { device: string }>(rows: T[], device: HeatmapInsightDevice): T[] {
  return device === "all" ? rows : rows.filter((r) => r.device === device);
}

/** Weighted median of `value` over `weight`. */
function weightedMedian(items: Array<{ value: number; weight: number }>): number | null {
  const xs = items.filter((i) => i.weight > 0 && Number.isFinite(i.value)).sort((a, b) => a.value - b.value);
  const total = xs.reduce((s, i) => s + i.weight, 0);
  if (!total) return null;
  let acc = 0;
  for (const i of xs) {
    acc += i.weight;
    if (acc * 2 >= total) return i.value;
  }
  return xs[xs.length - 1]!.value;
}

/** Share of views (0–100) whose deepest point is at least `depth`%. */
function reachAt(rows: ScrollRow[], total: number, depth: number): number {
  if (!total) return 0;
  const d = Math.max(0, Math.min(100, Math.round(depth)));
  return pct(rows.reduce((s, r) => s + (r.depth >= d ? r.views : 0), 0), total);
}

export function scrollStats(rows: ScrollRow[]): HeatmapScrollStats | null {
  const total = rows.reduce((s, r) => s + r.views, 0);
  if (total < MIN_VIEWS) return null;

  // Where the median view stops: the deepest point at least half the views reached.
  const depths = [...new Set(rows.map((r) => r.depth))].sort((a, b) => b - a);
  let median = 0;
  for (const d of depths) {
    if (reachAt(rows, total, d) >= 50) { median = d; break; }
  }
  const avg = rows.reduce((s, r) => s + r.depth * r.views, 0) / total;

  const folded = rows.filter((r) => r.fold !== null);
  const fold = weightedMedian(folded.map((r) => ({ value: r.fold!, weight: r.views })));
  const viewport = weightedMedian(rows.filter((r) => r.viewportPx).map((r) => ({ value: r.viewportPx!, weight: r.views })));
  const documentPx = weightedMedian(rows.filter((r) => r.documentPx).map((r) => ({ value: r.documentPx!, weight: r.views })));
  // A view that loads already shows its first screen, so its depth starts at the fold. Within a
  // few points of it is "did not scroll", allowing for a page that grew a little while open.
  const foldedViews = folded.reduce((s, r) => s + r.views, 0);
  const stayed = foldedViews > 0
    ? pct(folded.reduce((s, r) => s + (r.depth <= Math.min(100, r.fold! + 5) ? r.views : 0), 0), foldedViews)
    : null;

  return {
    page_views: total,
    reach: {
      p25: round(reachAt(rows, total, 25)),
      p50: round(reachAt(rows, total, 50)),
      p75: round(reachAt(rows, total, 75)),
      p100: round(reachAt(rows, total, 100)),
    },
    median_depth: round(median),
    avg_depth: round(avg),
    fold_pct: fold === null ? null : round(fold),
    viewport_px: viewport === null ? null : round(viewport),
    document_px: documentPx === null ? null : round(documentPx),
    // Meaningless on a page that fits in one screen: every view "stays above the fold".
    stayed_above_fold_pct: stayed === null || (fold !== null && fold >= 95) ? null : round(stayed),
  };
}

type Agg = {
  selector: string;
  clicks: number;
  bands: Map<number, { clicks: number; y: number }>;
  tag: string | null;
  role: string | null;
  annotated: boolean;
  pinned: boolean;
};

export function clickStats(rows: ClickRow[], scrollRows: ScrollRow[], scroll: HeatmapScrollStats | null): HeatmapClickStats | null {
  const total = rows.reduce((s, r) => s + r.clicks, 0);
  if (total < MIN_CLICKS) return null;

  const scrollTotal = scrollRows.reduce((s, r) => s + r.views, 0);
  const fold = scroll?.fold_pct ?? null;

  const bySelector = new Map<string, Agg>();
  const bands = Array.from({ length: 10 }, () => 0);
  let aboveFold = 0;
  for (const r of rows) {
    const band = Math.max(0, Math.min(9, Math.trunc(r.band)));
    bands[band]! += r.clicks;
    const meanY = r.clicks > 0 ? r.yWeighted / r.clicks / 100 : 0;
    if (r.pinned || (fold !== null && meanY <= fold)) aboveFold += r.clicks;

    let a = bySelector.get(r.selector);
    if (!a) {
      a = { selector: r.selector, clicks: 0, bands: new Map(), tag: null, role: null, annotated: false, pinned: false };
      bySelector.set(r.selector, a);
    }
    a.clicks += r.clicks;
    const b = a.bands.get(band) ?? { clicks: 0, y: 0 };
    b.clicks += r.clicks;
    b.y += r.yWeighted;
    a.bands.set(band, b);
    a.tag ??= r.tag ? r.tag.toLowerCase() : null;
    a.role ??= r.role || null;
    a.annotated ||= r.annotated;
    a.pinned ||= r.pinned;
  }

  const targets: HeatmapClickTarget[] = [...bySelector.values()].map((a) => {
    // The same selector can sit in the header and the footer; its position is where most of
    // its clicks are, not an average of both.
    let main = { clicks: 0, y: 0 };
    for (const b of a.bands.values()) if (b.clicks > main.clicks) main = b;
    const depth = main.clicks > 0 ? main.y / main.clicks / 100 : 0;
    const tag = a.tag ?? tagFromSelector(a.selector);
    return {
      selector: displaySelector(a.selector),
      tag,
      role: a.role,
      interactive: isInteractive(tag, a.role, a.annotated || a.selector.startsWith("[data-seentics-id")),
      pinned: a.pinned,
      clicks: a.clicks,
      share: round(pct(a.clicks, total)),
      depth_pct: round(depth),
      reach_pct: a.pinned || !scroll ? null : round(reachAt(scrollRows, scrollTotal, depth)),
      above_fold: a.pinned ? true : fold === null ? null : depth <= fold,
    };
  }).sort((x, y) => y.clicks - x.clicks || x.selector.localeCompare(y.selector));

  const known = targets.filter((t) => t.interactive !== null);
  const knownClicks = known.reduce((s, t) => s + t.clicks, 0);
  const dead = targets.filter((t) => t.interactive === false);
  const deadClicks = dead.reduce((s, t) => s + t.clicks, 0);

  return {
    clicks: total,
    clicks_per_view: scroll && scroll.page_views > 0 ? Math.round((total / scroll.page_views) * 100) / 100 : null,
    top: targets.slice(0, 8),
    top3_share: round(pct(targets.slice(0, 3).reduce((s, t) => s + t.clicks, 0), total)),
    bands: bands.map((c, i) => ({ from_pct: i * 10, to_pct: (i + 1) * 10, clicks: c, share: round(pct(c, total)) })),
    above_fold_share: fold === null ? null : round(pct(aboveFold, total)),
    dead_clicks: {
      clicks: deadClicks,
      share: round(pct(deadClicks, knownClicks)),
      known_share: round(pct(knownClicks, total)),
      targets: dead.slice(0, 5),
    },
    ctas: targets.filter(isCta).slice(0, 5),
  };
}

export function analyseDevice(device: HeatmapInsightDevice, scrollRows: ScrollRow[], clickRows: ClickRow[]): HeatmapDeviceAnalysis {
  const s = byDevice(scrollRows, device);
  const scroll = scrollStats(s);
  return { device, scroll, clicks: clickStats(byDevice(clickRows, device), s, scroll) };
}

const label = (d: HeatmapInsightDevice) => (d === "all" ? "all devices" : d);

/** One decimal, for clicks per view. */
const oneDp = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

/** Signals for one device's analysis. `prefix` keeps ids unique across devices. */
function deviceSignals(a: HeatmapDeviceAnalysis): HeatmapSignal[] {
  const out: HeatmapSignal[] = [];
  const d = a.device;
  const on = d === "all" ? "" : ` on ${d}`;
  const s = a.scroll;
  const c = a.clicks;

  if (s) {
    const fold = s.fold_pct;
    out.push({
      id: `scroll-${d}`,
      kind: "scroll_depth",
      device: d,
      score: 40 + (100 - s.median_depth) * 0.4,
      finding: `Half of page views${on} stop by ${s.median_depth}% of the page${fold !== null ? `, and the first screen shows the top ${fold}%` : ""}. ${s.reach.p75}% get three quarters of the way down.`,
      fix: s.median_depth < 60
        ? `Keep the key message and main call to action in the top ${s.median_depth}% of the page, where most page views still are.`
        : "Most page views get well down the page; keep the important content where it is and make sure the end of the page offers a next step.",
      facts: `scroll ${label(d)}: ${s.page_views} page views; median stop ${s.median_depth}% of page; avg ${s.avg_depth}%; reach 25%=${s.reach.p25}% 50%=${s.reach.p50}% 75%=${s.reach.p75}% 100%=${s.reach.p100}%` +
        (fold !== null ? `; fold at ${fold}% of page` : "") +
        (s.viewport_px && s.document_px ? ` (viewport ${s.viewport_px}px, page ${s.document_px}px)` : ""),
    });

    if (s.stayed_above_fold_pct !== null && s.stayed_above_fold_pct >= 35) {
      out.push({
        id: `fold-${d}`,
        kind: "fold",
        device: d,
        score: 45 + s.stayed_above_fold_pct * 0.4,
        finding: `${s.stayed_above_fold_pct}% of page views${on} never scroll below the first screen.`,
        fix: "Make the first screen say what the page is for and show the main action, or give a clear reason to scroll.",
        facts: `fold ${label(d)}: ${s.stayed_above_fold_pct}% of page views never scroll below the first screen (fold at ${fold}% of page)`,
      });
    }
  }

  if (c) {
    const top = c.top;
    if (top.length && top[0]!.share >= 40 && c.clicks >= 50) {
      const t = top[0]!;
      out.push({
        id: `concentration-${d}`,
        kind: "click_concentration",
        device: d,
        score: 30 + t.share * 0.3,
        finding: `${t.share}% of clicks${on} go to one element, ${t.selector}.`,
        fix: isCta(t)
          ? `Make sure ${t.selector} leads where people expect; it carries most of the page.`
          : `Check whether ${t.selector} is what you want people to click; if not, give the main call to action more prominence.`,
        facts: `click concentration ${label(d)}: ${c.clicks} clicks; ${t.selector} (${t.tag ?? "?"}) has ${t.clicks} clicks = ${t.share}%; top 3 elements = ${c.top3_share}%`,
      });
    } else if (top.length >= 3 && c.top3_share >= 60 && c.clicks >= 50) {
      const names = top.slice(0, 3).map((t) => t.selector);
      out.push({
        id: `concentration-${d}`,
        kind: "click_concentration",
        device: d,
        score: 25 + c.top3_share * 0.2,
        finding: `${c.top3_share}% of clicks${on} go to three elements: ${names[0]}, ${names[1]} and ${names[2]}.`,
        fix: "Check those are the actions you want people to take; if the main call to action is not among them, give it that prominence.",
        facts: `click concentration ${label(d)}: ${c.clicks} clicks; top 3 = ${c.top3_share}%: ${top.slice(0, 3).map((t) => `${t.selector} ${t.share}%`).join(", ")}`,
      });
    }

    const dead = c.dead_clicks;
    const worst = dead.targets[0];
    if (worst && dead.share >= 10 && dead.clicks >= 20 && dead.known_share >= 50) {
      out.push({
        id: `dead-${d}`,
        kind: "dead_clicks",
        device: d,
        score: 50 + dead.share * 0.6,
        finding: `${dead.share}% of clicks${on} land on things that are not links or buttons, most on ${worst.selector} (${worst.clicks} clicks).`,
        fix: `If people expect ${worst.selector} to do something, make it a link or button; otherwise restyle it so it does not look clickable.`,
        facts: `dead-click candidates ${label(d)}: ${dead.clicks} clicks = ${dead.share}% of clicks on known elements; top: ${dead.targets.slice(0, 3).map((t) => `${t.selector} (${t.tag ?? "?"}) ${t.clicks} clicks at ${t.depth_pct}% down`).join("; ")}`,
      });
    }

    let ctaSignals = 0;
    for (const t of c.ctas.slice(0, 3)) {
      if (ctaSignals >= 2) break;
      if (t.pinned || t.reach_pct === null || t.reach_pct >= 50 || t.clicks < 10) continue;
      ctaSignals += 1;
      const fold = s?.fold_pct ?? null;
      out.push({
        id: `cta-${d}-${ctaSignals}`,
        kind: "cta_reach",
        device: d,
        score: 60 + (50 - t.reach_pct),
        finding: `Only ${t.reach_pct}% of page views${on} scroll far enough to reach ${t.selector}, ${t.depth_pct}% down the page, though it takes ${t.share}% of clicks.`,
        fix: fold !== null
          ? `Move ${t.selector} higher, or repeat it within the first screen (the top ${fold}% of the page).`
          : `Move ${t.selector} higher, or repeat it near the top of the page.`,
        facts: `cta ${label(d)}: ${t.selector} (${t.tag ?? t.role ?? "?"}) at ${t.depth_pct}% down the page; ${t.reach_pct}% of page views reach it; ${t.clicks} clicks = ${t.share}% of clicks` +
          (fold !== null ? `; fold at ${fold}%` : ""),
      });
    }

    if (c.clicks_per_view !== null && s && s.page_views >= 100 && c.clicks_per_view < 0.1) {
      const per100 = Math.round(c.clicks_per_view * 100);
      out.push({
        id: `engagement-${d}`,
        kind: "low_engagement",
        device: d,
        score: 35,
        finding: `Page views${on} produce only ${per100} clicks per 100.`,
        fix: "Make the next step obvious: one clear call to action near the top of the page.",
        facts: `engagement ${label(d)}: ${c.clicks} clicks over ${s.page_views} page views = ${per100} clicks per 100 page views`,
      });
    }
  }
  return out;
}

/** Mobile against desktop, when both have enough data. */
function deviceGapSignals(devices: HeatmapDeviceAnalysis[]): HeatmapSignal[] {
  const desk = devices.find((x) => x.device === "desktop");
  const mob = devices.find((x) => x.device === "mobile");
  if (!desk || !mob) return [];
  const out: HeatmapSignal[] = [];
  if (desk.scroll && mob.scroll) {
    const dm = desk.scroll.median_depth;
    const mm = mob.scroll.median_depth;
    const gap = Math.abs(dm - mm);
    if (gap >= 15) {
      out.push({
        id: "gap-scroll",
        kind: "device_gap",
        device: mm < dm ? "mobile" : "desktop",
        score: 45 + gap * 0.5,
        finding: `On mobile, half of page views stop by ${mm}% of the page, against ${dm}% on desktop.`,
        fix: mm < dm
          ? "Shorten the mobile layout or move the key content and call to action up on small screens."
          : "Desktop page views stop earlier than mobile ones; check what the desktop layout shows in its first screen.",
        facts: `device gap scroll: median stop mobile ${mm}% (${mob.scroll.page_views} page views) vs desktop ${dm}% (${desk.scroll.page_views} page views)`,
      });
    }
  }
  const dc = desk.clicks?.clicks_per_view ?? null;
  const mc = mob.clicks?.clicks_per_view ?? null;
  if (dc !== null && mc !== null && dc > 0 && mc > 0) {
    const ratio = Math.max(dc, mc) / Math.min(dc, mc);
    if (ratio >= 2) {
      out.push({
        id: "gap-clicks",
        kind: "device_gap",
        device: mc < dc ? "mobile" : "desktop",
        score: 40 + Math.min(20, ratio * 3),
        finding: `Mobile page views get ${oneDp(mc)} clicks each, against ${oneDp(dc)} on desktop.`,
        fix: mc < dc
          ? "Check that tap targets on mobile are large enough and the main action is visible without zooming or hunting."
          : "Desktop visitors click less than mobile ones; check whether the desktop layout makes the next step clear.",
        facts: `device gap clicks: clicks per page view mobile ${oneDp(mc)} vs desktop ${oneDp(dc)}`,
      });
    }
  }
  return out;
}

/**
 * The analysis of one page: per device, the signals worth saying, and the limits.
 *
 * `device` narrows everything to one bucket; `all` merges them and adds per-device
 * analyses (each only when it has enough data) and a mobile-against-desktop comparison.
 */
export function analysePage(input: {
  pagePath: string;
  days: number;
  device: HeatmapInsightDevice;
  scrollRows: ScrollRow[];
  clickRows: ClickRow[];
}): HeatmapPageAnalysis {
  const overall = analyseDevice(input.device, input.scrollRows, input.clickRows);
  const devices = input.device === "all"
    ? DEVICES.map((d) => analyseDevice(d, input.scrollRows, input.clickRows)).filter((a) => a.scroll || a.clicks)
    : [];

  const signals = [...deviceSignals(overall), ...deviceGapSignals(devices)]
    .sort((a, b) => b.score - a.score)
    .map((s) => ({ ...s, score: Math.round(s.score) }));

  const limits = [...HEATMAP_INSIGHT_LIMITS];
  const dead = overall.clicks?.dead_clicks;
  if (dead && dead.known_share < 50) {
    limits.push(`Element types are known for only ${dead.known_share}% of clicks (the rest predate element capture), so dead clicks are not estimated.`);
  }
  if (overall.scroll && overall.scroll.fold_pct === null) {
    limits.push("The fold is unknown: these scroll summaries predate viewport capture.");
  }

  const sufficient = !!(overall.scroll || overall.clicks);
  const views = input.scrollRows.filter((r) => input.device === "all" || r.device === input.device).reduce((s, r) => s + r.views, 0);
  const clicks = input.clickRows.filter((r) => input.device === "all" || r.device === input.device).reduce((s, r) => s + r.clicks, 0);
  return {
    page_path: input.pagePath,
    days: input.days,
    device: input.device,
    sufficient,
    reason: sufficient
      ? null
      : `Only ${views} page views and ${clicks} clicks in the last ${input.days} days${input.device === "all" ? "" : ` on ${input.device}`}. Insights start at ${MIN_VIEWS} of either.`,
    overall,
    devices,
    signals,
    limits,
  };
}

/** Findings shown when no model words them: the strongest signals, as the rules state them. */
export const MAX_FINDINGS = 5;

export function ruleFindings(signals: HeatmapSignal[], max = 4): HeatmapInsightFinding[] {
  return signals.slice(0, Math.min(max, MAX_FINDINGS)).map((s) => ({
    signal: s.id,
    kind: s.kind,
    device: s.device,
    finding: s.finding,
    fix: s.fix,
  }));
}
