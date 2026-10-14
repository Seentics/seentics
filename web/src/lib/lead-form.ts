/**
 * The lead-capture form a popup carries, and the edits the builder makes to it.
 *
 * Pure functions over plain data, kept out of the builder component so the rules — email
 * is always there, at most seven more fields, names are unique identifiers — are testable
 * without rendering anything. The shape mirrors `leadFormSchema` in core.
 */

export type LeadFormFieldType = 'text' | 'email' | 'tel';

export type LeadFormField = {
  name: string;
  type: LeadFormFieldType;
  label: string;
  placeholder: string;
  required: boolean;
};

export type LeadForm = {
  fields: LeadFormField[];
  submit_text: string;
  success_message: string;
  success_redirect_url?: string;
  consent_text?: string;
  consent_required: boolean;
  /**
   * Destination ids this form sends to. Absent means every enabled destination on the site;
   * present means exactly those (an empty list is "nowhere"). See `lib/form-routing`.
   */
  destinations?: string[];
};

/** The most destinations one form can name; core's schema allows the same. */
export const MAX_DESTINATIONS = 20;

/** Email is implicit, so this is the number of *extra* fields. */
export const MAX_EXTRA_FIELDS = 7;

/** Names the endpoint stores as columns or reserves; an extra field may not reuse them. */
const RESERVED = new Set(['email', 'hp', 'consent']);
const NAME_PATTERN = /^[a-z][a-z0-9_]{0,39}$/i;

export const defaultLeadForm = (): LeadForm => ({
  fields: [{ name: 'name', type: 'text', label: 'Name', placeholder: '', required: false }],
  submit_text: 'Subscribe',
  success_message: "Thanks, you're subscribed.",
  consent_required: true,
});

export const isValidFieldName = (name: string) => NAME_PATTERN.test(name) && !RESERVED.has(name.toLowerCase());

/** A name not yet used, for the "add field" button: `field_1`, `field_2`, … */
export function nextFieldName(fields: readonly LeadFormField[]): string {
  const used = new Set(fields.map((f) => f.name.toLowerCase()));
  for (let i = 1; ; i++) if (!used.has(`field_${i}`)) return `field_${i}`;
}

export function addField(form: LeadForm): LeadForm {
  if (form.fields.length >= MAX_EXTRA_FIELDS) return form;
  const name = nextFieldName(form.fields);
  return { ...form, fields: [...form.fields, { name, type: 'text', label: 'New field', placeholder: '', required: false }] };
}

export function updateField(form: LeadForm, index: number, patch: Partial<LeadFormField>): LeadForm {
  return { ...form, fields: form.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)) };
}

export function removeField(form: LeadForm, index: number): LeadForm {
  return { ...form, fields: form.fields.filter((_, i) => i !== index) };
}

/**
 * What is wrong with the form, as messages the builder can show — empty when it is fine.
 *
 * The server rejects the same things on save; checking here first turns a failed save
 * into an inline hint next to the field that caused it.
 */
export function validateLeadForm(form: LeadForm): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const f of form.fields) {
    if (!isValidFieldName(f.name)) {
      problems.push(`"${f.name || '(empty)'}" is not a valid field name. Use letters, digits and underscores, starting with a letter, and not email, hp or consent.`);
    }
    if (seen.has(f.name.toLowerCase())) problems.push(`Two fields are named "${f.name}".`);
    seen.add(f.name.toLowerCase());
  }
  const redirect = form.success_redirect_url?.trim();
  if (redirect && !/^(https?:\/\/|\/(?!\/))/i.test(redirect)) {
    problems.push('The redirect must be an http(s) URL or a path starting with /.');
  }
  if (form.destinations && form.destinations.length > MAX_DESTINATIONS) {
    problems.push(`A form can send to at most ${MAX_DESTINATIONS} destinations.`);
  }
  return problems;
}
