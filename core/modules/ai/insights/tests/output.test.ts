import { describe, expect, it } from 'bun:test';
import { buildBrief, numbersIn } from '../brief';
import { MAX_LINES, extractJson, parseModelOutput, ruleLines } from '../output';
import { detectSignals } from '../signals';
import { troubledSnapshot } from './fixtures';

const signals = detectSignals(troubledSnapshot());
const brief = buildBrief(troubledSnapshot(), signals);
const model = (lines: unknown) => JSON.stringify({ lines });

describe('buildBrief', () => {
  it('is compact, lists every signal by id, and contains the figures it states', () => {
    expect(brief.text.length).toBeLessThan(3500);
    for (const s of signals) expect(brief.text).toContain(`[${s.id}]`);
    expect(brief.text).toContain('visitors 4,300 (-16%)');
    expect(brief.numbers.has('4300')).toBe(true);
    expect(brief.numbers.has('16')).toBe(true);
  });

  it('never includes anything personal: paths and messages arrive masked', () => {
    expect(brief.text).not.toMatch(/@|\b\d{1,3}(?:\.\d{1,3}){3}\b/);
  });

  it('says plainly when nothing changed', () => {
    expect(buildBrief(troubledSnapshot(), []).text).toContain('(none: nothing changed enough to report)');
  });
});

describe('numbersIn', () => {
  it('reads figures with separators, decimals and percentages', () => {
    const n = numbersIn('12,400 visits, +8%, 2.3 pages, 4.6×');
    expect([...n]).toEqual(expect.arrayContaining(['12400', '8', '2.3', '4.6', '5']));
  });
});

describe('extractJson', () => {
  it('reads plain JSON, a fenced block, or JSON inside a sentence', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(extractJson('Here you go: {"a":3} hope that helps')).toEqual({ a: 3 });
    expect(() => extractJson('no json here')).toThrow('no JSON');
  });
});

describe('parseModelOutput', () => {
  it('keeps lines that name a real signal and use only the brief\'s numbers, with evidence from the signal', () => {
    const out = parseModelOutput(model([
      { signal: 'traffic.visitors', kind: 'finding', text: 'Visitors fell 16% over the last 7 days, to 4,300 from 5,100.' },
      { signal: 'device.mobile.conversion', kind: 'action', text: 'Mobile conversion is down 40%: consider a recovery offer for mobile visitors.' },
    ]), signals, brief.numbers);
    expect(out.dropped).toEqual([]);
    expect(out.lines).toHaveLength(2);
    expect(out.lines[0]).toMatchObject({ kind: 'finding', evidence: { kind: 'traffic' } });
    expect(out.lines[1]).toMatchObject({ kind: 'action', evidence: { kind: 'device' } });
    expect(out.lines[1]!.action?.prompt).toContain('mobile');
  });

  it('drops a line that states a number that is not in the data', () => {
    const out = parseModelOutput(model([
      { signal: 'traffic.visitors', text: 'Visitors fell 31% over the last 7 days, to 4,300 from 5,100.' },
      { signal: 'traffic.bounce', text: 'Bounce rate rose 11 points to 55%.' },
    ]), signals, brief.numbers);
    expect(out.lines.map((l) => l.text)).toEqual(['Bounce rate rose 11 points to 55%.']);
    expect(out.dropped[0]).toEqual({ signal: 'traffic.visitors', why: 'numbers not in the data: 31' });
  });

  it('drops an unknown signal, a repeated one and a line that looks personal', () => {
    const out = parseModelOutput(model([
      { signal: 'made.up', text: 'Something happened to your business this week.' },
      { signal: 'traffic.bounce', text: 'Bounce rate rose 11 points to 55%.' },
      { signal: 'traffic.bounce', text: 'Bounce rate rose 11 points to 55% again.' },
      { signal: 'traffic.visitors', text: 'Ask ada@example.com why visitors fell 16%.' },
    ]), signals, brief.numbers);
    expect(out.lines).toHaveLength(1);
    expect(out.dropped.map((d) => d.why)).toEqual(['unknown signal', 'signal used twice', 'looks like personal data']);
  });

  it('keeps an action line only when the signal has an action to attach', () => {
    const out = parseModelOutput(model([{ signal: 'traffic.visitors', kind: 'action', text: 'Visitors fell 16%: run a campaign.' }]), signals, brief.numbers);
    expect(out.lines[0]).toMatchObject({ kind: 'finding' });
    expect(out.lines[0]!.action).toBeUndefined();
  });

  it('keeps at most three lines', () => {
    const many = signals.slice(0, 5).map((s) => ({ signal: s.id, text: `Something about ${s.id.split('.')[0]}.` }));
    expect(parseModelOutput(model(many), signals, brief.numbers).lines.length).toBeLessThanOrEqual(MAX_LINES);
  });

  it('rejects output that is not the expected shape', () => {
    expect(() => parseModelOutput('{"lines":"nope"}', signals, brief.numbers)).toThrow();
    expect(() => parseModelOutput('sorry', signals, brief.numbers)).toThrow();
  });
});

describe('ruleLines', () => {
  it('words the top signals from templates, with the last as a suggestion when there is one', () => {
    const lines = ruleLines(signals);
    expect(lines.length).toBeLessThanOrEqual(MAX_LINES);
    expect(lines.some((l) => l.kind === 'action' && l.action)).toBe(true);
    expect(lines[0]!.text).toBe(signals[0]!.text);
  });

  it('is empty when there is nothing to say', () => {
    expect(ruleLines([])).toEqual([]);
  });
});
