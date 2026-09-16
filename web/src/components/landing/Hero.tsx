import { Check, Github } from 'lucide-react';
import { HeroCTA } from './HeroCTA';

const HERO_TRUST = ['No credit card required', '100% open source', 'No cookies', 'Self-host in minutes'];

export default function Hero() {
  return (
    <section className="relative overflow-hidden pb-10 pt-28 md:pb-14 md:pt-36">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-primary/[0.02] to-transparent" />

      <div className="landing-container relative z-10">
        <div className="mx-auto mt-4 max-w-5xl text-center">

          <h1 className="mb-6">
            <span className="landing-h1 block">Understand your visitors.</span>
            <span className="landing-h1  mt-1 block">Then act — automatically.</span>
          </h1>

          <p className="landing-lead mx-auto mb-9 max-w-2xl">
            One privacy-first platform to measure traffic, find conversion problems,
            watch the sessions behind them and respond with no-code automations.
          </p>

          <div>
            <HeroCTA />
            <ul className="mx-auto grid w-fit gap-x-6 gap-y-2 text-left text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4 lg:text-[15px]">
              {HERO_TRUST.map((item) => (
                <li key={item} className="flex items-center gap-1.5 whitespace-nowrap">
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
