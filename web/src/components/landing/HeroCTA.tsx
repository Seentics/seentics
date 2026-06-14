'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/stores/useAuthStore';

export function HeroCTA() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex items-center justify-center gap-3 mb-16">
      {isAuthenticated ? (
        <Link href="/websites">
          <Button size="lg" className="h-11 px-7 text-sm font-semibold rounded-lg gap-2 shadow-sm">
            Go to Dashboard
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      ) : (
        <Link href="/signup">
          <Button size="lg" className="h-11 px-7 text-sm font-semibold rounded-lg gap-2 shadow-sm">
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      )}
      <Link href="/websites/demo">
        <Button variant="outline" size="lg" className="h-11 px-6 text-sm font-medium rounded-lg gap-2 border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/50">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Live Demo
        </Button>
      </Link>
    </div>
  );
}
