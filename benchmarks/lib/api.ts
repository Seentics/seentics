/** The API calls every benchmark makes: an account, a token, timed reads. */
import { API, type State } from "./config";

async function json<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

/** A new account, the way a customer signs up. Returns its id and access token. */
export async function register(email: string, password: string): Promise<{ userId: string; token: string }> {
  const r = await json<{ data: { user: { id: string }; tokens: { access_token: string } } }>(
    "POST", "/api/v1/user/auth/register", { name: "Bench", email, password },
  );
  return { userId: r.data.user.id, token: r.data.tokens.access_token };
}

export async function createWebsite(token: string, name: string, url: string): Promise<{ id: string; tracking_id: string }> {
  const r = await json<{ data: { website: { id: string; tracking_id: string } } }>("POST", "/api/v1/websites", { name, url }, token);
  return r.data.website;
}

/**
 * A session that logs in again when its token nears expiry (they last 15 minutes, and
 * a long audit outlives one — after which it would be measuring the 401 path).
 */
export function session(state: Pick<State, "email" | "password">) {
  let token = "";
  let at = 0;
  let bust = 0;

  async function auth(): Promise<string> {
    if (!token || Date.now() - at > 10 * 60_000) {
      const r = await json<{ data: { tokens: { access_token: string } } }>(
        "POST", "/api/v1/user/auth/login", { email: state.email, password: state.password },
      );
      token = r.data.tokens.access_token;
      at = Date.now();
    }
    return token;
  }

  /**
   * GET a path, timed. `cold` adds a unique parameter so the request misses the
   * response caches (they key on the full URL); a warm call repeats the previous one.
   */
  async function get(path: string, cold: boolean): Promise<{ status: number; ms: number; body: any }> {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${API}${path}${sep}_bench=${cold ? ++bust : bust}`;
    const headers = { Authorization: `Bearer ${await auth()}` };
    const t0 = performance.now();
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(120_000) });
    const body = await res.json().catch(() => null);
    return { status: res.status, ms: Math.round(performance.now() - t0), body };
  }

  return { auth, get };
}
