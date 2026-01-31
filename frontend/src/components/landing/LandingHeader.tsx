import { useState, useEffect } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/stores/useAuthStore';
import { Menu, X, Sparkles, MoveRight, Github, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '../ui/logo';
import { motion, AnimatePresence } from 'framer-motion';
import { PromotionBanner } from '../promotion-banner';

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
    { name: 'Import', href: '#import-export' },
    { name: 'Vision', href: '#vision' },
    { name: 'Pricing', href: '#pricing' },
  ];

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${
        scrolled 
          ? 'glass bg-background/60 border-b border-white/10 backdrop-blur-xl h-auto' 
          : 'bg-transparent h-auto'
      }`}
    >
      <PromotionBanner />
      <div className="container mx-auto px-6 h-16 sm:h-20 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <Logo size='lg' />
          <span className="text-xl font-black tracking-tighter text-foreground">Seentics</span>
        </Link>

        {/* Centered Navigation */}
        <nav className="hidden lg:flex items-center absolute left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="px-5 py-2 rounded-full text-[13px] font-bold text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-all tracking-wider"
              >
                {link.name}
              </Link>
            ))}
          </div>
        </nav>

        {/* Actions */}
        <div className="hidden lg:flex items-center gap-6">
         

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Link href="/websites">
                <Button variant="brand" className="h-12 px-8 rounded-xl font-bold text-sm active:scale-95 shadow-lg shadow-primary/10 transition-all">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/signin">
                  <span className="text-sm font-bold text-foreground/50 hover:text-foreground transition-colors cursor-pointer px-6">
                    Sign in
                  </span>
                </Link>
                <Link href="/signup">
                  <Button variant="brand" className="h-12 px-10 rounded-xl font-bold text-sm active:scale-95 shadow-lg shadow-primary/10 transition-all">
                    Start for free
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile Toggle */}
        <button 
          className="lg:hidden p-3 rounded-full hover:bg-foreground/5 text-foreground transition-all"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 right-0 border-b border-border bg-background/95 backdrop-blur-2xl lg:hidden"
          >
            <div className="container mx-auto px-6 py-10 flex flex-col gap-8">
              <nav className="flex flex-col gap-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-between py-4 border-b border-border/50 group"
                  >
                    <span className="text-xl font-bold tracking-tight">{link.name}</span>
                    <ArrowRight className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0" />
                  </Link>
                ))}
              </nav>
              
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

