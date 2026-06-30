import { HeroCTA } from './HeroCTA';
import { HeroDashboardPreviewLazy } from './HeroDashboardPreviewLazy';

export default function Hero() {
  return (
    <section className="relative pt-32 pb-24 md:pt-44 md:pb-32 bg-muted/40 overflow-hidden">
      {/* Fade edge into page background */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-background" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="animate-in fade-in slide-in-from-bottom-3 duration-500 mb-6">
            <span className="block text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter text-foreground leading-[1.1]">
              See. Analyze. <span className="text-primary">Act.</span>
            </span>
          </h1>

          <p className="animate-in fade-in slide-in-from-bottom-3 duration-500 [animation-delay:80ms] text-xl text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed">
            Seentics gives you session replays, heatmaps, funnels and AI insights — with built-in automations to act on what you find. Self-hosted, open source, no cookies.
          </p>

          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 [animation-delay:150ms]">
            <HeroCTA />
          </div>

          {/* 3D Perspective Dashboard Preview — loaded lazily after first paint */}
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 [animation-delay:200ms] relative max-w-5xl mx-auto [perspective:1200px]">
            <div className="relative [transform:perspective(1200px)_rotateX(2deg)] origin-bottom">
              <HeroDashboardPreviewLazy />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
