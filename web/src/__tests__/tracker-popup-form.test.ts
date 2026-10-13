// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { buildForm, normalizeFields, splitValues, successNode } from '../../public/trackers/popup-form.js';

const colors = { button: '#2563eb', buttonText: '#ffffff' };

describe('normalizeFields', () => {
  it('always leads with a required email field', () => {
    const fields = normalizeFields(undefined);
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ name: 'email', type: 'email', required: true });
  });

  it('keeps valid extra fields and drops reserved or malformed ones', () => {
    const fields = normalizeFields([
      { name: 'name', label: 'Name' },
      { name: 'email' },
      { name: 'hp' },
      { name: 'bad key' },
      { name: 'phone', type: 'tel', required: true },
      { name: 'x', type: 'checkbox' },
      null,
    ]);
    expect(fields.map((f: { name: string }) => f.name)).toEqual(['email', 'name', 'phone', 'x']);
    expect(fields.find((f: { name: string }) => f.name === 'x')?.type).toBe('text');
    expect(fields.find((f: { name: string }) => f.name === 'phone')?.required).toBe(true);
  });

  it('caps the number of fields', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ name: `f${i}` }));
    expect(normalizeFields(many)).toHaveLength(8);
  });
});

describe('splitValues', () => {
  it('lifts name and phone out and leaves the rest as answers', () => {
    expect(splitValues({ email: 'a@b.co', name: 'Jane', company: 'Acme' })).toEqual({
      email: 'a@b.co', name: 'Jane', phone: '', fields: { company: 'Acme' },
    });
  });
});

function mount(cfg: Record<string, unknown> = {}, submit = vi.fn().mockResolvedValue(true)) {
  const onSuccess = vi.fn();
  const form = buildForm({ form: cfg, automation_id: 'a1' }, { colors, submit, onSuccess }) as HTMLFormElement;
  document.body.replaceChildren(form);
  const email = form.querySelector('input[name=email]') as HTMLInputElement;
  const submitForm = () => form.dispatchEvent(new Event('submit', { cancelable: true }));
  return { form, email, submit, onSuccess, submitForm };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('buildForm', () => {
  it('renders owner text as text, never as markup', () => {
    const { form } = mount({ submit_text: '<img src=x onerror=alert(1)>', fields: [{ name: 'name', label: '<b>Name</b>' }] });
    expect(form.querySelector('img')).toBeNull();
    expect(form.querySelector('b')).toBeNull();
    expect(form.querySelector('button')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('rejects an invalid email without submitting', async () => {
    const { email, submit, submitForm, form } = mount();
    email.value = 'nope';
    submitForm();
    await tick();
    expect(submit).not.toHaveBeenCalled();
    expect(form.querySelector('.snc-form-error')?.textContent).toMatch(/valid email/i);
  });

  it('submits trimmed values with the honeypot and calls onSuccess', async () => {
    const { email, submit, onSuccess, submitForm } = mount({ fields: [{ name: 'name' }] });
    email.value = '  jane@example.com ';
    (document.querySelector('input[name=name]') as HTMLInputElement).value = ' Jane ';
    submitForm();
    await tick();
    expect(submit).toHaveBeenCalledWith({
      email: 'jane@example.com', name: 'Jane', phone: '', fields: {}, consent: false, hp: '',
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('sends the honeypot value so the server can discard the bot', async () => {
    const { email, submit, submitForm } = mount();
    email.value = 'bot@example.com';
    (document.querySelector('input[name=hp]') as HTMLInputElement).value = 'spam';
    submitForm();
    await tick();
    expect(submit.mock.calls[0][0].hp).toBe('spam');
  });

  it('requires consent when asked, and reports it as given', async () => {
    const { email, submit, submitForm, form } = mount({ consent_text: 'I agree' });
    email.value = 'a@b.co';
    submitForm();
    await tick();
    expect(submit).not.toHaveBeenCalled();
    expect(form.querySelector('.snc-form-error')?.textContent).toMatch(/accept/i);

    (form.querySelector('input[name=consent]') as HTMLInputElement).checked = true;
    submitForm();
    await tick();
    expect(submit.mock.calls[0][0].consent).toBe(true);
  });

  it('re-enables the button and shows an error when the submit fails', async () => {
    const { email, submitForm, form, onSuccess } = mount({}, vi.fn().mockResolvedValue(false));
    email.value = 'a@b.co';
    submitForm();
    await tick();
    expect(onSuccess).not.toHaveBeenCalled();
    expect((form.querySelector('button') as HTMLButtonElement).disabled).toBe(false);
    expect(form.querySelector('.snc-form-error')?.textContent).toMatch(/try again/i);
  });
});

describe('successNode', () => {
  it('is an announced status message with the owner text', () => {
    const node = successNode('You are in!');
    expect(node.getAttribute('role')).toBe('status');
    expect(node.textContent).toBe('You are in!');
  });
});
