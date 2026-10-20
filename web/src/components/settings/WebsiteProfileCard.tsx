'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { ProfilePicker } from '@/components/websites/ProfilePicker';
import { getWebsiteByAnyId, updateWebsite } from '@/features/websites/api';
import type { WebsiteProfile } from '@/features/websites/types';
import { useT } from '@/lib/i18n';
import { isValidId } from '@/lib/utils';
import { useAuth } from '@/stores/useAuthStore';

/** The website's kind of business, which orders its sidebar (features/sidebar/profiles.ts). */
export function WebsiteProfileCard({ websiteId }: { websiteId: string }) {
  const t = useT().dashboard.profiles;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: website } = useQuery({
    queryKey: ['website', websiteId],
    queryFn: () => getWebsiteByAnyId(websiteId),
    enabled: isValidId(websiteId),
  });
  const save = useMutation({
    mutationFn: async (profile: WebsiteProfile) => {
      if (!user?.id) throw new Error(t.failed);
      return updateWebsite(websiteId, { profile }, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website', websiteId] });
      toast.success(t.saved);
    },
    onError: () => toast.error(t.failed),
  });
  if (!website) return null;
  const value = save.variables ?? website.profile ?? null;
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div>
          <p className="text-sm font-semibold text-foreground">{t.settingTitle}</p>
          <p className="text-xs text-muted-foreground">{t.settingHint}</p>
        </div>
        <ProfilePicker value={value} onChange={(p) => save.mutate(p)} disabled={save.isPending} name="settings-profile" />
      </CardContent>
    </Card>
  );
}
