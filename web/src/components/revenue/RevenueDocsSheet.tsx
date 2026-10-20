'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, Check, Copy, CircleCheck, TriangleAlert } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useT } from '@/lib/i18n';
import type { Rich } from '@/lib/i18n/messages/revenue-en';

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const t = useT().revenue.docs;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(t.copied);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t.copyFailed);
    }
  };
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
        <span className="text-[11px] text-zinc-500">{label ?? 'JavaScript'}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 text-[11px] text-zinc-400 transition-colors hover:text-zinc-100"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? t.copied : t.copy}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-relaxed text-zinc-200">{code}</pre>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {children}
      </div>
    </li>
  );
}

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[13px] leading-relaxed text-muted-foreground">{children}</p>
);
const C = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground">{children}</code>
);

/** Text with inline code: every odd part is code (see `Rich` in revenue-en). */
const R = ({ parts }: { parts: Rich }) => (
  <>{parts.map((part, i) => (i % 2 ? <C key={i}>{part}</C> : part))}</>
);

type Need = 'required' | 'recommended' | 'optional';
const PROPS: Array<[name: 'value' | 'currency' | 'order_id' | 'product_name' | 'user_type' | 'items', type: string, need: Need]> = [
  ['value', 'number', 'required'],
  ['currency', 'string', 'optional'],
  ['order_id', 'string', 'recommended'],
  ['product_name', 'string', 'optional'],
  ['user_type', 'string', 'optional'],
  ['items', 'array', 'optional'],
];

export function RevenueDocsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT().revenue.docs;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            {t.title}
          </SheetTitle>
          <SheetDescription>{t.description}</SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="setup" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-5 mt-4 h-8 w-auto justify-start self-start bg-muted/60 p-0.5">
            <TabsTrigger value="setup" className="h-7 px-3 text-xs">{t.tabs.setup}</TabsTrigger>
            <TabsTrigger value="props" className="h-7 px-3 text-xs">{t.tabs.props}</TabsTrigger>
            <TabsTrigger value="counted" className="h-7 px-3 text-xs">{t.tabs.counted}</TabsTrigger>
            <TabsTrigger value="help" className="h-7 px-3 text-xs">{t.tabs.help}</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto p-5">
            {/* ── Set up ── */}
            <TabsContent value="setup" className="mt-0">
              <ol className="space-y-6">
                <Step n={1} title={t.step1}>
                  <P>{t.step1Body}</P>
                </Step>

                <Step n={2} title={t.step2}>
                  <P><R parts={t.step2Body} /></P>
                  <CodeBlock
                    code={`seentics.track('purchase', {
  value:    49.99,
  currency: 'USD',
  order_id: 'ORD-8821',
});`}
                  />
                </Step>

                <Step n={3} title={t.step3}>
                  <CodeBlock
                    code={`seentics.track('purchase', {
  value:        78.00,
  currency:     'EUR',
  order_id:     'ORD-5541',
  product_name: 'Starter bundle',
  user_type:    'new',
  items: [
    { name: 'T-shirt', sku: 'TSHIRT-M', qty: 2, price: 29.00 },
    { name: 'Cap',     sku: 'CAP-RED',  qty: 1, price: 20.00 },
  ],
});`}
                  />
                  <P><R parts={t.step3Body} /></P>
                </Step>

                <Step n={4} title={t.step4}>
                  <CodeBlock
                    code={`seentics.track('refund', {
  value:    49.99,
  currency: 'USD',
  order_id: 'ORD-8821',
});`}
                  />
                  <P><R parts={t.step4Body} /></P>
                </Step>

                <Step n={5} title={t.step5}>
                  <P>{t.step5Body}</P>
                  <CodeBlock
                    label="URL"
                    code={`https://yoursite.com/pricing?utm_source=newsletter&utm_medium=email&utm_campaign=spring-sale`}
                  />
                </Step>
              </ol>
            </TabsContent>

            {/* ── Properties ── */}
            <TabsContent value="props" className="mt-0 space-y-3">
              {PROPS.map(([name, type, req]) => (
                <div key={name} className="rounded-lg border border-border p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="font-mono text-[13px] font-semibold text-foreground">{name}</code>
                    <span className="text-[11px] text-sky-600 dark:text-sky-400">{type}</span>
                    <span
                      className={
                        req === 'required'
                          ? 'rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400'
                          : req === 'recommended'
                            ? 'rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400'
                            : 'rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground'
                      }
                    >
                      {t[req]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{t.props[name]}</p>
                </div>
              ))}
              <P><R parts={t.altNames} /></P>
            </TabsContent>

            {/* ── How it's counted ── */}
            <TabsContent value="counted" className="mt-0 space-y-5">
              <section className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">{t.creditTitle}</h4>
                <P>{t.creditIntro}</P>
                <ol className="space-y-1.5 text-[13px] text-muted-foreground">
                  {t.credit.map((line, i) => (
                    <li key={i} className="flex gap-2"><span className="font-semibold text-foreground">{i + 1}.</span> {line}</li>
                  ))}
                </ol>
                <P>{t.creditNote}</P>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">{t.duplicatesTitle}</h4>
                <P><R parts={t.duplicates} /></P>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">{t.refundsTitle}</h4>
                <P><R parts={t.refunds} /></P>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">{t.currenciesTitle}</h4>
                <P>{t.currencies}</P>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">{t.historyTitle}</h4>
                <P>{t.history}</P>
              </section>
            </TabsContent>

            {/* ── Troubleshooting ── */}
            <TabsContent value="help" className="mt-0 space-y-3">
              {t.help.map(([title, body]) => (
                <div key={title} className="flex gap-3 rounded-lg border border-border p-3.5">
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 rounded-lg bg-amber-500/10 p-3 text-[13px] text-amber-800 dark:text-amber-300">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {t.noPersonalData}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
