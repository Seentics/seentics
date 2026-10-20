'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useEffect } from 'react';

import { Loader2 } from 'lucide-react';
import { useT } from '@/lib/i18n';

/**
 * The old address of a shared dashboard. It fetched `/public/analytics/:id`, which no server
 * serves, so every link here showed "not found"; /share is the same dashboard over the real
 * route. Kept as a redirect so links already handed out still land somewhere.
 */
export default function PublicDashboardPage() {
    const t = useT().sharing.public;
    const publicId = usePathSegment(1) ?? '';

    useEffect(() => {
        if (!publicId) return;
        window.location.replace(`/share/${encodeURIComponent(publicId)}${window.location.search}`);
    }, [publicId]);

    return (
        <div className="flex h-screen w-screen items-center justify-center flex-col gap-4 bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="font-black text-sm uppercase tracking-widest text-muted-foreground animate-pulse">{t.loading}</p>
        </div>
    );
}
