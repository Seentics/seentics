import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateConditions,
  liveFacts,
  runContinuation,
} from '../../../public/trackers/automation-runtime.js';

/**
 * The tracker's half of a `wait_until`.
 *
 * Two things carry the risk. The condition language has to give the same answer as the
 * server's — a visitor must not qualify on one side and not the other — so the operator
 * cases here mirror `condition-evaluator.test.ts`. And the wait itself has to resolve
 * exactly once, whether by the condition passing or the timeout firing, because both
 * branches are already loaded and running both would show the visitor two things.
 */

const group = (fact: string, operator: string, value?: unknown) => ({
  operator: 'AND' as const,
  rules: [{ fact, operator, value }],
});

/** Evaluate one rule against one fact. */
const evalOne = (operator: string, fact: unknown, value?: unknown) =>
  evaluateConditions(group('x', operator, value), { x: fact });

// -- Condition parity --------------------------------------------------------

describe('condition evaluation', () => {
  it('passes when there is no condition, or the group is empty', () => {
    expect(evaluateConditions(null, {})).toBe(true);
    expect(evaluateConditions({ operator: 'AND', rules: [] }, {})).toBe(true);
  });

  it('matches a number fact against the string a rule carries', () => {
    // Rule values come from a text input, so this crossing is the normal case.
    expect(evalOne('equals', 5, '5')).toBe(true);
    expect(evalOne('equals', true, 'true')).toBe(true);
  });

  it('does not fall for the classic loose-equality surprises', () => {
    expect(evalOne('equals', 0, '')).toBe(false);
    expect(evalOne('equals', '', false)).toBe(false);
  });

  it('treats an unset fact as equal to nothing', () => {
    expect(evalOne('equals', null, null)).toBe(false);
    expect(evalOne('notEquals', null, null)).toBe(true);
  });

  it('compares numerically only when both sides are numbers', () => {
    expect(evalOne('greaterThan', 5, 3)).toBe(true);
    expect(evalOne('greaterThan', '10', 5)).toBe(true);
    // Number(null) being 0 would make a missing fact satisfy "<= 5".
    expect(evalOne('lessThanOrEqual', null, 5)).toBe(false);
    expect(evalOne('greaterThan', 'abc', 5)).toBe(false);
  });

  it('matches strings case-insensitively across the whole family', () => {
    expect(evalOne('contains', 'Hello World', 'WORLD')).toBe(true);
    expect(evalOne('startsWith', '/Pricing', '/pri')).toBe(true);
    expect(evalOne('endsWith', '/PRICING', 'ing')).toBe(true);
  });

  it('satisfies notContains for an unset fact', () => {
    expect(evalOne('notContains', null, 'x')).toBe(true);
  });

  it('applies a regex and fails rather than throwing on a bad one', () => {
    expect(evalOne('matches', 'abc123', '^abc')).toBe(true);
    expect(evalOne('matches', 'abc', '[')).toBe(false);
  });

  it('accepts every spelling of true and false', () => {
    for (const v of [true, 1, 'true', '1']) expect(evalOne('isTrue', v)).toBe(true);
    for (const v of [false, 0, 'false', '0']) expect(evalOne('isFalse', v)).toBe(true);
  });

  it('handles membership, coercing like equals', () => {
    expect(evalOne('in', 2, ['1', '2'])).toBe(true);
    expect(evalOne('notIn', 'z', ['a'])).toBe(true);
    // A malformed list cannot be judged either way.
    expect(evalOne('in', 'a', 'not-a-list')).toBe(false);
    expect(evalOne('notIn', 'a', 'not-a-list')).toBe(false);
  });

  it('fails closed on an operator this build does not know', () => {
    // The same rule as the server: a visitor must not qualify because one side is older.
    expect(evalOne('sortaEquals', 'a', 'a')).toBe(false);
    expect(evalOne('EQUALS', 'a', 'a')).toBe(false);
  });

  it('reads a dotted path and treats a missing one as unset', () => {
    expect(evaluateConditions(group('user.plan', 'equals', 'pro'), { user: { plan: 'pro' } })).toBe(true);
    expect(evaluateConditions(group('a.b.c', 'isNotSet'), {})).toBe(true);
  });

  it('supports AND, OR and NOT, and nests them', () => {
    const ctx = { a: 1, b: 2 };
    const r = (fact: string, value: unknown) => ({ fact, operator: 'equals', value });
    expect(evaluateConditions({ operator: 'AND', rules: [r('a', 1), r('b', 2)] }, ctx)).toBe(true);
    expect(evaluateConditions({ operator: 'OR', rules: [r('a', 9), r('b', 2)] }, ctx)).toBe(true);
    expect(evaluateConditions({ operator: 'NOT', rules: [r('a', 9)] }, ctx)).toBe(true);
    expect(evaluateConditions(
      { operator: 'AND', rules: [r('a', 1), { operator: 'OR', rules: [r('b', 9), r('b', 2)] }] },
      ctx,
    )).toBe(true);
  });

  it('rejects a group operator it does not recognise', () => {
    expect(evaluateConditions({ operator: 'XOR', rules: [{ fact: 'a', operator: 'isSet' }] }, { a: 1 })).toBe(false);
  });
});

// -- Live facts --------------------------------------------------------------

