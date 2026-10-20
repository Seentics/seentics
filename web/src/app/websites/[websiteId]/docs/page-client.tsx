'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useState } from 'react';
import Link from 'next/link';

import { ReportPage } from '@/components/ui/linear-list';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Copy, Check, Zap, Code2, ArrowUpRight, Loader2 } from 'lucide-react';
import { SDK_GUIDES, type SdkGuide } from '@/components/docs/observability-content';
import { useApiCatalogue } from '@/features/api-keys/queries';
import { config } from '@/lib/config';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Code block with copy button
// ---------------------------------------------------------------------------
function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group">
      <pre className="bg-muted/60 border border-border rounded-lg px-4 py-3 overflow-x-auto text-[12px] leading-relaxed font-mono text-foreground/90 whitespace-pre">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded-lg bg-background border border-border text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section heading
// ---------------------------------------------------------------------------
function Section({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="h-4 w-4 text-primary" />}
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

const Mono = ({ children }: { children: React.ReactNode }) => (
  <code className="font-mono bg-muted px-1 rounded-lg text-foreground">{children}</code>
);

// ---------------------------------------------------------------------------
// Snippets
//
// Taken from the public Observability guides (components/docs/observability-content.ts),
// which are copied from the SDKs themselves (sdks/node, sdks/go, sdks/python), so this
// page cannot show an install command or API that the packages do not have. Every guide
// starts with "Install" then "Set up"; the rest lives in the full guide.
// ---------------------------------------------------------------------------
const snippetsOf = (guide: SdkGuide, step: number) => guide.steps[step]?.snippets ?? [];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function DocsPage() {
  const params = { websiteId: usePathSegment(1) ?? '' };
  const websiteId = params?.websiteId as string;
  const [tab, setTab] = useState<SdkGuide['id']>('node');
  const guide = SDK_GUIDES.find(g => g.id === tab) ?? SDK_GUIDES[0];
  const d = useT().developers.sdkDocs;
  // The Data API's endpoint list comes from the server's own catalogue (public, no key
  // needed), so it can't drift from the router the way a hand-written table did.
  const { data: catalogue, isLoading, isError } = useApiCatalogue();
  const developersHref = (tabId: string) => `/websites/${websiteId}/developers?tab=${tabId}`;

  return (
    <ReportPage
      title={d.title}
      description={d.description}
      websiteId={websiteId}
      width="max-w-[900px]"
    >

      {/* SDK tabs */}
      <div className="flex items-center gap-1 mb-8 bg-muted/40 border border-border rounded-lg p-1 w-fit">
        {SDK_GUIDES.map(g => (
          <button
            key={g.id}
            onClick={() => setTab(g.id)}
            className={cn(
              'px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors',
              tab === g.id
                ? 'bg-background text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Keys callout: the SDKs and the Data API use two different keys */}
      <Card className="border border-primary/20 bg-primary/5 mb-8">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Code2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-foreground">{d.credentials}</p>
              <p className="text-muted-foreground">
                {d.projectId} <code className="font-mono bg-muted px-1.5 py-0.5 rounded-lg text-foreground">{websiteId}</code>
              </p>
              <p className="text-muted-foreground">
                {d.ingestKeyBefore}{' '}
                <a href={`${config.observeUrl}/projects/${websiteId}`} className="font-semibold text-foreground hover:underline">
                  {d.ingestKeyPlace}
                </a>
                {d.ingestKeyAfter}
              </p>
              <p className="text-muted-foreground">
                {d.apiKeyBefore}{' '}
                <Link href={developersHref('api-keys')} className="font-semibold text-foreground hover:underline">
                  {d.apiKeyPlace}
                </Link>
                {d.apiKeyAfter}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Installation */}
      <Section title={d.installation} icon={Zap}>
        <p className="text-xs text-muted-foreground">
          <Mono>{guide.pkg}</Mono> · {guide.requires}
        </p>
        {snippetsOf(guide, 0).map((s, i) => (
          <div key={i} className="space-y-1">
            {s.filename && <p className="text-[11px] text-muted-foreground">{s.filename}</p>}
            <CodeBlock code={s.code} />
          </div>
        ))}
      </Section>

      {/* Set up */}
      <Section title={d.setup} icon={Code2}>
        {snippetsOf(guide, 1).map((s, i) => (
          <div key={i} className="space-y-1">
            {s.filename && <p className="text-[11px] text-muted-foreground">{s.filename}</p>}
            <CodeBlock code={s.code} />
          </div>
        ))}
        <Link
          href={`/docs/observability/${guide.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          {d.fullGuide.replace('{sdk}', guide.label)}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </Section>

      {/* Data API */}
      <Section title={d.apiReference} icon={BookOpen}>
        <p className="text-xs text-muted-foreground">
          {d.apiIntro} <Mono>{catalogue?.meta.base_path ?? '/api/v1/raw'}</Mono>.
        </p>
        <Card className="border border-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : isError || !catalogue ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">{d.catalogueFailed}</p>
            ) : (
              catalogue.data.map(r => (
                <div key={r.path} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0">
                  <Badge
                    variant="outline"
                    className="text-[10px] w-12 justify-center shrink-0 font-mono border-green-400/60 text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-300"
                  >
                    {r.method}
                  </Badge>
                  <code className="text-[11px] font-mono text-foreground flex-1 min-w-0 truncate">
                    {r.path.replace(':website_id', websiteId || ':website_id')}
                  </code>
                  <span className="text-xs text-muted-foreground hidden md:block shrink-0 max-w-[260px] truncate" title={r.summary}>{r.summary}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground mt-3">
          {d.authBefore} <Mono>X-API-Key: &lt;apiKey&gt;</Mono> {d.authAfter}
          {' '}{d.referenceBefore}{' '}
          <Link href={developersHref('data-api')} className="font-semibold text-foreground hover:underline">
            {d.referencePlace}
          </Link>
          {d.referenceAfter}
        </p>
        <p className="text-xs text-muted-foreground">
          {d.trackerBefore} <Mono>POST /api/v1/tracker/collect</Mono> {d.trackerMiddle} <Mono>seentics.track()</Mono>{d.trackerAfter}
        </p>
      </Section>
    </ReportPage>
  );
}
