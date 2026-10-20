'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Archive, ArchiveRestore, ArrowLeft, ArrowUpRight, Code2, Globe, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { archiveClient, unarchiveClient } from '@/features/agency/api';
import { useAgencyMutation, useClient, useClientWebsites } from '@/features/agency/queries';
import type { AgencyWebsite } from '@/features/agency/types';
import { agencySiteHref } from '@/lib/demo/agency-mode';
import { useT } from '@/lib/i18n';
import { AddWebsiteDialog } from './AddWebsiteDialog';
import { ClientFormDialog } from './ClientFormDialog';
import { ClientUsersPanel } from './ClientUsersPanel';
import { EmbedsPanel } from './EmbedsPanel';
import { FeaturesMatrix } from './FeaturesMatrix';
import { InstallDrawer } from './InstallDrawer';
import { EmptyState, LoadingRow, Panel, Pill, StatusPill, WorkspacePage, useErrorText } from './ui';

export function ClientDetailView({ clientId }: { clientId: string }) {
  const all = useT().agency;
  const t = all.clientDetail;
  const errorMessage = useErrorText();
  const client = useClient(clientId);
  const websites = useClientWebsites(clientId);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [installing, setInstalling] = useState<AgencyWebsite | null>(null);
  const archive = useAgencyMutation(archiveClient);
  const unarchive = useAgencyMutation(unarchiveClient);
  const onError = (e: unknown) => toast.error(errorMessage(e));

  const back = (
    <Link href="/agency/clients" className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-3.5 w-3.5" />{t.allClients}
    </Link>
  );

  if (client.isLoading || !clientId) return <div className="mx-auto w-full max-w-[1440px] p-4 md:p-5 lg:px-6 lg:py-5">{back}<LoadingRow /></div>;
  if (client.isError || !client.data) {
    return (
      <div className="mx-auto w-full max-w-[1440px] p-4 md:p-5 lg:px-6 lg:py-5">
        {back}
        <Panel><EmptyState title={t.notFound} description={errorMessage(client.error)} /></Panel>
      </div>
    );
  }

  const c = client.data;
  const sites = websites.data ?? [];

  return (
    <WorkspacePage
      title={c.name}
      description={c.company || all.common.client}
      before={back}
      actions={
        <>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" />{all.common.editDetails}</Button>
          {c.status !== 'archived' ? (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => archive.mutate(c.id, { onSuccess: () => toast.success(t.archived), onError })}>
              <Archive className="h-3.5 w-3.5" />{all.common.archive}
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => unarchive.mutate(c.id, { onSuccess: () => toast.success(t.restored), onError })}>
              <ArchiveRestore className="h-3.5 w-3.5" />{all.common.unarchive}
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Panel
            title={all.common.websites}
            description={t.websitesBody}
            actions={<Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" />{t.addWebsite}</Button>}
            bodyClassName="p-0"
          >
            {websites.isLoading ? <LoadingRow /> : sites.length === 0 ? (
              <EmptyState icon={<Globe className="h-5 w-5" />} title={t.noWebsites} description={t.noWebsitesBody} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{all.common.website}</TableHead>
                    <TableHead>{all.common.tracking}</TableHead>
                    <TableHead className="text-right"><span className="sr-only">{all.common.actions}</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sites.map(w => (
                    <TableRow key={w.id}>
                      <TableCell>
                        <Link href={agencySiteHref(w.id)} className="font-medium text-foreground hover:underline" title={all.common.openWebsiteDashboard}>{w.name}</Link>
                        <p className="text-xs text-muted-foreground">{w.url}</p>
                      </TableCell>
                      <TableCell>{w.is_verified ? <Pill tone="green">{all.common.verified}</Pill> : <Pill tone="amber">{all.common.notInstalled}</Pill>}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setInstalling(w)} aria-label={t.installNamed(w.name)}>
                            <Code2 className="h-3.5 w-3.5" />{all.common.install}
                          </Button>
                          <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                            <Link href={agencySiteHref(w.id)}>{all.common.dashboard} <ArrowUpRight className="h-3.5 w-3.5" /></Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
          <FeaturesMatrix clientId={c.id} />
        </div>

        <div className="space-y-5">
          <Panel title={t.details}>
            <dl className="space-y-2.5 text-xs">
              {[
                [t.status, <StatusPill key="s" status={c.status} />],
                [t.company, c.company || '—'],
                [t.id, <code key="id" className="break-all font-mono">{c.id}</code>],
                [t.notes, c.notes ? <span key="n" className="whitespace-pre-wrap">{c.notes}</span> : '—'],
              ].map(([k, v]) => (
                <div key={k as string} className="grid grid-cols-[80px_minmax(0,1fr)] gap-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="break-words text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <ClientUsersPanel clientId={c.id} />
          <EmbedsPanel scope="client" targetId={c.id} targetName={c.name} />
        </div>
      </div>

      <ClientFormDialog open={editing} onOpenChange={setEditing} client={c} onSaved={() => toast.success(all.clients.saved)} />
      <AddWebsiteDialog open={adding} onOpenChange={setAdding} clientId={c.id} />
      <InstallDrawer website={installing} onClose={() => setInstalling(null)} />
    </WorkspacePage>
  );
}
