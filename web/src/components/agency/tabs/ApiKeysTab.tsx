'use client';

import { Activity, KeyRound, ShieldCheck } from 'lucide-react';
import { useAgencyAPIKeys } from '@/features/agency/queries';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { AccountKeysList } from '@/components/agency/AccountKeysPanel';

/**
 * One kind of key. An account key acts for the whole account: the management API creates and
 * manages clients and websites, and the analytics API reads any of their data, by id.
 */
export function ApiKeysTab({ websiteId, onCreateAccountKey }: { websiteId: string; onCreateAccountKey: () => void }) {
  const { data: keys = [], isLoading } = useAgencyAPIKeys(websiteId);

  const canManage = keys.filter(k => k.scopes.includes('websites:write')).length;
  const usedRecently = keys.filter(k => k.lastUsed && Date.now() - new Date(k.lastUsed).getTime() < 7 * 864e5).length;

  return (
    <>
      <StatCards
        isLoading={isLoading}
        cols={3}
        cards={[
          { label: 'API keys', value: keys.length, icon: KeyRound, tone: 'info' },
          { label: 'Can manage', value: canManage, icon: ShieldCheck, tone: 'accent' },
          { label: 'Used this week', value: usedRecently, icon: Activity, tone: 'success', toneWhen: usedRecently > 0 },
        ]}
      />

      <section className="mb-6 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Account keys</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Send one as X-API-Key to create clients and websites, and to read their analytics by id. Keep it on your server.
          </p>
        </div>
        <AccountKeysList websiteId={websiteId} onCreate={onCreateAccountKey} />
      </section>
    </>
  );
}
