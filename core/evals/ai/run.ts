/**
 * AI evaluation harness. Real model, real agent loop and tools, in-memory fixtures.
 *
 *   bun run eval:ai [suite] [--split train|test|all] [--only id,id] [--out name] [--concurrency n] [--judge]
 *
 * suite: all (default) | agent | generators | insights | sessions | heatmap | anomaly | impact | sql
 *
 * Not part of `bun test` (no *.test.ts here): every run spends real tokens. Spend is metered into
 * results/spend.json and a run refuses to start a call past EVAL_BUDGET_USD (default $1.40).
 * Results go to results/<out>.json. The API key is read from OPENAI_API_KEY or the repo's .env and
 * never printed or written.
 */
process.env.DATABASE_URL ??= "postgres://eval-not-connected";
process.env.LOG_LEVEL ??= "error";

const { writeFileSync, mkdirSync } = await import("node:fs");
const { join } = await import("node:path");
const { MeteredClient, RESULTS_DIR, BUDGET_USD } = await import("./llm");
const { runAgentSuite, summariseAgent } = await import("./agent-suite");
const { runGenerators, GENERATOR_SUITES } = await import("./generators");
type GenSuite = (typeof GENERATOR_SUITES)[number];

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const suite = args.find((a) => !a.startsWith("--") && !args[args.indexOf(a) - 1]?.startsWith("--")) ?? "all";
const split = (flag("split") ?? "all") as "train" | "test" | "all";
const only = flag("only")?.split(",").filter(Boolean);
const out = flag("out") ?? `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const concurrency = Math.min(4, Math.max(1, Number(flag("concurrency") ?? 4)));
const judge = args.includes("--judge");
const repeat = Math.min(5, Math.max(1, Number(flag("repeat") ?? 1)));
const { configureLogger } = await import("../../platform/observability/logger");
configureLogger({ logLevel: "error" } as never);

if (suite === "regrade") {
  // Re-grade a stored run with the current graders: no model calls, no spend.
  const { readFileSync } = await import("node:fs");
  const { regrade } = await import("./agent-suite");
  const file = join(RESULTS_DIR, `${args[1]}.json`);
  const data = JSON.parse(readFileSync(file, "utf8"));
  const cases = data.agent.cases.map(regrade);
  const bySplit = (s: string) => cases.filter((r: any) => r.split === s);
  data.agent.cases = cases;
  data.agent.summary = { all: summariseAgent(cases), train: summariseAgent(bySplit("train")), test: summariseAgent(bySplit("test")) };
  data.agent.byCategory = Object.fromEntries([...new Set<string>(cases.map((r: any) => r.category))].map((c) => [c, summariseAgent(cases.filter((r: any) => r.category === c))]));
  writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(JSON.stringify(data.agent.summary, null, 1));
  for (const r of cases.filter((x: any) => !x.pass)) {
    console.log(`  FAIL ${r.id} [${r.split}] ${Object.entries(r.grade).filter(([, v]: any) => v && v.length).map(([k, v]: any) => `${k}: ${v.join("; ")}`).join(" | ")}`);
  }
  process.exit(0);
}

const llm = new MeteredClient(out);
console.log(`model ${llm.model} · suite ${suite} · split ${split} · spent so far $${llm.totalSpendUsd.toFixed(4)} of $${BUDGET_USD}`);

const started = Date.now();
const report: Record<string, unknown> = { model: llm.model, suite, split, repeat, at: new Date().toISOString() };

try {
  if (suite === "all" || suite === "agent") {
    const results = await runAgentSuite(llm, { split, only, concurrency, judge, repeat });
    const bySplit = (s: string) => results.filter((r) => r.split === s);
    report.agent = {
      summary: { all: summariseAgent(results), train: summariseAgent(bySplit("train")), test: summariseAgent(bySplit("test")) },
      byCategory: Object.fromEntries([...new Set(results.map((r) => r.category))].map((c) => [c, summariseAgent(results.filter((r) => r.category === c))])),
      cases: results,
    };
    console.log("\nAGENT", JSON.stringify((report.agent as any).summary, null, 1));
    for (const r of results.filter((x) => !x.pass)) {
      const why = Object.entries(r.grade).filter(([, v]) => v && v.length).map(([k, v]) => `${k}: ${v!.join("; ")}`).join(" | ");
      console.log(`  FAIL ${r.id} [${r.split}] ${why}`);
    }
  }
  const genSuites: GenSuite[] = suite === "all" || suite === "generators"
    ? [...GENERATOR_SUITES]
    : (GENERATOR_SUITES as readonly string[]).includes(suite) ? [suite as GenSuite] : [];
  if (genSuites.length) {
    const results = await runGenerators(llm, genSuites, concurrency, repeat);
    const summary = Object.fromEntries(genSuites.map((s) => {
      const rs = results.filter((r) => r.suite === s);
      return [s, { cases: rs.length, pass_pct: rs.length ? Math.round((rs.filter((r) => r.pass).length / rs.length) * 1000) / 10 : null }];
    }));
    report.generators = { summary, cases: results };
    console.log("\nGENERATORS", JSON.stringify(summary));
    for (const r of results.filter((x) => !x.pass)) console.log(`  FAIL ${r.suite}/${r.id}: ${r.reasons.join("; ")}`);
  }
} finally {
  llm.flush();
  report.spend = { run: { ...llm.run, costUsd: Math.round(llm.run.costUsd * 1e6) / 1e6 }, totalUsd: Math.round(llm.totalSpendUsd * 1e6) / 1e6 };
  report.elapsedSec = Math.round((Date.now() - started) / 1000);
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(join(RESULTS_DIR, `${out}.json`), JSON.stringify(report, null, 2));
  console.log(`\nrun cost $${llm.run.costUsd.toFixed(4)} (${llm.run.calls} calls) · total $${llm.totalSpendUsd.toFixed(4)} · results/${out}.json`);
}
export {};
