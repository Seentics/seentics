'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { AgencyWebsite } from '@/features/agency/types';
import { agencySiteHref } from '@/lib/demo/agency-mode';
import { EmbedsPanel } from './EmbedsPanel';
import { InstallPanel } from './InstallPanel';

/** One website's install snippet, tracking check and embed link, in a side drawer. */
export function InstallDrawer({ website, onClose }: { website: AgencyWebsite | null; onClose: () => void }) {
  return (
    <Sheet open={!!website} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {website && (
          <div className="space-y-5">
            <SheetHeader className="space-y-1 text-left">
              <SheetTitle>{website.name}</SheetTitle>
              <SheetDescription className="break-all">{website.url}</SheetDescription>
            </SheetHeader>
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Link href={agencySiteHref(website.id)}>Open site dashboard <ArrowUpRight className="h-3.5 w-3.5" /></Link>
            </Button>
            <InstallPanel websiteId={website.id} />
            <EmbedsPanel scope="website" targetId={website.id} targetName={website.name} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
