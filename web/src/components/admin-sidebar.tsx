'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Activity, Users, CreditCard, HardDrive, BarChart3, LogOut } from 'lucide-react';
import { clearAdminToken } from '@/lib/admin-api';
import Link from 'next/link';

const NAV = [
  { href: '/admin/dashboard',    icon: Activity,   label: 'Overview' },
  { href: '/admin/users',        icon: Users,       label: 'Users' },
  { href: '/admin/subscriptions',icon: CreditCard,  label: 'Subscriptions' },
  { href: '/admin/storage',      icon: HardDrive,   label: 'Storage' },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    clearAdminToken();
    router.replace('/admin');
  }

  return (
    <aside className="w-56 border-r border-white/5 flex flex-col py-6 px-3 shrink-0">
      <div className="flex items-center gap-2.5 mb-8 px-3">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-sm tracking-tight">Seentics Admin</span>
      </div>
      <nav className="flex flex-col gap-0.5 flex-1">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                active
                  ? 'bg-indigo-600/20 text-indigo-300 font-medium'
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={logout}
        className="flex items-center gap-2.5 px-3 py-2 text-gray-600 hover:text-red-400 text-sm transition-colors rounded-xl hover:bg-red-400/5"
      >
        <LogOut className="w-4 h-4" /> Sign out
      </button>
    </aside>
  );
}
