'use client';

import { Link2, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { createEmbed, deleteEmbed, updateEmbed } from '@/features/agency/api';
import { EMBED_SECTION_IDS } from '@/features/agency/constants';
import { useAgencyMutation, useEmbeds } from '@/features/agency/queries';
import type { Embed, EmbedScope, EmbedSection } from '@/features/agency/types';
import { useT } from '@/lib/i18n';
import { CopyButton, EmptyState, LoadingRow, Panel, useErrorText } from './ui';

/**
 * Read-only dashboards anyone with the link can open, for one client (all its websites) or one
 * website: create, choose what they show, copy, revoke.
 */
export function EmbedsPanel({ scope, targetId, targetName }: { scope: EmbedScope; targetId: string; targetName: string }) {
  const t = useT().agency.embeds;
  const errorMessage = useErrorText();
  const filters = { scope, target_id: targetId };
  const embeds = useEmbeds(filters);
  const create = useAgencyMutation(createEmbed);
  const update = useAgencyMutation(({ id, sections }: { id: string; sections: EmbedSection[] }) => updateEmbed(id, sections));
  const remove = useAgencyMutation(deleteEmbed);
  const [confirm, confirmDialog] = useConfirm();
  const onError = (e: unknown) => toast.error(errorMessage(e));

  const toggle = (embed: Embed, section: EmbedSection, on: boolean) => {
    const sections = on ? [...embed.sections, section] : embed.sections.filter(s => s !== section);
    if (sections.length === 0) return toast.error(t.atLeastOne);
    update.mutate({ id: embed.id, sections }, { onError });
  };

  const revoke = async (embed: Embed) => {
    const ok = await confirm({
      title: t.revokeTitle,
      description: t.revokeBody,
      confirmLabel: t.revokeConfirm,
      destructive: true,
    });
    if (ok) remove.mutate(embed.id, { onSuccess: () => toast.success(t.revoked), onError });
  };

  const list = embeds.data ?? [];

  return (
    <Panel
      data-testid="embeds-panel"
      title={t.title}
      description={scope === 'client' ? t.clientBody(targetName) : t.websiteBody(targetName)}
      actions={list.length > 0 ? undefined : (
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={create.isPending}
          onClick={() => create.mutate({ scope, target_id: targetId, sections: ['analytics'] }, { onSuccess: () => toast.success(t.created), onError })}
        >
          {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {t.create}
        </Button>
      )}
    >
      {confirmDialog}
      {embeds.isLoading ? (
        <LoadingRow />
      ) : list.length === 0 ? (
        <EmptyState icon={<Link2 className="h-5 w-5" />} title={t.none} description={t.noneBody} />
      ) : (
        <ul className="space-y-4">
          {list.map(embed => (
            <li key={embed.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <Input readOnly value={embed.embed_url} aria-label={t.linkLabel} className="h-8 font-mono text-xs" />
                <CopyButton text={embed.embed_url} label={t.copyLink} />
                <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive" aria-label={t.revokeLabel} onClick={() => void revoke(embed)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {/* One row per section, switch on the right: the panel is narrow, so side-by-side tiles
                  wrapped every word onto its own line. */}
              <div className="divide-y divide-border rounded-md border border-border">
                {EMBED_SECTION_IDS.map(id => ({ id, ...t.sections[id] })).map(s => (
                  <label key={s.id} className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-foreground">{s.label}</span>
                      <span className="block text-xs text-muted-foreground">{s.description}</span>
                    </span>
                    <Switch
                      checked={embed.sections.includes(s.id)}
                      onCheckedChange={on => toggle(embed, s.id, on)}
                      aria-label={t.show(s.label)}
                      disabled={update.isPending}
                    />
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
