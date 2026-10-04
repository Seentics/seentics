'use client';

import { C, CodeBlock, DocSection, P, RefTable, Ul, Li } from '@/components/docs/DocsKit';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DEPLOY_GUIDES,
  IDENTITY_ROWS,
  NAMING_PITFALLS,
  SDK_GUIDES,
  type SdkGuide,
} from '@/components/docs/observability-content';

/** The sections of one SDK's guide, in the order you follow them. */
export function SdkGuideBody({ id }: { id: SdkGuide['id'] }) {
  const guide = SDK_GUIDES.find((g) => g.id === id)!;
  return (
    <>
      <DocSection>
        <p className="font-mono text-[14px] text-foreground">{guide.pkg}</p>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{guide.requires}</p>
        <P>{guide.summary}</P>
      </DocSection>
      {guide.steps.map((step) => (
        <DocSection key={step.title} title={step.title}>
          {step.body && <P>{step.body}</P>}
          {step.snippets?.map((snippet, index) => (
            <CodeBlock
              key={`${snippet.filename ?? ''}${index}`}
              code={snippet.code}
              language={snippet.language}
              filename={snippet.filename}
            />
          ))}
        </DocSection>
      ))}
    </>
  );
}

/** What identifies a project, service and server, and how to set each where the app runs. */
export function NamingSection() {
  return (
    <>
      <DocSection title="Services, servers and the ingest key">
        <P>
          One ingest key covers a whole project, so the key does not say which service or server a
          record came from. Each SDK stamps that on every log, span and metric — you only set the
          names.
        </P>
        <RefTable
          columns={['Identifies', 'Set by', 'If you don’t set it']}
          rows={IDENTITY_ROWS.map((row) => [row.what, row.setBy, row.fallback])}
        />
      </DocSection>

      <DocSection title="Set it where your app runs">
        <Tabs defaultValue={DEPLOY_GUIDES[0].id}>
          <TabsList>
            {DEPLOY_GUIDES.map((guide) => (
              <TabsTrigger key={guide.id} value={guide.id}>
                {guide.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {DEPLOY_GUIDES.map((guide) => (
            <TabsContent key={guide.id} value={guide.id} className="mt-4 space-y-4">
              <P>{guide.body}</P>
              {guide.snippets.map((snippet, index) => (
                <CodeBlock
                  key={`${snippet.filename ?? ''}${index}`}
                  code={snippet.code}
                  language={snippet.language}
                  filename={snippet.filename}
                />
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </DocSection>

      <DocSection title="Avoid merged data">
        <Ul>
          {NAMING_PITFALLS.map((line) => (
            <Li key={line}>{line}</Li>
          ))}
        </Ul>
        <P>
          Host and process metrics are on by default in the Node and Go SDKs. Run the SDK or the
          host agent on a machine, not both, or its CPU and memory are counted twice — turn the SDK’s
          off with <C>SEENTICS_HOST_METRICS_ENABLED=false</C> (Node) or{' '}
          <C>SEENTICS_HOST_METRICS=false</C> (Go).
        </P>
      </DocSection>
    </>
  );
}
