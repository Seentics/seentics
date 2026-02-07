import { Logo } from '@/components/ui/logo';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-border/40 py-20 bg-muted/50">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-12">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-6">
              <Logo size="lg" showText={true} textClassName="text-lg font-bold text-foreground" className="gap-2.5" />
            </div>
            <p className="text-sm text-muted-foreground/80 leading-relaxed max-w-xs">
              Privacy-first analytics that helps you grow. Cookieless, lightning-fast, and easy to use.
            </p>
          </div>
          
          <div>
            <h3 className="font-bold mb-6 text-foreground text-xs uppercase tracking-widest">Product</h3>
            <ul className="space-y-4 text-sm text-muted-foreground font-medium">
              <li><Link href="#features" className="hover:text-primary transition-colors">Features</Link></li>
              <li><Link href="#automations" className="hover:text-primary transition-colors">Automations</Link></li>
              <li><Link href="#pricing" className="hover:text-primary transition-colors">Pricing</Link></li>
              <li><Link href="#faq" className="hover:text-primary transition-colors">FAQ</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-bold mb-6 text-foreground text-xs uppercase tracking-widest">Company</h3>
            <ul className="space-y-4 text-sm text-muted-foreground font-medium">
              <li><Link href="/about" className="hover:text-primary transition-colors">About</Link></li>
              <li><Link href="/blog" className="hover:text-primary transition-colors">Blog</Link></li>
              <li><Link href="/contact" className="hover:text-primary transition-colors">Contact</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-bold mb-6 text-foreground text-xs uppercase tracking-widest">Legal</h3>
            <ul className="space-y-4 text-sm text-muted-foreground font-medium">
              <li><Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-primary transition-colors">Privacy Notice</Link></li>
              <li><Link href="/refund-policy" className="hover:text-primary transition-colors">Refund Policy</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold mb-6 text-foreground text-xs uppercase tracking-widest">Support</h3>
            <ul className="space-y-4 text-sm text-muted-foreground font-medium">
              <li><Link href="/help" className="hover:text-primary transition-colors">Help Center</Link></li>
              <li><Link href="/status" className="hover:text-primary transition-colors">System Status</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-border/40 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center gap-6 text-[13px] text-muted-foreground/60 font-medium tracking-tight">
          <p>&copy; {new Date().getFullYear()} Seentics. All rights reserved.</p>
          <div className="flex items-center gap-8">
            <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link href="/refund-policy" className="hover:text-primary transition-colors">Refund</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
