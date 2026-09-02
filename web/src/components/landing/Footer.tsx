'use client';

import { Logo } from '@/components/ui/logo';
import { FaDiscord } from 'react-icons/fa';
import { Github } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Footer() {
  /**
   * `#features` and friends only resolve on the home page. In the footer they were
   * bare hashes, so on /blog, /contact or /docs they scrolled nowhere — the header
   * has had this helper for a while and the footer never got it.
   */
  const pathname = usePathname();
  const anchor = (hash: string) => (pathname === '/' ? hash : `/${hash}`);

  return (
    <footer className="border-t border-border py-16 bg-background dark:border-border/40">
      <div className="landing-container">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4">
              <Logo size="lg" showText={true} textClassName="text-lg font-semibold text-foreground" className="gap-2.5" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Open-source, privacy-first web analytics. No cookies, fast, and easy to use.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground mb-4">Product</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href={anchor('#features')} className="hover:text-foreground transition-colors">Features</Link></li>
              <li><Link href={anchor('#pricing')} className="hover:text-foreground transition-colors">Pricing</Link></li>
              <li><Link href={anchor('#faq')} className="hover:text-foreground transition-colors">FAQ</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground mb-4">Company</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link></li>
              <li><Link href="https://github.com/Seentics/seentics" target="_blank" className="hover:text-foreground transition-colors flex items-center gap-1.5"><Github className="h-3.5 w-3.5" />GitHub</Link></li>
              <li><Link href="https://discord.gg/eHNHR82add" target="_blank" className="hover:text-[#5865F2] transition-colors flex items-center gap-1.5"><FaDiscord className="h-3.5 w-3.5" />Discord</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground mb-4">Legal</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Notice</Link></li>
              <li><Link href="/refund-policy" className="hover:text-foreground transition-colors">Refund Policy</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground mb-4">Resources</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/blog" className="hover:text-foreground transition-colors">Blog</Link></li>
              <li><Link href="/websites/demo" className="hover:text-foreground transition-colors">Live Demo</Link></li>
              <li><Link href="https://github.com/Seentics/seentics/issues" target="_blank" className="hover:text-foreground transition-colors">Support</Link></li>
            </ul>
          </div>
        </div>

        {/* Just the copyright. Terms/Privacy/Refund and GitHub/Discord were all
            repeated here from the columns above — ten links, four of them duplicates. */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/40 pt-6 text-sm text-muted-foreground/60 md:flex-row">
          <p>&copy; {new Date().getFullYear()} Seentics. All rights reserved.</p>
          <p>Open source under AGPL-3.0.</p>
        </div>
      </div>
    </footer>
  );
}
