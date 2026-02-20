import { useState, useEffect } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/stores/useAuthStore';
import { Menu, X } from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import Link from 'next/link';
import { Logo } from '../ui/logo';
import { AnimatePresence, motion } from 'framer-motion';

export default function LandingHeader() {
  const { isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Features', href: '#features' },
    { name: 'Automations', href: '#automations' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'FAQ', href: '#faq' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
        scrolled
          ? 'bg-background/80 border-b border-border/40 backdrop-blur-md h-14'
          : 'bg-transparent h-16'
      }`}
    >
      <div className="container mx-auto px-6 h-full flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo size="md" />
          <span className="text-base font-semibold text-foreground">Seentics</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.name}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="https://discord.gg/TYdPvDRA"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <FaDiscord size={15} />
          </a>
          <ThemeToggle />
          <div className="hidden sm:flex items-center gap-2">
            {isAuthenticated ? (
              <Link href="/websites">
                <Button size="sm" className="h-8 px-4 text-xs font-medium rounded-md">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/signin">
                  <Button variant="ghost" size="sm" className="h-8 px-3 text-xs font-medium">
                    Log in
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="h-8 px-4 text-xs font-medium rounded-md">
                    Sign up
                  </Button>
                </Link>
              </>
            )}
          </div>

          <button
            className="md:hidden p-1.5 rounded-md hover:bg-accent text-foreground transition-colors"
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
                <a
                  href="https://discord.gg/TYdPvDRA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 text-sm font-medium text-foreground hover:text-primary transition-colors flex items-center gap-2"
                >
                  <FaDiscord size={15} /> Discord
                </a>
              </nav>

              <div className="pt-2 border-t border-border/40">
                {isAuthenticated ? (
                  <Link href="/websites" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full h-10 text-sm font-medium rounded-lg">
                      Dashboard
                    </Button>
                  </Link>
                ) : (
                  <Link href="/signup" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full h-10 text-sm font-medium rounded-lg">
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
