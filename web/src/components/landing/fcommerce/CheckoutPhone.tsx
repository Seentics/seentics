import { BatteryFull, Lock, Minus, Plus, ShieldCheck, Signal, Wifi } from 'lucide-react';
import { shopBn } from '@/lib/i18n/messages/shop-bn';
import { cn } from '@/lib/utils';

/**
 * A phone showing a seentics.shop product page as a buyer sees it: the product, or the order form
 * filled in and ready to confirm. A picture for the landing page (aria-hidden), in Bangla whatever
 * the page's language, since buyers always see Bangla. Photo: Unsplash (free licence).
 */

const t = shopBn.preview;
const ACCENT = '#0f6b4f';
const PRODUCT = {
  title: 'স্মার্ট ওয়াচ, Bluetooth কলিং সহ',
  price: 990,
  comparePrice: 1990,
  image: '/images/fcommerce/watch.jpg',
  highlights: ['৭ দিনের ব্যাটারি', 'হার্ট রেট আর স্টেপ কাউন্ট', '৭ দিনের রিপ্লেসমেন্ট গ্যারান্টি'],
};
const DELIVERY = 60;

const taka = (n: number) => `৳${n.toLocaleString('en-US')}`;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-0.5 text-[10.5px] text-zinc-500">{label}</p>
      <p className="truncate rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] text-zinc-900">{value}</p>
    </div>
  );
}

export function CheckoutPhone({ view = 'checkout', className }: { view?: 'checkout' | 'product'; className?: string }) {
  const off = Math.round((1 - PRODUCT.price / PRODUCT.comparePrice) * 100);
  return (
    <div aria-hidden className={cn('relative w-[340px] max-w-full select-none', className)}>
      {/* side buttons */}
      <span className="absolute -left-[3px] top-[110px] h-8 w-[3px] rounded-l bg-zinc-800" />
      <span className="absolute -left-[3px] top-[160px] h-14 w-[3px] rounded-l bg-zinc-800" />
      <span className="absolute -right-[3px] top-[140px] h-20 w-[3px] rounded-r bg-zinc-800" />
      <div className="rounded-[50px] bg-zinc-900 p-[10px] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.55),inset_0_0_0_1.5px_#3f3f46]">
        <div className="relative flex h-[700px] flex-col overflow-hidden rounded-[40px] bg-zinc-50 text-zinc-900" lang="bn">
          {/* status bar + dynamic island */}
          <div className="relative flex h-11 shrink-0 items-center justify-between bg-white px-7 pt-1 text-[13px] font-semibold">
            <span>9:41</span>
            <span className="absolute left-1/2 top-2.5 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" />
            <span className="flex items-center gap-1"><Signal className="h-3.5 w-3.5" /><Wifi className="h-3.5 w-3.5" /><BatteryFull className="h-4 w-4" /></span>
          </div>
          {/* browser address bar */}
          <div className="shrink-0 bg-white px-3 pb-2">
            <div className="flex items-center justify-center gap-1 rounded-lg bg-zinc-100 py-1.5 text-[11px] text-zinc-600">
              <Lock className="h-3 w-3" />seentics.shop/rupa-fashion/smart-watch
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-100 bg-white px-4 py-2">
              <span className="text-[12.5px] font-bold">Rupa Fashion</span>
              <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: ACCENT }}>{t.off(off)}</span>
            </div>

            {view === 'product' ? (
              <>
                <img src={PRODUCT.image} alt="" className="aspect-square w-full bg-zinc-100 object-cover" draggable={false} />
                <div className="space-y-2.5 bg-white px-4 py-3">
                  <p className="text-[16px] font-bold leading-snug">{PRODUCT.title}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[22px] font-bold" style={{ color: ACCENT }}>{taka(PRODUCT.price)}</span>
                    <span className="text-[13px] text-zinc-400 line-through">{taka(PRODUCT.comparePrice)}</span>
                  </div>
                  <ul className="space-y-1 text-[12px] text-zinc-700">
                    {PRODUCT.highlights.map((h) => <li key={h}>✓ {h}</li>)}
                  </ul>
                  <div className="rounded-lg py-2.5 text-center text-[14px] font-semibold text-white" style={{ background: ACCENT }}>{t.orderNow}</div>
                  <p className="flex items-center justify-center gap-1 text-[11px] text-zinc-500"><ShieldCheck className="h-3.5 w-3.5" style={{ color: ACCENT }} />{t.cod}</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex gap-3 bg-white px-4 py-3">
                  <img src={PRODUCT.image} alt="" className="h-[72px] w-[72px] shrink-0 rounded-lg bg-zinc-100 object-cover" draggable={false} />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold leading-snug">{PRODUCT.title}</p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-[17px] font-bold" style={{ color: ACCENT }}>{taka(PRODUCT.price)}</span>
                      <span className="text-[11.5px] text-zinc-400 line-through">{taka(PRODUCT.comparePrice)}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 space-y-2.5 bg-white px-4 py-3">
                  <p className="text-[13.5px] font-bold">{t.formTitle}</p>
                  <Field label={t.name} value="নাসরিন আক্তার" />
                  <Field label={t.phone} value="01819-234567" />
                  <Field label={t.address} value="বাড়ি ১২, রোড ৫, ধানমন্ডি, ঢাকা" />
                  <div>
                    <p className="mb-0.5 text-[10.5px] text-zinc-500">{t.area}</p>
                    <div className="grid grid-cols-2 gap-1.5 text-[11.5px]">
                      <span className="rounded-md border-2 py-1 text-center font-semibold" style={{ borderColor: ACCENT, color: ACCENT }}>{t.insideDhaka} {taka(DELIVERY)}</span>
                      <span className="rounded-md border border-zinc-200 py-1 text-center text-zinc-600">{t.outsideDhaka} ৳120</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-zinc-500">{t.quantity}</span>
                    <span className="flex items-center gap-2.5 rounded-md border border-zinc-200 px-2 py-0.5"><Minus className="h-3 w-3" />1<Plus className="h-3 w-3" /></span>
                  </div>
                  <p className="flex justify-between border-t border-dashed border-zinc-200 pt-2 text-[12px] text-zinc-500"><span>{t.delivery}</span><span>{taka(DELIVERY)}</span></p>
                </div>
              </>
            )}
          </div>
          {view === 'checkout' && (
            // Pinned to the bottom of the screen, as on the real page, so the button is always in view.
            <div className="shrink-0 border-t border-zinc-200 bg-white px-4 pb-7 pt-3 shadow-[0_-8px_20px_-12px_rgba(0,0,0,0.25)]">
              <p className="mb-2 flex items-baseline justify-between text-[13px]"><span className="text-zinc-500">{t.total}</span><span className="text-[18px] font-bold">{taka(PRODUCT.price + DELIVERY)}</span></p>
              <div className="rounded-xl py-3.5 text-center text-[16px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(15,107,79,0.8)]" style={{ background: ACCENT }}>{t.confirm}</div>
            </div>
          )}
          {/* home indicator */}
          <span className="absolute bottom-2 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full bg-zinc-900/80" />
        </div>
      </div>
    </div>
  );
}

