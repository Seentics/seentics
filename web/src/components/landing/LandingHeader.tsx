'use client';

import { useRef, useState, useEffect } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/stores/useAuthStore';
import { Menu, X, Github, ActivitySquare, Gauge, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '../ui/logo';
import { AnimatePresence, motion } from 'framer-motion';
import { config } from '@/lib/config';

/**
 * Each sibling product is shown with its own mark and its own brand colour —
 * Observability's stepped-signal glyph in purple, Uptime's pulse in green,
 * the same ones those sites use. They are separate products, and a menu that
 * renders them in this app's blue with two interchangeable lucide icons tells
 * the reader they are features of the analytics app rather than places to go.
 *
 * The identity stops at the mark. Layout, type and surfaces stay in this app's
 * tokens: an earlier attempt gave each product a tinted card, and a panel that
 * changes palette and shape mid-header reads as though you have already left.
 *
 * The glyphs are inlined rather than imported because each lives in its own
 * repo — observability/web and uptime/web are separate deployments, and this
 * app cannot reach across to them. They are small and they change rarely; the
 * comment is the reminder to update all three together when they do.
 */
function ObserveGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 15.5h3.2V12h3.2V6.5h3.2V17h3.2v-4.5H20"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const SUITE_PRODUCTS = [
  {
    name: 'Observability',
    description: 'Logs, traces, metrics and grouped errors for every service behind your product.',
    href: config.observeUrl,
    glyph: ObserveGlyph,
    // observability/web --accent-solid
    tint: 'bg-[hsl(267_60%_47%)]',
  },
  {
    name: 'Uptime',
    description: 'Endpoint checks every 60 seconds, alerts to Slack or SMS, and a public status page.',
    href: config.uptimeUrl,
    glyph: ActivitySquare,
    // uptime/web --primary
    tint: 'bg-[hsl(145_72%_38%)]',
  },
];

const FREE_TOOLS = [
  {
    name: 'Speed Test',
    description: 'Paste a URL, get a Core Web Vitals report. No account needed.',
    href: '/tools/page-speed-test',
    icon: Gauge,
  },
];

/**
 * Hover-triggered mega menu, Stripe/Linear-style. A plain `group-hover` CSS
 * approach was tried first and rejected: moving the cursor from the nav link
 * down into the panel crosses a gap, and CSS-only hover closes the panel the
 * instant the cursor leaves the link — before it reaches the cards. A short
 * close delay, cancelled on re-entry, is what every site that does this
 * actually ships.
 */
function ProductsNavItem() {
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

  return (
    <div
      className="relative"
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-[15px] font-semibold text-foreground/80 hover:text-foreground transition-colors"
      >
        Products &amp; Tools
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.12 }}
            /* Anchored to the trigger's left edge, not centred on it: the
               trigger sits near the left of a wide header, so a centred panel
               is pushed half its own width further left and runs off screen. */
            className="absolute left-0 top-full z-50 mt-3 w-[440px] max-w-[calc(100vw-3rem)] rounded-xl border border-border bg-card p-3 shadow-lg"
          >
            <p className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60">
              Products
            </p>
            <div className="flex flex-col gap-0.5">
              {SUITE_PRODUCTS.map((product) => (
                <a
                  key={product.name}
                  href={product.href}
                  className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/60"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white ${product.tint}`}
                  >
                    <product.glyph className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-semibold text-foreground">{product.name}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted-foreground">
                      {product.description}
                    </span>
                  </span>
                </a>
              ))}
            </div>

            <div className="my-2 border-t border-border/60" />

            <p className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60">
              Free tools
            </p>
            <div className="flex flex-col gap-0.5">
              {FREE_TOOLS.map((tool) => (
                <Link
                  key={tool.name}
                  href={tool.href}
                  className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/60"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/70">
                    <tool.icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-semibold text-foreground">{tool.name}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted-foreground">
                      {tool.description}
                    </span>
                  </span>
                </Link>
              ))}

              <Link
                href="/websites/demo"
                className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/60"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-semibold text-foreground">Live demo</span>
                  <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted-foreground">
                    A real Seentics dashboard with real data. No signup.
                  </span>
                </span>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LandingHeader({ alwaysBordered = false }: { alwaysBordered?: boolean }) {
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
    { name: 'Features', href: anchorHref('#features') },
    { name: 'Docs',      href: '/docs' },
    { name: 'Pricing',   href: anchorHref('#pricing') },
  ];

  return (
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
          <Logo size="lg" />
          <span className="font-bold text-base text-foreground tracking-tight">Seentics</span>
        </Link>

        {/* Desktop: nav and actions grouped together on the right, the way
            an enterprise product's header reads — not split across a
            centered nav and a separate right cluster that visually competes
            with it. */}
        <div className="hidden lg:flex items-center gap-7">
          <nav className="flex items-center gap-6">
            <ProductsNavItem />
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-[15px] font-semibold text-foreground/80 hover:text-foreground transition-colors"
              >
                {link.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-0.5">
            <Link href="https://github.com/Seentics/seentics" target="_blank">
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Seentics on GitHub">
                <Github className="h-4 w-4" />
              </Button>
            </Link>

            <span className="mx-2 h-5 w-px bg-border" aria-hidden />

            <ThemeToggle />
            {isAuthenticated ? (
              <Link href="/websites" className="ml-2">
                <Button className="h-9 rounded-lg px-4 text-sm font-semibold shadow-sm">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/signin" className="ml-1">
                  <Button variant="ghost" className="h-9 rounded-lg px-3 text-sm font-medium">
                    Sign in
                  </Button>
                </Link>
                <Link href="/signup" className="ml-1.5">
                  <Button className="h-9 rounded-lg px-4 text-sm font-semibold shadow-sm">
                    Get Started
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
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
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
            className="absolute top-full left-0 right-0 border-b border-border bg-background/95 backdrop-blur-xl lg:hidden"
          >
            <div className="landing-container py-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1 pb-3 border-b border-border/40">
                <p className="px-0 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Products &amp; Tools</p>
                {SUITE_PRODUCTS.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    className="flex items-center gap-2.5 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white ${item.tint}`}>
                      <item.glyph className="h-3.5 w-3.5" />
                    </span>
                    {item.name}
                  </a>
                ))}
                {FREE_TOOLS.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="flex items-center gap-2.5 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-foreground/70">
                      <item.icon className="h-3.5 w-3.5" />
                    </span>
                    {item.name}
                  </Link>
                ))}
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
                    Live Demo
                  </Button>
                </Link>
                {isAuthenticated ? (
                  <Link href="/websites" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full h-10 text-sm font-medium rounded-lg">
                      Dashboard
                    </Button>
                  </Link>
                ) : (
                  <Link href="/signup" onClick={() => setMobileOpen(false)}>
                    <Button size={'lg'} className="w-full   font-medium rounded-lg">
                      Get Started
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
