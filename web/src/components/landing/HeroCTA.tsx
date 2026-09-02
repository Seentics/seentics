'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/stores/useAuthStore';

/**
 * The hero's two actions.
 *
 * On a phone these were two `h-14 px-10` pills sitting in a centred `flex-wrap`, so
 * they stacked at whatever width their labels happened to need — a wide primary above
 * a narrower outline button, neither aligned to anything. Below `sm` they are now one
 * stacked pair at equal full width; from `sm` they go back to sitting side by side at
 * their natural size.
 *
 * The primary also loses its `shadow-lg shadow-primary/20`. A coloured glow under an
 * already-solid primary button is the same kind of decoration that came off the
 * lifetime card — the fill is what makes it the brightest thing on the page.
 */

const PRIMARY = 'h-12 w-full gap-2 rounded-lg text-base font-semibold sm:h-14 sm:w-auto sm:px-9';

export function HeroCTA() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="mb-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
      <Link href={isAuthenticated ? '/websites' : '/signup'} className="w-full sm:w-auto">
        <Button className={PRIMARY}>
          {isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>

      <Link href="/websites/demo" className="w-full sm:w-auto">
        <Button
          variant="outline"
          className="h-12 w-full gap-2 rounded-lg border-2 border-border text-base font-semibold text-foreground hover:bg-accent sm:h-14 sm:w-auto sm:px-9"
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          Live Demo
        </Button>
      </Link>
    </div>
  );
}
