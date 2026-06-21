'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getWebsites, addWebsite } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { Loader2, ArrowRight, CheckCircle, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/ui/logo';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * First-time entry: users with no websites add their first property here.
 * Once they have at least one site, visiting `/websites` redirects to that dashboard.
 * Manage all sites from Settings → Websites on any dashboard, or `/websites/manage`.
 */
export default function WebsitesOnboardingPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const [phase, setPhase] = useState<'loading' | 'onboarding' | 'snippet'>('loading');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newlyAddedSiteId, setNewlyAddedSiteId] = useState<string | null>(null);
  const [trackingCode, setTrackingCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    (async () => {
      try {
        const data = await getWebsites();
        if (cancelled) return;
        if (data.length > 0) {
          router.replace(`/websites/${data[0].id}`);
          return;
        }
        setPhase('onboarding');
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          toast({
            title: 'Could not load websites',
            description: 'Please refresh the page or try again later.',
            variant: 'destructive',
          });
          setPhase('onboarding');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, router, toast]);

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
        `<!-- Seentics Analytics -->\n<script \n  defer \n  data-website-id="${website.id}" \n  src="${origin}/trackers/seentics.min.js"\n></script>`,
      );
      toast({ title: 'Success!', description: `${name} has been added successfully` });
      setPhase('snippet');
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

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <Logo className="h-8 w-auto opacity-90" />
          <div>
            <p className="text-sm font-semibold text-foreground">Loading your workspace</p>
            <p className="mt-1 text-xs text-muted-foreground">Checking your websites…</p>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background selection:bg-primary/20">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 right-0 h-[420px] w-[420px] rounded-full bg-primary/[0.07] blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[320px] w-[320px] rounded-full bg-sky-500/[0.06] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col px-4 pb-10 pt-6 sm:px-6 sm:pt-10">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <Logo size="md" />
            <span className="text-lg font-bold tracking-tight text-foreground sm:text-xl">Seentics</span>
          </Link>
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logout();
                router.push('/signin');
              }}
              className="shrink-0 gap-2 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          )}
        </header>

        <main className="flex flex-1 flex-col justify-center">
          <AnimatePresence mode="wait">
            {phase === 'onboarding' && (
              <motion.div
                key="add-form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                <Card className="border-border/80 shadow-lg shadow-black/5 dark:shadow-black/20 rounded-2xl">
                  <CardHeader className="space-y-3 px-6 pb-2 pt-8 sm:px-8">
                    <CardTitle className="text-2xl font-bold tracking-tight">Add your website</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      Choose a dashboard label, then the site&apos;s hostname (e.g.{' '}
                      <span className="font-mono text-xs text-foreground/80">example.com</span>
                      ). Skip <span className="font-mono text-xs">https://</span>
                      — we normalize the URL. You&apos;ll get the tracking snippet on the next screen.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-6 pb-8 pt-2 sm:px-8">
                    <form onSubmit={handleFirstSiteSubmit} className="space-y-5">
                      <div className="space-y-1.5">
                        <Label htmlFor="onboard-name" className="text-sm font-medium text-foreground">
                          Website name
                        </Label>
                        <Input
                          id="onboard-name"
                          placeholder="My site"
                          value={name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                          className={cn(
                            'h-11 rounded-lg border-border/80 bg-background px-3.5 text-sm shadow-sm',
                            'placeholder:text-muted-foreground/50',
                            'hover:border-muted-foreground/25',
                            'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0',
                          )}
                          autoComplete="organization"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="onboard-url" className="text-sm font-medium text-foreground">
                          Website domain
                        </Label>
                        <Input
                          id="onboard-url"
                          placeholder="example.com"
                          value={url}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                          className={cn(
                            'h-11 rounded-lg border-border/80 bg-background px-3.5 text-sm shadow-sm',
                            'placeholder:text-muted-foreground/50',
                            'font-mono text-sm',
                            'hover:border-muted-foreground/25',
                            'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0',
                          )}
                          inputMode="url"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          required
                        />
                      </div>

                      <Button type="submit" disabled={isSubmitting} className="h-11 w-full rounded-lg text-sm font-semibold">
                        {isSubmitting ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            Add website
                            <ArrowRight className="h-4 w-4" />
                          </span>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {phase === 'snippet' && newlyAddedSiteId && (
              <motion.div
                key="tracking-code"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                <Card className="border-border/80 shadow-lg shadow-black/5 dark:shadow-black/20 rounded-2xl">
                  <CardHeader className="space-y-3 pb-2 pt-8 text-center">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="h-5 w-5" strokeWidth={2} />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Tracking code</CardTitle>
                    <CardDescription className="text-sm">
                      Add to <span className="font-mono text-foreground/90">{'<head>'}</span> on{' '}
                      <span className="font-medium text-foreground">{name}</span>.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 px-6 pb-8 sm:px-8">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">Code</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(trackingCode)}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="max-h-[220px] overflow-auto rounded-xl border border-border bg-zinc-950 p-4 text-[11px] leading-relaxed text-zinc-200 shadow-inner dark:bg-zinc-950">
                        <code>{trackingCode}</code>
                      </pre>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-stretch">
                      <Button className="h-11 flex-1 rounded-lg font-semibold" asChild>
                        <Link href={`/websites/${newlyAddedSiteId}`}>Open dashboard</Link>
                      </Button>
                      <Button variant="outline" className="h-11 flex-1 rounded-lg font-semibold" asChild>
                        <Link href="/websites/manage">Manage websites</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="mt-8 text-center">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
            <Link href="/">Home</Link>
          </Button>
        </footer>
      </div>
    </div>
  );
}
