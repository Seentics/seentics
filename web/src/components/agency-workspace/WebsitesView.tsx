'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, ArrowUpRight, Code2, Globe, Loader2, MoreVertical, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { deleteWebsite, updateWebsite } from '@/features/agency/api';
import { useAgencyMutation, useClients, useWebsites } from '@/features/agency/queries';
import type { AgencyWebsite, WebsiteListFilters } from '@/features/agency/types';
import { agencySiteHref } from '@/lib/demo/agency-mode';
import { useT } from '@/lib/i18n';
import { AddWebsiteDialog } from './AddWebsiteDialog';
import { InstallDrawer } from './InstallDrawer';
import { EmptyState, LoadingRow, Panel, Pill, WorkspacePage, useDebounced, useErrorText } from './ui';

const ALL = '__all__';
const UNASSIGNED = '__unassigned__';

function MoveDialog({ website, onClose }: { website: AgencyWebsite | null; onClose: () => void }) {
  const all = useT().agency;
  const t = all.websites;
  const errorMessage = useErrorText();
  const clients = useClients({ status: 'active' });
  const [target, setTarget] = useState(UNASSIGNED);
  const move = useAgencyMutation(({ id, client_id }: { id: string; client_id: string | null }) => updateWebsite(id, { client_id }));
  useEffect(() => { if (website) setTarget(website.client_id ?? UNASSIGNED); }, [website]);

  return (
    <Dialog open={!!website} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.moveTitle(website?.name ?? '')}</DialogTitle>
          <DialogDescription>{t.moveBody}</DialogDescription>
        </DialogHeader>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger className="h-9" aria-label={t.moveLabel}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>{all.common.noClient}</SelectItem>
            {clients.items.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose}>{all.common.cancel}</Button>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={move.isPending || !website || target === (website.client_id ?? UNASSIGNED)}
            onClick={() => website && move.mutate(
              { id: website.id, client_id: target === UNASSIGNED ? null : target },
              { onSuccess: () => { toast.success(t.moved); onClose(); }, onError: e => toast.error(errorMessage(e)) },
            )}
          >
            {move.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t.move}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WebsitesView() {
  const all = useT().agency;
  const t = all.websites;
  const errorMessage = useErrorText();
  const [filter, setFilter] = useState(ALL);
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [adding, setAdding] = useState(false);
  const [installing, setInstalling] = useState<AgencyWebsite | null>(null);
  const [moving, setMoving] = useState<AgencyWebsite | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  const clients = useClients({ status: 'active' });

  // `?client=<id>` or `?unassigned=1` lands on that filter.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('unassigned') === '1') setFilter(UNASSIGNED);
    else if (params.get('client')) setFilter(params.get('client')!);
  }, []);

  const clientNames = useMemo(() => new Map(clients.items.map(c => [c.id, c.name])), [clients.items]);
  const filters = useMemo<WebsiteListFilters>(() => ({
    ...(filter === UNASSIGNED ? { unassigned: true } : filter !== ALL ? { client_id: filter } : {}),
    ...(q ? { q } : {}),
  }), [filter, q]);
  const websites = useWebsites(filters);
  const remove = useAgencyMutation(deleteWebsite);

  const confirmDelete = async (w: AgencyWebsite) => {
    const ok = await confirm({
      title: t.deleteTitle(w.name),
      description: t.deleteBody,
      confirmLabel: t.deleteConfirm,
      destructive: true,
    });
    if (ok) remove.mutate(w.id, { onSuccess: () => toast.success(t.deleted(w.name)), onError: e => toast.error(errorMessage(e)) });
  };

  return (
    <WorkspacePage
      title={t.title}
      description={t.description}
      actions={<Button className="h-8 gap-1.5 px-3 text-xs" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" />{t.addWebsite}</Button>}
    >
      {confirmDialog}
      <Panel
        bodyClassName="p-0"
        title={t.allWebsites}
        description={websites.items.length ? t.shown(websites.items.length, !!websites.hasNextPage) : undefined}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-8 w-full !bg-card text-xs sm:w-44" aria-label={t.filterByClient}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL} className="text-xs">{all.common.allClients}</SelectItem>
                <SelectItem value={UNASSIGNED} className="text-xs">{all.common.notAssigned}</SelectItem>
                {clients.items.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label={t.search} placeholder={t.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} className="h-8 w-full !bg-card pl-8 text-xs" />
            </div>
          </div>
        }
      >
        {websites.isLoading ? <LoadingRow /> : websites.isError ? (
          <EmptyState title={t.loadFailed} description={errorMessage(websites.error)} />
        ) : websites.items.length === 0 ? (
          <EmptyState
            icon={<Globe className="h-5 w-5" />}
            title={q || filter !== ALL ? all.common.noMatches : t.noneYet}
            description={q || filter !== ALL ? t.noMatchBody : t.emptyBody}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{all.common.website}</TableHead>
                  <TableHead>{all.common.client}</TableHead>
                  <TableHead>{all.common.tracking}</TableHead>
                  <TableHead className="w-12"><span className="sr-only">{all.common.actions}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {websites.items.map(w => (
                  <TableRow key={w.id}>
                    <TableCell>
                      <Link href={agencySiteHref(w.id)} className="font-medium text-foreground hover:underline" title={all.common.openWebsiteDashboard}>{w.name}</Link>
                      <p className="text-xs text-muted-foreground">{w.url}</p>
                    </TableCell>
                    <TableCell className="text-xs">
                      {w.client_id ? <Link href={`/agency/clients/${w.client_id}`} className="text-foreground hover:underline">{clientNames.get(w.client_id) ?? all.common.client}</Link> : <span className="text-muted-foreground">{all.common.notAssigned}</span>}
                    </TableCell>
                    <TableCell>{w.is_verified ? <Pill tone="green">{all.common.verified}</Pill> : <Pill tone="amber">{all.common.notInstalled}</Pill>}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground" aria-label={all.common.actionsFor(w.name)}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem asChild>
                            <Link href={agencySiteHref(w.id)}><ArrowUpRight className="mr-2 h-3.5 w-3.5" />{all.common.openDashboard}</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setInstalling(w)}><Code2 className="mr-2 h-3.5 w-3.5" />{t.installEmbed}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setMoving(w)}><ArrowRightLeft className="mr-2 h-3.5 w-3.5" />{t.moveToClient}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void confirmDelete(w)}>
                            <Trash2 className="mr-2 h-3.5 w-3.5" />{all.common.delete}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {websites.hasNextPage && (
              <div className="border-t border-border p-3 text-center">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void websites.fetchNextPage()} disabled={websites.isFetchingNextPage}>{all.common.loadMore}</Button>
              </div>
            )}
          </>
        )}
      </Panel>

      <AddWebsiteDialog open={adding} onOpenChange={setAdding} />
      <InstallDrawer website={installing} onClose={() => setInstalling(null)} />
      <MoveDialog website={moving} onClose={() => setMoving(null)} />
    </WorkspacePage>
  );
}
