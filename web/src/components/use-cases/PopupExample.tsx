import { BrowserFrame } from './BrowserFrame';
import type { ReactNode } from 'react';

/**
 * What a visitor sees: a schematic web page with one of Seentics' on-page actions on top of
 * it. The page is deliberately generic (grey blocks, no brand) and always light, as a
 * customer's own site would be, whatever theme this site is in. The modal copies the look of
 * the real one (white card, 8px radius, 20px title, one blue button; see ext-automations.js),
 * so the picture matches what ships.
 */

type Layout = 'store' | 'article' | 'pricing' | 'listing' | 'booking';

function Bar({ w, h = 'h-2.5', tone = 'bg-slate-200' }: { w: string; h?: string; tone?: string }) {
  return <i className={`block rounded-full ${h} ${tone}`} style={{ width: w }} />;
}

function SiteMock({ layout, children, dim = false }: { layout: Layout; children?: ReactNode; dim?: boolean }) {
  const blocks = {
    store: ['bg-amber-100', 'bg-emerald-100', 'bg-sky-100'],
    article: [],
    pricing: ['bg-slate-100', 'bg-blue-50', 'bg-slate-100'],
    listing: ['bg-rose-100', 'bg-indigo-100', 'bg-teal-100'],
    booking: ['bg-orange-100', 'bg-sky-100', 'bg-violet-100'],
  }[layout];
  return (
    <div className="relative h-[360px] overflow-hidden bg-white text-slate-900 sm:h-[420px]">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
        <span className="text-[13px] font-extrabold tracking-[0.2em]">BRAND</span>
        <span className="hidden gap-5 sm:flex"><Bar w="42px" /><Bar w="42px" /><Bar w="42px" /></span>
      </div>
      <div className="px-5 pt-6 sm:px-8">
        <Bar w="48%" h="h-4" tone="bg-slate-300" />
        <div className="mt-3 space-y-2"><Bar w="72%" /><Bar w="58%" /></div>
        {layout === 'article' ? (
          <div className="mt-6 space-y-2.5">{[96, 90, 94, 70, 92, 85].map((w, i) => <Bar key={i} w={`${w}%`} />)}</div>
        ) : (
          <div className="mt-6 grid grid-cols-3 gap-3">
            {blocks.map((b, i) => (
              <div key={i} className="overflow-hidden rounded-lg border border-slate-200">
                <div className={`h-20 sm:h-24 ${b}`} />
                <div className="space-y-2 p-3"><Bar w="70%" /><Bar w="40%" /></div>
              </div>
            ))}
          </div>
        )}
      </div>
      {dim && <div className="absolute inset-0 bg-slate-900/55" />}
      {children}
    </div>
  );
}

const Btn = ({ children }: { children: ReactNode }) => (
  <span className="inline-block rounded-md bg-blue-600 px-5 py-2.5 text-[13.5px] font-semibold text-white">{children}</span>
);

function Modal({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4">
      <div className="relative w-full max-w-[400px] rounded-lg bg-white p-6 text-slate-900 shadow-2xl">
        <span className="absolute right-3 top-2 text-[20px] leading-none text-slate-400" aria-hidden>×</span>
        {children}
      </div>
    </div>
  );
}

const Field = ({ label, placeholder }: { label: string; placeholder?: string }) => (
  <label className="block text-left">
    <span className="text-[11.5px] font-semibold text-slate-600">{label}</span>
    <span className="mt-1 block rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-400">{placeholder ?? ''}</span>
  </label>
);

export type ExampleKind = 'email-modal' | 'offer-modal' | 'banner' | 'toast' | 'highlight' | 'booking-modal';

export interface ExampleProps {
  kind: ExampleKind;
  layout?: Layout;
  url?: string;
  title?: string;
  body?: string;
  button?: string;
  fields?: { label: string; placeholder?: string }[];
  consent?: string;
  note?: string;
}

