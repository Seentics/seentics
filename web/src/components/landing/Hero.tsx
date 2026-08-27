import { Check } from 'lucide-react';
import { HeroCTA } from './HeroCTA';
import HeroPreviewStack from './HeroPreviewStack';

const HERO_TRUST = ['No credit card required', '100% open source', 'No cookies', 'Self-host in minutes'];

export default function Hero() {
  return (
    <section className="relative pt-32 pb-24 md:pt-44 md:pb-32  overflow-hidden">
      {/* Soft wash behind the headline — on the white canvas a flat section reads
          as unfinished, so the colour comes from a tint rather than a fill. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-gradient-to-b from-primary/[0.06] via-primary/[0.02] to-transparent" />
      {/* Fade edge into page background */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-background" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="animate-in fade-in slide-in-from-bottom-3 duration-500 mb-6">
            {/* Two blocks, not one wrapped line: at the smaller type size the
                sentences ran together mid-line ("…Behavior Take / automated action"),
                so each clause owns its own line at every width. */}
            <span className="landing-h1 block">Understand Users Behavior</span>
            <span className="landing-h1 block text-primary">Take automated action.</span>
          </h1>

          <p className="animate-in fade-in slide-in-from-bottom-3 duration-500 [animation-delay:80ms] landing-lead max-w-3xl mx-auto mb-10">
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
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 [animation-delay:200ms] relative mt-16 max-w-[1600px] mx-auto">
          <HeroPreviewStack />
        </div>
      </div>
    </section>
  );
}
