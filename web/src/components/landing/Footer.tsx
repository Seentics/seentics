import { Logo } from '@/components/ui/logo';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-border/40 py-16 bg-background">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4">
              <Logo size="lg" showText={true} textClassName="text-lg font-semibold text-foreground" className="gap-2.5" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Privacy-first analytics that helps you grow. Cookieless, fast, and easy to use.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground mb-4">Product</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="#features" className="hover:text-foreground transition-colors">Features</Link></li>
              <li><Link href="#automations" className="hover:text-foreground transition-colors">Automations</Link></li>
              <li><Link href="#pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
              <li><Link href="#faq" className="hover:text-foreground transition-colors">FAQ</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground mb-4">Company</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/about" className="hover:text-foreground transition-colors">About</Link></li>
              <li><Link href="/blog" className="hover:text-foreground transition-colors">Blog</Link></li>
              <li><Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link></li>
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
            <h3 className="text-sm font-medium text-foreground mb-4">Support</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/help" className="hover:text-foreground transition-colors">Help Center</Link></li>
              <li><Link href="/status" className="hover:text-foreground transition-colors">System Status</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/40 mt-12 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground/60">
          <p>&copy; {new Date().getFullYear()} Seentics. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/refund-policy" className="hover:text-foreground transition-colors">Refund</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
