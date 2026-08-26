'use client';

import { useState, useEffect } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/stores/useAuthStore';
import { Menu, X, Github } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '../ui/logo';
import { AnimatePresence, motion } from 'framer-motion';

export default function LandingHeader({ alwaysBordered = false }: { alwaysBordered?: boolean }) {
  const { isAuthenticated } = useAuth();
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

  const navLinks = [
    { name: 'Features', href: anchorHref('#features') },
    { name: 'Docs',     href: '/docs' },
    { name: 'Blog',     href: '/blog' },
    { name: 'Pricing',  href: anchorHref('#pricing') },
    { name: 'FAQ',      href: anchorHref('#faq') },
  ];

  return (
    <header
      className={`fixed left-0 right-0 z-[100] transition-all duration-300 ${
        scrolled || alwaysBordered
          ? 'top-0 bg-background/70 border-b border-border/30 backdrop-blur-xl h-14'
          : 'top-0 bg-transparent h-16'
      }`}
    >
      <div className="container mx-auto px-6 h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Logo size="lg" />
          <span className="font-bold text-base text-foreground tracking-tight">Seentics</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Right section */}
        <div className="flex items-center gap-2 ml-auto">
          <Link href="https://github.com/Seentics/seentics" target="_blank" className="hidden sm:block">
            <Button variant="ghost" size="lg" className="h-8 px-3 text-xs font-semibold gap-1.5 border-border">
              <Github className="h-4.5 w-4.5" />
            </Button>
          </Link>
          <ThemeToggle />
          {isAuthenticated ? (
            <Link href="/websites">
              <Button size="sm" className="h-8 px-4 text-xs font-semibold rounded-lg">
                Dashboard
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/signin" className="hidden sm:block">
                <Button variant="ghost" size="lg" className="h-10 px-4 text font-semibold rounded-lg">
                  Sign in
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="lg" className="h-10 px-4 text font-semibold rounded-lg">
                  Get Started
                </Button>
              </Link>
            </>
          )}
          <button
            className="lg:hidden p-1.5 hover:bg-accent rounded-lg transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
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
            className="absolute top-full left-0 right-0 border-b border-border bg-background/95 backdrop-blur-xl md:hidden"
          >
            <div className="container mx-auto px-6 py-6 flex flex-col gap-4">
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
