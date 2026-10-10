'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, Check, Copy, CircleCheck, TriangleAlert } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy');
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
          {copied ? 'Copied' : 'Copy'}
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

const PROPS: Array<[string, string, string, string]> = [
  ['value', 'number', 'Required', 'The order total, as a plain number like 49.99. Also read from revenue, amount or total. Without a number the order counts as 0.'],
  ['currency', 'string', 'Optional', 'A 3-letter code such as USD, EUR or GBP. Defaults to USD. Amounts are not converted between currencies.'],
  ['order_id', 'string', 'Recommended', 'Your order number (transaction_id also works). Orders with the same ID are counted once, so reloading the thank-you page does not double your revenue.'],
  ['product_name', 'string', 'Optional', 'Feeds the Product breakdown. product and name also work.'],
  ['user_type', 'string', 'Optional', '"new" or "returning". Splits revenue by customer type.'],
  ['items', 'array', 'Optional', 'Line items shown on the order page: [{ name, sku, qty, price }].'],
];

export function RevenueDocsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            Track revenue
          </SheetTitle>
          <SheetDescription>
            One line of code on your thank-you page. Seentics does the rest.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="setup" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-5 mt-4 h-8 w-auto justify-start self-start bg-muted/60 p-0.5">
            <TabsTrigger value="setup" className="h-7 px-3 text-xs">Set up</TabsTrigger>
            <TabsTrigger value="props" className="h-7 px-3 text-xs">Properties</TabsTrigger>
            <TabsTrigger value="counted" className="h-7 px-3 text-xs">How it&apos;s counted</TabsTrigger>
            <TabsTrigger value="help" className="h-7 px-3 text-xs">Not showing?</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto p-5">
            {/* ── Set up ── */}
            <TabsContent value="setup" className="mt-0">
              <ol className="space-y-6">
                <Step n={1} title="Make sure the tracker is on your site">
                  <P>
                    The Seentics script must load on your checkout confirmation page, the same way it does on the rest of your site.
                  </P>
                </Step>

                <Step n={2} title="Send a purchase when an order completes">
                  <P>
                    Put this on your order confirmation (thank-you) page, after the order succeeds. Only <C>value</C> is needed.
                  </P>
                  <CodeBlock
                    code={`seentics.track('purchase', {
  value:    49.99,
  currency: 'USD',
  order_id: 'ORD-8821',
});`}
                  />
                </Step>

                <Step n={3} title="Add detail if you want richer reports">
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
                  <P>
                    <C>price</C> is the unit price. The order page multiplies it by <C>qty</C>.
                  </P>
                </Step>

                <Step n={4} title="Record refunds so revenue stays accurate">
                  <CodeBlock
                    code={`seentics.track('refund', {
  value:    49.99,
  currency: 'USD',
  order_id: 'ORD-8821',
});`}
                  />
                  <P>
                    Refunds are subtracted from the revenue total. A partial refund is a refund with a smaller <C>value</C>.
                  </P>
                </Step>

                <Step n={5} title="Marketing links: add UTM tags">
                  <P>
                    Tag your links so the Source, Medium and Campaign breakdowns fill in. Without tags, revenue is credited to the referring site, or to &quot;direct&quot;.
                  </P>
                  <CodeBlock
                    label="URL"
                    code={`https://yoursite.com/pricing?utm_source=newsletter&utm_medium=email&utm_campaign=spring-sale`}
                  />
                </Step>
              </ol>
            </TabsContent>

            {/* ── Properties ── */}
            <TabsContent value="props" className="mt-0 space-y-3">
              {PROPS.map(([name, type, req, desc]) => (
                <div key={name} className="rounded-lg border border-border p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="font-mono text-[13px] font-semibold text-foreground">{name}</code>
                    <span className="text-[11px] text-sky-600 dark:text-sky-400">{type}</span>
                    <span
                      className={
                        req === 'Required'
                          ? 'rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400'
                          : req === 'Recommended'
                            ? 'rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400'
                            : 'rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground'
                      }
                    >
                      {req}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              ))}
              <P>
                Event names also accepted for a purchase: <C>order_completed</C>, <C>checkout_completed</C>, <C>ecommerce_purchase</C> and <C>transaction</C>. For a refund: <C>refunded</C>.
              </P>
            </TabsContent>

            {/* ── How it's counted ── */}
            <TabsContent value="counted" className="mt-0 space-y-5">
              <section className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Which channel gets the credit</h4>
                <P>Each order is credited to the first of these that applies:</P>
                <ol className="space-y-1.5 text-[13px] text-muted-foreground">
                  <li className="flex gap-2"><span className="font-semibold text-foreground">1.</span> The visitor&apos;s most recent page view with UTM tags in the same session, within 24 hours before the purchase.</li>
                  <li className="flex gap-2"><span className="font-semibold text-foreground">2.</span> UTM tags on the purchase event itself.</li>
                  <li className="flex gap-2"><span className="font-semibold text-foreground">3.</span> The last outside website the visitor came from, such as google.com.</li>
                  <li className="flex gap-2"><span className="font-semibold text-foreground">4.</span> Otherwise &quot;direct&quot;.</li>
                </ol>
                <P>
                  Visiting your own checkout directly does not steal credit from the campaign that brought the visitor in.
                </P>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Duplicates</h4>
                <P>
                  Purchases with the same <C>order_id</C> count once. If you do not send one, every event counts as its own order, so reloading the confirmation page would add the sale again.
                </P>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Refunds</h4>
                <P>
                  A <C>refund</C> event is subtracted from your revenue total. Each refund counts on its own, so two partial
                  refunds of one order are two refunds. The order itself still counts as an order.
                </P>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Currencies</h4>
                <P>
                  Totals are shown in your main currency (the one most orders use). Amounts in other currencies are not converted.
                </P>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">History</h4>
                <P>
                  Individual orders on this page cover recent purchases. Totals, the daily chart and breakdowns can look back further.
                </P>
              </section>
            </TabsContent>

            {/* ── Troubleshooting ── */}
            <TabsContent value="help" className="mt-0 space-y-3">
              {[
                ['Check the call actually runs', 'It must run after the order succeeds, on a page where the Seentics script has loaded. Open your browser console and run seentics.track(...) by hand to test.'],
                ['Make sure value is a number', 'Send 49.99, not "$49.99". A value that is not a number counts as 0.'],
                ['Spell the event name exactly', 'Use "purchase" (all lowercase) or one of the other accepted names on the Properties tab.'],
                ['Check consent and blockers', 'Visitors who decline tracking, and some ad blockers, are not counted.'],
                ['Give it a moment', 'New orders can take a short while to appear in the totals.'],
              ].map(([title, body]) => (
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
                Never send card numbers or personal data in purchase properties.
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
