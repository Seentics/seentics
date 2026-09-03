import { describe, expect, it } from "bun:test";
import { validateAndSanitizeSQL } from "../services/shared";
import { ANALYTICS_PROMPT, ANALYTICS_TABLES } from "../services/domains/analytics";
import { AUTOMATIONS_PROMPT, AUTOMATIONS_TABLES } from "../services/domains/automations";
import { FUNNELS_PROMPT, FUNNELS_TABLES } from "../services/domains/funnels";
import { HEATMAPS_PROMPT, HEATMAPS_TABLES } from "../services/domains/heatmaps";
import { REPLAYS_PROMPT, REPLAYS_TABLES } from "../services/domains/replays";
import { REVENUE_PROMPT, REVENUE_TABLES } from "../services/domains/revenue";

/**
 * Every worked example in a domain prompt must survive the guard that runs on what the
 * model writes.
 *
 * The prompts are few-shot material: an example the validator would refuse teaches the
 * model a shape that fails at execution, and the user sees "Unsafe SQL" for a question
 * the product claims to answer. That failure mode is silent from the prompt's side —
 * nothing links the two files — so it is checked here instead.
 *
 * This is also the regression test for tightening the guard. When a new rule is added,
 * the examples that no longer pass fail this test, which is the list of prompts that
 * need updating in the same change.
 */

const DOMAINS = [
  { name: "analytics", prompt: ANALYTICS_PROMPT, tables: ANALYTICS_TABLES },
  { name: "revenue", prompt: REVENUE_PROMPT, tables: REVENUE_TABLES },
  { name: "replays", prompt: REPLAYS_PROMPT, tables: REPLAYS_TABLES },
  { name: "heatmaps", prompt: HEATMAPS_PROMPT, tables: HEATMAPS_TABLES },
  { name: "funnels", prompt: FUNNELS_PROMPT, tables: FUNNELS_TABLES },
  { name: "automations", prompt: AUTOMATIONS_PROMPT, tables: AUTOMATIONS_TABLES },
];

/**
 * Pull the worked examples out of a prompt.
 *
 * They live under `COMMON QUERY PATTERNS`, each introduced by a `--` comment and
 * terminated by `;`. Anything outside that section is schema notes and rules prose. The
 * `--` lines are stripped: they are annotations in the prompt, not part of the example,
 * and the guard rejects comments outright.
 */
function examplesIn(prompt: string): string[] {
  const start = prompt.indexOf("COMMON QUERY PATTERNS");
  if (start === -1) return [];
  // Stop at the next banner section so the RESPONSE FORMAT block is not scanned.
  const rest = prompt.slice(start);
  const end = rest.indexOf("RESPONSE FORMAT");
  const body = end === -1 ? rest : rest.slice(0, end);

  return body
    .split(";")
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((l) => !l.trimStart().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((sql) => /^(SELECT|WITH)\b/i.test(sql));
}

describe("domain prompt examples", () => {
  for (const domain of DOMAINS) {
    describe(domain.name, () => {
      const examples = examplesIn(domain.prompt);

      it("has worked examples to check", () => {
        expect(examples.length).toBeGreaterThan(0);
      });

      for (const [i, sql] of examples.entries()) {
        // The first line is the SELECT list, which is enough to identify the example.
        const label = sql.split("\n")[0]!.slice(0, 60);
        it(`example ${i + 1} passes the guard — ${label}`, () => {
          const result = validateAndSanitizeSQL(sql, domain.tables);
          if (!result.ok) {
            throw new Error(
              `${domain.name} example ${i + 1} would be refused: ${result.reason}\n\n${sql}`,
            );
          }
        });
      }
    });
  }
});
