import { Check } from 'lucide-react';
import { HeroCTA } from './HeroCTA';

const HERO_TRUST = ['No credit card required', '100% open source', 'No cookies', 'Self-host in minutes'];

export default function Hero() {
  return (
    // No bottom rhythm of its own: `ProductShowcase` sits directly underneath and the
    // two are one unit — the claim and the evidence for it.
    <section className="relative overflow-hidden pt-28 pb-12 md:pt-36 md:pb-16">
      {/* Soft wash behind the headline — on the white canvas a flat section reads
          as unfinished, so the colour comes from a tint rather than a fill. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-gradient-to-b from-primary/[0.06] via-primary/[0.02] to-transparent" />

      <div className="landing-container relative z-10">
        <div className="mx-auto max-w-5xl text-center">
          {/*
            Two blocks, not one wrapped line: at any width the two halves of the
            product — what it tells you, and what it does about it — each own a line.

            Emphasis is tonal, not coloured — see `.landing-accent`. The second
            clause steps down in lightness, which separates the two halves without
            putting a second hue inside one sentence, and leaves blue meaning only
            "you can click this".
          */}
          <h1 className="animate-in fade-in slide-in-from-bottom-3 mb-7 duration-500">
            <span className="landing-h1 block">Understand your visitors.</span>
            <span className="landing-h1 landing-accent block">Then act — automatically.</span>
          </h1>

          <p className="animate-in fade-in slide-in-from-bottom-3 landing-lead mx-auto mb-11 max-w-3xl duration-500 [animation-delay:80ms]">
            Traffic, funnels, session replay and heatmaps in one open-source platform —
            wired to automations that fire the moment a visitor does something worth
            answering.
          </p>

          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 [animation-delay:150ms]">
            <HeroCTA />
            <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[15px] text-muted-foreground">
              {HERO_TRUST.map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
