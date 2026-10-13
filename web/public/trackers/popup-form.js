/**
 * Lead-capture form for a popup: builds the fields, validates, submits, thanks the visitor.
 *
 * Split out of ext-automations.js because it is the one part of an action that talks back
 * to the server, and it should be readable — and testable — without the trigger and
 * renderer code around it. esbuild folds it into the automations extension; it is not a
 * script a page loads on its own.
 *
 * Everything the owner configures reaches the DOM through `textContent` and property
 * assignment, never `innerHTML`: field labels and messages are owner-written but arrive
 * over the network, and the cost of never trusting them is nothing.
 */

const MAX_FIELDS = 8;
const FIELD_KEY = /^[a-z][a-z0-9_]{0,39}$/i;
const INPUT_TYPES = { email: 'email', text: 'text', tel: 'tel' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Appended to the shared action styles. Scoped under `.snc-form` so a host page cannot reach it. */
export const FORM_CSS =
  '.snc-form{display:flex;flex-direction:column;gap:10px;margin:0;text-align:left}' +
  '.snc-form label{display:block;font-size:13px;font-weight:600;margin:0 0 4px}' +
  '.snc-form input[type=email],.snc-form input[type=text],.snc-form input[type=tel]{width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,.25);border-radius:6px;font:inherit;font-size:14px;color:#111827;background:#fff;box-sizing:border-box}' +
  '.snc-form input:focus-visible,.snc-form button:focus-visible{outline:2px solid currentColor;outline-offset:2px}' +
  '.snc-form-consent{display:flex;gap:8px;align-items:flex-start;font-size:12px;line-height:1.4}' +
  '.snc-form-consent input{margin-top:2px;flex:none}' +
  '.snc-form-hp{position:absolute!important;left:-10000px!important;width:1px;height:1px;opacity:0;overflow:hidden}' +
  '.snc-form-error{font-size:13px;color:#b91c1c;min-height:1em;margin:0}' +
  '.snc-form button[type=submit]{cursor:pointer;border:none;border-radius:6px;padding:10px 20px;font-size:14px;font-weight:600}' +
  '.snc-form button[disabled]{opacity:.6;cursor:default}';

/** Reduce the owner's field list to what the endpoint accepts. Email is always present. */
export const normalizeFields = (fields) => {
  const out = [{ name: 'email', type: 'email', label: 'Email', placeholder: '', required: true }];
  for (const f of Array.isArray(fields) ? fields : []) {
    if (!f || typeof f !== 'object' || out.length >= MAX_FIELDS) continue;
    const name = String(f.name ?? '');
    if (!FIELD_KEY.test(name) || name === 'email' || name === 'hp') continue;
    out.push({
      name,
      type: INPUT_TYPES[f.type] ? f.type : 'text',
      label: String(f.label ?? name).slice(0, 80),
      placeholder: String(f.placeholder ?? '').slice(0, 80),
      required: f.required === true,
    });
  }
  return out;
};

/** `name` and `phone` are columns on the contact; everything else is stored as an answer. */
export const splitValues = (values) => {
  const { email, name, phone, ...fields } = values;
  return { email, name: name ?? '', phone: phone ?? '', fields };
};

const el = (tag, props = {}, children = []) => {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of children) node.append(child);
  return node;
};

/**
 * Build the form for a popup action.
 *
 * @param {object} action  the action, carrying `form`, `automation_id` and `variant`
 * @param {object} ctx     `{ submit(payload) → Promise<boolean>, onSuccess(), colors }`
 * @returns {HTMLFormElement}
 */
export const buildForm = (action, ctx) => {
  const cfg = action.form || {};
  const fields = normalizeFields(cfg.fields);
  const form = el('form', { className: 'snc-form', noValidate: true });
  form.setAttribute('data-snc', 'form');

  const inputs = {};
  fields.forEach((f, i) => {
    const id = `snc-f-${f.name}-${Math.random().toString(36).slice(2, 7)}`;
    const input = el('input', {
      id, name: f.name, type: INPUT_TYPES[f.type] || 'text', placeholder: f.placeholder,
      required: f.required, autocomplete: f.name === 'email' ? 'email' : f.type === 'tel' ? 'tel' : f.name === 'name' ? 'name' : 'off',
    });
    input.maxLength = f.name === 'email' ? 254 : 1000;
    inputs[f.name] = input;
    const wrap = el('div');
    wrap.append(el('label', { htmlFor: id, textContent: f.label }), input);
    form.append(wrap);
    if (i === 0) form.__firstInput = input;
  });

  // Honeypot: a real visitor never sees or reaches it, a form-filling bot fills every input.
  const hp = el('input', { name: 'hp', type: 'text', tabIndex: -1, autocomplete: 'off' });
  hp.setAttribute('aria-hidden', 'true');
  form.append(el('div', { className: 'snc-form-hp' }, [hp]));

  let consent = null;
  if (cfg.consent_text) {
    consent = el('input', { type: 'checkbox', name: 'consent', required: cfg.consent_required !== false });
    form.append(el('label', { className: 'snc-form-consent' }, [consent, el('span', { textContent: String(cfg.consent_text).slice(0, 300) })]));
  }

  const error = el('p', { className: 'snc-form-error' });
  error.setAttribute('role', 'alert');
  const button = el('button', { type: 'submit', textContent: String(cfg.submit_text || 'Subscribe').slice(0, 60) });
  button.style.background = ctx.colors.button;
  button.style.color = ctx.colors.buttonText;
  form.append(error, button);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.textContent = '';

    const values = {};
    for (const f of fields) {
      const v = inputs[f.name].value.trim();
      if (f.required && !v) { error.textContent = `${f.label} is required.`; inputs[f.name].focus(); return; }
      if (v) values[f.name] = v;
    }
    if (!EMAIL.test(values.email || '')) { error.textContent = 'Please enter a valid email address.'; inputs.email.focus(); return; }
    if (consent && consent.required && !consent.checked) { error.textContent = 'Please accept to continue.'; consent.focus(); return; }

    button.disabled = true;
    const ok = await ctx.submit({ ...splitValues(values), consent: !!(consent && consent.checked), hp: hp.value });
    if (ok) { ctx.onSuccess(); return; }
    button.disabled = false;
    error.textContent = 'Something went wrong. Please try again.';
  });

  return form;
};

/**
 * Show the thank-you state in place of the form.
 *
 * `role="status"` so a screen reader announces it; the message is the owner's, as text.
 */
export const successNode = (message) => {
  const p = el('p', { textContent: String(message || 'Thanks, you are subscribed.').slice(0, 300) });
  p.setAttribute('role', 'status');
  p.style.fontWeight = '600';
  return p;
};
