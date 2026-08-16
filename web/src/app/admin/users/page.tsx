'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchAdminUsers, getAdminToken, clearAdminToken } from '@/lib/admin-api';
import { AdminSidebar } from '@/components/admin-sidebar';

type User = {
  id: string; name: string; email: string; role: string;
  avatarUrl: string | null; createdAt: string; plan: string; subStatus: string | null;
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

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string, page: number) => {
    if (!getAdminToken()) { router.replace('/admin'); return; }
    setLoading(true);
    try {
      const data = await fetchAdminUsers({ search: q, page, limit: 20 });
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (e: any) {
      if (e.message?.includes('Unauthorized')) { clearAdminToken(); router.replace('/admin'); }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(search, pagination.page); }, [search, pagination.page, load]);

  function handleSearchChange(val: string) {
    setSearchInput(val);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { setSearch(val); setPagination((p) => ({ ...p, page: 1 })); }, 350);
  }

  return (
    <div className="min-h-screen bg-[#0c0c12] text-white flex">
      <AdminSidebar />

      <main className="flex-1 p-8 overflow-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Users</h1>
            <p className="text-gray-500 text-sm mt-0.5">{pagination.total.toLocaleString()} total</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
            <input
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name or email…"
              className="bg-white/5 border border-white/8 text-white text-sm rounded-lg pl-9 pr-4 py-2 w-64 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder:text-gray-600"
            />
          </div>
        </div>

        <div className="bg-[#111116] border border-white/[0.06] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-3.5 text-left text-[11px] text-gray-500 uppercase tracking-wide font-medium">User</th>
                <th className="px-5 py-3.5 text-left text-[11px] text-gray-500 uppercase tracking-wide font-medium">Role</th>
                <th className="px-5 py-3.5 text-left text-[11px] text-gray-500 uppercase tracking-wide font-medium">Plan</th>
                <th className="px-5 py-3.5 text-left text-[11px] text-gray-500 uppercase tracking-wide font-medium">Status</th>
                <th className="px-5 py-3.5 text-left text-[11px] text-gray-500 uppercase tracking-wide font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-5 py-16 text-center text-gray-600">Loading…</td></tr>
              )}
              {!loading && users.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-16 text-center text-gray-600">No users found</td></tr>
              )}
              {!loading && users.map((u, i) => (
                <tr
                  key={u.id}
                  className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${i === users.length - 1 ? 'border-b-0' : ''}`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-600/30 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
                        {u.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <p className="text-white font-medium text-[13px]">{u.name || '—'}</p>
                        <p className="text-gray-500 text-xs">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[11px] px-2 py-0.5 rounded-lg font-medium ${u.role === 'admin' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-white/5 text-gray-500 border border-white/8'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[11px] px-2 py-0.5 rounded-lg font-medium capitalize ${PLAN_BADGE[u.plan] ?? 'bg-white/5 text-gray-400 border border-white/8'}`}>
                      {u.plan.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {u.subStatus ? (
                      <span className={`text-[11px] px-2 py-0.5 rounded-lg font-medium ${u.subStatus === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-gray-500 border border-white/8'}`}>
                        {u.subStatus}
                      </span>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs tabular-nums">
                    {new Date(u.createdAt).toLocaleDateString()}
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 hover:bg-white/8 disabled:opacity-30 transition-colors text-sm"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= pagination.pages}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 hover:bg-white/8 disabled:opacity-30 transition-colors text-sm"
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
