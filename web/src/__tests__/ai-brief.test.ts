import { describe, expect, it } from 'vitest';
import { briefPhrase } from '@/components/ai/AiBrief';

describe('one-line AI brief', () => {
  it('keeps each point to its first clause, without splitting numbers', () => {
    expect(briefPhrase('Visitors rose 8% week over week to 12,340, led by organic search (+21%).', 'finding'))
      .toBe('Visitors rose 8% week over week to 12,340');
    expect(briefPhrase('Checkout errors surged', 'alert')).toBe('Checkout errors surged');
  });

  it('reads a suggestion as the next step', () => {
    expect(briefPhrase('Make the plan cards on /pricing clickable, or move the Start trial button above the fold.', 'action'))
      .toBe('Next: make the plan cards on /pricing clickable');
  });

  it('caps a long point so three fit on one line', () => {
    expect(briefPhrase('a'.repeat(120), 'finding').length).toBeLessThanOrEqual(70);
  });
});
