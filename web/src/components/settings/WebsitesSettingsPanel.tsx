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
  Lightbulb,
  Info,
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
import { Card, CardContent } from '@/components/ui/card';
import { AddWebsiteModal } from '@/components/websites/AddWebsiteModal';
import { isDemo, demoMutationGuard } from '@/lib/demo';

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
};

export function WebsitesSettingsPanel({ redirectWhenEmpty = false }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

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
      const data = await getWebsites();
      if (data.length === 0 && redirectWhenEmpty) {
        router.replace('/websites');
        return;
      }
      setWebsites(data);
    } catch (e) {
      console.error(e);
      toast({
        title: 'Could not load websites',
        description: 'Please refresh the page or try again later.',
        variant: 'destructive',
      });
    } finally {
      setListLoading(false);
    }
  }, [toast, router, redirectWhenEmpty]);

  useEffect(() => {
    if (!user) return;
    refresh();
  }, [user, refresh]);

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
      toast({ title: 'Validation', description: 'Name and URL are required.', variant: 'destructive' });
      return;
    }
    try {
      new URL(u.startsWith('http') ? u : `https://${u}`);
    } catch {
      toast({ title: 'Invalid URL', description: 'Enter a valid website URL.', variant: 'destructive' });
      return;
    }
    if (!u.startsWith('http')) u = `https://${u}`;
    setEditSaving(true);
    try {
      await updateWebsite(editSite.id, { name: n, url: u }, user.id);
      toast({ title: 'Saved', description: 'Website updated.' });
      setEditSite(null);
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not update website.';
      toast({ title: 'Update failed', description: msg, variant: 'destructive' });
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
      toast({ title: 'Deleted', description: `${deleteSite.name} was removed.` });
      setDeleteSite(null);
      const next = await getWebsites();
      if (next.length === 0 && redirectWhenEmpty) {
        router.replace('/websites');
        return;
      }
      setWebsites(next);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not delete website.';
      toast({ title: 'Delete failed', description: msg, variant: 'destructive' });
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
      toast({ title: 'Copy failed', description: 'Could not copy to clipboard.', variant: 'destructive' });
    }
  };

  if (listLoading && websites.length === 0) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-border/60 bg-card/30">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading websites…</p>
        </div>
      </div>
    );
  }

  if (!listLoading && websites.length === 0) {
    return (
      <div className="space-y-4">
        <AddWebsiteModal open={addOpen} onOpenChange={setAddOpen} onSuccess={() => refresh()} />
        <Card className="border border-border/60 bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-14 text-center">
            <p className="text-sm text-muted-foreground max-w-sm">
              You don&apos;t have any websites yet. Add a property to get a tracking snippet and dashboard.
            </p>
            <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add website
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AddWebsiteModal open={addOpen} onOpenChange={setAddOpen} onSuccess={() => refresh()} />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add website
        </Button>
      </div>

      <Dialog open={!!editSite} onOpenChange={(o) => !o && setEditSite(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit website</DialogTitle>
            <DialogDescription>Update the display name and URL for this property.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="settings-websites-edit-name">Name</Label>
              <Input
                id="settings-websites-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="My site"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-websites-edit-url">Website URL</Label>
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
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteSite} onOpenChange={(o) => !o && setDeleteSite(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete website?</DialogTitle>
            <DialogDescription>
              This removes <span className="font-medium text-foreground">{deleteSite?.name}</span> and its
              configuration. Analytics data may be retained per your plan and retention policy.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteSite(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteLoading}>
              {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!snippetSite} onOpenChange={(o) => !o && setSnippetSite(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tracking snippet</DialogTitle>
            <DialogDescription>
              Install this on <span className="font-medium text-foreground">{snippetSite?.name}</span>. Use the site&apos;s
              ID <code className="text-xs font-mono bg-muted px-1 rounded">{snippetSite?.id}</code> in the script tag.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Embed code</span>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={copySnippet}>
                {snippetCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {snippetCopied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border/50 bg-muted/30 p-4">
              <pre className="text-xs font-mono leading-relaxed text-foreground sm:text-sm">
                <code>{snippetText}</code>
              </pre>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex gap-2.5 rounded-lg border border-border/50 bg-muted/20 p-3">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-medium text-foreground">Installation</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-snug">
                    Paste into the <code className="rounded bg-muted px-1">{`<head>`}</code> of your site. The script is
                    deferred and lightweight.
                  </p>
                </div>
              </div>
              <div className="flex gap-2.5 rounded-lg border border-border/50 bg-muted/20 p-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-xs font-medium text-foreground">Verification</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-snug">
                    After deploy, open your site and check{' '}
                    {snippetSite ? (
                      <Link href={`/websites/${snippetSite.id}/realtime`} className="text-primary hover:underline">
                        Realtime
                      </Link>
                    ) : (
                      'Realtime'
                    )}{' '}
                    for hits.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="overflow-hidden rounded-lg border border-border/60 bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">URL</TableHead>
              <TableHead className="hidden md:table-cell">Added</TableHead>
              <TableHead className="hidden lg:table-cell">Status</TableHead>
              <TableHead className="w-[56px] text-right"> </TableHead>
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
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] font-medium">
                        Paused
                      </Badge>
                    )}
                    {w.isVerified ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-medium border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                      >
                        Verified
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem asChild>
                        <Link href={`/websites/${w.id}`} className="flex cursor-pointer items-center gap-2">
                          <LayoutDashboard className="h-4 w-4" />
                          Open dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex cursor-pointer items-center gap-2"
                        onClick={() => setSnippetSite(w)}
                      >
                        <Code2 className="h-4 w-4" />
                        View tracking snippet
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/websites/${w.id}/settings`} className="flex cursor-pointer items-center gap-2">
                          <Settings className="h-4 w-4" />
                          Site settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="gap-2" onClick={() => openEdit(w)} disabled={isDemo(w.id)}>
                        <Pencil className="h-4 w-4" />
                        Edit
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
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
