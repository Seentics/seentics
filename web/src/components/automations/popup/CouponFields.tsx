import { Input } from '@/components/ui/input';
import { defaultCoupon, type CouponConfig } from '@/lib/popup-config';
import { Labeled, ToggleSection, inp } from './fields';
import { useT } from '@/lib/i18n';

/**
 * A coupon code. Behind an email form it is revealed only after the form is accepted —
 * the code is kept off the page and sent with the submission response — and without a
 * form it is simply shown.
 */
export function CouponFields({
  value, onChange, hasForm,
}: { value: CouponConfig | undefined; onChange: (c: CouponConfig | undefined) => void; hasForm: boolean }) {
  const m = useT().automations.popup.coupon;
  return (
    <ToggleSection
      title={m.title}
      description={hasForm ? m.withForm : m.withoutForm}
      enabled={!!value}
      onToggle={(on) => onChange(on ? defaultCoupon() : undefined)}
    >
      {value && (
        <div className="grid grid-cols-2 gap-3">
          <Labeled label={m.code}>
            <Input value={value.code} maxLength={64} onChange={(e) => onChange({ ...value, code: e.target.value })} className={inp} />
          </Labeled>
          <Labeled label={m.description}>
            <Input value={value.description} maxLength={160} onChange={(e) => onChange({ ...value, description: e.target.value })} className={inp} />
          </Labeled>
        </div>
      )}
    </ToggleSection>
  );
}
