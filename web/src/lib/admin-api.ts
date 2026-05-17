const ADMIN_TOKEN_KEY = 'seentics_admin_token';

function getApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1').replace(/\/api\/v1$/, '');
}

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(`${getApiBase()}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Request failed');
  }
  return res.json();
}

export async function adminLogin(email: string, password: string): Promise<string> {
  const data = await adminFetch<{ token: string }>('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return data.token;
}

export async function fetchAdminStats() {
  return adminFetch<{
    users: { total: number; newThisMonth: number; newLastMonth: number };
    subscriptions: { active: number; byPlan: { plan: string; count: number }[] };
    websites: { total: number };
    events: { total: number; thisMonth: number };
    sessions: { total: number; thisMonth: number };
    heatmaps: { totalPages: number };
    aiQueries: { thisMonth: number };
    revenue: { totalUsd: number };
  }>('/admin/stats');
}

export async function fetchAdminUsers(params: { search?: string; page?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.page)   q.set('page',   String(params.page));
  if (params.limit)  q.set('limit',  String(params.limit));
  return adminFetch<{
    users: { id: string; name: string; email: string; role: string; avatarUrl: string | null; createdAt: string; plan: string; subStatus: string | null }[];
    pagination: { total: number; page: number; limit: number; pages: number };
  }>(`/admin/users?${q}`);
}

export async function fetchAdminSubscriptions(params: { page?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (params.page)  q.set('page',  String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  return adminFetch<{
    subscriptions: { id: string; userId: string; userName: string; userEmail: string; planId: string; planName: string; priceMonthly: number; status: string; periodStart: string | null; periodEnd: string | null; createdAt: string }[];
    pagination: { total: number; page: number; limit: number; pages: number };
  }>(`/admin/subscriptions?${q}`);
}

export async function fetchAdminPlans() {
  return adminFetch<{
    plans: { id: string; name: string; price_monthly: number; max_monthly_events: number; max_replays: number; subscriber_count: number }[];
  }>('/admin/plans');
}

export async function fetchRecentSignups() {
  return adminFetch<{
    users: { id: string; name: string; email: string; role: string; created_at: string; plan_id: string | null }[];
  }>('/admin/recent-signups');
}
