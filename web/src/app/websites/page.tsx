'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getWebsites, addWebsite } from '@/lib/websites-api';
import { rememberedWebsite, rememberWebsite } from '@/lib/last-website';
import { useAuth } from '@/stores/useAuthStore';
import { Loader2, ArrowRight, CheckCircle, LogOut, Briefcase } from 'lucide-react';
import { AGENCY_WORKSPACE_HREF, useHasAgencyWorkspace } from '@/components/dashboard/Sidebar';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/ui/logo';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useClientAccess } from '@/features/client-mode/useClientAccess';
import { firstAllowedPath } from '@/features/client-mode/routes';
import { clientSignInHref } from '@/features/client-mode/session';
import { useT } from '@/lib/i18n';
import { ProfilePicker } from '@/components/websites/ProfilePicker';
import { isWebsiteProfile, type WebsiteProfile } from '@/features/websites/types';

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
  const all = useT();
  const t = all.dashboard.onboarding;
  const addT = all.dashboard.addWebsite;
  // The effect below reads the strings without re-running when the language changes.
  const tRef = useRef(t);
  tRef.current = t;
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [profile, setProfile] = useState<WebsiteProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newlyAddedSiteId, setNewlyAddedSiteId] = useState<string | null>(null);
  const [trackingCode, setTrackingCode] = useState('');
  const [copied, setCopied] = useState(false);
  // Agency accounts may start in the Agency workspace rather than with a site of their own.
  const hasAgency = useHasAgencyWorkspace();
  // A client user (client mode) has no websites of their own to add: straight to the first page
  // of a website their agency shared.
  const clientAccess = useClientAccess();
  const isClient = clientAccess.isClient;
  const clientTarget = (() => {
    if (!isClient || clientAccess.isLoading) return null;
    const sites = clientAccess.websites;
    const last = rememberedWebsite();
    const ordered = [...sites.filter((w) => w.id === last), ...sites.filter((w) => w.id !== last)];
    for (const w of ordered) {
      const path = firstAllowedPath(w.id, w.features);
      if (path) return path;
    }
    return 'none';
  })();

  useEffect(() => {
    if (clientTarget && clientTarget !== 'none') router.replace(clientTarget);
  }, [clientTarget, router]);

  useEffect(() => {
    if (isClient) return;
    // `?profile=store` (a landing page's sign-up): that answer already picked.
    const asked = new URLSearchParams(window.location.search).get('profile');
    if (isWebsiteProfile(asked)) setProfile(asked);
    // The site opened last time: straight there, without waiting for the session check and
    // the websites list. The dashboard confirms it and comes back here if it is gone.
    const last = rememberedWebsite();
    if (last) {
      router.replace(`/websites/${last}`);
      return;
    }
    if (!user) return;

    let cancelled = false;

    (async () => {
      try {
        const data = await getWebsites();
        if (cancelled) return;
        if (data.length > 0) {
          rememberWebsite(data[0].id);
          router.replace(`/websites/${data[0].id}`);
          return;
        }
        setPhase('onboarding');
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          toast({
            title: tRef.current.loadFailed,
            description: tRef.current.loadFailedBody,
            variant: 'destructive',
          });
          setPhase('onboarding');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, router, toast, isClient]);

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({ title: all.actions.copied, description: t.codeCopied });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: addT.error, description: t.copyFailed, variant: 'destructive' });
    }
  };

  const handleFirstSiteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) {
      toast({
        title: addT.validationError,
        description: addT.fillAll,
        variant: 'destructive',
      });
      return;
    }
    try {
      new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    } catch {
      toast({
        title: addT.invalidUrl,
        description: addT.invalidUrlBody,
        variant: 'destructive',
      });
      return;
    }
    if (!user?.id) return;
    setIsSubmitting(true);
    try {
      const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      const website = await addWebsite({ name: name.trim(), url: normalizedUrl, ...(profile ? { profile } : {}) }, user.id);
      setNewlyAddedSiteId(website.id);
      const origin = window.location.origin;
      setTrackingCode(
        `<!-- Seentics Analytics -->\n<script \n  defer \n  data-website-id="${website.id}" \n  src="${origin}/trackers/seentics.min.js"\n></script>`,
      );
      toast({ title: addT.success, description: addT.added(name) });
      setPhase('snippet');
    } catch (error: any) {
      console.error('Error adding website:', error);
      toast({
        title: addT.error,
        description: error.message || addT.failed,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isClient && clientTarget === 'none') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center" data-testid="client-no-websites">
          <p className="text-sm font-semibold text-foreground">{t.clientNone}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.clientNoneBody}
          </p>
          <Button variant="outline" size="sm" className="mt-5 gap-1.5" onClick={() => { const href = clientSignInHref(user?.agency?.slug); logout(); router.push(href); }}>
            <LogOut className="h-3.5 w-3.5" />{all.dashboard.sidebar.logOut}
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'loading' || isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <Logo className="h-8 w-auto opacity-90" />
          <div>
            <p className="text-sm font-semibold text-foreground">{t.loading}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.checking}</p>
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
            <div className="flex items-center gap-1">
            {hasAgency && (
              <Button variant="outline" size="sm" className="shrink-0 gap-2" asChild>
                <Link href={AGENCY_WORKSPACE_HREF}>
                  <Briefcase className="h-4 w-4" />
                  <span>{all.dashboard.sidebar.agencyWorkspace}</span>
                </Link>
              </Button>
            )}
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
              <span className="hidden sm:inline">{all.dashboard.sidebar.logOut}</span>
            </Button>
            </div>
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
                <Card className="border-border shadow-lg shadow-black/5 dark:shadow-black/20 rounded-lg">
                  <CardHeader className="space-y-3 px-6 pb-2 pt-8 sm:px-8">
                    <CardTitle className="text-2xl font-bold tracking-tight">{t.title}</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      {t.descA}
                      <span className="font-mono text-xs text-foreground/80">example.com</span>
                      {t.descB}<span className="font-mono text-xs">https://</span>
                      {t.descC}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-6 pb-8 pt-2 sm:px-8">
                    <form onSubmit={handleFirstSiteSubmit} className="space-y-5">
                      <div className="space-y-1.5">
                        <Label htmlFor="onboard-name" className="text-sm font-medium text-foreground">
                          {t.name}
                        </Label>
                        <Input
                          id="onboard-name"
                          placeholder={t.namePlaceholder}
                          value={name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                          className={cn(
                            'h-11 rounded-lg border-border bg-background px-3.5 text-sm shadow-sm',
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
                          {t.domain}
                        </Label>
                        <Input
                          id="onboard-url"
                          placeholder="example.com"
                          value={url}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                          className={cn(
                            'h-11 rounded-lg border-border bg-background px-3.5 text-sm shadow-sm',
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

                      <fieldset className="space-y-2">
                        <legend className="text-sm font-medium text-foreground">{all.dashboard.profiles.question}</legend>
                        <p className="text-xs text-muted-foreground">{all.dashboard.profiles.hint}</p>
                        <ProfilePicker value={profile} onChange={setProfile} disabled={isSubmitting} name="onboard-profile" />
                      </fieldset>

                      <Button type="submit" disabled={isSubmitting} className="h-11 w-full rounded-lg text-sm font-semibold">
                        {isSubmitting ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            {t.submit}
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
                <Card className="border-border shadow-lg shadow-black/5 dark:shadow-black/20 rounded-lg">
                  <CardHeader className="space-y-3 pb-2 pt-8 text-center">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="h-5 w-5" strokeWidth={2} />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">{t.codeTitle}</CardTitle>
                    <CardDescription className="text-sm">
                      {t.addTo(
                        <span className="font-mono text-foreground/90">{'<head>'}</span>,
                        <span className="font-medium text-foreground">{name}</span>,
                      ).map((part, i) => <Fragment key={i}>{part}</Fragment>)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 px-6 pb-8 sm:px-8">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">{t.code}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(trackingCode)}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          {copied ? all.actions.copied : all.actions.copy}
                        </button>
                      </div>
                      <pre className="max-h-[220px] overflow-auto rounded-lg border border-border bg-zinc-950 p-4 text-[11px] leading-relaxed text-zinc-200 shadow-inner dark:bg-zinc-950">
                        <code>{trackingCode}</code>
                      </pre>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-stretch">
                      <Button className="h-11 flex-1 rounded-lg font-semibold" asChild>
                        <Link href={`/websites/${newlyAddedSiteId}`}>{all.common.openDashboard}</Link>
                      </Button>
                      <Button variant="outline" className="h-11 flex-1 rounded-lg font-semibold" asChild>
                        <Link href="/websites/manage">{t.manage}</Link>
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
            <Link href="/">{t.home}</Link>
          </Button>
        </footer>
      </div>
    </div>
  );
}
