import { describe, expect, it } from 'vitest';
import { validateDefinition } from '@/components/automations/AutomationBuilder';
import { TEMPLATES } from '@/features/automations/templates';

/**
 * Every starter template must be saveable as it is shipped.
 *
 * "Welcome New Visitors" and "Pricing Page Follow-up" each left an `if`'s false branch
 * unwired, which the builder (rightly) refuses to save — so picking either template
 * opened a builder whose Save button was disabled, with nothing on screen to say why.
 */
describe('automation templates', () => {
  it.each(TEMPLATES.map(t => [t.name, t] as const))('%s passes the builder\'s validation', (_name, template) => {
    expect(validateDefinition(template.definition)).toEqual([]);
  });

  it('have unique ids', () => {
    expect(new Set(TEMPLATES.map(t => t.id)).size).toBe(TEMPLATES.length);
  });
});
