import { Logo } from '@/components/ui/logo';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-border py-24 bg-transparent">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-8 md:gap-12">
          <div className="sm:col-span-2 md:col-span-1">
            <div className="mb-6">
              <Logo size="xl" showText={true} textClassName="text-xl font-bold text-foreground" className="gap-3" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Get real-time insights into your website traffic while respecting user privacy. Lightweight, cookieless, and powerful analytics.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-6 text-foreground text-sm uppercase tracking-wider">Product</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="#features" className="hover:text-primary transition-colors">Features</Link></li>
              <li><Link href="#how-it-works" className="hover:text-primary transition-colors">How It Works</Link></li>
              <li><Link href="/docs" className="hover:text-primary transition-colors">Documentation</Link></li>
              <li><Link href="https://github.com/seentics/seentics" className="hover:text-primary transition-colors">GitHub</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-6 text-foreground text-sm uppercase tracking-wider">Company</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/about" className="hover:text-primary transition-colors">About</Link></li>
              <li><Link href="/blog" className="hover:text-primary transition-colors">Blog</Link></li>
              <li><Link href="/careers" className="hover:text-primary transition-colors">Careers</Link></li>
              <li><Link href="/contact" className="hover:text-primary transition-colors">Contact</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-6 text-foreground text-sm uppercase tracking-wider">Legal</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-primary transition-colors">Privacy Notice</Link></li>
              <li><Link href="/refund-policy" className="hover:text-primary transition-colors">Refund Policy</Link></li>
              <li><Link href="/security" className="hover:text-primary transition-colors">Security</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-6 text-foreground text-sm uppercase tracking-wider">Support</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/help" className="hover:text-primary transition-colors">Help Center</Link></li>
              <li><Link href="/status" className="hover:text-primary transition-colors">Status</Link></li>
              <li><Link href="/compliance" className="hover:text-primary transition-colors">Compliance</Link></li>
              <li><Link href="/trust" className="hover:text-primary transition-colors">Trust Center</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Seentics. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link href="/refund-policy" className="hover:text-primary transition-colors">Refund</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
