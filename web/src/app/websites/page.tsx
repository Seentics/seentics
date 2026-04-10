'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  getWebsites,
  addWebsite,
  updateWebsite,
  deleteWebsite,
  type Website,
} from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  LogOut,
  Sparkles,
  Globe,
  MoreHorizontal,
  LayoutDashboard,
  Code2,
  Settings,
  Pencil,
  Trash2,
  Plus,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/ui/logo';
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
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { websiteWorkspaceShellClass } from '@/lib/website-shell';
import { AddWebsiteModal } from '@/components/websites/AddWebsiteModal';
import { isDemo, demoMutationGuard } from '@/lib/demo';

export default function WebsitesPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const [listLoading, setListLoading] = useState(true);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [addOpen, setAddOpen] = useState(false);

  const [onboarding, setOnboarding] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newlyAddedSiteId, setNewlyAddedSiteId] = useState<string | null>(null);
  const [trackingCode, setTrackingCode] = useState('');
  const [copied, setCopied] = useState(false);

  const [editSite, setEditSite] = useState<Website | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [deleteSite, setDeleteSite] = useState<Website | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const refresh = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await getWebsites();
      setWebsites(data);
      setOnboarding(data.length === 0);
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
  }, [toast]);

  useEffect(() => {
    if (!user) return;
    refresh();
  }, [user, refresh]);

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({ title: 'Copied!', description: 'Tracking code copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Error', description: 'Failed to copy code', variant: 'destructive' });
    }
  };

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
    } catch (e: any) {
      toast({
        title: 'Update failed',
        description: e?.message || 'Could not update website.',
        variant: 'destructive',
      });
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
      await refresh();
    } catch (e: any) {
      toast({
        title: 'Delete failed',
        description: e?.message || 'Could not delete website.',
        variant: 'destructive',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleFirstSiteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid website URL',
        variant: 'destructive',
      });
      return;
    }
    if (!user?.id) return;
    setIsSubmitting(true);
    try {
      const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
      const website = await addWebsite({ name: name.trim(), url: normalizedUrl }, user.id);
      setNewlyAddedSiteId(website.id);
      const origin = window.location.origin;
      setTrackingCode(
        `<!-- Seentics Analytics -->\n<script \n  defer \n  data-website-id="${website.id}" \n  src="${origin}/trackers/seentics.js"\n></script>`,
      );
      toast({ title: 'Success!', description: `${name} has been added successfully` });
      setOnboarding(false);
      await refresh();
    } catch (error: any) {
      console.error('Error adding website:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add website. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (listLoading && websites.length === 0 && !onboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-6 text-primary" />
          <p className="text-muted-foreground font-medium animate-pulse">Loading your websites...</p>
        </div>
      </div>
    );
  }

  const showTable = websites.length > 0 && !newlyAddedSiteId;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/30">
        <div className={cn(websiteWorkspaceShellClass, 'flex flex-wrap items-center justify-between gap-4 py-4')}>
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <Logo size="sm" />
              <span className="text-lg font-bold tracking-tight text-foreground">Seentics</span>
            </Link>
            <span className="text-muted-foreground hidden sm:inline">/</span>
            <h1 className="text-lg font-semibold text-foreground truncate">Websites</h1>
          </div>
          <div className="flex items-center gap-2">
            {showTable && (
              <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" />
                Add website
              </Button>
            )}
            {user && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  logout();
                  router.push('/signin');
                }}
                className="text-muted-foreground gap-1.5"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Log out</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className={cn(websiteWorkspaceShellClass, 'pb-12')}>
        <AddWebsiteModal
          open={addOpen}
          onOpenChange={setAddOpen}
          onSuccess={() => refresh()}
        />

        <Dialog open={!!editSite} onOpenChange={(o) => !o && setEditSite(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit website</DialogTitle>
              <DialogDescription>Update the display name and URL for this property.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="My site"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-url">Website URL</Label>
                <Input
                  id="edit-url"
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

        {showTable && (
          <div className="rounded-lg border border-border/60 bg-card shadow-sm overflow-hidden">
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
                        <span className="truncate max-w-[200px] sm:max-w-[280px]">{w.name}</span>
                        <span className="text-xs text-muted-foreground font-mono truncate sm:hidden">
                          {w.url.replace(/^https?:\/\//, '')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm max-w-[280px] truncate">
                      {w.url}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {w.createdAt
                        ? formatDistanceToNow(new Date(w.createdAt), { addSuffix: true })
                        : '—'}
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
                          <Badge variant="outline" className="text-[10px] font-medium border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
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
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem asChild>
                            <Link href={`/websites/${w.id}`} className="flex items-center gap-2 cursor-pointer">
                              <LayoutDashboard className="h-4 w-4" />
                              Dashboard
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/websites/${w.id}/settings/tracking`}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <Code2 className="h-4 w-4" />
                              Tracking snippet
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/websites/${w.id}/settings`} className="flex items-center gap-2 cursor-pointer">
                              <Settings className="h-4 w-4" />
                              Settings
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="gap-2"
                            onClick={() => openEdit(w)}
                            disabled={isDemo(w.id)}
                          >
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
        )}

        {(onboarding || websites.length === 0) && !newlyAddedSiteId && !showTable && (
          <div className="max-w-lg mx-auto pt-8">
            <AnimatePresence mode="wait">
              <motion.div
                key="add-form"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card/50 backdrop-blur-xl p-8 md:p-10 rounded-xl border border-border/50 shadow-lg"
              >
                <div className="mb-8 text-center">
                  <h2 className="text-2xl font-bold tracking-tight mb-2">Connect your first website</h2>
                  <p className="text-muted-foreground text-sm">Add a site to unlock the dashboard and tracking snippet.</p>
                </div>
                <form onSubmit={handleFirstSiteSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground/70 ml-1">Friendly name</label>
                    <div className="relative group">
                      <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="e.g. My blog"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-12 pl-12 rounded-xl"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground/70 ml-1">Website URL</label>
                    <div className="relative group">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="example.com"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="h-12 pl-12 rounded-xl"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={isSubmitting} className="w-full h-12 rounded-xl font-semibold gap-2">
                    {isSubmitting ? (
                      <Loader2 className="animate-spin h-5 w-5" />
                    ) : (
                      <>
                        Add website <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {newlyAddedSiteId && (
          <div className="max-w-lg mx-auto pt-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card/50 backdrop-blur-xl p-8 md:p-10 rounded-3xl border border-border/50 shadow-lg"
            >
              <div className="mb-8 text-center">
                <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl mb-4">
                  <CheckCircle size={32} />
                </div>
                <h2 className="text-2xl font-bold tracking-tight mb-2">Install the snippet</h2>
                <p className="text-muted-foreground text-sm">
                  Add this to the <span className="font-mono bg-muted px-1 rounded">{'<head>'}</span> of your site.
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground/70">Tracking snippet</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(trackingCode)}
                    className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-slate-950 text-[11px] font-mono leading-relaxed overflow-x-auto text-slate-300 border border-white/5">
                  <code>{trackingCode}</code>
                </pre>
              </div>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Button className="flex-1 h-11 rounded-xl font-semibold" asChild>
                  <Link href={`/websites/${newlyAddedSiteId}`}>Open dashboard</Link>
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-11 rounded-xl"
                  onClick={() => {
                    setNewlyAddedSiteId(null);
                    setName('');
                    setUrl('');
                  }}
                >
                  Back to list
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {showTable && (
          <div className="mt-8 text-center">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-muted-foreground gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to home
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
