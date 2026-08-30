/**
 * The part of an automation the browser finishes.
 *
 * A `wait_until` node cannot be resolved on the server: evaluation is synchronous with
 * the tracker's request, so by the time the wait would elapse the response has long been
 * sent. The server therefore stops at the wait and hands over a *continuation* — the
 * condition, a snapshot of the facts it resolved, and both outcomes already walked and
 * template-rendered — which this module resolves in the page.
 *
 * It is a separate module from the tracker so it can be tested. esbuild inlines it into
 * `seentics.min.js`, so there is no extra request; the split is a source-level one.
 *
 * The operator set mirrors `condition-evaluator.ts` on the server, including its two
 * rules: an unrecognised operator fails closed, and comparison across the string
 * boundary is explicit rather than left to `==`. A visitor must not get a different
 * answer depending on which side evaluated the condition.
 */

/** Facts only the page can see. Read fresh on every check. */
export function liveFacts(pageEnterMs) {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  return {
    page: location.pathname,
    url: location.href,
    title: document.title,
    referrer: document.referrer,
    scrollPercent: scrollable > 0 ? Math.round((window.scrollY / scrollable) * 100) : 0,
    timeOnPage: Math.round((Date.now() - pageEnterMs) / 1000),
  };
}

function factAt(obj, path) {
  if (!path) return undefined;
  let cur = obj;
  for (const part of String(path).split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

/** Strict within a type, string-compared across one. Nullish equals nothing. */
function valuesEqual(a, b) {
  if (a == null || b == null) return false;
  if (a === b) return true;
  if (typeof a === typeof b) return false;
  return String(a) === String(b);
}

/** Numbers and numeric strings only — `Number(null)` being 0 is not a comparison. */
function asNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const asText = (v) => (v == null ? null : String(v).toLowerCase());

function applyOperator(value, op, expected) {
  const pair = () => {
    const x = asNumber(value);
    const y = asNumber(expected);
    return x === null || y === null ? null : [x, y];
  };

  switch (op) {
    case 'equals':             return valuesEqual(value, expected);
    case 'notEquals':          return !valuesEqual(value, expected);
    case 'greaterThan':        { const n = pair(); return !!n && n[0] >  n[1]; }
    case 'lessThan':           { const n = pair(); return !!n && n[0] <  n[1]; }
    case 'greaterThanOrEqual': { const n = pair(); return !!n && n[0] >= n[1]; }
    case 'lessThanOrEqual':    { const n = pair(); return !!n && n[0] <= n[1]; }

    case 'contains':    { const v = asText(value), e = asText(expected); return v !== null && e !== null && v.includes(e); }
    case 'notContains': { const v = asText(value), e = asText(expected); return v === null || e === null || !v.includes(e); }
    case 'startsWith':  { const v = asText(value), e = asText(expected); return v !== null && e !== null && v.startsWith(e); }
    case 'endsWith':    { const v = asText(value), e = asText(expected); return v !== null && e !== null && v.endsWith(e); }

    case 'matches':
      if (value == null) return false;
      try { return new RegExp(String(expected ?? '')).test(String(value)); } catch { return false; }

    case 'isSet':    return value != null && value !== '';
    case 'isNotSet': return value == null || value === '';
    case 'isTrue':   return value === true  || value === 1 || value === 'true'  || value === '1';
    case 'isFalse':  return value === false || value === 0 || value === 'false' || value === '0';

    case 'in':    return Array.isArray(expected) && expected.some((e) => valuesEqual(value, e));
    case 'notIn': return Array.isArray(expected) && !expected.some((e) => valuesEqual(value, e));

    // Fail closed, exactly as the server does. An operator this build does not know
    // must not pass for everyone.
    default: return false;
  }
}

/** Evaluate a condition tree. No condition, or an empty group, passes. */
export function evaluateConditions(group, facts) {
  if (!group) return true;
  const rules = group.rules;
  if (!Array.isArray(rules) || rules.length === 0) return true;

  const one = (node) => {
    if (!node || typeof node !== 'object') return false;
    if ('fact' in node) {
      if (typeof node.fact !== 'string' || !node.fact) return false;
      return applyOperator(factAt(facts, node.fact), node.operator, node.value);
    }
    if (Array.isArray(node.rules)) return evaluateConditions(node, facts);
    return false;
  };

  if (group.operator === 'NOT') return !one(rules[0]);
  if (group.operator === 'OR')  return rules.some(one);
  if (group.operator === 'AND') return rules.every(one);
  return false;
}

/** Mirrors MAX_DELAY_SECONDS on the server. */
export const MAX_ACTION_DELAY_MS = 300_000;

/**
 * Resolve a continuation in the page.
 *
 * Polls rather than subscribing to specific events: the condition can name any fact, and
 * a listener per fact would be a lot of machinery for a window measured in seconds. Each
 * tick is a handful of property reads, and it stops the moment the condition passes or
 * the timeout fires.
 *
 * Returns a cancel function so a caller can abandon a pending wait — used when the page
 * unloads, and by tests.
 */
export function runContinuation(cont, baseDelayMs, perform, opts = {}) {
  if (!cont) return () => {};

  const pageEnterMs = opts.pageEnterMs ?? Date.now();
  const pollMs = opts.pollMs ?? 250;
  const facts = () => ({ ...(cont.facts ?? {}), ...liveFacts(pageEnterMs) });

  let timer = null;
  let startTimer = null;
  let done = false;

  const cancel = () => {
    done = true;
    if (timer !== null) clearInterval(timer);
    if (startTimer !== null) clearTimeout(startTimer);
  };

  const settle = (met) => {
    if (done) return;
    cancel();
    perform(met ? cont.met : cont.timeout);
    // A branch may itself end in another wait; its delays are relative to this one
    // resolving, so the offset restarts at zero.
    runContinuation(met ? cont.metContinuation : cont.timeoutContinuation, 0, perform, opts);
  };

  const start = () => {
    // Checked once up front: a condition already true should not wait a tick.
    if (evaluateConditions(cont.group, facts())) return settle(true);

    const deadline = Date.now() + Math.min(Math.max(0, cont.timeoutMs | 0), MAX_ACTION_DELAY_MS);
    timer = setInterval(() => {
      if (evaluateConditions(cont.group, facts())) settle(true);
      else if (Date.now() >= deadline) settle(false);
    }, pollMs);
  };

  const offset = Math.min(Math.max(0, baseDelayMs | 0), MAX_ACTION_DELAY_MS);
  if (offset > 0) startTimer = setTimeout(start, offset);
  else start();

  return cancel;
}
