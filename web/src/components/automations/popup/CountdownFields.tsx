import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { defaultCountdown, fromLocalInput, toLocalInput, validateCountdown, type CountdownConfig } from '@/lib/popup-config';
import { Labeled, Problems, ToggleSection, inp } from './fields';

function CountdownForm({ value, onChange }: { value: CountdownConfig; onChange: (c: CountdownConfig) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="Type" hint={value.mode === 'evergreen' ? 'Each visitor gets their own timer, starting when they first see it.' : 'Everyone counts down to the same moment.'}>
          <Select value={value.mode} onValueChange={(m) => onChange({ ...value, mode: m as CountdownConfig['mode'] })}>
            <SelectTrigger className={inp}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="evergreen">Per visitor (evergreen)</SelectItem>
              <SelectItem value="fixed">Fixed end date</SelectItem>
            </SelectContent>
          </Select>
        </Labeled>
        {value.mode === 'evergreen' ? (
          <Labeled label="Minutes">
            <Input type="number" min={1} max={43200} value={value.duration_minutes} onChange={(e) => onChange({ ...value, duration_minutes: Math.max(1, Math.trunc(Number(e.target.value) || 1)) })} className={inp} />
          </Labeled>
        ) : (
          <Labeled label="Ends at (your local time)">
            <Input type="datetime-local" value={toLocalInput(value.ends_at)} onChange={(e) => onChange({ ...value, ends_at: fromLocalInput(e.target.value) })} className={inp} />
          </Labeled>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="Label">
          <Input value={value.label} maxLength={80} placeholder="Offer ends in" onChange={(e) => onChange({ ...value, label: e.target.value })} className={inp} />
        </Labeled>
        <Labeled label="When it runs out">
          <Input value={value.expired_text} maxLength={120} disabled={value.hide_on_expire} onChange={(e) => onChange({ ...value, expired_text: e.target.value })} className={inp} />
        </Labeled>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <Switch checked={value.hide_on_expire} onCheckedChange={(h) => onChange({ ...value, hide_on_expire: h })} aria-label="Close when the timer ends" />
        Close the popup when the timer ends
      </label>
      <Problems problems={validateCountdown(value)} />
    </>
  );
}

/**
 * A countdown timer. `optional` puts it behind a switch (a modal or bar that may have
 * one); without it the timer is the point of the layout and always shown.
 */
export function CountdownFields({
  value, onChange, optional,
}: { value: CountdownConfig | undefined; onChange: (c: CountdownConfig | undefined) => void; optional?: boolean }) {
  if (!optional) return <div className="space-y-3"><CountdownForm value={value ?? defaultCountdown()} onChange={onChange} /></div>;
  return (
    <ToggleSection title="Countdown timer" description="Adds urgency. Hides or shows a message when time is up." enabled={!!value} onToggle={(on) => onChange(on ? defaultCountdown() : undefined)}>
      {value && <CountdownForm value={value} onChange={onChange} />}
    </ToggleSection>
  );
}
