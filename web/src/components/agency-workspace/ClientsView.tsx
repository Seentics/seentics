'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ArchiveRestore, ExternalLink, MoreVertical, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { archiveClient, deleteClient, unarchiveClient } from '@/features/agency/api';
import { useAgencyMutation, useClients } from '@/features/agency/queries';
import type { Client, ClientStatus } from '@/features/agency/types';
import { useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { ClientFormDialog } from './ClientFormDialog';
import { EmptyState, LoadingRow, Panel, StatusPill, WorkspacePage, shortDate, useDebounced, useErrorText } from './ui';

type Tab = 'active' | 'archived' | 'all';
const TABS: Tab[] = ['active', 'archived', 'all'];

export function ClientsView() {
  const all = useT().agency;
  const t = all.clients;
  const { locale } = useLocale();
  const errorMessage = useErrorText();
  const router = useRouter();
  const [status, setStatus] = useState<Tab>('active');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  const clients = useClients({ status: status === 'all' ? undefined : (status as ClientStatus), q: q || undefined });

  const archive = useAgencyMutation(archiveClient);
  const unarchive = useAgencyMutation(unarchiveClient);
  const remove = useAgencyMutation(deleteClient);
  const onError = (e: unknown) => toast.error(errorMessage(e));

  // `/agency/clients?new=1`, from the setup guide, opens the create dialog.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('new') === '1') setCreating(true);
  }, []);

  const open = (c: Client) => router.push(`/agency/clients/${c.id}`);

  const confirmDelete = async (c: Client) => {
    const ok = await confirm({
      title: t.deleteTitle(c.name),
      description: t.deleteBody(c.website_count),
      confirmLabel: t.deleteConfirm,
      destructive: true,
    });
    if (ok) remove.mutate(c.id, { onSuccess: () => toast.success(t.deleted(c.name)), onError });
  };

  return (
    <WorkspacePage
      title={t.title}
      description={t.description}
      actions={<Button className="h-8 gap-1.5 px-3 text-xs" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" />{t.newClient}</Button>}
    >
      {confirmDialog}
      <Panel
        bodyClassName="p-0"
        title={
          <div role="tablist" aria-label={t.statusLabel} className="flex gap-4">
            {TABS.map(tab => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={status === tab}
                onClick={() => setStatus(tab)}
                className={cn('text-[13px] font-medium transition-colors', status === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                {t.tabs[tab]}
              </button>
            ))}
          </div>
        }
        actions={
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label={t.search}
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 w-full !bg-card pl-8 text-xs"
            />
          </div>
        }
      >
        {clients.isLoading ? (
          <LoadingRow />
        ) : clients.isError ? (
          <EmptyState title={t.loadFailed} description={errorMessage(clients.error)} />
        ) : clients.items.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title={q ? all.common.noMatches : status === 'archived' ? t.noArchived : t.noneYet}
            description={q ? t.noMatchBody : status === 'archived' ? t.archivedBody : t.emptyBody}
            action={!q && status === 'active' ? <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" />{t.newClient}</Button> : undefined}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{all.common.client}</TableHead>
                  <TableHead className="hidden md:table-cell">{t.added}</TableHead>
                  <TableHead className="text-right">{all.common.websites}</TableHead>
                  <TableHead>{t.status}</TableHead>
                  <TableHead className="w-12"><span className="sr-only">{all.common.actions}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.items.map(c => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/35" onClick={() => open(c)}>
                    <TableCell>
                      <p className="font-medium text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.company || '—'}</p>
                    </TableCell>
                    <TableCell className="hidden text-xs md:table-cell">{shortDate(c.created_at, locale)}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.website_count}</TableCell>
                    <TableCell><StatusPill status={c.status} /></TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground" aria-label={all.common.actionsFor(c.name)}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => open(c)}><ExternalLink className="mr-2 h-3.5 w-3.5" />{all.common.open}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditing(c)}><Pencil className="mr-2 h-3.5 w-3.5" />{all.common.editDetails}</DropdownMenuItem>
                          {c.status !== 'archived' ? (
                            <DropdownMenuItem onClick={() => archive.mutate(c.id, { onSuccess: () => toast.success(t.archived(c.name)), onError })}>
                              <Archive className="mr-2 h-3.5 w-3.5" />{all.common.archive}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => unarchive.mutate(c.id, { onSuccess: () => toast.success(t.restored(c.name)), onError })}>
                              <ArchiveRestore className="mr-2 h-3.5 w-3.5" />{all.common.unarchive}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void confirmDelete(c)}>
                            <Trash2 className="mr-2 h-3.5 w-3.5" />{all.common.delete}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {clients.hasNextPage && (
              <div className="border-t border-border p-3 text-center">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void clients.fetchNextPage()} disabled={clients.isFetchingNextPage}>
                  {all.common.loadMore}
                </Button>
              </div>
            )}
          </>
        )}
      </Panel>

      <ClientFormDialog open={creating} onOpenChange={setCreating} onSaved={c => { toast.success(t.created(c.name)); open(c); }} />
      <ClientFormDialog open={!!editing} onOpenChange={o => { if (!o) setEditing(null); }} client={editing} onSaved={() => toast.success(t.saved)} />
    </WorkspacePage>
  );
}
