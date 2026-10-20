'use client';

import { Logo } from '@/components/ui/logo';
import { FaDiscord } from 'react-icons/fa';
import { Github } from 'lucide-react';
import Link from 'next/link';
import { isEnterprise } from '@/lib/features';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n';

export default function Footer() {
  /**
   * `#features` and friends only resolve on the home page. In the footer they were
   * bare hashes, so on /blog, /contact or /docs they scrolled nowhere — the header
   * has had this helper for a while and the footer never got it.
   */
  const pathname = usePathname();
  const t = useT();
  const anchor = (hash: string) => (pathname === '/' ? hash : `/${hash}`);

  return (
    <footer className="border-t border-border py-16 bg-background dark:border-border/40">
      <div className="landing-container">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <div className="mb-4">
              <Logo size="lg" showText={true} textClassName="text-lg font-semibold text-foreground" className="gap-2.5" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {t.footer.tagline}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground mb-4">{t.footer.product}</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href={anchor('#why')} className="hover:text-foreground transition-colors">{t.footer.products}</Link></li>
              <li><Link href={anchor('#pricing')} className="hover:text-foreground transition-colors">{t.footer.pricing}</Link></li>
              <li><Link href="/docs" className="hover:text-foreground transition-colors">{t.footer.docs}</Link></li>
              <li><Link href={anchor('#faq')} className="hover:text-foreground transition-colors">{t.footer.faq}</Link></li>
            </ul>
          </div>

          {/* Cloud only: a self-hosted install has no Agency plan (/agencies is not built there). */}
          {isEnterprise && (
          <div>
            <h3 className="text-sm font-medium text-foreground mb-4">{t.footer.agencies}</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/agencies" className="hover:text-foreground transition-colors">{t.footer.forAgencies}</Link></li>
              <li><Link href="/agency?demo=1" className="hover:text-foreground transition-colors">{t.footer.agencyDemo}</Link></li>
              <li><Link href="/docs/agency/api" className="hover:text-foreground transition-colors">{t.footer.agencyApi}</Link></li>
            </ul>
          </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-foreground mb-4">{t.footer.company}</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/contact" className="hover:text-foreground transition-colors">{t.footer.contact}</Link></li>
              <li><Link href="https://github.com/Seentics/seentics" target="_blank" className="hover:text-foreground transition-colors flex items-center gap-1.5"><Github className="h-3.5 w-3.5" />GitHub</Link></li>
              <li><Link href="https://discord.gg/eHNHR82add" target="_blank" className="hover:text-[#5865F2] transition-colors flex items-center gap-1.5"><FaDiscord className="h-3.5 w-3.5" />Discord</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground mb-4">{t.footer.legal}</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/terms" className="hover:text-foreground transition-colors">{t.footer.terms}</Link></li>
              <li><Link href="/privacy" className="hover:text-foreground transition-colors">{t.footer.privacy}</Link></li>
              <li><Link href="/dpa" className="hover:text-foreground transition-colors">{t.footer.dpa}</Link></li>
              <li><Link href="/subprocessors" className="hover:text-foreground transition-colors">{t.footer.subprocessors}</Link></li>
              <li><Link href="/refund-policy" className="hover:text-foreground transition-colors">{t.footer.refunds}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground mb-4">{t.footer.resources}</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/blog" className="hover:text-foreground transition-colors">{t.footer.blog}</Link></li>
              <li><Link href="/websites/demo" className="hover:text-foreground transition-colors">{t.footer.liveDemo}</Link></li>
              <li><Link href="/tools/page-speed-test" className="hover:text-foreground transition-colors">{t.footer.speedTest}</Link></li>
              <li><Link href="https://github.com/Seentics/seentics/issues" target="_blank" className="hover:text-foreground transition-colors">{t.footer.support}</Link></li>
            </ul>
          </div>
        </div>

        {/* Just the copyright. Terms/Privacy/Refund and GitHub/Discord were all
            repeated here from the columns above — ten links, four of them duplicates. */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/40 pt-6 text-sm text-muted-foreground/60 md:flex-row">
          <p>{t.footer.rights(new Date().getFullYear())}</p>
          <div className="flex items-center gap-4">
            <p>{t.footer.openSource}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
