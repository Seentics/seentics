# AI evaluation — tuning report (2026-10-14)

Model: `gpt-6-luna` (OpenAI). 58 assistant cases (46 tuned against, 12 held out) plus 24
generator cases. Deterministic graders decide pass/fail; see `../graders.ts`.
Run: `bun run eval:ai [suite] [--split train|test]` from `seentics/core`.

| Assistant cases       | Baseline | Final |
|-----------------------|---------:|------:|
| Pass — tuned (46)     | 45.7%    | 91.3% |
| Pass — held out (12)  | 33.3%    | 75.0% |
| Correct (grounded)    | 100%     | 100%  |
| Helpful               | 84.5%    | 91.4% |
| Actionable            | 9.4%     | 93.8% |
| Safe                  | 98.3%    | 100%  |
| Generators (24)       | 95.8%    | 100%  |

Cost per assistant question ≈ $0.001. Total model spend for the tuning: $0.33.

## What changed
- **Agent loop:** the last turn withholds reads but keeps drafts, so a researched answer is
  given (or a change drafted) instead of "couldn't finish"; a draft with no prose is explained
  from its own summary, and every draft reply says nothing changes until confirmed.
- **System prompt:** answer-first with the period; at most three specific points; one next
  step tied to a page, element, recording or funnel step; read independent sources together;
  ask (and do not draft) when a request is ambiguous; check for an existing funnel, goal or
  automation before creating; look paths up instead of asking; say plainly what Seentics
  does not track; refuse other sites; quote error messages.
- **Automations:** drafts can be limited to a page (`pagePath`, `pageMatch`), and the
  evaluator now applies a trigger's `path` to every trigger type, not only page views —
  before, "exit popup on /pricing" could only be drafted site-wide.
- **Funnels:** tool descriptions say how to match a section (`starts_with`) and how to add,
  remove or reorder steps.
- **Grader fixes:** typographic apostrophes, bold paths, `file:line` names, "Next, …"
  steps, and two cases whose expectations were wrong (period not named; two checkout errors).

## Remaining weaknesses
- Variance run to run (±2–4 points); a single run is not a verdict.
- Sometimes a section funnel step is drafted as one exact page despite the description.
- "Top three things to fix" occasionally stops short of naming /checkout.
- Vague questions ("how are we doing?") sometimes omit the period or headline figure.
