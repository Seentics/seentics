'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { Settings, Users, CreditCard, LifeBuoy, BookOpen, ExternalLink, Github, Twitter } from 'lucide-react';
import { TeamModal } from './modals/TeamModal';
import { BillingModal } from './modals/BillingModal';
import { SettingsModal } from './modals/SettingsModal';
import { DocsModal } from './modals/DocsModal';
import { SupportModal } from './modals/SupportModal';

export function DashboardFooter() {
  const [activeModal, setActiveModal] = useState<'team' | 'billing' | 'settings' | 'docs' | 'support' | null>(null);

  const openModal = (modal: 'team' | 'billing' | 'settings' | 'docs' | 'support') => {
    setActiveModal(modal);
  };

  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-12 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 rounded-t-xl overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-1">
            <Link href="/" className="flex items-center mb-4">
              <Logo size="md" showText={true} textClassName="font-headline text-xl font-bold" />
            </Link>
            <p className="text-sm text-muted-foreground mt-4 max-w-xs">
              Privacy-first analytics and powerful website workflows to help you grow your online presence with confidence.
            </p>
            <div className="flex space-x-4 mt-6">
                 <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                    <Github className="h-5 w-5" />
                 </a>
                 <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                    <Twitter className="h-5 w-5" />
                 </a>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Product</h3>
            <ul className="space-y-3">
              <li>
                <button onClick={() => openModal('billing')} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-2 transition-colors">
                   <CreditCard className="h-4 w-4" /> Billing
                </button>
              </li>
              <li>
                <button onClick={() => openModal('team')} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-2 transition-colors">
                   <Users className="h-4 w-4" /> Team
                </button>
              </li>
              <li>
                <button onClick={() => openModal('settings')} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-2 transition-colors">
                   <Settings className="h-4 w-4" /> Settings
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Support</h3>
            <ul className="space-y-3">
              <li>
                <button onClick={() => openModal('docs')} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-2 transition-colors">
                   <BookOpen className="h-4 w-4" /> Documentation
                </button>
              </li>
              <li>
                <button onClick={() => openModal('support')} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-2 transition-colors">
                   <LifeBuoy className="h-4 w-4" /> Support
                </button>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-2 transition-colors">
                   <ExternalLink className="h-4 w-4" /> Status
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Company</h3>
            <ul className="space-y-3">
              <li><Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">Terms of Service</Link></li>
              <li><Link href="/contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">Contact Us</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-muted-foreground text-center">
            &copy; {currentYear} Seentics. All rights reserved. Built with privacy in mind.
          </p>
        </div>
      </div>

      {/* Footer Modals */}
      <TeamModal isOpen={activeModal === 'team'} onClose={() => setActiveModal(null)} />
      <BillingModal isOpen={activeModal === 'billing'} onClose={() => setActiveModal(null)} />
      <SettingsModal isOpen={activeModal === 'settings'} onClose={() => setActiveModal(null)} />
      <DocsModal isOpen={activeModal === 'docs'} onClose={() => setActiveModal(null)} />
      <SupportModal isOpen={activeModal === 'support'} onClose={() => setActiveModal(null)} />
    </footer>
  );
}
