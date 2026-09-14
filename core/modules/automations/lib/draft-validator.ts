import {
  automationDefinitionSchema,
  CLIENT_ACTION_TYPES,
  TRIGGER_TYPES,
} from "../validators/automation.schema";
import type { AutomationDraftValidator } from "../interfaces/automations.module";

/**
 * `AutomationDraftValidator` over the same schema the create endpoint uses.
 *
 * One schema, two callers: the endpoint that saves and the AI tool that drafts. A second
 * copy for drafting would let the two drift, and a draft that validates here but fails on
 * save is worse than one refused up front — the person has already approved it.
 */
export class AutomationDraftValidatorService implements AutomationDraftValidator {
  vocabulary() {
    // `webhook` is the server-performed action and lives outside CLIENT_ACTION_TYPES.
    return { triggerTypes: TRIGGER_TYPES, actionTypes: [...CLIENT_ACTION_TYPES, "webhook"] };
  }

  validateDefinition(definition: unknown) {
    const parsed = automationDefinitionSchema.safeParse(definition);
    if (parsed.success) return { ok: true as const, definition: parsed.data };
    const error = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return { ok: false as const, error };
  }
}
