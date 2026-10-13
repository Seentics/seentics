import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { LAYOUT_OPTIONS, applyLayout, defaultCountdown, defaultSteps, defaultWheel, layoutOf, type PopupAction, type PopupLayout } from '@/lib/popup-config';
import { CountdownFields } from './CountdownFields';
import { CouponFields } from './CouponFields';
import { StepsFields } from './StepsFields';
import { TeaserFields } from './TeaserFields';
import { WheelFields } from './WheelFields';
import { Labeled, inp } from './fields';

/**
 * The popup type picker and the editor for whatever it selects, plus the mechanics that
 * combine with any type: a countdown, a teaser tab and a coupon.
 *
 * Works on the whole action and returns the whole action, so `AutomationBuilder` needs one
 * line to host it and none of its own state.
 */
export function PopupTypeFields({ action, onChange }: { action: PopupAction; onChange: (a: PopupAction) => void }) {
  const layout = layoutOf(action);
  const hint = LAYOUT_OPTIONS.find((o) => o.value === layout)?.hint;

  return (
    <div className="space-y-3">
      <Labeled label="Popup type" hint={hint}>
        <Select value={layout} onValueChange={(v) => onChange(applyLayout(action, v as PopupLayout))}>
          <SelectTrigger className={inp}><SelectValue /></SelectTrigger>
          <SelectContent>
            {LAYOUT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Labeled>

      {layout === 'spin_wheel' && <WheelFields wheel={action.wheel ?? defaultWheel()} onChange={(wheel) => onChange({ ...action, wheel })} />}
      {layout === 'multi_step' && <StepsFields steps={action.steps ?? defaultSteps()} onChange={(steps) => onChange({ ...action, steps })} />}
      {layout === 'countdown' && <CountdownFields value={action.countdown ?? defaultCountdown()} onChange={(countdown) => onChange({ ...action, countdown })} />}

      {/* A wheel pays its own prizes, so a single coupon only makes sense on the others. */}
      {layout !== 'countdown' && <CountdownFields optional value={action.countdown} onChange={(countdown) => onChange({ ...action, countdown })} />}
      <TeaserFields value={action.teaser} onChange={(teaser) => onChange({ ...action, teaser })} />
      {layout !== 'spin_wheel' && <CouponFields hasForm={!!action.form} value={action.coupon} onChange={(coupon) => onChange({ ...action, coupon })} />}
    </div>
  );
}
