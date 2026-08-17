'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { HardDrive, RefreshCw, Database, Table2, FileDigit } from 'lucide-react';
import { fetchAdminStorage, getAdminToken } from '@/lib/admin-api';
import { AdminSidebar } from '@/components/admin-sidebar';

type StorageData = Awaited<ReturnType<typeof fetchAdminStorage>>;

const TABLE_LABELS: Record<string, string> = {
  analytics_events:      'Analytics Events',
  session_replays:       'Session Replays',
  heatmap_points:        'Heatmap Points',
  websites:              'Websites',
  ai_queries:            'AI Queries',
  funnels:               'Funnels',
  automations:           'Automations',
  funnel_steps:          'Funnel Steps',
  funnel_events:         'Funnel Events',
  automation_rules:      'Automation Rules',
  automation_executions: 'Automation Executions',
  visitor_sessions:      'Visitor Sessions',
};

const TABLE_COLORS: Record<string, string> = {
  analytics_events: 'bg-violet-500',
  session_replays:  'bg-teal-500',
  heatmap_points:   'bg-rose-500',
  websites:         'bg-sky-500',
  ai_queries:       'bg-amber-500',
  funnels:          'bg-indigo-500',
  automations:      'bg-emerald-500',
};

function fmtBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 2 : 1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtRows(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function AdminStoragePage() {
  const router = useRouter();
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (showRefresh = false) => {
    if (!getAdminToken()) { router.replace('/admin'); return; }
    if (showRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      setData(await fetchAdminStorage());
    } catch (e: any) {
      if (e.message?.includes('Unauthorized')) { router.replace('/admin'); return; }
      setError(e.message ?? 'Failed to load storage data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const totalTrackedBytes = data?.tables.reduce((s, t) => s + t.totalBytes, 0) ?? 0;

  return (
    <div className="min-h-screen bg-[#0c0c12] text-white flex">
      <AdminSidebar />

      <main className="flex-1 p-8 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Storage</h1>
            <p className="text-gray-500 text-sm mt-0.5">Database table sizes and row counts</p>
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

        {data && !loading && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#111116] border border-white/[0.06] rounded-lg p-5">
                <div className="p-2 rounded-lg bg-teal-500/15 text-teal-400 w-fit mb-4">
                  <Database className="w-4 h-4" />
                </div>
                <p className="text-[11px] text-gray-500 uppercase tracking-wide font-medium mb-1">Total DB Size</p>
                <p className="text-2xl font-bold text-white">{fmtBytes(data.dbTotalBytes)}</p>
                <p className="text-xs text-gray-600 mt-1.5">entire postgres database</p>
              </div>
              <div className="bg-[#111116] border border-white/[0.06] rounded-lg p-5">
                <div className="p-2 rounded-lg bg-violet-500/15 text-violet-400 w-fit mb-4">
                  <Table2 className="w-4 h-4" />
                </div>
                <p className="text-[11px] text-gray-500 uppercase tracking-wide font-medium mb-1">Tracked Tables</p>
                <p className="text-2xl font-bold text-white">{fmtBytes(totalTrackedBytes)}</p>
                <p className="text-xs text-gray-600 mt-1.5">{data.tables.length} analytics tables</p>
              </div>
              <div className="bg-[#111116] border border-white/[0.06] rounded-lg p-5">
                <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400 w-fit mb-4">
                  <FileDigit className="w-4 h-4" />
                </div>
                <p className="text-[11px] text-gray-500 uppercase tracking-wide font-medium mb-1">Total Rows</p>
                <p className="text-2xl font-bold text-white">
                  {fmtRows(data.tables.reduce((s, t) => s + t.rows, 0))}
                </p>
                <p className="text-xs text-gray-600 mt-1.5">across all tracked tables</p>
              </div>
            </div>

            {/* Visual breakdown bar */}
            {data.tables.length > 0 && (
              <div className="bg-[#111116] border border-white/[0.06] rounded-lg p-5">
                <p className="text-[11px] text-gray-500 uppercase tracking-wide font-medium mb-3">Storage Distribution</p>
                <div className="flex h-3 rounded-full overflow-hidden gap-px mb-4">
                  {data.tables.map((t) => {
                    const pct = totalTrackedBytes > 0 ? (t.totalBytes / totalTrackedBytes) * 100 : 0;
                    if (pct < 0.5) return null;
                    const color = TABLE_COLORS[t.name] ?? 'bg-gray-500';
                    return (
                      <div
                        key={t.name}
                        className={`${color} h-full transition-all`}
                        style={{ width: `${pct}%` }}
                        title={`${TABLE_LABELS[t.name] ?? t.name}: ${fmtBytes(t.totalBytes)}`}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {data.tables.filter(t => totalTrackedBytes > 0 && (t.totalBytes / totalTrackedBytes) >= 0.005).map((t) => (
                    <div key={t.name} className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-lg-sm ${TABLE_COLORS[t.name] ?? 'bg-gray-500'}`} />
                      <span className="text-[11px] text-gray-500">{TABLE_LABELS[t.name] ?? t.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Table breakdown */}
            <div className="bg-[#111116] border border-white/[0.06] rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left">
                    <th className="px-5 py-3.5 text-[11px] text-gray-500 uppercase tracking-wide font-medium">Table</th>
                    <th className="px-5 py-3.5 text-[11px] text-gray-500 uppercase tracking-wide font-medium text-right">Rows</th>
                    <th className="px-5 py-3.5 text-[11px] text-gray-500 uppercase tracking-wide font-medium text-right">Data</th>
                    <th className="px-5 py-3.5 text-[11px] text-gray-500 uppercase tracking-wide font-medium text-right">Indexes</th>
                    <th className="px-5 py-3.5 text-[11px] text-gray-500 uppercase tracking-wide font-medium text-right">Total</th>
                    <th className="px-5 py-3.5 text-[11px] text-gray-500 uppercase tracking-wide font-medium">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tables.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-gray-600">No tables found</td>
                    </tr>
                  )}
                  {data.tables.map((t, i) => {
                    const pct = totalTrackedBytes > 0 ? (t.totalBytes / totalTrackedBytes) * 100 : 0;
                    const color = TABLE_COLORS[t.name] ?? 'bg-gray-500';
                    return (
                      <tr
                        key={t.name}
                        className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${i === data.tables.length - 1 ? 'border-b-0' : ''}`}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-2 h-2 rounded-lg-sm shrink-0 ${color}`} />
                            <span className="text-white font-medium">{TABLE_LABELS[t.name] ?? t.name}</span>
                            <span className="text-[11px] text-gray-600 font-mono">{t.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right text-gray-300 tabular-nums font-medium">{fmtRows(t.rows)}</td>
                        <td className="px-5 py-3.5 text-right text-gray-400 tabular-nums">{fmtBytes(t.dataBytes)}</td>
                        <td className="px-5 py-3.5 text-right text-gray-500 tabular-nums">{fmtBytes(t.indexBytes)}</td>
                        <td className="px-5 py-3.5 text-right text-white font-semibold tabular-nums">{fmtBytes(t.totalBytes)}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                            <span className="text-[11px] text-gray-500 tabular-nums w-10">{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
