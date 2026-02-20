import { useState, useEffect } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/stores/useAuthStore';
import { Menu, X, Sparkles, MoveRight, Github, ArrowRight } from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import Link from 'next/link';
import { Logo } from '../ui/logo';
import { motion, AnimatePresence } from 'framer-motion';

export default function LandingHeader() {
  const { user, isAuthenticated } = useAuth();
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
          ? 'bg-background/80 border-b border-border/40 backdrop-blur-md h-16' 
          : 'bg-transparent h-20'
      }`}
    >
      <div className="container mx-auto px-6 h-full flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group">
          <Logo size='md' />
          <span className="text-lg font-bold tracking-tight text-foreground">Seentics</span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <a href="https://discord.gg/TYdPvDRA" target="_blank" rel="noopener noreferrer" className="hidden sm:flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">
            <FaDiscord size={16} /> Discord
          </a>
          <div className="hidden sm:flex items-center gap-4">
            {isAuthenticated ? (
              <Link href="/websites">
                <Button size="sm" variant="brand" className="rounded-lg font-bold px-5">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/signin">
                  <span className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer mr-2">
                    Log in
                  </span>
                </Link>
                <Link href="/signup">
                  <Button size="sm" variant="brand" className="rounded-lg font-bold px-5">
                    Sign up
                  </Button>
                </Link>
              </>
            )}
          </div>
          <ThemeToggle />
          
          {/* Mobile Toggle */}
          <button 
            className="md:hidden p-2 rounded-lg hover:bg-accent text-foreground transition-all"
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
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 border-b border-border bg-background/95 backdrop-blur-2xl lg:hidden overflow-hidden"
          >
            <div className="container mx-auto px-6 py-8 flex flex-col gap-6">
              <nav className="flex flex-col">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-between py-4 border-b border-border/10 last:border-0 group"
                  >
                    <span className="text-lg font-bold tracking-tight">{link.name}</span>
                    <ArrowRight className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                  </Link>
                ))}
              </nav>
              
              <a
                href="https://discord.gg/TYdPvDRA"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between py-4 border-b border-border/10 group"
              >
                <span className="text-lg font-bold tracking-tight flex items-center gap-2"><FaDiscord size={18} /> Discord</span>
                <ArrowRight className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
              </a>

              <div className="flex flex-col gap-4">
                {isAuthenticated ? (
                  <Link href="/websites" onClick={() => setMobileOpen(false)}>
                    <Button variant="brand" className="w-full h-14 rounded-full font-bold text-sm uppercase tracking-widest">
                      Dashboard
                    </Button>
                  </Link>
                ) : (
                  <Link href="/signup" onClick={() => setMobileOpen(false)}>
                    <Button variant="brand" className="w-full h-14 rounded-full font-bold text-sm uppercase tracking-widest">
                      Start Free Forever
                    </Button>
                  </Link>
                )}
                <div className="flex items-center justify-between px-2">
                  <span className="text-sm font-bold text-muted-foreground">Dark mode</span>
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

