import { ArrowRight, Check, Server, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The f-commerce page's picture of the path a confirmed order takes to Facebook. Bangla throughout, fixed
 * light colours (they show the product, not the page's theme), aria-hidden.
 */

const ACCENT = '#0f6b4f';

const EVENTS: Array<{ no: number; total: string; ok: boolean; note: string }> = [
  { no: 1093, total: '৳1,050', ok: true, note: 'Server · ম্যাচ হয়েছে' },
  { no: 1091, total: '৳1,740', ok: true, note: 'Server · ম্যাচ হয়েছে' },
  { no: 1090, total: '৳1,110', ok: true, note: 'Server · ম্যাচ হয়েছে' },
  { no: 1089, total: '৳1,050', ok: false, note: 'ফেক, পাঠানো হয়নি' },
];

function Step({ n, title, children, className }: { n: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-zinc-200 bg-white p-4 text-zinc-900 shadow-[0_20px_40px_-28px_rgba(0,0,0,0.35)]', className)}>
      <p className="flex items-center gap-2 text-[13px] font-semibold text-zinc-500">
        <span className="flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: ACCENT }}>{n}</span>
        {title}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex justify-center py-1.5 text-zinc-400" aria-hidden>
      <ArrowRight className="h-5 w-5 rotate-90" />
    </div>
  );
}

/** A confirmed order's path: Seentics → our server → Facebook, and the fake one that never leaves. */
export function ConversionFlow() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-[460px] select-none rounded-3xl bg-[var(--fc-soft)] p-4 sm:p-6" lang="bn">
      <Step n="১" title="আপনি অর্ডার Confirm করলেন">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 px-3.5 py-2.5">
          <span className="min-w-0 text-[13.5px]"><b>#1093 · নাসরিন আক্তার</b><span className="block text-[12px] text-zinc-500">স্মার্ট ওয়াচ × ১ · ৳1,050</span></span>
          <span className="flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-white" style={{ background: ACCENT }}><Check className="h-3.5 w-3.5" strokeWidth={3} />Confirmed</span>
        </div>
      </Step>
      <Arrow />
      <Step n="২" title="Seentics Server থেকে পাঠানো হলো">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white"><Server className="h-5 w-5" /></span>
          <ul className="grid gap-1 text-[12.5px] text-zinc-700">
            <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />Purchase Event, আসল দাম ৳1,050</li>
            <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />ফোন নম্বর Hash করা</li>
            <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />একবারই, Duplicate হবে না</li>
          </ul>
        </div>
      </Step>
      <Arrow />
      <Step n="৩" title="Facebook Events Manager">
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200">
          {EVENTS.map((e) => (
            <li key={e.no} className={cn('flex items-center justify-between gap-3 px-3.5 py-2 text-[12.5px]', !e.ok && 'bg-red-50')}>
              <span className="min-w-0">
                <b className={e.ok ? 'text-zinc-900' : 'text-zinc-400 line-through'}>Purchase · {e.total}</b>
                <span className={cn('block text-[11.5px]', e.ok ? 'text-zinc-500' : 'text-red-600')}>#{e.no} · {e.note}</span>
              </span>
              <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full', e.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white')}>
                {e.ok ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <X className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
            </li>
          ))}
        </ul>
      </Step>
    </div>
  );
}
