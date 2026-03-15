'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/stores/useAuthStore';
import { getWebsites } from '@/lib/websites-api';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  MonitorPlay,
  Zap,
  MessageSquare,
  Activity,
  Globe,
  Users,
  Settings,
  LogOut,
  ChevronRight,
  Plus,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  Shield,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  href: string;
  port: number;
  enabled: boolean;
  status: 'active' | 'coming_soon' | 'disabled';
}

const products: Product[] = [
  {
    id: 'analytics',
    name: 'Analytics',
    description: 'Privacy-focused website analytics with real-time visitor tracking, traffic sources, and conversion goals.',
    icon: BarChart3,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    href: '/websites',
    port: 3000,
    enabled: true,
    status: 'active',
  },
  {
    id: 'replays',
    name: 'Replays',
    description: 'Session recordings and heatmaps to understand how users interact with your website.',
    icon: MonitorPlay,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    href: 'http://localhost:3007',
    port: 3007,
    enabled: true,
    status: 'active',
  },
  {
    id: 'automation',
    name: 'Automation',
    description: 'Behavioral triggers and workflows that automatically respond to visitor actions.',
    icon: Zap,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    href: 'http://localhost:3009',
    port: 3009,
    enabled: true,
    status: 'active',
  },
  {
    id: 'feedback',
    name: 'Feedback',
    description: 'Collect user feedback with surveys, voting boards, and embeddable widgets.',
    icon: MessageSquare,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    href: 'http://localhost:3005',
    port: 3005,
    enabled: true,
    status: 'active',
  },
  {
    id: 'status',
    name: 'Status',
    description: 'Monitor uptime, track incidents, and share a public status page with your users.',
    icon: Activity,
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/10',
    href: 'http://localhost:3001',
    port: 3001,
    enabled: true,
    status: 'active',
  },
];

export default function WorkspacePage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [websites, setWebsites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [productStates, setProductStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const sites = await getWebsites();
        setWebsites(sites);
      } catch {
        // ignore
      }
      // Load product toggle states from localStorage
      const saved = localStorage.getItem('seentics_product_toggles');
      if (saved) {
        setProductStates(JSON.parse(saved));
      } else {
        const defaults: Record<string, boolean> = {};
        products.forEach(p => { defaults[p.id] = p.enabled; });
        setProductStates(defaults);
      }
      setLoading(false);
    };
    load();
  }, []);

  const toggleProduct = (productId: string) => {
    if (productId === 'analytics') return; // Analytics is always on
    setProductStates(prev => {
      const next = { ...prev, [productId]: !prev[productId] };
      localStorage.setItem('seentics_product_toggles', JSON.stringify(next));
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    router.push('/signin');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="lg" />
            <div>
              <h1 className="font-bold text-lg tracking-tight">Seentics</h1>
              <p className="text-[10px] text-muted-foreground -mt-0.5">Workspace Hub</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/workspace/team">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Team</span>
              </Button>
            </Link>
            <Link href="/workspace/settings">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            </Link>
            <div className="h-6 w-px bg-border/50" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium leading-none">{user?.name || 'User'}</p>
                <p className="text-[10px] text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Sites Overview */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Your Sites</h2>
              <p className="text-sm text-muted-foreground">Websites connected to your Seentics workspace</p>
            </div>
            <Link href="/websites">
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add Site
              </Button>
            </Link>
          </div>

          {websites.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/50 bg-card/50 p-8 text-center">
              <Globe className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <h3 className="font-medium mb-1">No sites yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Connect your first website to start tracking</p>
              <Link href="/websites">
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Add Your First Site
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {websites.map((site: any) => (
                <Link
                  key={site.id}
                  href={`/websites/${site.id}`}
                  className="group rounded-xl border border-border/50 bg-card p-4 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Globe className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{site.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{site.url}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Products */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Products</h2>
              <p className="text-sm text-muted-foreground">Enable or disable products for your workspace</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => {
              const isEnabled = productStates[product.id] !== false;
              const isAnalytics = product.id === 'analytics';
              const Icon = product.icon;

              return (
                <div
                  key={product.id}
                  className={cn(
                    'rounded-xl border bg-card p-5 transition-all',
                    isEnabled
                      ? 'border-border/50 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5'
                      : 'border-border/30 opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', product.bgColor)}>
                      <Icon className={cn('h-5 w-5', product.color)} />
                    </div>
                    <button
                      onClick={() => toggleProduct(product.id)}
                      disabled={isAnalytics}
                      className={cn(
                        'transition-colors',
                        isAnalytics && 'cursor-not-allowed opacity-50'
                      )}
                      title={isAnalytics ? 'Analytics is always enabled' : `Toggle ${product.name}`}
                    >
                      {isEnabled ? (
                        <ToggleRight className="h-6 w-6 text-primary" />
                      ) : (
                        <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                      )}
                    </button>
                  </div>

                  <h3 className="font-semibold text-sm mb-1">{product.name}</h3>
                  <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{product.description}</p>

                  {isEnabled && (
                    <a
                      href={product.href}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    >
                      Open {product.name}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
