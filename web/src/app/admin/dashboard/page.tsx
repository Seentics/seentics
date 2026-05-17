'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Globe, Zap, CreditCard, Activity, Layers,
  BrainCircuit, DollarSign, TrendingUp, TrendingDown,
  LogOut, BarChart3, ChevronRight, RefreshCw,
} from 'lucide-react';
import { fetchAdminStats, fetchRecentSignups, clearAdminToken, getAdminToken } from '@/lib/admin-api';
import Link from 'next/link';

type Stats = Awaited<ReturnType<typeof fetchAdminStats>>;
type RecentSignups = Awaited<ReturnType<typeof fetchRecentSignups>>;

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  color = 'indigo',
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'indigo' | 'emerald' | 'violet' | 'amber' | 'sky' | 'rose';
}) {
  const colors = {
    indigo: 'bg-indigo-500/10 text-indigo-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    violet: 'bg-violet-500/10 text-violet-400',
    amber: 'bg-amber-500/10 text-amber-400',
    sky: 'bg-sky-500/10 text-sky-400',
    rose: 'bg-rose-500/10 text-rose-400',
  };
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{label}</span>
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        {sub && (
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            {trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-400" />}
            {trend === 'down' && <TrendingDown className="w-3 h-3 text-rose-400" />}
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

const PLAN_COLORS: Record<string, string> = {
  starter: 'bg-gray-700 text-gray-300',
  basic: 'bg-blue-900/50 text-blue-300',
  growth: 'bg-emerald-900/50 text-emerald-300',
  pro: 'bg-violet-900/50 text-violet-300',
  agency: 'bg-amber-900/50 text-amber-300',
  agency_pro: 'bg-orange-900/50 text-orange-300',
  lifetime: 'bg-yellow-900/50 text-yellow-300',
  lifetime_pro: 'bg-rose-900/50 text-rose-300',
  enterprise: 'bg-pink-900/50 text-pink-300',
};

function planBadge(plan: string) {
  const cls = PLAN_COLORS[plan] ?? 'bg-gray-700 text-gray-300';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {plan}
    </span>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentSignups | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showRefresh = false) => {
    if (!getAdminToken()) { router.replace('/admin'); return; }
    if (showRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const [s, r] = await Promise.all([fetchAdminStats(), fetchRecentSignups()]);
      setStats(s);
      setRecent(r);
    } catch (e: any) {
      if (e.message?.includes('Unauthorized')) { clearAdminToken(); router.replace('/admin'); return; }
      setError(e.message ?? 'Failed to load stats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  function logout() {
    clearAdminToken();
    router.replace('/admin');
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-gray-800 flex flex-col py-6 px-4 shrink-0">
        <div className="flex items-center gap-2 mb-8 px-2">
          <BarChart3 className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-sm">Seentics Admin</span>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          <Link href="/admin/dashboard" className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-indigo-600/20 text-indigo-300 text-sm font-medium">
            <Activity className="w-4 h-4" /> Overview
          </Link>
          <Link href="/admin/users" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 text-sm transition-colors">
            <Users className="w-4 h-4" /> Users
          </Link>
          <Link href="/admin/subscriptions" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 text-sm transition-colors">
            <CreditCard className="w-4 h-4" /> Subscriptions
          </Link>
        </nav>
        <button onClick={logout} className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-red-400 text-sm transition-colors rounded-lg hover:bg-red-400/10">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold">Overview</h1>
            <p className="text-gray-500 text-sm mt-0.5">Platform-wide metrics</p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-64 text-gray-500">Loading…</div>
        )}
        {error && (
          <div className="bg-red-400/10 border border-red-400/20 text-red-400 rounded-xl p-4 text-sm">{error}</div>
        )}

        {stats && !loading && (
          <>
            {/* Stat grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard icon={Users} label="Total Users" value={stats.users.total}
                sub={`+${stats.users.newThisMonth} this month`} trend="up" color="indigo" />
              <StatCard icon={CreditCard} label="Active Subscriptions" value={stats.subscriptions.active}
                sub="paid plans" color="emerald" />
              <StatCard icon={Globe} label="Websites Tracked" value={stats.websites.total}
                color="sky" />
              <StatCard icon={DollarSign} label="Total Revenue" value={`$${stats.revenue.totalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                sub="all-time purchases" color="amber" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard icon={Zap} label="Total Events" value={stats.events.total}
                sub={`${stats.events.thisMonth.toLocaleString()} this month`} color="violet" />
              <StatCard icon={Activity} label="Sessions (replays)" value={stats.sessions.total}
                sub={`${stats.sessions.thisMonth.toLocaleString()} this month`} color="indigo" />
              <StatCard icon={Layers} label="Heatmap Pages" value={stats.heatmaps.totalPages}
                color="rose" />
              <StatCard icon={BrainCircuit} label="AI Queries" value={stats.aiQueries.thisMonth}
                sub="this month" color="violet" />
            </div>

            {/* Plan breakdown + Recent signups */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Plan breakdown */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="font-semibold text-sm mb-4">Active Subscribers by Plan</h2>
                {stats.subscriptions.byPlan.length === 0 && (
                  <p className="text-gray-500 text-sm">No active subscriptions</p>
                )}
                <div className="space-y-3">
                  {stats.subscriptions.byPlan.map((p) => (
                    <div key={p.plan} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {planBadge(p.plan)}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-gray-800 rounded-full h-1.5">
                          <div
                            className="bg-indigo-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, (p.count / Math.max(1, stats.subscriptions.active)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-300 w-6 text-right">{p.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent signups */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-sm">Recent Signups</h2>
                  <Link href="/admin/users" className="text-indigo-400 text-xs flex items-center gap-1 hover:underline">
                    View all <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="space-y-3">
                  {(recent?.users ?? []).map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-indigo-900 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
                          {u.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{u.name || u.email}</p>
                          <p className="text-xs text-gray-500 truncate">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {planBadge(u.plan_id ?? 'starter')}
                        <span className="text-xs text-gray-600">
                          {new Date(u.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
