/**
 * Where the benchmarks point. Defaults are the standalone stack `run.sh up` starts; set
 * the variables to aim the same scripts at another deployment of this API — the
 * seentics-cloud stack behind its gateway, for instance (its benchmarks/run.sh does).
 *
 *   BENCH_API            base URL of the API                 http://127.0.0.1:8001
 *   BENCH_DATABASE_URL   its Postgres, for seeding and the reference queries
 *   BENCH_PG_CONTAINER   the Postgres container, for bulk loads through docker exec
 *   BENCH_STATE_FILE     the account and sites the seed created
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const API = process.env.BENCH_API ?? "http://127.0.0.1:8001";
export const DATABASE_URL =
  process.env.BENCH_DATABASE_URL ?? "postgres://seentics:bench_postgres_password@127.0.0.1:55433/seentics";
export const PG_CONTAINER = process.env.BENCH_PG_CONTAINER ?? "seentics-oss-bench-postgres-1";
export const DB_NAME = new URL(DATABASE_URL).pathname.slice(1);
export const DB_USER = decodeURIComponent(new URL(DATABASE_URL).username);

export const STATE_FILE = process.env.BENCH_STATE_FILE ?? new URL("../.state/state.json", import.meta.url).pathname;
export const RESULTS_DIR = new URL("../results/", import.meta.url).pathname;
mkdirSync(dirname(STATE_FILE), { recursive: true });
mkdirSync(RESULTS_DIR, { recursive: true });

export type Site = { id: string; host: string; sessions: number };

/** What the seed recorded: the account it registered and the sites it filled. */
export type State = {
  email: string;
  password: string;
  sites: Record<string, Site>;
};

export async function readState(): Promise<State> {
  const file = Bun.file(STATE_FILE);
  if (!(await file.exists())) throw new Error(`no ${STATE_FILE} — run the seed first (run.sh seed)`);
  return file.json();
}

export async function writeState(state: State): Promise<void> {
  await Bun.write(STATE_FILE, JSON.stringify(state, null, 2));
}
