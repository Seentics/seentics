'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { getWebsiteByAnyId, setPublicSharing } from '@/features/websites/api';
import { demoMutationGuard } from '@/lib/demo';
import { useT } from '@/lib/i18n';
import { isValidId } from '@/lib/utils';

/**
 * The website's public dashboard link (/share/<id>). Core could always issue one
 * (POST /websites/:id/share), but nothing in the dashboard called it, so the shared
 * dashboard page had no way to be reached.
 */
export function PublicShareCard({ websiteId }: { websiteId: string }) {
  const t = useT().sharing.settingsCard;
  const queryClient = useQueryClient();
  const { data: website } = useQuery({
    queryKey: ['website', websiteId],
    queryFn: () => getWebsiteByAnyId(websiteId),
    enabled: isValidId(websiteId),
  });
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setPublicSharing(websiteId, enabled),
    onSuccess: (shareId) => {
      queryClient.invalidateQueries({ queryKey: ['website', websiteId] });
      toast.success(shareId ? t.enabled : t.disabled);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || t.failed),
  });
  if (!website) return null;

  const shareId = toggle.isSuccess ? toggle.data : website.publicShareId ?? null;
  const link = shareId && typeof window !== 'undefined' ? `${window.location.origin}/share/${shareId}` : '';

  const copy = () => {
    navigator.clipboard?.writeText(link).then(
      () => toast.success(t.copied),
      () => toast.error(t.failed),
    );
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">{t.title}</p>
            <p className="text-xs text-muted-foreground">{t.hint}</p>
          </div>
          <Switch
            checked={!!shareId}
            onCheckedChange={(on) => {
              if (demoMutationGuard(websiteId)) return;
              toggle.mutate(on);
            }}
            disabled={toggle.isPending}
            aria-label={t.enable}
          />
        </div>
        {link && (
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/40 px-2.5 py-1.5 font-mono text-xs text-foreground select-all">
              {link}
            </code>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={copy}>
              <Copy className="h-3.5 w-3.5" />
              {t.copy}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5" asChild>
              <a href={link} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                {t.open}
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
