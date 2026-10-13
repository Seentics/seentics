import { describe, expect, it } from 'vitest';
import {
  MAX_EXTRA_FIELDS, addField, defaultLeadForm, isValidFieldName, nextFieldName, removeField, updateField, validateLeadForm,
  type LeadForm,
} from '@/lib/lead-form';

describe('lead form helpers', () => {
  it('starts with a valid default form', () => {
    expect(validateLeadForm(defaultLeadForm())).toEqual([]);
  });

  it('adds uniquely named fields up to the cap', () => {
    let form: LeadForm = { ...defaultLeadForm(), fields: [] };
    for (let i = 0; i < 12; i++) form = addField(form);
    expect(form.fields).toHaveLength(MAX_EXTRA_FIELDS);
    expect(new Set(form.fields.map((f) => f.name)).size).toBe(MAX_EXTRA_FIELDS);
    expect(validateLeadForm(form)).toEqual([]);
  });

  it('picks the next free name', () => {
    expect(nextFieldName([{ name: 'field_1', type: 'text', label: '', placeholder: '', required: false }])).toBe('field_2');
  });

  it('updates and removes by index', () => {
    const form = updateField(addField({ ...defaultLeadForm(), fields: [] }), 0, { label: 'Company', required: true });
    expect(form.fields[0]).toMatchObject({ label: 'Company', required: true });
    expect(removeField(form, 0).fields).toEqual([]);
  });

  it('rejects reserved, malformed and duplicate names', () => {
    expect(isValidFieldName('company')).toBe(true);
    for (const bad of ['email', 'EMAIL', 'hp', 'consent', '1abc', 'has space', '', 'x'.repeat(41)]) {
      expect(isValidFieldName(bad), bad).toBe(false);
    }
    const dup = { ...defaultLeadForm(), fields: [
      { name: 'a', type: 'text' as const, label: '', placeholder: '', required: false },
      { name: 'A', type: 'text' as const, label: '', placeholder: '', required: false },
    ] };
    expect(validateLeadForm(dup).join(' ')).toMatch(/Two fields/);
  });

  it('only accepts safe redirects', () => {
    const base = defaultLeadForm();
    expect(validateLeadForm({ ...base, success_redirect_url: '/thanks' })).toEqual([]);
    expect(validateLeadForm({ ...base, success_redirect_url: 'https://x.test' })).toEqual([]);
    expect(validateLeadForm({ ...base, success_redirect_url: 'javascript:alert(1)' }).length).toBe(1);
    expect(validateLeadForm({ ...base, success_redirect_url: '//evil.test' }).length).toBe(1);
  });
});
