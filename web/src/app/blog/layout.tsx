import { LandingHeader } from '@/components/landing/LandingHeader';
import { Footer } from '@/components/landing/Footer';

export const metadata = {
  title: 'Blog | Seentics',
  description: 'Latest updates, guides, and insights about analytics and product tracking.',
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <LandingHeader />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
