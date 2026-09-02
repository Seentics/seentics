import { Star, GitBranch, ShieldCheck, Server, Cookie } from 'lucide-react';
import Link from 'next/link';

const GITHUB_REPO = 'Seentics/seentics';

/** Live star count from the GitHub API, cached for an hour. Falls back to null on any error. */
async function getGitHubStars(): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: number };
    return typeof data.stargazers_count === 'number' ? data.stargazers_count : null;
  } catch {
    return null;
  }
}

function formatStars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);
}

const TRUST_ITEMS = [
  // AGPL-3.0, not MIT. Only the ui/blocks package (@seentics/ui) is MIT, and
  // claiming MIT for the platform on a public page misstates the licence.
  { icon: GitBranch, label: 'AGPL-3.0' },
  { icon: ShieldCheck, label: 'GDPR-ready' },
  { icon: Cookie, label: 'No cookies' },
  { icon: Server, label: 'Self-hostable' },
];

export default async function SocialProof() {
  const stars = await getGitHubStars();

  return (
    <section className="border-y border-border bg-muted/50 py-6 dark:border-border/40 dark:bg-muted/20">
      <div className="landing-container">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm">
          <Link
            href={`https://github.com/${GITHUB_REPO}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span>Star on GitHub</span>
            {stars != null && (
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-bold tabular-nums text-muted-foreground group-hover:text-primary dark:border-transparent">
                {formatStars(stars)}
              </span>
            )}
          </Link>

          <span className="hidden h-4 w-px bg-border sm:block" />

          {TRUST_ITEMS.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
              <item.icon className="h-4 w-4 text-emerald-500" />
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