export function PopupExample({
  kind, layout = 'store', url = 'yourstore.com', title = '', body = '', button = 'Continue',
  fields = [], consent, note,
}: ExampleProps) {
  let overlay: ReactNode = null;
  let dim = false;
  if (kind === 'email-modal' || kind === 'booking-modal') {
    dim = true;
    overlay = (
      <Modal>
        <h4 className="pr-5 text-[19px] font-bold leading-snug !text-slate-900">{title}</h4>
        <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600">{body}</p>
        <div className="mt-4 space-y-3">
          <Field label="Email" placeholder="you@example.com" />
          {fields.map((f) => <Field key={f.label} label={f.label} placeholder={f.placeholder} />)}
          {consent && (
            <p className="flex items-start gap-2 text-left text-[11.5px] leading-snug text-slate-500">
              <i className="mt-0.5 block h-3.5 w-3.5 shrink-0 rounded-sm border border-slate-400" />{consent}
            </p>
          )}
          <Btn>{button}</Btn>
        </div>
      </Modal>
    );
  } else if (kind === 'offer-modal') {
    dim = true;
    overlay = (
      <Modal>
        <h4 className="pr-5 text-[19px] font-bold leading-snug !text-slate-900">{title}</h4>
        <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600">{body}</p>
        <div className="mt-4"><Btn>{button}</Btn></div>
      </Modal>
    );
  } else if (kind === 'banner') {
    overlay = (
      <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-4 bg-slate-900 px-4 py-2.5 text-white">
        <span className="text-[13px] font-medium">{title}</span>
        <span className="rounded-md bg-white px-3 py-1 text-[12px] font-semibold text-slate-900">{button}</span>
      </div>
    );
  } else if (kind === 'toast') {
    overlay = (
      <div className="absolute bottom-4 right-4 max-w-[260px] rounded-lg bg-slate-900 p-4 text-white shadow-2xl">
        <p className="text-[13px] font-semibold">{title}</p>
        <p className="mt-1 text-[12px] leading-snug text-slate-300">{body}</p>
        <span className="mt-2.5 inline-block text-[12px] font-semibold text-blue-300">{button} →</span>
      </div>
    );
  } else {
    overlay = (
      <div className="absolute bottom-10 right-8 sm:right-12">
        <span className="absolute -inset-2 animate-pulse rounded-xl ring-4 ring-blue-500/50" aria-hidden />
        <span className="relative inline-block rounded-md bg-blue-600 px-5 py-2.5 text-[13.5px] font-semibold text-white">{button}</span>
        <span className="absolute -top-14 right-0 w-44 rounded-lg bg-slate-900 p-2.5 text-[12px] leading-snug text-white shadow-xl">{title}</span>
      </div>
    );
  }
  return (
    <figure>
      <BrowserFrame url={url}>
        <SiteMock layout={layout} dim={dim}>{overlay}</SiteMock>
      </BrowserFrame>
      <figcaption className="mt-3 text-[12.5px] text-muted-foreground">{note ?? 'What the visitor sees. Wording, colours and fields are yours to set.'}</figcaption>
    </figure>
  );
}

/** The Leads inbox, with sample contacts. Illustrative, not live data. */
export function LeadsInboxMock() {
  const rows = [
    ['maya@northwind.example', 'Maya R.', 'Exit offer · A', '/pricing', 'new'],
    ['dev@brightpath.example', 'Dev P.', 'Guide popup · B', '/guides/seo', 'contacted'],
    ['sam@harbor.example', 'Sam K.', 'Exit offer · A', '/cart', 'new'],
    ['lena@fieldco.example', 'Lena F.', 'Newsletter bar', '/blog/launch', 'archived'],
  ];
  const tone: Record<string, string> = {
    new: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    contacted: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    archived: 'bg-muted text-muted-foreground',
  };
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <p className="text-[14px] font-semibold text-foreground">Leads</p>
        <span className="rounded-md border border-border px-2.5 py-1 text-[12px] text-muted-foreground">Export CSV</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground/70">
              {['Contact', 'Came from', 'Page', 'Status'].map((h) => <th key={h} className="px-5 py-2.5 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(([email, name, src, page, status]) => (
              <tr key={email} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-3"><span className="block font-medium text-foreground">{name}</span><span className="text-muted-foreground">{email}</span></td>
                <td className="px-5 py-3 text-muted-foreground">{src}</td>
                <td className="px-5 py-3 font-mono text-muted-foreground">{page}</td>
                <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${tone[status]}`}>{status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="border-t border-border px-5 py-3 text-[12px] text-muted-foreground">
        Sample contacts. Each lead records the popup, the A/B variant and the page it came from.
      </figcaption>
    </figure>
  );
}
