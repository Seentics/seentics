'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Globe, KeyRound, ShieldCheck } from 'lucide-react';
import { getWebsites } from '@/features/websites/api';
import { useAgencyAPIKeys } from '@/features/agency/queries';
import { demoWebsite, isDemo } from '@/lib/demo';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AccountKeysList } from '@/components/agency/AccountKeysPanel';
import { WebsiteKeysCard } from '@/components/developers/ApiKeysPanel';

/**
 * Both kinds of key in one place: account keys (the management API — act for the whole
 * account) and website keys (the data API — read one site). The page header's button
 * creates an account key; each website key list has its own.
 */
export function ApiKeysTab({ websiteId, onCreateAccountKey }: { websiteId: string; onCreateAccountKey: () => void }) {
  const { data: accountKeys = [], isLoading } = useAgencyAPIKeys(websiteId);
  const [siteId, setSiteId] = useState(websiteId);
  useEffect(() => setSiteId(websiteId), [websiteId]);

  const { data: sites = [] } = useQuery({
    queryKey: ['websites', isDemo(websiteId)],
    queryFn: async () => (isDemo(websiteId) ? [demoWebsite()] : getWebsites()),
    enabled: !!websiteId,
  });

  const writeKeys = accountKeys.filter(k => k.scopes.includes('websites:write')).length;
  const usedRecently = accountKeys.filter(k => k.lastUsed && Date.now() - new Date(k.lastUsed).getTime() < 7 * 864e5).length;

  return (
    <>
      <StatCards
        isLoading={isLoading}
        cols={3}
        cards={[
          { label: 'Account keys', value: accountKeys.length, icon: KeyRound, tone: 'info' },
          { label: 'Read & write', value: writeKeys, icon: ShieldCheck, tone: 'accent' },
          { label: 'Used this week', value: usedRecently, icon: Activity, tone: 'success', toneWhen: usedRecently > 0 },
        ]}
      />

      <section className="surface mb-6 overflow-hidden">
        <div className="border-b border-border/60 px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">Account keys</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Management API — create clients and websites from your own backend. Act for your whole account.
          </p>
        </div>
        <AccountKeysList websiteId={websiteId} onCreate={onCreateAccountKey} />
      </section>

      {siteId && (
        <WebsiteKeysCard
          websiteId={siteId}
          sitePicker={
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger className="h-8 w-56 text-xs">
                <Globe className="mr-2 h-3.5 w-3.5 shrink-0 opacity-60" />
                <SelectValue placeholder="Choose a website" />
              </SelectTrigger>
              <SelectContent>
                {sites.map(s => <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          }
        />
      )}
    </>
  );
}
