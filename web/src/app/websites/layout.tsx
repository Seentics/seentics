'use client';

import { useAuth } from '@/stores/useAuthStore';
import { BarChart3 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function WebsitesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const isDemoMode = params?.websiteId === 'demo';

  useEffect(() => {
    // Only redirect if we're not loading, there's no user, AND we're not in demo mode
    if (!isLoading && !user && !isDemoMode) {
      router.push('/signin');
    }
  }, [user, isLoading, router, isDemoMode]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <BarChart3 className="h-7 w-7 text-primary" />
            <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-background bg-primary animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Loading your dashboard</p>
            <p className="mt-1 text-xs text-muted-foreground">Fetching your analytics data…</p>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user && !isDemoMode) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
} 