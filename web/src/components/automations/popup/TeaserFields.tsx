import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { defaultTeaser, type TeaserConfig } from '@/lib/popup-config';
import { Labeled, ToggleSection, inp } from './fields';

/** A small tab on the page edge that opens the popup, instead of covering the page at once. */
export function TeaserFields({ value, onChange }: { value: TeaserConfig | undefined; onChange: (t: TeaserConfig | undefined) => void }) {
  return (
    <ToggleSection title="Show as a teaser tab" description="A small tab opens the popup when clicked." enabled={!!value} onToggle={(on) => onChange(on ? defaultTeaser() : undefined)}>
      {value && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Tab text">
              <Input value={value.label} maxLength={40} onChange={(e) => onChange({ ...value, label: e.target.value })} className={inp} />
            </Labeled>
            <Labeled label="Position">
              <Select value={value.position} onValueChange={(p) => onChange({ ...value, position: p as TeaserConfig['position'] })}>
                <SelectTrigger className={inp}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="right">Right edge</SelectItem>
                  <SelectItem value="left">Left edge</SelectItem>
                  <SelectItem value="bottom-right">Bottom right</SelectItem>
                  <SelectItem value="bottom-left">Bottom left</SelectItem>
                </SelectContent>
              </Select>
            </Labeled>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={value.reopen} onCheckedChange={(r) => onChange({ ...value, reopen: r })} aria-label="Bring the tab back after closing" />
            Bring the tab back after the popup is closed
          </label>
        </>
      )}
    </ToggleSection>
  );
}
