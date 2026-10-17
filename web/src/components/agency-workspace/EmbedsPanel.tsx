'use client';

import { Link2, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { createEmbed, deleteEmbed, errorMessage, updateEmbed } from '@/features/agency/api';
import { EMBED_SECTIONS } from '@/features/agency/constants';
import { useAgencyMutation, useEmbeds } from '@/features/agency/queries';
import type { Embed, EmbedScope, EmbedSection } from '@/features/agency/types';
import { CopyButton, EmptyState, LoadingRow, Panel } from './ui';

/**
 * Read-only dashboards anyone with the link can open, for one client (all its websites) or one
 * website: create, choose what they show, copy, revoke.
 */
export function EmbedsPanel({ scope, targetId, targetName }: { scope: EmbedScope; targetId: string; targetName: string }) {
  const filters = { scope, target_id: targetId };
  const embeds = useEmbeds(filters);
  const create = useAgencyMutation(createEmbed);
  const update = useAgencyMutation(({ id, sections }: { id: string; sections: EmbedSection[] }) => updateEmbed(id, sections));
  const remove = useAgencyMutation(deleteEmbed);
  const [confirm, confirmDialog] = useConfirm();
  const onError = (e: unknown) => toast.error(errorMessage(e));

  const toggle = (embed: Embed, section: EmbedSection, on: boolean) => {
    const sections = on ? [...embed.sections, section] : embed.sections.filter(s => s !== section);
    if (sections.length === 0) return toast.error('An embed link has to show at least one section.');
    update.mutate({ id: embed.id, sections }, { onError });
  };

  const revoke = async (embed: Embed) => {
    const ok = await confirm({
      title: 'Revoke this embed link?',
      description: 'Anyone using it loses access at once. A new link gets a new address.',
      confirmLabel: 'Revoke link',
      destructive: true,
    });
    if (ok) remove.mutate(embed.id, { onSuccess: () => toast.success('Embed link revoked'), onError });
  };

  const list = embeds.data ?? [];

  return (
    <Panel
      data-testid="embeds-panel"
      title="Embed links"
      description={scope === 'client'
        ? `A read-only dashboard of all ${targetName}’s websites, for anyone with the link.`
        : `A read-only dashboard of ${targetName}, for anyone with the link.`}
      actions={list.length > 0 ? undefined : (
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={create.isPending}
          onClick={() => create.mutate({ scope, target_id: targetId, sections: ['analytics'] }, { onSuccess: () => toast.success('Embed link created'), onError })}
        >
          {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Create embed link
        </Button>
      )}
    >
      {confirmDialog}
      {embeds.isLoading ? (
        <LoadingRow />
      ) : list.length === 0 ? (
        <EmptyState icon={<Link2 className="h-5 w-5" />} title="No embed link" description="Create one to put this dashboard on a client’s intranet or in a report." />
      ) : (
        <ul className="space-y-4">
          {list.map(embed => (
            <li key={embed.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <Input readOnly value={embed.embed_url} aria-label="Embed link" className="h-8 font-mono text-xs" />
                <CopyButton text={embed.embed_url} label="Copy embed link" />
                <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive" aria-label="Revoke embed link" onClick={() => void revoke(embed)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {EMBED_SECTIONS.map(s => (
                  <label key={s.id} className="flex items-start gap-2.5 rounded-md border border-border p-2.5">
                    <Switch
                      checked={embed.sections.includes(s.id)}
                      onCheckedChange={on => toggle(embed, s.id, on)}
                      aria-label={`Show ${s.label}`}
                      disabled={update.isPending}
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-foreground">{s.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{s.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
