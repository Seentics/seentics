import { Switch } from '@/components/ui/switch';

/** The input styling the builder uses everywhere, so these editors look like the rest of it. */
export const inp = 'bg-muted border-border text-foreground placeholder:text-muted-foreground';

export function Labeled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

/**
 * A bordered section with an on/off switch in its header.
 *
 * Off by default and collapsed to the switch, so a popup that is only a message stays as
 * simple as it was; on, the section shows its fields. The same shape as the lead form's.
 */
export function ToggleSection({
  title, description, enabled, onToggle, children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (on: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div>
          <p className="text-xs font-semibold text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} aria-label={title} />
      </div>
      {enabled && <div className="space-y-3 border-t border-border p-3">{children}</div>}
    </div>
  );
}

export function Problems({ problems }: { problems: string[] }) {
  if (!problems.length) return null;
  return (
    <ul className="list-disc space-y-1 pl-4 text-[11px] text-destructive" role="alert">
      {problems.map((p) => <li key={p}>{p}</li>)}
    </ul>
  );
}
