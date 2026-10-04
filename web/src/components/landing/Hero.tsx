import { Check, Github } from 'lucide-react';
import { HeroCTA } from './HeroCTA';

const HERO_TRUST = ['No credit card required', 'Open-source analytics core', 'No cookies', 'Self-host in minutes'];

export default function Hero() {
  return (
    <section className="relative overflow-hidden pb-10 pt-28 md:pb-14 md:pt-36">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-primary/[0.02] to-transparent" />

      <div className="landing-container relative z-10">
        <div className="mx-auto mt-4 max-w-5xl text-center">

          <h1 className="mx-auto mb-5 max-w-4xl text-balance text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            See everything happening <span className="text-primary">on your website.</span>
          </h1>

          <p className="landing-lead mx-auto mb-9 max-w-4xl text-balance">
            Track visitors, replay sessions, collect logs and traces, monitor uptime and trigger
            automations in one <span className="whitespace-nowrap">privacy-first</span> platform.
            Start with analytics and add the rest when you need it.
          </p>

          <div>
            <HeroCTA />
            <ul className="mx-auto text-xs lg:text-sm w-fit gap-x-6 gap-y-2 text-left text-muted-foreground flex items-center justify-center mt-6 md:mt-8 md:grid-cols-2">
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