describe('liveFacts', () => {
  it('reports what only the page can see', () => {
    const facts = liveFacts(Date.now() - 5000);
    expect(facts.page).toBe(window.location.pathname);
    expect(facts.url).toBe(window.location.href);
    expect(facts.timeOnPage).toBeGreaterThanOrEqual(4);
  });

  it('reports zero scroll on a page that does not scroll', () => {
    // jsdom gives a zero-height document; the guard stops this being NaN or Infinity.
    expect(liveFacts(Date.now()).scrollPercent).toBe(0);
  });
});

// -- Continuations -----------------------------------------------------------

describe('runContinuation', () => {
  let performed: unknown[][];
  const perform = (actions: unknown[]) => { performed.push(actions); };

  const continuation = (over: Record<string, unknown> = {}) => ({
    group: group('ready', 'isTrue'),
    facts: {},
    timeoutMs: 1000,
    startMs: 0,
    met: [{ type: 'show_toast' }],
    timeout: [{ type: 'show_banner' }],
    ...over,
  });

  beforeEach(() => {
    performed = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when there is no continuation', () => {
    runContinuation(null, 0, perform);
    expect(performed).toEqual([]);
  });

  it('takes the met branch immediately when the condition is already true', () => {
    // A condition already satisfied should not cost the visitor a polling tick.
    runContinuation(continuation({ facts: { ready: true } }), 0, perform, { pollMs: 10 });
    expect(performed).toEqual([[{ type: 'show_toast' }]]);
  });

  it('takes the timeout branch when the condition never passes', () => {
    runContinuation(continuation(), 0, perform, { pollMs: 10 });
    expect(performed).toEqual([]);

    vi.advanceTimersByTime(1100);
    expect(performed).toEqual([[{ type: 'show_banner' }]]);
  });

  it('takes the met branch as soon as the condition turns true', () => {
    const facts: Record<string, unknown> = { ready: false };
    runContinuation(continuation({ facts }), 0, perform, { pollMs: 10 });

    vi.advanceTimersByTime(50);
    expect(performed).toEqual([]);

    facts.ready = true;
    vi.advanceTimersByTime(20);
    expect(performed).toEqual([[{ type: 'show_toast' }]]);
  });

  it('resolves exactly once, never both branches', () => {
    // Both branches are already loaded; running both would show the visitor two things.
    const facts: Record<string, unknown> = { ready: false };
    runContinuation(continuation({ facts }), 0, perform, { pollMs: 10 });

    facts.ready = true;
    vi.advanceTimersByTime(5000);
    expect(performed).toHaveLength(1);
  });

  it('stops polling once it has resolved', () => {
    runContinuation(continuation(), 0, perform, { pollMs: 10 });
    vi.advanceTimersByTime(1100);
    const after = performed.length;

    vi.advanceTimersByTime(5000);
    expect(performed).toHaveLength(after);
  });

  it('holds the whole wait back by a preceding delay', () => {
    runContinuation(continuation({ facts: { ready: true } }), 500, perform, { pollMs: 10 });
    expect(performed).toEqual([]);

    vi.advanceTimersByTime(500);
    expect(performed).toEqual([[{ type: 'show_toast' }]]);
  });

  it('runs a nested wait on the branch it took', () => {
    const nested = continuation({
      facts: { ready: true },
      met: [{ type: 'show_toast' }],
      metContinuation: {
        group: group('second', 'isTrue'),
        facts: { second: true },
        timeoutMs: 1000,
        startMs: 0,
        met: [{ type: 'redirect' }],
        timeout: [],
      },
    });
    runContinuation(nested, 0, perform, { pollMs: 10 });

    expect(performed).toEqual([[{ type: 'show_toast' }], [{ type: 'redirect' }]]);
  });

  it('does not run the other branch\'s nested wait', () => {
    const nested = continuation({
      timeoutContinuation: {
        group: group('second', 'isTrue'),
        facts: { second: true },
        timeoutMs: 1000,
        startMs: 0,
        met: [{ type: 'redirect' }],
        timeout: [],
      },
      facts: { ready: true },
    });
    runContinuation(nested, 0, perform, { pollMs: 10 });
    expect(performed).toEqual([[{ type: 'show_toast' }]]);
  });

  it('can be cancelled before it resolves', () => {
    const cancel = runContinuation(continuation(), 0, perform, { pollMs: 10 });
    cancel();

    vi.advanceTimersByTime(5000);
    expect(performed).toEqual([]);
  });

  it('can be cancelled during its opening delay', () => {
    const cancel = runContinuation(continuation({ facts: { ready: true } }), 500, perform, { pollMs: 10 });
    cancel();

    vi.advanceTimersByTime(2000);
    expect(performed).toEqual([]);
  });

  it('merges page facts over the server snapshot', () => {
    // The snapshot carries what only the server knows; the page overrides what it can
    // see for itself, which is the whole point of re-evaluating here.
    const cont = continuation({
      group: group('page', 'equals', window.location.pathname),
      facts: { page: '/somewhere-else' },
    });
    runContinuation(cont, 0, perform, { pollMs: 10 });
    expect(performed).toEqual([[{ type: 'show_toast' }]]);
  });

  it('clamps an absurd timeout rather than waiting forever', () => {
    runContinuation(continuation({ timeoutMs: 9_999_999 }), 0, perform, { pollMs: 10 });
    vi.advanceTimersByTime(300_001);
    expect(performed).toEqual([[{ type: 'show_banner' }]]);
  });

  it('handles an empty branch without calling perform with nothing useful', () => {
    runContinuation(continuation({ facts: { ready: true }, met: [] }), 0, perform, { pollMs: 10 });
    expect(performed).toEqual([[]]);
  });
});
