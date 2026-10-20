'use client';

// The marketing pages' type: Inter with its optical sizes, and a mono for figure labels.
// Loaded with the header every marketing page has, so the dashboard does not carry them.
import '@fontsource-variable/inter/opsz.css';
import '@fontsource-variable/jetbrains-mono';

import { useRef, useState, useEffect } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/stores/useAuthStore';
import { Menu, X, Github, Gauge, ChevronDown, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { isEnterprise } from '@/lib/features';
import { usePathname } from 'next/navigation';
import { Logo } from '../ui/logo';
import { AnimatePresence, motion } from 'framer-motion';
import { config } from '@/lib/config';
import { IntegrationIcon } from '@/components/integrations/IntegrationIcon';
import { INTEGRATIONS } from '@/lib/integrations';
import { GROUPS, USE_CASES, useCasesIn } from '@/lib/use-cases';
import { UseCaseIcon } from '@/components/use-cases/UseCaseIcon';
import { HashLinks } from './HashLinks';
import { useT } from '@/lib/i18n';

// The Products & Tools menu was removed: the header keeps Use cases, Integrations, Docs, For agencies
// and Pricing. The free Speed Test is linked from the footer.

/**
 * "Use cases": outcomes grouped in three columns. Each entry opens its own page, which is
 * what search engines index. Hover
 * behaviour and panel positioning are the same as the Integrations menu.
 */
function UseCasesNavItem() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };
  useEffect(() => () => cancelClose(), []);

  const entry = (u: (typeof USE_CASES)[number]) => (
    <Link
      key={u.slug}
      href={`/use-cases/${u.slug}`}
      onClick={() => setOpen(false)}
      className="flex items-start gap-3.5 rounded-xl px-3 py-3 transition-colors hover:bg-muted/60"
    >
      <UseCaseIcon useCase={u} size="sm" />
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold leading-snug text-foreground">{u.name}</span>
        <span className="mt-1 block text-[12.5px] leading-relaxed text-muted-foreground">{u.summary}</span>
      </span>
    </Link>
  );

  return (
    <div
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
      onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 whitespace-nowrap text-[14px] font-medium text-foreground/65 hover:text-foreground transition-colors"
      >
        {t.header.useCases}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            /* `x: '-50%'` rather than a Tailwind translate: see IntegrationsNavItem. */
            initial={{ opacity: 0, y: -6, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -6, x: '-50%' }}
            transition={{ duration: 0.12 }}
            className="absolute left-1/2 top-full z-50 mt-3 w-[min(1120px,calc(100vw-3rem))] rounded-2xl border border-border bg-card p-5 shadow-xl"
          >
            <div className="grid gap-x-8 md:grid-cols-3">
              {GROUPS.map((g) => (
                <div key={g.key}>
                  <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {g.title}
                  </p>
                  <div className="flex flex-col gap-1">{useCasesIn(g.key).map(entry)}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-border/50 px-3 pt-4">
              <Link
                href="/use-cases"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-primary hover:underline"
              >
                {t.header.seeAllUseCases} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Same hover behaviour as the products menu, for the platform guides. The panel is
 * positioned against the header, not the trigger: the trigger sits in a right-hand
 * cluster, and a panel this wide anchored to it would run off one edge or the other.
 */
function IntegrationsNavItem() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };
  useEffect(() => () => cancelClose(), []);

  const featured = INTEGRATIONS.filter((i) => i.featured);

  return (
    <div
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
      onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 whitespace-nowrap text-[14px] font-medium text-foreground/65 hover:text-foreground transition-colors"
      >
        {t.header.integrations}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            /* `x: '-50%'` rather than a Tailwind translate: Framer writes its own inline
               transform for `y`, which would replace the class and leave the panel
               hanging off the right edge. */
            initial={{ opacity: 0, y: -6, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -6, x: '-50%' }}
            transition={{ duration: 0.12 }}
            className="absolute left-1/2 top-full z-50 mt-3 w-[min(760px,calc(100vw-3rem))] rounded-xl border border-border bg-card p-3 shadow-lg"
          >
            <p className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60">
              {t.header.worksWith}
            </p>
            <div className="grid grid-cols-2 gap-x-1 gap-y-0.5">
              {featured.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted/60"
                >
                  <IntegrationIcon integration={item} size={20} />
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-semibold text-foreground">{item.name}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted-foreground">
                      {t.site.integrations.descriptions[item.name] ?? item.description}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
            <div className="mt-2 border-t border-border/60 px-3 pt-2.5">
              <Link
                href="/integrations"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-primary hover:underline"
              >
                {t.header.seeAllIntegrations} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LandingHeader({ alwaysBordered = false }: { alwaysBordered?: boolean }) {
  const t = useT();
  const { isAuthenticated: authed } = useAuth();
  /*
   * The auth store hydrates from localStorage, so the server renders the signed-out
   * header and the client can render the signed-in one — a different subtree, a
   * different number of `useId` calls, and Radix's DropdownMenu id no longer matching
   * between the two. That was the hydration warning on this page.
   *
   * Treat auth as unknown until mounted so both passes render the same tree.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isAuthenticated = mounted && authed;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Hash links only make sense on the home page — prefix with '/' on all other pages
  const anchorHref = (hash: string) => pathname === '/' ? hash : `/${hash}`;

  // Blog and FAQ stay reachable from the footer rather than living here too —
  // between this, the logo, and the Products & Tools menu, the header was
  // getting crowded.
  const navLinks = [
    { name: t.header.docs,      href: '/docs' },
    // Cloud only, like the page itself.
    ...(isEnterprise ? [{ name: t.header.forAgencies, href: '/agencies' }] : []),
    { name: t.header.pricing,   href: anchorHref('#pricing') },
  ];

  return (
    <>
    <HashLinks />
    <header
      className={`fixed left-0 right-0 top-0 z-[100] h-[72px] transition-colors duration-300 ${
        scrolled || alwaysBordered
          ? 'bg-background/85 border-b border-border backdrop-blur-xl dark:bg-background/75 dark:border-border/30'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="landing-container h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Logo size="xl" />
          <span className="font-bold text-[1.3125rem] text-foreground tracking-tight">Seentics</span>
        </Link>

        {/* Desktop: nav and actions grouped together on the right, the way
            an enterprise product's header reads — not split across a
            centered nav and a separate right cluster that visually competes
            with it. */}
        <div className="hidden lg:flex items-center gap-5 xl:gap-7">
          <nav className="flex items-center gap-5 xl:gap-6">
            <UseCasesNavItem />
            <IntegrationsNavItem />
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="whitespace-nowrap text-[14px] font-medium text-foreground/65 hover:text-foreground transition-colors"
              >
                {link.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-0.5">
            <Link href="https://github.com/Seentics/seentics" target="_blank" className="hidden xl:inline-flex">
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Seentics on GitHub">
                <Github className="h-4 w-4" />
              </Button>
            </Link>

            <span className="mx-2 hidden h-5 w-px bg-border xl:block" aria-hidden />

            <ThemeToggle />
            {isAuthenticated ? (
              <Link href="/websites" className="ml-2">
                <Button className="h-8 rounded-full bg-foreground px-4 text-[13.5px] font-medium text-background shadow-none hover:bg-foreground/85">
                  {t.common.dashboard}
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/signin" className="ml-1">
                  <Button variant="ghost" className="h-8 rounded-full px-3 text-[13.5px] font-medium text-foreground/80">
                    {t.common.signIn}
                  </Button>
                </Link>
                <Link href="/signup" className="ml-1.5">
                  <Button className="h-8 rounded-full bg-foreground px-4 text-[13.5px] font-medium text-background shadow-none hover:bg-foreground/85">
                    {t.common.getStarted}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-1.5 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            aria-label={mobileOpen ? t.header.closeMenu : t.header.openMenu}
            aria-expanded={mobileOpen}
            className="rounded-lg p-2 transition-colors hover:bg-accent"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 max-h-[calc(100dvh-72px)] overflow-y-auto overscroll-contain border-b border-border bg-background/95 backdrop-blur-xl lg:hidden"
          >
            <div className="landing-container py-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1 pb-3 border-b border-border/40">
                <p className="px-0 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{t.header.useCases}</p>
                {USE_CASES.map((u) => (
                  <Link
                    key={u.slug}
                    href={`/use-cases/${u.slug}`}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2.5 py-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    <UseCaseIcon useCase={u} size="xs" />
                    {u.name}
                  </Link>
                ))}
              </div>
              <div className="flex flex-col gap-1 pb-3 border-b border-border/40">
                <p className="px-0 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{t.header.integrations}</p>
                {INTEGRATIONS.filter((i) => i.featured).map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2.5 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    <IntegrationIcon integration={item} size={16} tile={false} />
                    {item.name}
                  </Link>
                ))}
                <Link
                  href="/integrations"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-1.5 py-2 text-sm font-semibold text-primary"
                >
                  {t.header.seeAllIntegrations} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <nav className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="py-2.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {link.name}
                  </Link>
                ))}
              </nav>

              <div className="pt-2 border-t border-border/40 space-y-2">
                <Link href="/websites/demo" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" className="w-full h-10 text-sm font-medium rounded-lg gap-2 border-border/60 text-muted-foreground">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    {t.common.liveDemo}
                  </Button>
                </Link>
                {isAuthenticated ? (
                  <Link href="/websites" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full h-10 text-sm font-medium rounded-lg">
                      {t.common.dashboard}
                    </Button>
                  </Link>
                ) : (
                  <Link href="/signup" onClick={() => setMobileOpen(false)}>
                    <Button size={'lg'} className="w-full   font-medium rounded-lg">
                      {t.common.getStarted}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
    </>
  );
}
