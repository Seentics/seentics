import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { GROUPS, useCasesIn, type UseCase } from '@/lib/use-cases';
import { UseCaseIcon } from '@/components/use-cases/UseCaseIcon';

export const metadata = {
  title: 'Use cases · Seentics',
  description:
    'What you can do with Seentics: capture leads with popups and forms, recover leaving visitors, get more bookings, find why visitors do not convert, and measure campaign ROI.',
  alternates: { canonical: '/use-cases' },
};

function Card({ u }: { u: UseCase }) {
  return (
    <Link
      href={`/use-cases/${u.slug}`}
      className="group flex items-start gap-3.5 rounded-xl border border-border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
    >
      <UseCaseIcon useCase={u} size="md" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[15px] font-semibold text-foreground">
          {u.name}
          <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
        </span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">{u.summary}</span>
      </span>
    </Link>
  );
}

export default function UseCasesPage() {
  return (
    <div className="landing-container py-16 sm:py-20">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-muted-foreground">Use cases</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          What can you do with Seentics?
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Capture leads, recover leaving visitors, get more bookings, find why people do not convert and
          prove which campaigns pay. Pick the outcome you want: each page shows who it is for and how to
          set it up.
        </p>
      </div>

      {GROUPS.map((g) => (
        <section key={g.key} className="mt-14" aria-labelledby={`g-${g.key}`}>
          <h2 id={`g-${g.key}`} className="text-xl font-bold tracking-tight text-foreground">{g.title}</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">{g.blurb}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {useCasesIn(g.key).map((u) => <Card key={u.slug} u={u} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
