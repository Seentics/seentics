'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Search, ChevronLeft, ChevronRight, Activity, CreditCard, BarChart3, LogOut } from 'lucide-react';
import { fetchAdminUsers, clearAdminToken, getAdminToken } from '@/lib/admin-api';
import Link from 'next/link';

type User = { id: string; name: string; email: string; role: string; avatarUrl: string | null; createdAt: string; plan: string; subStatus: string | null };

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

  function logout() { clearAdminToken(); router.replace('/admin'); }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-gray-800 flex flex-col py-6 px-4 shrink-0">
        <div className="flex items-center gap-2 mb-8 px-2">
          <BarChart3 className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-sm">Seentics Admin</span>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          <Link href="/admin/dashboard" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 text-sm transition-colors">
            <Activity className="w-4 h-4" /> Overview
          </Link>
          <Link href="/admin/users" className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-indigo-600/20 text-indigo-300 text-sm font-medium">
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Users</h1>
            <p className="text-gray-500 text-sm mt-0.5">{pagination.total.toLocaleString()} total</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name or email…"
              className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg pl-9 pr-4 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-left">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500">Loading…</td></tr>
              )}
              {!loading && users.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500">No users found</td></tr>
              )}
              {!loading && users.map((u, i) => (
                <tr key={u.id} className={`border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors ${i === users.length - 1 ? 'border-b-0' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-indigo-900 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
                        {u.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <p className="text-white font-medium">{u.name || '—'}</p>
                        <p className="text-gray-500 text-xs">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-rose-900/50 text-rose-300' : 'bg-gray-800 text-gray-400'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[u.plan] ?? 'bg-gray-700 text-gray-300'}`}>
                      {u.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.subStatus ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.subStatus === 'active' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-gray-700 text-gray-400'}`}>
                        {u.subStatus}
                      </span>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
            <span>Page {pagination.page} of {pagination.pages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-600 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= pagination.pages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-600 disabled:opacity-40 transition-colors"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
