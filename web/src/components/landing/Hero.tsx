import { Sparkles } from 'lucide-react';
import { HeroCTA } from './HeroCTA';
import { HeroDashboardPreviewLazy } from './HeroDashboardPreviewLazy';

export default function Hero() {
  return (
    <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 bg-background overflow-hidden">
      {/* Dot pattern background */}
      <div className="absolute inset-0 [background-image:radial-gradient(hsl(var(--border)/0.4)_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,hsl(var(--background))_70%)]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/[0.07] rounded-full blur-[120px]" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/50 border border-border/60 text-xs font-medium text-muted-foreground mb-8">
            <Sparkles className="h-3 w-3 text-indigo-400" />
            <span className="text-indigo-400 font-semibold">AI-Powered</span>
            <span className="text-border">·</span>
            Open Source
            <span className="text-border">·</span>
            Self-Hosted
          </div>

          <h1 className="animate-in fade-in slide-in-from-bottom-3 duration-500 [animation-delay:50ms] mb-6">
            <span className="block text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.2]">
              <span className="text-primary">See.</span> <span className="text-primary">Analyze.</span> <span className="text-primary">Act.</span>
            </span>
          </h1>

          <p className="animate-in fade-in slide-in-from-bottom-3 duration-500 [animation-delay:100ms] text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Seentics gives you session replays, heatmaps, funnels and revenue tracking — then trigger popups, webhooks or API calls based on what your visitors do. Self-hosted, open source, no cookies.
          </p>

          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 [animation-delay:150ms]">
            <HeroCTA />
          </div>

          {/* 3D Perspective Dashboard Preview — loaded lazily after first paint */}
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 [animation-delay:200ms] relative max-w-5xl mx-auto [perspective:1200px]">
            <div className="absolute -inset-8 bg-primary/[0.04] rounded-3xl blur-3xl" />
            <div className="relative [transform:perspective(1200px)_rotateX(2deg)] origin-bottom">
              <HeroDashboardPreviewLazy />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
