import LandingHeader from '@/components/landing/LandingHeader';
import Footer from '@/components/landing/Footer';

export const metadata = {
  title: 'Blog | Seentics',
  description: 'Latest updates, guides, and insights about analytics and product tracking.',
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lx flex min-h-screen flex-col bg-background">
      <LandingHeader />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
