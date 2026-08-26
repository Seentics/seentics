'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Globe, Layers,
  BrainCircuit, DollarSign,
  ChevronRight, RefreshCw,
  Zap, Video, UserCheck, UserX,
} from 'lucide-react';
import { fetchAdminStats, fetchRecentSignups, getAdminToken, clearAdminToken } from '@/lib/admin-api';
import { AdminSidebar } from '@/components/admin-sidebar';
import Link from 'next/link';

type Stats = Awaited<ReturnType<typeof fetchAdminStats>>;
type RecentSignups = Awaited<ReturnType<typeof fetchRecentSignups>>;

const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString();
};


const PLAN_COLORS: Record<string, string> = {
  starter:      'bg-gray-800 text-gray-300 border border-gray-700',
  basic:        'bg-blue-500/10 text-blue-300 border border-blue-500/20',
  growth:       'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
  pro:          'bg-violet-500/10 text-violet-300 border border-violet-500/20',
  agency:       'bg-amber-500/10 text-amber-300 border border-amber-500/20',
  agency_pro:   'bg-orange-500/10 text-orange-300 border border-orange-500/20',
  lifetime:     'bg-yellow-500/10 text-yellow-300 border border-yellow-500/20',
  lifetime_pro: 'bg-rose-500/10 text-rose-300 border border-rose-500/20',
  enterprise:   'bg-pink-500/10 text-pink-300 border border-pink-500/20',
};

function PlanBadge({ plan }: { plan: string }) {
  const cls = PLAN_COLORS[plan] ?? 'bg-gray-800 text-gray-300 border border-gray-700';
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${cls}`}>
      {plan.replace('_', ' ')}
    </span>
  );
}

type CardAccent = 'indigo' | 'emerald' | 'violet' | 'amber' | 'sky' | 'rose' | 'teal' | 'slate';

const ACCENT: Record<CardAccent, { icon: string; text: string; bar: string }> = {
  indigo: { icon: 'bg-indigo-500/15 text-indigo-400', text: 'text-indigo-400', bar: 'bg-indigo-500' },
  emerald:{ icon: 'bg-emerald-500/15 text-emerald-400', text: 'text-emerald-400', bar: 'bg-emerald-500' },
  violet: { icon: 'bg-violet-500/15 text-violet-400', text: 'text-violet-400', bar: 'bg-violet-500' },
  amber:  { icon: 'bg-amber-500/15 text-amber-400', text: 'text-amber-400', bar: 'bg-amber-500' },
  sky:    { icon: 'bg-sky-500/15 text-sky-400', text: 'text-sky-400', bar: 'bg-sky-500' },
  rose:   { icon: 'bg-rose-500/15 text-rose-400', text: 'text-rose-400', bar: 'bg-rose-500' },
  teal:   { icon: 'bg-teal-500/15 text-teal-400', text: 'text-teal-400', bar: 'bg-teal-500' },
  slate:  { icon: 'bg-slate-500/15 text-slate-400', text: 'text-slate-400', bar: 'bg-slate-400' },
};

const CARD = 'bg-[#111116] border border-white/[0.06] rounded-lg p-5 hover:border-white/10 transition-colors';

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  badge,
  accent = 'indigo',
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  badge?: string;
  accent?: CardAccent;
}) {
  const a = ACCENT[accent];
  return (
    <div className={CARD}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2 rounded-lg ${a.icon}`}>
          <Icon className="w-4 h-4" />
        </div>
        {badge && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 bg-white/5 px-2 py-0.5 rounded-lg">
            {badge}
          </span>
        )}
      </div>
      <p className="text-[12px] text-gray-500 mb-1 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-white tracking-tight leading-none">
        {typeof value === 'number' ? fmt(value) : value}
      </p>
      {sub && (
        <p className={`text-xs mt-2 ${a.text}`}>{sub}</p>
      )}
    </div>
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

  const totalSubs = (stats?.subscriptions.paid ?? 0) + (stats?.subscriptions.free ?? 0);

  return (
    <div className="min-h-screen bg-[#0c0c12] text-white flex">
      <AdminSidebar />

      {/* Main */}
      <main className="flex-1 p-8 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Overview</h1>
            <p className="text-gray-500 text-sm mt-0.5">Platform-wide metrics</p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/8 rounded-lg px-3.5 py-2 transition-all disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-64 text-gray-600 text-sm">Loading…</div>
        )}
        {error && (
          <div className="bg-red-500/5 border border-red-500/20 text-red-400 rounded-lg p-4 text-sm mb-6">{error}</div>
        )}

        {stats && !loading && (
          <div className="space-y-6">
            {/* Row 1 — Users & Subscriptions */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Total Users" value={stats.users.total}
                sub={`+${stats.users.newThisMonth} this month`} accent="indigo" />
              <StatCard icon={UserCheck} label="Paid Subscribers" value={stats.subscriptions.paid}
                sub="active paid plans" badge="paid" accent="emerald" />
              <StatCard icon={UserX} label="Free Users" value={stats.subscriptions.free}
                sub="on free plan" badge="free" accent="slate" />
              <StatCard icon={DollarSign} label="Total Revenue" value={`$${fmt(stats.revenue.totalUsd)}`}
                sub="all-time purchases" accent="amber" />
            </div>

            {/* Row 2 — Platform activity */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Globe} label="Websites Tracked" value={stats.websites.total}
                accent="sky" />
              <StatCard icon={Zap} label="Events This Month" value={stats.events.thisMonth}
                sub={`${fmt(stats.events.total)} total`} accent="violet" />
              <StatCard icon={Video} label="Sessions This Month" value={stats.sessions.thisMonth}
                sub={`${fmt(stats.sessions.total)} total`} accent="teal" />
              <StatCard icon={Layers} label="Heatmap Pages" value={stats.heatmaps.totalPages}
                accent="rose" />
            </div>

            {/* Row 3 — AI + Plan breakdown + Recent signups */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* AI Queries */}
              <StatCard icon={BrainCircuit} label="AI Queries" value={stats.aiQueries.thisMonth}
                sub="this month" badge="this month" accent="violet" />

              {/* Plan breakdown */}
              <div className={CARD}>
                <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-4">Subscribers by Plan</h2>
                {stats.subscriptions.byPlan.length === 0 ? (
                  <p className="text-gray-600 text-sm">No subscriptions yet</p>
                ) : (
                  <div className="space-y-3">
                    {stats.subscriptions.byPlan.map((p) => (
                      <div key={p.plan} className="flex items-center gap-3">
                        <PlanBadge plan={p.plan} />
                        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${ACCENT[p.plan === 'starter' ? 'slate' : p.plan === 'growth' ? 'emerald' : p.plan === 'pro' ? 'violet' : 'indigo'].bar}`}
                            style={{ width: `${Math.min(100, (p.count / Math.max(1, totalSubs)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gray-300 w-5 text-right tabular-nums">{p.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent signups */}
              <div className={CARD}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Recent Signups</h2>
                  <Link href="/admin/users" className="text-indigo-400 text-xs flex items-center gap-1 hover:text-indigo-300 transition-colors">
                    View all <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="space-y-3">
                  {(recent?.users ?? []).slice(0, 5).map((u) => (
                    <div key={u.id} className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-600/30 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
                        {u.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-white font-medium truncate leading-tight">{u.name || '—'}</p>
                        <p className="text-[11px] text-gray-500 truncate">{u.email}</p>
                      </div>
                      <PlanBadge plan={u.plan_id ?? 'starter'} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
