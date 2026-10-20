import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MAX_SEGMENTS, MIN_SEGMENTS, addSegment, removeSegment, updateSegment, validateWheel, winChance, type WheelConfig,
} from '@/lib/popup-config';
import { Labeled, Problems, inp } from './fields';
import { useT } from '@/lib/i18n';

/**
 * The slices of a spin wheel: label, relative weight, and the coupon code each one pays.
 *
 * The weight is a relative chance — the percentage beside it is what it works out to — and
 * the prize is drawn on the server when the email is submitted, so editing this changes
 * the odds for everyone from the next save, not what a visitor's browser can be made to
 * show. A slice with no code is a "try again" slice.
 */
export function WheelFields({ wheel, onChange }: { wheel: WheelConfig; onChange: (w: WheelConfig) => void }) {
  const m = useT().automations.popup.wheel;
  return (
    <div className="space-y-3">
      {wheel.segments.map((s, i) => (
        <div key={i} className="grid grid-cols-[1fr_72px_auto] items-end gap-2 rounded-md border border-border/60 p-2">
          <Labeled label={m.sliceLabel(i + 1)}>
            <Input value={s.label} maxLength={40} onChange={(e) => onChange(updateSegment(wheel, i, { label: e.target.value }))} className={inp} />
          </Labeled>
          <Labeled label={m.weight(winChance(wheel, i))}>
            <Input
              type="number" min={0} max={1000} value={s.weight}
              onChange={(e) => onChange(updateSegment(wheel, i, { weight: Math.min(1000, Math.max(0, Math.trunc(Number(e.target.value) || 0))) }))}
              className={inp}
            />
          </Labeled>
          <Button
            type="button" size="icon" variant="ghost" className="h-9 w-9" aria-label={m.removeSlice(i + 1)}
            disabled={wheel.segments.length <= MIN_SEGMENTS} onClick={() => onChange(removeSegment(wheel, i))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Labeled label={m.coupon}>
            <Input value={s.coupon_code} maxLength={64} placeholder="SAVE10" onChange={(e) => onChange(updateSegment(wheel, i, { coupon_code: e.target.value }))} className={inp} />
          </Labeled>
          <Labeled label={m.colour}>
            <Input value={s.color ?? ''} maxLength={40} placeholder="#2563eb" onChange={(e) => onChange(updateSegment(wheel, i, { color: e.target.value || undefined }))} className={inp} />
          </Labeled>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" className="h-8 gap-1" disabled={wheel.segments.length >= MAX_SEGMENTS} onClick={() => onChange(addSegment(wheel))}>
        <Plus className="h-3.5 w-3.5" /> {m.addSlice}
      </Button>
      <Labeled label={m.buttonText} hint={m.buttonHint}>
        <Input value={wheel.spin_text} maxLength={40} onChange={(e) => onChange({ ...wheel, spin_text: e.target.value })} className={inp} />
      </Labeled>
      <Problems problems={validateWheel(wheel)} />
    </div>
  );
}
