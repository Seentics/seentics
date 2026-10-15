import { z } from 'zod';
import type { HeatmapInsightFinding, HeatmapSignal } from '../../heatmaps/interfaces';
import { numbersIn } from '../insights/brief';
import { extractJson } from '../insights/output';
import { looksPersonal } from '../../../platform/heuristics';

/**
 * What the model may return for a page, and what is kept.
 *
 * The same lenient, per-finding checks as the daily insight (insights/output.ts): a finding is
 * kept only when it names a signal from the brief (once), every number in its finding and its fix
 * is in the brief, it carries nothing that looks like personal data, and it is a sensible length.
 * A finding that fails is dropped, not repaired. The kind and device of a finding come from its
 * signal, never from the model.
 */

export const MIN_FINDINGS = 2;
export const MAX_FINDINGS = 5;
/** Findings read from a response at most. */
const MAX_RAW = 8;
const MAX_FINDING = 300;
const MAX_FIX = 260;

/** Small whole numbers that carry no claim of their own ("top 3", "two or three elements"). */
const FREE_NUMBERS = new Set(['1', '2', '3']);

const envelope = z.object({ findings: z.array(z.unknown()) });
const item = z.object({
  signal: z.string().trim().min(1).max(120),
  finding: z.string().trim().min(12).transform((t) => clip(t, MAX_FINDING)),
  fix: z.string().trim().min(8).transform((t) => clip(t, MAX_FIX)),
});

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, '')}…`;
}

export type ParsedFindings = { findings: HeatmapInsightFinding[]; dropped: Array<{ signal: string; why: string }> };

export function parseHeatmapOutput(raw: string, signals: HeatmapSignal[], briefNumbers: Set<string>): ParsedFindings {
  const parsed = envelope.parse(extractJson(raw));
  const byId = new Map(signals.map((s) => [s.id, s]));
  const findings: HeatmapInsightFinding[] = [];
  const dropped: ParsedFindings['dropped'] = [];
  const used = new Set<string>();

  for (const rawItem of parsed.findings.slice(0, MAX_RAW)) {
    const checked = item.safeParse(rawItem);
    if (!checked.success) {
      const sig = (rawItem as { signal?: unknown } | null)?.signal;
      dropped.push({ signal: typeof sig === 'string' ? sig.slice(0, 120) : '', why: 'malformed finding' });
      continue;
    }
    const f = checked.data;
    const drop = (why: string) => dropped.push({ signal: f.signal, why });
    const signal = byId.get(f.signal);
    if (!signal) { drop('unknown signal'); continue; }
    if (used.has(signal.id)) { drop('signal used twice'); continue; }
    if (looksPersonal(f.finding) || looksPersonal(f.fix)) { drop('looks like personal data'); continue; }
    const invented = [...numbersIn(`${f.finding} ${f.fix}`)].filter((n) => !briefNumbers.has(n) && !FREE_NUMBERS.has(n));
    if (invented.length) { drop(`numbers not in the data: ${invented.join(', ')}`); continue; }

    findings.push({ signal: signal.id, kind: signal.kind, device: signal.device, finding: f.finding, fix: f.fix });
    used.add(signal.id);
    if (findings.length === MAX_FINDINGS) break;
  }
  return { findings, dropped };
}

/** The findings worded from templates: the strongest signals as the rules state them. */
export function ruleHeatmapFindings(signals: HeatmapSignal[], max = 4): HeatmapInsightFinding[] {
  return signals.slice(0, Math.min(max, MAX_FINDINGS)).map((s) => ({
    signal: s.id, kind: s.kind, device: s.device, finding: s.finding, fix: s.fix,
  }));
}

/**
 * The model's findings, topped up from the rules when it kept fewer than the page has to say:
 * a model that wandered on three of five signals still leaves the owner two worth reading.
 */
export function withRuleTopUp(findings: HeatmapInsightFinding[], signals: HeatmapSignal[]): HeatmapInsightFinding[] {
  const want = Math.min(MIN_FINDINGS, signals.length);
  if (findings.length >= want) return findings;
  const used = new Set(findings.map((f) => f.signal));
  const extra = ruleHeatmapFindings(signals.filter((s) => !used.has(s.id)), want - findings.length);
  return [...findings, ...extra];
}
