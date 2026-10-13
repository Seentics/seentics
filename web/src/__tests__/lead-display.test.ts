import { describe, expect, it } from 'vitest';
import { avatarTone, hostOf, humanizeKey, initials, pathOf, splitAnswers } from '@/lib/lead-display';

describe('initials', () => {
  it('uses first and last word of the name, else the email', () => {
    expect(initials('Ava Martin', 'x@y.co')).toBe('AM');
    expect(initials('Mary Jane Watson', 'x@y.co')).toBe('MW');
    expect(initials('Cher', 'x@y.co')).toBe('CH');
    expect(initials('', 'jane.doe@example.com')).toBe('JA');
    expect(initials('  ', '@@')).toBe('?');
  });
});

describe('avatarTone', () => {
  it('is stable per address and varies between them', () => {
    expect(avatarTone('a@b.co')).toBe(avatarTone('a@b.co'));
    const tones = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((x) => avatarTone(`${x}@example.com`)));
    expect(tones.size).toBeGreaterThan(1);
  });
});

describe('pathOf and hostOf', () => {
  it('shortens URLs and tolerates junk', () => {
    expect(pathOf('https://seentics.com/pricing?utm=x#a')).toBe('/pricing');
    expect(pathOf('https://seentics.com')).toBe('/');
    expect(pathOf('not a url')).toBe('not a url');
    expect(pathOf('')).toBe('');
    expect(hostOf('https://www.google.com/search?q=1')).toBe('google.com');
    expect(hostOf('')).toBe('');
  });
});

describe('splitAnswers', () => {
  it('lifts the wheel prize and code out of the ordinary answers', () => {
    expect(splitAnswers({ company: 'Acme', prize: '20% off', coupon_code: 'SPIN20', seats: 5 })).toEqual({
      prize: { label: '20% off', code: 'SPIN20' },
      rest: [['company', 'Acme'], ['seats', '5']],
    });
  });
  it('has no prize when there is none, and still shows a code with no label', () => {
    expect(splitAnswers({ company: 'Acme' }).prize).toBeNull();
    expect(splitAnswers({ coupon_code: 'X' }).prize).toEqual({ label: '', code: 'X' });
    expect(splitAnswers({})).toEqual({ prize: null, rest: [] });
  });
});

describe('humanizeKey', () => {
  it('turns identifiers into labels', () => {
    expect(humanizeKey('company_name')).toBe('Company name');
    expect(humanizeKey('team-size')).toBe('Team size');
  });
});
