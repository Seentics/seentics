'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  getWebsites,
  updateWebsite,
  deleteWebsite,
  type Website,
} from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import {
  Loader2,
  MoreHorizontal,
  LayoutDashboard,
  Code2,
  Settings,
  Pencil,
  Trash2,
  Plus,
  Copy,
  Check,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { AddWebsiteModal } from '@/components/websites/AddWebsiteModal';
import { isDemo, demoMutationGuard, demoWebsite } from '@/lib/demo';
import { usePathSegment } from '@/lib/path-segment';
import { useT } from '@/lib/i18n';

function trackingSnippetFor(id: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://analytics.seentics.com';
  return `<!-- Seentics Analytics -->
<script
  defer
  data-website-id="${id}"
  src="${origin}/trackers/seentics.min.js"
></script>`;
}

type Props = {
  /** When true, redirect to `/websites` onboarding if the user has no sites (manage page behavior). */
  redirectWhenEmpty?: boolean;
  /** When true, hides the "Add website" button (used when button is in header) */
  hideAddButton?: boolean;
};

export function WebsitesSettingsPanel({ redirectWhenEmpty = false, hideAddButton = false }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const tAll = useT();
  const t = tAll.settings.websites;

  // The shared reader of the site in the path (lib/path-segment), like the rest of the app:
  // it also answers for the landing page's preview, which shows this page as the demo's.
  const currentSiteId = usePathSegment(1) ?? '';
  const onDemoSite = isDemo(currentSiteId);
  const [listLoading, setListLoading] = useState(true);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [addOpen, setAddOpen] = useState(false);

  const [editSite, setEditSite] = useState<Website | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [deleteSite, setDeleteSite] = useState<Website | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [snippetSite, setSnippetSite] = useState<Website | null>(null);
  const [snippetCopied, setSnippetCopied] = useState(false);

  const snippetText = useMemo(
    () => (snippetSite ? trackingSnippetFor(snippetSite.id) : ''),
    [snippetSite],
  );

  const refresh = useCallback(async () => {
    setListLoading(true);
    try {
      // Signed out on the demo website: show its sample site rather than an empty list.
      const data = user ? await getWebsites() : [demoWebsite() as unknown as Website];
      if (data.length === 0 && redirectWhenEmpty) {
        router.replace('/websites');
        return;
      }
      setWebsites(data);
    } catch (e) {
      console.error(e);
      toast({
        title: t.loadFailed,
        description: t.loadFailedBody,
        variant: 'destructive',
      });
    } finally {
      setListLoading(false);
    }
  }, [toast, router, redirectWhenEmpty, t]);

  useEffect(() => {
    if (!user && !onDemoSite) return;
    refresh();
  }, [user, onDemoSite, refresh]);

  useEffect(() => {
    if (!snippetSite) setSnippetCopied(false);
  }, [snippetSite]);

  const openEdit = (w: Website) => {
    if (demoMutationGuard(w.id)) return;
    setEditSite(w);
    setEditName(w.name);
    setEditUrl(w.url);
  };

  const saveEdit = async () => {
    if (!editSite || !user?.id) return;
    if (demoMutationGuard(editSite.id)) return;
    const n = editName.trim();
    let u = editUrl.trim();
    if (!n || !u) {
      toast({ title: t.validation, description: t.required, variant: 'destructive' });
      return;
    }
    try {
      new URL(u.startsWith('http') ? u : `https://${u}`);
    } catch {
      toast({ title: t.invalidUrl, description: t.invalidUrlBody, variant: 'destructive' });
      return;
    }
    if (!u.startsWith('http')) u = `https://${u}`;
    setEditSaving(true);
    try {
      await updateWebsite(editSite.id, { name: n, url: u }, user.id);
      toast({ title: t.saved, description: t.savedBody });
      setEditSite(null);
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t.updateFailedBody;
      toast({ title: t.updateFailed, description: msg, variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteSite || !user?.id) return;
    if (demoMutationGuard(deleteSite.id)) return;
    setDeleteLoading(true);
    try {
      await deleteWebsite(deleteSite.id, user.id);
      toast({ title: t.deleted, description: t.deletedBody(deleteSite.name) });
      setDeleteSite(null);
      const next = await getWebsites();
      // Set first: the navigation below keeps this panel mounted (same page, new site id), so
      // nothing else would refetch the list and the deleted row would linger.
      setWebsites(next);
      // Deleting the site these settings belong to left them showing a site that no longer exists.
      if (deleteSite.id === currentSiteId) {
        router.replace(next[0] ? `/websites/${next[0].id}/settings/websites` : '/websites');
        return;
      }
      if (next.length === 0 && redirectWhenEmpty) {
        router.replace('/websites');
        return;
      }
    } catch (e: any) {
      // The server's reason (not the owner, a failed Observe erase) over axios's "status code 403".
      const msg = e?.response?.data?.error || (e instanceof Error ? e.message : t.deleteFailedBody);
      toast({ title: t.deleteFailed, description: msg, variant: 'destructive' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const copySnippet = async () => {
    if (!snippetText) return;
    try {
      await navigator.clipboard.writeText(snippetText);
      setSnippetCopied(true);
      setTimeout(() => setSnippetCopied(false), 2000);
    } catch {
      toast({ title: t.copyFailed, description: t.copyFailedBody, variant: 'destructive' });
    }
  };

  if (listLoading && websites.length === 0) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-border bg-card/30">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (!listLoading && websites.length === 0) {
    return (
      <div className="space-y-4">
        <AddWebsiteModal open={addOpen} onOpenChange={setAddOpen} onSuccess={() => refresh()} />
        <Card className="surface">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-14 text-center">
            <p className="text-sm text-muted-foreground max-w-sm">
              {t.empty}
            </p>
            <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              {t.add}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AddWebsiteModal open={addOpen} onOpenChange={setAddOpen} onSuccess={() => refresh()} />

      {!hideAddButton && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            {t.add}
          </Button>
        </div>
      )}

      <Dialog open={!!editSite} onOpenChange={(o) => !o && setEditSite(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.editTitle}</DialogTitle>
            <DialogDescription>{t.editDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="settings-websites-edit-name">{t.name}</Label>
              <Input
                id="settings-websites-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t.namePlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-websites-edit-url">{t.url}</Label>
              <Input
                id="settings-websites-edit-url"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSite(null)}>
              {tAll.actions.cancel}
            </Button>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : tAll.actions.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteSite} onOpenChange={(o) => !o && setDeleteSite(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.deleteTitle}</DialogTitle>
            <DialogDescription>
              {t.deleteBefore}<span className="font-medium text-foreground">{deleteSite?.name}</span>{t.deleteAfter}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteSite(null)}>
              {tAll.actions.cancel}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteLoading}>
              {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : tAll.actions.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!snippetSite} onOpenChange={(o) => !o && setSnippetSite(null)}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader className="bg-card">
            <SheetTitle className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-muted-foreground" />
              {t.trackingCode}
            </SheetTitle>
            <SheetDescription>
              {t.installBefore}<span className="font-medium text-foreground">{snippetSite?.name}</span>{t.installAfter}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-3 overflow-y-auto bg-muted/40 p-4">
            <div className="space-y-2 rounded-lg border bg-card p-3.5 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">{t.websiteId}</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/40 px-2.5 py-1.5 font-mono text-xs text-foreground select-all">
                  {snippetSite?.id}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 bg-card"
                  aria-label={t.copyId}
                  onClick={() => {
                    if (!snippetSite) return;
                    navigator.clipboard?.writeText(snippetSite.id).then(
                      () => toast({ title: t.copied, description: t.idCopied }),
                      () => toast({ title: t.copyFailed, variant: 'destructive' }),
                    );
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
                <span className="text-[11px] text-zinc-500">HTML</span>
                <button
                  type="button"
                  onClick={copySnippet}
                  className="inline-flex items-center gap-1 text-[11px] text-zinc-400 transition-colors hover:text-zinc-100"
                >
                  {snippetCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {snippetCopied ? t.copied : t.copyCode}
                </button>
              </div>
              <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-relaxed text-zinc-200">
                <code>{snippetText}</code>
              </pre>
            </div>

            <ol className="space-y-2.5 rounded-lg border bg-card p-3.5 text-[13px] text-muted-foreground shadow-sm">
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">1</span>
                <span>{t.step1Before}<code className="rounded bg-muted px-1 font-mono text-xs text-foreground">{`<head>`}</code>{t.step1After}</span>
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">2</span>
                <span>
                  {t.step2Before}
                  {snippetSite ? (
                    <Link href={`/websites/${snippetSite.id}`} className="font-medium text-primary hover:underline">{t.overview}</Link>
                  ) : t.overview}
                  {t.step2After}
                </span>
              </li>
            </ol>
          </div>
        </SheetContent>
      </Sheet>

      <div className="surface overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t.name}</TableHead>
              <TableHead className="hidden sm:table-cell">{t.colUrl}</TableHead>
              <TableHead className="hidden md:table-cell">{t.colAdded}</TableHead>
              <TableHead className="hidden lg:table-cell">{t.colStatus}</TableHead>
              <TableHead className="w-[190px] text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {websites.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-col gap-0.5">
                    <span className="max-w-[200px] truncate sm:max-w-[280px]">{w.name}</span>
                    <span className="truncate font-mono text-xs text-muted-foreground sm:hidden">
                      {w.url.replace(/^https?:\/\//, '')}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden max-w-[280px] truncate text-sm text-muted-foreground sm:table-cell">
                  {w.url}
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {w.createdAt ? formatDistanceToNow(new Date(w.createdAt), { addSuffix: true }) : '—'}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {w.isActive !== false ? (
                      <Badge variant="secondary" className="text-[10px] font-medium">
                        {t.active}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] font-medium">
                        {t.paused}
                      </Badge>
                    )}
                    {w.isVerified ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-medium border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                      >
                        {t.verified}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/15 hover:text-primary"
                    onClick={() => setSnippetSite(w)}
                  >
                    <Code2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t.trackingCode}</span>
                  </Button>
                  {/* Not modal: its items open a dialog, and a modal menu left pointer-events: none on the
                      page when that dialog closed — nothing on the page could be clicked until a reload. */}
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">{t.openMenu}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem asChild>
                        <Link href={`/websites/${w.id}`} className="flex cursor-pointer items-center gap-2">
                          <LayoutDashboard className="h-4 w-4" />
                          {t.openDashboard}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex cursor-pointer items-center gap-2"
                        onClick={() => setSnippetSite(w)}
                      >
                        <Code2 className="h-4 w-4" />
                        {t.viewSnippet}
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/websites/${w.id}/settings`} className="flex cursor-pointer items-center gap-2">
                          <Settings className="h-4 w-4" />
                          {t.siteSettings}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="gap-2" onClick={() => openEdit(w)} disabled={isDemo(w.id)}>
                        <Pencil className="h-4 w-4" />
                        {tAll.actions.edit}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2 text-destructive focus:text-destructive"
                        onClick={() => {
                          if (demoMutationGuard(w.id)) return;
                          setDeleteSite(w);
                        }}
                        disabled={isDemo(w.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        {tAll.actions.delete}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
