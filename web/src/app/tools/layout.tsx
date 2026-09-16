import LandingHeader from '@/components/landing/LandingHeader';
import Footer from '@/components/landing/Footer';

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingHeader alwaysBordered />
      <main className="flex-1 pt-[72px] sm:pt-20">{children}</main>
      <Footer />
    </div>
  );
}
