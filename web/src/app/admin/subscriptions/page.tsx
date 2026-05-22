'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchAdminSubscriptions, getAdminToken, clearAdminToken } from '@/lib/admin-api';
import { AdminSidebar } from '@/components/admin-sidebar';

type Sub = {
  id: string; userId: string; userName: string; userEmail: string;
  planId: string; planName: string; priceMonthly: number;
  status: string; periodStart: string | null; periodEnd: string | null; createdAt: string;
};

const PLAN_BADGE: Record<string, string> = {
  starter:      'bg-white/5 text-gray-400 border border-white/8',
  basic:        'bg-blue-500/10 text-blue-300 border border-blue-500/20',
  growth:       'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
  pro:          'bg-violet-500/10 text-violet-300 border border-violet-500/20',
  agency:       'bg-amber-500/10 text-amber-300 border border-amber-500/20',
  agency_pro:   'bg-orange-500/10 text-orange-300 border border-orange-500/20',
  lifetime:     'bg-yellow-500/10 text-yellow-300 border border-yellow-500/20',
  lifetime_pro: 'bg-rose-500/10 text-rose-300 border border-rose-500/20',
  enterprise:   'bg-pink-500/10 text-pink-300 border border-pink-500/20',
};

export default function AdminSubscriptionsPage() {
  const router = useRouter();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (page: number) => {
    if (!getAdminToken()) { router.replace('/admin'); return; }
    setLoading(true);
    try {
      const data = await fetchAdminSubscriptions({ page, limit: 20 });
      setSubs(data.subscriptions);
      setPagination(data.pagination);
    } catch (e: any) {
      if (e.message?.includes('Unauthorized')) { clearAdminToken(); router.replace('/admin'); }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(pagination.page); }, [pagination.page, load]);

  return (
    <div className="min-h-screen bg-[#0c0c12] text-white flex">
      <AdminSidebar />

      <main className="flex-1 p-8 overflow-auto">
        <div className="mb-8">
          <h1 className="text-lg font-bold tracking-tight">Subscriptions</h1>
          <p className="text-gray-500 text-sm mt-0.5">{pagination.total.toLocaleString()} total</p>
        </div>

        <div className="bg-[#111116] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-3.5 text-left text-[11px] text-gray-500 uppercase tracking-wide font-medium">User</th>
                <th className="px-5 py-3.5 text-left text-[11px] text-gray-500 uppercase tracking-wide font-medium">Plan</th>
                <th className="px-5 py-3.5 text-left text-[11px] text-gray-500 uppercase tracking-wide font-medium">Price</th>
                <th className="px-5 py-3.5 text-left text-[11px] text-gray-500 uppercase tracking-wide font-medium">Status</th>
                <th className="px-5 py-3.5 text-left text-[11px] text-gray-500 uppercase tracking-wide font-medium">Period End</th>
                <th className="px-5 py-3.5 text-left text-[11px] text-gray-500 uppercase tracking-wide font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-5 py-16 text-center text-gray-600">Loading…</td></tr>
              )}
              {!loading && subs.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-16 text-center text-gray-600">No subscriptions found</td></tr>
              )}
              {!loading && subs.map((s, i) => (
                <tr
                  key={s.id}
                  className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${i === subs.length - 1 ? 'border-b-0' : ''}`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-600/30 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
                        {s.userName?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <p className="text-white font-medium text-[13px]">{s.userName || '—'}</p>
                        <p className="text-gray-500 text-xs">{s.userEmail}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium capitalize ${PLAN_BADGE[s.planId] ?? 'bg-white/5 text-gray-400 border border-white/8'}`}>
                      {s.planName}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-300 font-medium tabular-nums">
                    {s.priceMonthly > 0 ? `$${s.priceMonthly}/mo` : <span className="text-gray-600">Free</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${
                      s.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      s.status === 'on_trial' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                      'bg-white/5 text-gray-500 border border-white/8'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs tabular-nums">
                    {s.periodEnd ? new Date(s.periodEnd).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs tabular-nums">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
            <span>Page {pagination.page} of {pagination.pages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page <= 1}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/8 hover:bg-white/8 disabled:opacity-30 transition-colors text-sm"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= pagination.pages}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/8 hover:bg-white/8 disabled:opacity-30 transition-colors text-sm"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
