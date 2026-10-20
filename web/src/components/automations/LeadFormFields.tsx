import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { FormDestinations } from './FormDestinations';
import { useT } from '@/lib/i18n';
import {
  MAX_EXTRA_FIELDS, addField, defaultLeadForm, removeField, updateField, validateLeadForm,
  type LeadForm, type LeadFormFieldType,
} from '@/lib/lead-form';

const inp = 'bg-muted border-border text-foreground placeholder:text-muted-foreground';

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/**
 * Turns a modal into a lead-capture form: email plus up to seven more fields, a thank-you
 * message and optional consent. Submissions are listed on this automation's page and sent to the
 * destinations chosen below (Settings > Integrations), attributed to this popup and its A/B variant.
 *
 * Off by default and collapsed to a single switch, so a modal that is only a message or a
 * link stays as simple as it was.
 */
export function LeadFormFields({
  form, onChange,
}: { form: LeadForm | undefined; onChange: (form: LeadForm | undefined) => void }) {
  const m = useT().automations.leadForm;
  const enabled = !!form;
  const problems = form ? validateLeadForm(form) : [];

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div>
          <p className="text-xs font-semibold text-foreground">{m.title}</p>
          <p className="text-[11px] text-muted-foreground">{m.body}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={(on) => onChange(on ? defaultLeadForm() : undefined)} aria-label={m.title} />
      </div>

      {form && (
        <div className="space-y-3 border-t border-border p-3">
          <p className="text-[11px] text-muted-foreground">{m.emailIncluded}</p>

          {form.fields.map((f, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-md border border-border/60 p-2">
              <Labeled label={m.fieldName}>
                <Input value={f.name} onChange={(e) => onChange(updateField(form, i, { name: e.target.value }))} className={inp} />
              </Labeled>
              <Labeled label={m.label}>
                <Input value={f.label} onChange={(e) => onChange(updateField(form, i, { label: e.target.value }))} className={inp} />
              </Labeled>
              <Button type="button" size="icon" variant="ghost" className="h-9 w-9" aria-label={m.remove(f.name)} onClick={() => onChange(removeField(form, i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <Labeled label={m.type}>
                <Select value={f.type} onValueChange={(v) => onChange(updateField(form, i, { type: v as LeadFormFieldType }))}>
                  <SelectTrigger className={inp}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">{m.text}</SelectItem>
                    <SelectItem value="tel">{m.phone}</SelectItem>
                  </SelectContent>
                </Select>
              </Labeled>
              <Labeled label={m.placeholder}>
                <Input value={f.placeholder} onChange={(e) => onChange(updateField(form, i, { placeholder: e.target.value }))} className={inp} />
              </Labeled>
              <label className="flex items-center gap-2 pb-2 text-xs">
                <Switch checked={f.required} onCheckedChange={(r) => onChange(updateField(form, i, { required: r }))} aria-label={m.requiredAria(f.name)} />
                {m.required}
              </label>
            </div>
          ))}

          <Button
            type="button" size="sm" variant="outline" className="h-8 gap-1"
            disabled={form.fields.length >= MAX_EXTRA_FIELDS}
            onClick={() => onChange(addField(form))}
          >
            <Plus className="h-3.5 w-3.5" /> {m.addField}
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <Labeled label={m.submitText}>
              <Input value={form.submit_text} maxLength={60} onChange={(e) => onChange({ ...form, submit_text: e.target.value })} className={inp} />
            </Labeled>
            <Labeled label={m.redirect}>
              <Input value={form.success_redirect_url ?? ''} placeholder="/thanks" onChange={(e) => onChange({ ...form, success_redirect_url: e.target.value })} className={inp} />
            </Labeled>
          </div>
          <Labeled label={m.thanks}>
            <Input value={form.success_message} maxLength={300} onChange={(e) => onChange({ ...form, success_message: e.target.value })} className={inp} />
          </Labeled>
          <Labeled label={m.consent}>
            <Input value={form.consent_text ?? ''} maxLength={300} placeholder={m.consentPlaceholder} onChange={(e) => onChange({ ...form, consent_text: e.target.value })} className={inp} />
          </Labeled>

          <FormDestinations form={form} onChange={onChange} />

          {problems.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-[11px] text-destructive" role="alert">
              {problems.map((p) => <li key={p}>{p}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
