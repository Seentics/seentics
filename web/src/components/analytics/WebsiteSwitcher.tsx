import { Globe, PlusCircle } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** Only what the switcher needs — not the full `Website`, so fixtures stay small. */
export interface WebsiteOption {
  id: string;
  name: string;
}

export interface WebsiteSwitcherProps {
  websites: WebsiteOption[];
  /** Id of the current site. May be absent while the list is still loading. */
  value?: string;
  onChange: (websiteId: string) => void;
  /**
   * Omit to hide the "Add website" entry — a demo or a recording has nowhere to add one,
   * and an option that cannot work is worse than no option.
   */
  onAddWebsite?: () => void;
  placeholder?: string;
  addLabel?: string;
  className?: string;
}

/**
 * The dashboard's site picker.
 *
 * Takes the list and a callback rather than fetching, so it renders identically from
 * live data, demo fixtures or a single hardcoded entry. The "add" affordance is a
 * separate callback instead of a magic option value, which is how it was done inline —
 * the page had to compare against the string `'add-new'` inside its change handler and
 * branch, putting a piece of this component's behaviour in the caller.
 */
export function WebsiteSwitcher({
  websites,
  value,
  onChange,
  onAddWebsite,
  placeholder = 'Select website',
  addLabel = 'Add Website',
  className,
}: WebsiteSwitcherProps) {
  const ADD = '__add_website__';
  const current = websites.find((w) => w.id === value);

  return (
    <Select
      value={value}
      onValueChange={(next) => (next === ADD ? onAddWebsite?.() : onChange(next))}
    >
      <SelectTrigger
        className={cn(
          'h-8 w-[180px] rounded-lg border bg-card transition-colors hover:bg-card dark:border-none',
          className,
        )}
      >
        <div className="flex items-center truncate">
          <Globe className="mr-1.5 h-3 w-3 shrink-0 text-primary" />
          <span className="truncate font-medium text-foreground">
            {current?.name || placeholder}
          </span>
        </div>
      </SelectTrigger>
      <SelectContent className="rounded-lg bg-card">
        {websites.map((site) => (
          <SelectItem key={site.id} value={site.id} className="rounded-lg py-1.5 text-xs">
            <span className="font-medium text-foreground">{site.name}</span>
          </SelectItem>
        ))}
        {websites.length > 0 && onAddWebsite && (
          <>
            <div className="mx-2 my-1 h-px bg-border" />
            <SelectItem value={ADD} className="rounded-lg py-1.5 text-xs text-primary">
              <div className="flex items-center font-medium">
                <PlusCircle className="mr-1.5 h-3 w-3" />
                {addLabel}
              </div>
            </SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
