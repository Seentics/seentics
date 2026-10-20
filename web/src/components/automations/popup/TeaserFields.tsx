import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { defaultTeaser, type TeaserConfig } from '@/lib/popup-config';
import { Labeled, ToggleSection, inp } from './fields';
import { useT } from '@/lib/i18n';

/** A small tab on the page edge that opens the popup, instead of covering the page at once. */
export function TeaserFields({ value, onChange }: { value: TeaserConfig | undefined; onChange: (t: TeaserConfig | undefined) => void }) {
  const m = useT().automations.popup.teaser;
  return (
    <ToggleSection title={m.title} description={m.description} enabled={!!value} onToggle={(on) => onChange(on ? defaultTeaser() : undefined)}>
      {value && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Labeled label={m.tabText}>
              <Input value={value.label} maxLength={40} onChange={(e) => onChange({ ...value, label: e.target.value })} className={inp} />
            </Labeled>
            <Labeled label={m.position}>
              <Select value={value.position} onValueChange={(p) => onChange({ ...value, position: p as TeaserConfig['position'] })}>
                <SelectTrigger className={inp}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="right">{m.right}</SelectItem>
                  <SelectItem value="left">{m.left}</SelectItem>
                  <SelectItem value="bottom-right">{m.bottomRight}</SelectItem>
                  <SelectItem value="bottom-left">{m.bottomLeft}</SelectItem>
                </SelectContent>
              </Select>
            </Labeled>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={value.reopen} onCheckedChange={(r) => onChange({ ...value, reopen: r })} aria-label={m.reopenAria} />
            {m.reopen}
          </label>
        </>
      )}
    </ToggleSection>
  );
}
