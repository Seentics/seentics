'use client';

import { useState } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/stores/useAuthStore';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '../ui/logo';
import { FaGithub, FaDiscord } from 'react-icons/fa';

export default function LandingHeader() {
  const { user, isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          
          {/* Brand - Left */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <Logo size='xl'/>
            <span className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Seentics</span>
          </Link>

          {/* Desktop Nav - Center */}
          <nav className="hidden lg:flex items-center gap-8">
            <Link href="#features" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
              Features
            </Link>
            <Link href="#pricing" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/docs" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
              Docs
            </Link>
            <Link href="/contact" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
              Contact
            </Link>
          </nav>

          {/* Desktop Actions - Right */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Social Icons */}
            <div className="flex items-center gap-2 mr-2">
              <a 
                href="https://github.com/skshohagmiah/Seentics" 
                target="_blank" 
                rel="noopener noreferrer"
                aria-label="Visit our GitHub repository"
                className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
              >
                <FaGithub className="h-5 w-5" />
              </a>
              <a 
                href="https://discord.gg/seentics" 
                target="_blank" 
                rel="noopener noreferrer"
                aria-label="Join our Discord community"
                className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
              >
                <FaDiscord className="h-5 w-5" />
              </a>
            </div>

            <ThemeToggle />

            {/* CTA Buttons */}
            {isAuthenticated && user ? (
              <Link href="/websites">
                <Button size="sm" className="font-semibold">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/signin">
                  <Button size="sm" variant="ghost" className="font-medium">Sign In</Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="font-semibold shadow-md">Get Started</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Actions - Right */}
          <div className="flex lg:hidden items-center gap-2">
            <ThemeToggle />
            <button
              className="inline-flex items-center justify-center rounded-lg p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(v => !v)}
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav Panel */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="container mx-auto px-4 py-4 space-y-3">
            {/* Navigation Links */}
            <Link 
              href="#features" 
              className="block py-2.5 px-3 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" 
              onClick={() => setMobileOpen(false)}
            >
              Features
            </Link>
            <Link 
              href="#pricing" 
              className="block py-2.5 px-3 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" 
              onClick={() => setMobileOpen(false)}
            >
              Pricing
            </Link>
            <Link 
              href="/docs" 
              className="block py-2.5 px-3 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" 
              onClick={() => setMobileOpen(false)}
            >
              Documentation
            </Link>
            <Link 
              href="/contact" 
              className="block py-2.5 px-3 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" 
              onClick={() => setMobileOpen(false)}
            >
              Contact
            </Link>
            
            {/* Social Icons - Mobile */}
            <div className="flex items-center gap-3 pt-3 pb-2 border-t border-slate-200 dark:border-slate-700">
              <a 
                href="https://github.com/skshohagmiah/Seentics" 
                target="_blank" 
                rel="noopener noreferrer"
                aria-label="Visit our GitHub repository"
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-1 justify-center font-medium"
              >
                <FaGithub className="h-5 w-5" />
                <span className="text-sm">GitHub</span>
              </a>
              <a 
                href="https://discord.gg/seentics" 
                target="_blank" 
                rel="noopener noreferrer"
                aria-label="Join our Discord community"
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-1 justify-center font-medium"
              >
                <FaDiscord className="h-5 w-5" />
                <span className="text-sm">Discord</span>
              </a>
            </div>
            
            {/* CTA Buttons - Mobile */}
            <div className="pt-2 space-y-2">
              {isAuthenticated && user ? (
                <Link href="/websites" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full font-semibold">Go to Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link href="/signin" onClick={() => setMobileOpen(false)}>
                    <Button variant="outline" className="w-full font-medium">Sign In</Button>
                  </Link>
                  <Link href="/signup" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full font-semibold shadow-md">Get Started Free</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
