/**
 * k6 load test for the Seentics API. Run through `benchmarks/run.sh k6`, which starts
 * grafana/k6 in a container on CPUs the stack does not use.
 *
 *   SCENARIO   ingest | dashboard | mixed                 (default mixed)
 *   RATE       requests per second, held constant         (default 200)
 *   DURATION   e.g. 60s, 5m                                (default 60s)
 *   SITE       which seeded site the dashboard reads      (default large)
 *
 * Open model (constant-arrival-rate): requests start at RATE whatever the latency, the
 * way real visitors arrive, so a slow server shows up as latency and errors instead of
 * quietly lowering the load. k6 adds VUs as needed up to MAX_VUS; "dropped_iterations"
 * in the summary means even that was not enough — the server stopped keeping up.
 *
 * Ingest goes to the seed's empty `ingest` site, so the load never changes the numbers
 * the feature benchmarks check. Dashboard requests add a unique `_k6` parameter so each
 * one misses the response cache and really queries the database.
 */
import http from "k6/http";
import { check } from "k6";

const state = JSON.parse(__ENV.BENCH_STATE);
const BASE = __ENV.BENCH_API || "http://host.docker.internal:8001";
const SCENARIO = __ENV.SCENARIO || "mixed";
const RATE = Number(__ENV.RATE || 200);
const DURATION = __ENV.DURATION || "60s";
const SITE = state.sites[__ENV.SITE || "large"];
const INGEST_SITE = state.sites.ingest;

const mixes = {
  ingest: { ingest: 1 },
  dashboard: { dashboard: 1 },
  mixed: { ingest: 0.95, dashboard: 0.05 },
};
const mix = mixes[SCENARIO];
if (!mix) throw new Error(`unknown SCENARIO ${SCENARIO} — ingest, dashboard or mixed`);

export const options = {
  scenarios: {
    load: {
      executor: "constant-arrival-rate",
      rate: RATE,
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: Math.min(200, RATE),
      maxVUs: Number(__ENV.MAX_VUS || 2000),
    },
  },
  // Pass/fail per request kind. A breach fails the run (non-zero exit), which is what
  // lets this gate CI.
  thresholds: {
    "http_req_failed": ["rate<0.01"],
    "http_req_duration{kind:ingest}": ["p(95)<200"],
    "http_req_duration{kind:dashboard}": ["p(95)<1000"],
  },
  summaryTrendStats: ["avg", "p(50)", "p(95)", "p(99)", "max"],
};

export function setup() {
  const res = http.post(`${BASE}/api/v1/user/auth/login`, JSON.stringify({ email: state.email, password: state.password }), {
    headers: { "Content-Type": "application/json" },
  });
  return { token: res.json("data.tokens.access_token") };
}

const PAGES = ["/", "/pricing", "/docs", "/blog/launch", "/features", "/signup", "/about", "/contact"];
const DASHBOARD = [
  "dashboard", "traffic-summary", "daily-stats", "hourly-stats", "top-pages", "top-referrers",
  "top-countries", "top-browsers", "dimensions-bulk", "visitor-insights", "geolocation-breakdown",
  "custom-events", "goals-stats", "page-utm-breakdown", "path-analysis", "revenue",
];
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

function pick() {
  let r = Math.random();
  for (const [kind, share] of Object.entries(mix)) {
    if ((r -= share) < 0) return kind;
  }
  return Object.keys(mix)[0];
}

function ingest() {
  const n = Math.floor(Math.random() * 1e9);
  const sid = `k6-s${n % 5000}`;
  const vid = `k6-v${n % 20000}`;
  const url = INGEST_SITE.host + PAGES[n % PAGES.length];
  const ts = Date.now();
  const body = JSON.stringify({
    website_id: INGEST_SITE.id,
    events: [
      { type: "pageview", data: { title: "k6", referrer: "https://www.google.com/", ua: UA, lang: "en-US", sw: 1920, sh: 1080 }, ts, url, sid, vid },
      { type: "click", data: { target: "button#cta" }, ts: ts + 1500, url, sid, vid },
      { type: "scroll", data: { depth: 0.6 }, ts: ts + 4000, url, sid, vid },
    ],
  });
  return http.post(`${BASE}/api/v1/tracker/collect`, body, {
    headers: { "Content-Type": "application/json", Origin: INGEST_SITE.host, "User-Agent": UA },
    tags: { kind: "ingest" },
  });
}

function dashboard(token) {
  const ep = DASHBOARD[Math.floor(Math.random() * DASHBOARD.length)];
  const days = [7, 30, 90][Math.floor(Math.random() * 3)];
  return http.get(`${BASE}/api/v1/analytics/${ep}/${SITE.id}?days=${days}&timezone=UTC&_k6=${Math.random()}`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { kind: "dashboard", endpoint: ep, days: String(days) },
  });
}

export default function (data) {
  const kind = pick();
  const res = kind === "ingest" ? ingest() : dashboard(data.token);
  check(res, { [`${kind} 2xx`]: (r) => r.status >= 200 && r.status < 300 });
}
