import { Logo } from '@/components/ui/logo';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-700 py-12 md:py-16 bg-white dark:bg-slate-950">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6 md:gap-8">
          <div className="sm:col-span-2 md:col-span-1">
            <div className="mb-4 md:mb-6">
              <Logo size="xl" showText={true} textClassName="text-lg md:text-xl font-bold text-slate-900 dark:text-white" className="gap-3" />
            </div>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed mb-4 md:mb-0">
              Get real-time insights into your website traffic while respecting user privacy. Lightweight, cookieless, and powerful analytics.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4 md:mb-6 text-slate-900 dark:text-white text-sm md:text-base">Product</h3>
            <ul className="space-y-2 md:space-y-3 text-sm md:text-base text-slate-600 dark:text-slate-300">
              <li><Link href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors">Features</Link></li>
              <li><Link href="#how-it-works" className="hover:text-slate-900 dark:hover:text-white transition-colors">How It Works</Link></li>
              <li><Link href="/docs" className="hover:text-slate-900 dark:hover:text-white transition-colors">Documentation</Link></li>
              <li><Link href="https://github.com/seentics/seentics" className="hover:text-slate-900 dark:hover:text-white transition-colors">GitHub</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4 md:mb-6 text-slate-900 dark:text-white text-sm md:text-base">Company</h3>
            <ul className="space-y-2 md:space-y-3 text-sm md:text-base text-slate-600 dark:text-slate-300">
              <li><Link href="/about" className="hover:text-slate-900 dark:hover:text-white transition-colors">About</Link></li>
              <li><Link href="/blog" className="hover:text-slate-900 dark:hover:text-white transition-colors">Blog</Link></li>
              <li><Link href="/careers" className="hover:text-slate-900 dark:hover:text-white transition-colors">Careers</Link></li>
              <li><Link href="/contact" className="hover:text-slate-900 dark:hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4 md:mb-6 text-slate-900 dark:text-white text-sm md:text-base">Support</h3>
            <ul className="space-y-2 md:space-y-3 text-sm md:text-base text-slate-600 dark:text-slate-300">
              <li><Link href="/help" className="hover:text-slate-900 dark:hover:text-white transition-colors">Help Center</Link></li>
              <li><Link href="/status" className="hover:text-slate-900 dark:hover:text-white transition-colors">Status</Link></li>
              <li><Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy</Link></li>
              <li><Link href="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 md:mb-6 text-slate-900 dark:text-white text-sm md:text-base">Compliance</h3>
            <ul className="space-y-2 md:space-y-3 text-sm md:text-base text-slate-600 dark:text-slate-300">
              <li><Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">GDPR/CCPA</Link></li>
              <li><Link href="/security" className="hover:text-slate-900 dark:hover:text-white transition-colors">Security</Link></li>
              <li><Link href="/compliance" className="hover:text-slate-900 dark:hover:text-white transition-colors">Compliance</Link></li>
              <li><Link href="/trust" className="hover:text-slate-900 dark:hover:text-white transition-colors">Trust Center</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-slate-200 dark:border-slate-700 mt-8 md:mt-12 pt-6 md:pt-8 text-center text-sm md:text-base text-slate-600 dark:text-slate-300">
          <p>&copy; 2024 Seentics. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
