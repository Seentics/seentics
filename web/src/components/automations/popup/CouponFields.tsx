import { Input } from '@/components/ui/input';
import { defaultCoupon, type CouponConfig } from '@/lib/popup-config';
import { Labeled, ToggleSection, inp } from './fields';

/**
 * A coupon code. Behind an email form it is revealed only after the form is accepted —
 * the code is kept off the page and sent with the submission response — and without a
 * form it is simply shown.
 */
export function CouponFields({
  value, onChange, hasForm,
}: { value: CouponConfig | undefined; onChange: (c: CouponConfig | undefined) => void; hasForm: boolean }) {
  return (
    <ToggleSection
      title="Offer a coupon code"
      description={hasForm ? 'Revealed after the email is submitted.' : 'Shown in the popup. Turn on the email form to reveal it only after a signup.'}
      enabled={!!value}
      onToggle={(on) => onChange(on ? defaultCoupon() : undefined)}
    >
      {value && (
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Code">
            <Input value={value.code} maxLength={64} onChange={(e) => onChange({ ...value, code: e.target.value })} className={inp} />
          </Labeled>
          <Labeled label="Description">
            <Input value={value.description} maxLength={160} onChange={(e) => onChange({ ...value, description: e.target.value })} className={inp} />
          </Labeled>
        </div>
      )}
    </ToggleSection>
  );
}
