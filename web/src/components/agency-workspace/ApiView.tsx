'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { curlExample, nodeExample, QUICK_START } from '@/features/agency/agency-api-docs';
import { AGENCY_API, AGENCY_API_BASE, AGENCY_API_GROUPS, AGENCY_ERROR_CODES, type AgencyEndpoint, type SpecField } from '@/features/agency/agency-api-spec';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { CodeBlock, Panel, Pill, WorkspacePage } from './ui';
import { useHomeWebsite } from './use-home-website';

type Lang = 'curl' | 'node';

const METHOD_TONE: Record<AgencyEndpoint['method'], string> = {
  GET: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  POST: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  PUT: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  PATCH: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  DELETE: 'bg-destructive/10 text-destructive',
};

function LangTabs({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  const t = useT().agency.api;
  return (
    <div role="tablist" aria-label={t.language} className="inline-flex rounded-md border border-border p-0.5">
      {(['curl', 'node'] as const).map(l => (
        <button key={l} type="button" role="tab" aria-selected={lang === l} onClick={() => onChange(l)}
          className={cn('rounded px-2.5 py-1 text-xs font-medium', lang === l ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
          {l === 'curl' ? 'curl' : 'Node'}
        </button>
      ))}
    </div>
  );
}

const example = (ep: AgencyEndpoint, lang: Lang) => (lang === 'curl' ? curlExample(ep) : nodeExample(ep));

function Fields({ title, fields }: { title: string; fields?: SpecField[] }) {
  const t = useT().agency.api;
  if (!fields?.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{title}</p>
      <dl className="divide-y divide-border rounded-md border border-border text-xs">
        {fields.map(f => (
          <div key={f.name} className="grid gap-1 px-3 py-2 sm:grid-cols-[180px_minmax(0,1fr)]">
            <dt className="font-mono text-foreground">
              {f.name}{f.required && <span className="ml-1 text-destructive" title={t.required}>*</span>}
              <span className="ml-2 text-muted-foreground">{f.type}</span>
            </dt>
            <dd className="text-muted-foreground">{f.description}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Endpoint({ ep, lang }: { ep: AgencyEndpoint; lang: Lang }) {
  const t = useT().agency.api;
  return (
    <details id={ep.id} data-testid={`endpoint-${ep.id}`} className="group border-b border-border last:border-0">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 hover:bg-muted/35">
        <span className={cn('w-14 rounded px-1.5 py-0.5 text-center font-mono text-[10.5px] font-bold', METHOD_TONE[ep.method])}>{ep.method}</span>
        <code className="font-mono text-xs text-foreground">{ep.path}</code>
        <span className="text-xs text-muted-foreground">{ep.summary}</span>
        <span className="ml-auto"><Pill tone={ep['x-scope'] === 'agency:read' ? 'muted' : 'blue'}>{ep['x-scope']}</Pill></span>
      </summary>
      <div className="space-y-4 px-4 pb-4">
        {ep.description && <p className="text-xs text-muted-foreground">{ep.description}</p>}
        <Fields title={t.pathParams} fields={ep.pathParams} />
        <Fields title={t.query} fields={ep.query} />
        <Fields title={t.body} fields={ep.body} />
        {ep.requestExample !== undefined && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{t.requestExample}</p>
            <CodeBlock code={JSON.stringify(ep.requestExample, null, 2)} label={t.copyRequest} />
          </div>
        )}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{t.response(ep.status ?? 200)}</p>
          {ep.responseExample === null
            ? <p className="text-xs text-muted-foreground">{t.noBody}</p>
            : <CodeBlock code={JSON.stringify(ep.responseExample, null, 2)} label={t.copyResponse} />}
        </div>
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{lang === 'curl' ? 'curl' : 'Node'}</p>
          <CodeBlock code={example(ep, lang)} label={t.copyExample} />
        </div>
      </div>
    </details>
  );
}

export function ApiView() {
  const t = useT().agency.api;
  const [lang, setLang] = useState<Lang>('curl');
  const home = useHomeWebsite();
  // The Developers page opens a new key on the Agency API preset (agency:read + agency:write).
  const keysHref = home ? `/websites/${home}/developers?new=agency` : '/websites';

  return (
    <WorkspacePage
      title={t.title}
      description={t.description}
      actions={<LangTabs lang={lang} onChange={setLang} />}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={t.authentication} data-testid="api-auth">
          <div className="space-y-3 text-xs text-muted-foreground">
            <p>
              {t.authSend} <code className="font-mono text-foreground">X-API-Key</code> {t.authHeaderTo}{' '}
              <code className="font-mono text-foreground">{AGENCY_API_BASE}</code>{t.authReads}{' '}
              <code className="font-mono text-foreground">agency:read</code> {t.authScopeElse}{' '}
              <code className="font-mono text-foreground">agency:write</code>.
            </p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>{t.authStep1Before} <strong className="text-foreground">{t.authStep1Tab}</strong> {t.authStep1Middle} <strong className="text-foreground">{t.authStep1Button}</strong>.</li>
              <li>{t.authStep2Before} <strong className="text-foreground">{t.authStep2Preset}</strong> {t.authStep2Middle} <code className="font-mono text-foreground">agency:read</code> {t.and} <code className="font-mono text-foreground">agency:write</code>{t.authStep2After}</li>
              <li>{t.authStep3}</li>
            </ol>
            <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
              <Link href={keysHref}><KeyRound className="h-3.5 w-3.5" />{t.createKey}<ArrowUpRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>
        </Panel>
        <Panel title={t.conventions}>
          <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted-foreground">
            <li>{t.convSuccess} <code className="font-mono text-foreground">{'{ data }'}</code>{t.convListsAdd} <code className="font-mono text-foreground">{'page: { next_cursor, has_more }'}</code>.</li>
            <li>{t.convPaginate} <code className="font-mono text-foreground">?limit=</code> {t.convUpTo} <code className="font-mono text-foreground">?cursor=</code>.</li>
            <li>{t.convIdemSend} <code className="font-mono text-foreground">Idempotency-Key</code> {t.convIdemRest} <code className="font-mono text-foreground">Idempotent-Replayed: true</code>.</li>
            <li>{t.convErrors} <code className="font-mono text-foreground">{'{ error: { code, message, details?, request_id } }'}</code>.</li>
            <li>{t.convLimits}</li>
          </ul>
        </Panel>
      </div>

      <Panel title={t.quickStart} description={t.quickStartBody} className="mt-5" data-testid="api-quick-start">
        <p className="mb-4 text-xs text-muted-foreground">
          {t.quickFirst} <Link href={keysHref} className="font-medium text-foreground underline underline-offset-2">{t.quickCreateKey}</Link>{' '}
          (<code className="font-mono text-foreground">agency:read</code> + <code className="font-mono text-foreground">agency:write</code>) {t.quickRest} <code className="font-mono text-foreground">X-API-Key</code>.
        </p>
        <ol className="space-y-4">
          {QUICK_START.map((step, i) => (
            <li key={step.endpoint.id} className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">{i + 1}. {step.title}</p>
              <CodeBlock code={example(step.endpoint, lang)} label={t.copyStep(i + 1)} />
            </li>
          ))}
        </ol>
      </Panel>

      <div className="mt-5 space-y-5" data-testid="api-reference">
        {AGENCY_API_GROUPS.map(group => (
          <Panel key={group} title={group} bodyClassName="p-0">
            {AGENCY_API.filter(e => e.group === group).map(ep => <Endpoint key={ep.id} ep={ep} lang={lang} />)}
          </Panel>
        ))}
        <Panel title={t.errorCodes} bodyClassName="p-0">
          <dl className="divide-y divide-border text-xs">
            {AGENCY_ERROR_CODES.map(e => (
              <div key={e.code} className="grid gap-1 px-4 py-2 sm:grid-cols-[220px_minmax(0,1fr)]">
                <dt className="font-mono text-foreground">{e.status} {e.code}</dt>
                <dd className="text-muted-foreground">{e.meaning}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </WorkspacePage>
  );
}
