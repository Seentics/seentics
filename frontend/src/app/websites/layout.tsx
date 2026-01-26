'use client';

import { useAuth } from '@/stores/useAuthStore';
import { Loader2 } from 'lucide-react';
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!user && !isDemoMode) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {children}
    </div>
  );
} 