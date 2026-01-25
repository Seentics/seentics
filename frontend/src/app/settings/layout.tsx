'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Settings, 
  Users, 
  CreditCard, 
  ChevronRight,
  ArrowLeft,
  Globe,
  User,
  ShieldCheck,
  LifeBuoy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { WebsitesHeader } from '@/components/websites/websites-header';
import { useAuth } from '@/stores/useAuthStore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function GlobalSettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/signin');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  const sidebarLinks = [
    {
      title: 'Websites',
      href: '/settings/websites',
      icon: Globe,
      description: 'Properties'
    },
    {
      title: 'Profile',
      href: '/settings/profile',
      icon: User,
      description: 'Account'
    },
    {
      title: 'Billing',
      href: '/settings/billing',
      icon: CreditCard,
      description: 'Subscription'
    },
    {
      title: 'Privacy & Safety',
      href: '/settings/privacy',
      icon: ShieldCheck,
      description: 'Compliance'
    },
    {
      title: 'Team',
      href: '/settings/team',
      icon: Users,
      description: 'Access'
    },
    {
      title: 'Support & Help',
      href: '/settings/support',
      icon: LifeBuoy,
      description: 'Assistance'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <WebsitesHeader />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <aside className="w-full md:w-64 shrink-0">
            <div className="sticky top-24 space-y-3">
              <Link href="/">
                <Button variant="ghost" size="sm" className="mb-4 gap-2 text-muted-foreground hover:text-foreground h-8 px-2 font-bold text-[11px] uppercase tracking-wider">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back TO DASHBOARD
                </Button>
              </Link>
              
              <div className="space-y-1">
                <nav className="space-y-1">
                  {sidebarLinks.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                      <Link key={link.href} href={link.href}>
                        <div className={cn(
                          "group flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all relative border border-transparent",
                          isActive 
                            ? "bg-primary/5 text-primary border-primary/10 shadow-sm" 
                            : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                        )}>
                          <link.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
                          <div className="flex flex-col text-left overflow-hidden">
                            <span className="text-[13px] font-bold leading-tight truncate">{link.title}</span>
                          </div>
                          {isActive && <div className="ml-auto w-1 h-3 rounded-full bg-primary" />}
                        </div>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <div className="bg-card border rounded-3xl p-8 shadow-sm min-h-[600px] border-muted-foreground/10">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
