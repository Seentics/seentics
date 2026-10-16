import { describe, expect, it } from 'vitest';
import { guessMapping, normaliseStatus, parseCsv, prepareImport, splitTags } from '@/lib/leads-csv';

describe('parseCsv', () => {
  it('reads quoted fields with commas, doubled quotes and line breaks', () => {
    const rows = parseCsv('email,notes\r\na@example.com,"Met at ""Expo"", Berlin"\nb@example.com,"two\nlines"\n');
    expect(rows).toEqual([['email', 'notes'], ['a@example.com', 'Met at "Expo", Berlin'], ['b@example.com', 'two\nlines']]);
  });

  it('ignores a byte-order mark, blank lines and a missing final line break', () => {
    expect(parseCsv('﻿email\n\n,\na@example.com')).toEqual([['email'], ['a@example.com']]);
  });
});

describe('guessMapping', () => {
  it('finds columns by their usual headers, in any case and order', () => {
    expect(guessMapping(['Full Name', 'E-mail', 'Mobile', 'Lead Status', 'Labels', 'Comments'])).toEqual({
      email: 1, name: 0, phone: 2, status: 3, tags: 4, notes: 5,
    });
  });

  it('falls back to the first column holding an address when no header says email', () => {
    expect(guessMapping(['who', 'contact info'], [['Ava', 'ava@example.com']]).email).toBe(1);
    expect(guessMapping(['a', 'b']).email).toBe(-1);
  });
});

describe('prepareImport', () => {
  const mapping = { email: 0, name: 1, phone: -1, status: 2, tags: 3, notes: -1 };

  it('turns rows into contacts, lower-casing emails and reading statuses and tags', () => {
    const out = prepareImport([['Ava@Example.com', 'Ava', 'Won', 'VIP; event, vip']], mapping);
    expect(out.rows).toEqual([{ email: 'ava@example.com', name: 'Ava', status: 'customer', tags: ['vip', 'event'] }]);
  });

  it('reports rows without a usable email by spreadsheet line, and keeps the first of a repeated email', () => {
    const out = prepareImport([['', 'Nobody'], ['not-an-email'], ['a@example.com'], ['A@example.com', 'Again']], mapping);
    expect(out.invalid).toEqual([{ row: 2, reason: 'No email' }, { row: 3, reason: 'Not an email address: not-an-email' }]);
    expect(out.rows).toEqual([{ email: 'a@example.com' }]);
    expect(out.duplicates).toBe(1);
  });
});

describe('statuses and tags', () => {
  it('maps common CRM words onto ours and leaves unknown ones unset', () => {
    expect(normaliseStatus('Qualified')).toBe('qualified');
    expect(normaliseStatus('closed lost')).toBe('lost');
    expect(normaliseStatus('mystery')).toBeUndefined();
    expect(splitTags(' a | b ;a,')).toEqual(['a', 'b']);
  });
});
