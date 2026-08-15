import { Check } from 'lucide-react';
import { HeroCTA } from './HeroCTA';
import HeroPreviewStack from './HeroPreviewStack';

const HERO_TRUST = ['No credit card required', '100% open source', 'No cookies', 'Self-host in minutes'];

export default function Hero() {
  return (
    <section className="relative pt-32 pb-24 md:pt-44 md:pb-32 bg-muted/40 overflow-hidden">
      {/* Fade edge into page background */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-background" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="animate-in fade-in slide-in-from-bottom-3 duration-500 mb-6">
            <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tighter text-foreground leading-[1.1]">
              Understand Users Behavior  <span className="text-primary">Take automated action.</span>
            </span>
          </h1>

          <p className="animate-in fade-in slide-in-from-bottom-3 duration-500 [animation-delay:80ms] text-xl text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed">
            Seentics gives you the analytics to understand your users and the automation to act on what you discover—all in one open-source platform.
          </p>

          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 [animation-delay:150ms]">
            <HeroCTA />
            <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {HERO_TRUST.map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Product preview — full-width section, three squared mocks side by side */}
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 [animation-delay:200ms] relative mt-16 max-w-7xl mx-auto">
          <HeroPreviewStack />
        </div>
      </div>
    </section>
  );
}
