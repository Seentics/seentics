'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/stores/useAuthStore';

export function HeroCTA() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
      {isAuthenticated ? (
        <Link href="/websites">
          <Button className="h-14 px-10 text-base font-semibold rounded-xl gap-2 shadow-lg shadow-primary/20">
            Go to Dashboard
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      ) : (
        <Link href="/signup">
          <Button className="h-14 px-10 text-base font-semibold rounded-xl gap-2 shadow-lg shadow-primary/20">
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      )}
      <Link href="/websites/demo">
        <Button variant="outline" className="h-14 px-10 text-base font-semibold rounded-xl gap-2 border-2 border-border text-foreground hover:bg-accent">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          Live Demo
        </Button>
      </Link>
    </div>
  );
}