/**
 * The same product page at desktop width, for the laptop beside the phone: photo and details on
 * the left, the order form filled in on the right. Laid out at 1100px; MacbookFrame scales it.
 */
export function CheckoutDesktop() {
  const off = Math.round((1 - PRODUCT.price / PRODUCT.comparePrice) * 100);
  return (
    <div className="h-full bg-zinc-50 text-zinc-900" lang="bn">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-10 py-3.5">
        <span className="text-[17px] font-bold">Rupa Fashion</span>
        <span className="text-[13px] text-zinc-500">{t.cod}</span>
      </div>
      <div className="grid grid-cols-[1.15fr_1fr] gap-8 px-10 py-7">
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl bg-white">
            <img src={PRODUCT.image} alt="" className="aspect-[4/3] w-full object-cover" draggable={false} />
            <span className="absolute left-4 top-4 rounded-md px-2.5 py-1 text-[13px] font-semibold text-white" style={{ background: ACCENT }}>{t.off(off)}</span>
          </div>
          <div>
            <p className="text-[24px] font-bold leading-snug">{PRODUCT.title}</p>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-[28px] font-bold" style={{ color: ACCENT }}>{taka(PRODUCT.price)}</span>
              <span className="text-[16px] text-zinc-400 line-through">{taka(PRODUCT.comparePrice)}</span>
            </div>
            <ul className="mt-2 flex gap-5 text-[14px] text-zinc-700">
              {PRODUCT.highlights.map((h) => <li key={h}>✓ {h}</li>)}
            </ul>
          </div>
        </div>
        <div className="h-fit space-y-3.5 rounded-2xl border border-zinc-200 bg-white p-6 [&_p]:text-[13px] [&_.truncate]:py-2.5 [&_.truncate]:text-[15px]">
          <p className="!text-[19px] font-bold">{t.formTitle}</p>
          <Field label={t.name} value="নাসরিন আক্তার" />
          <Field label={t.phone} value="01819-234567" />
          <Field label={t.address} value="বাড়ি ১২, রোড ৫, ধানমন্ডি, ঢাকা" />
          <div className="grid grid-cols-2 gap-2 text-[14px]">
            <span className="rounded-lg border-2 py-2 text-center font-semibold" style={{ borderColor: ACCENT, color: ACCENT }}>{t.insideDhaka} {taka(DELIVERY)}</span>
            <span className="rounded-lg border border-zinc-200 py-2 text-center text-zinc-600">{t.outsideDhaka} ৳120</span>
          </div>
          <div className="space-y-1 border-t border-dashed border-zinc-200 pt-3 text-[14px]">
            <div className="flex justify-between text-zinc-500"><span>{t.delivery}</span><span>{taka(DELIVERY)}</span></div>
            <div className="flex justify-between text-[18px] font-bold"><span>{t.total}</span><span>{taka(PRODUCT.price + DELIVERY)}</span></div>
          </div>
          <div className="rounded-xl py-3.5 text-center text-[17px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(15,107,79,0.8)]" style={{ background: ACCENT }}>{t.confirm}</div>
        </div>
      </div>
    </div>
  );
}
