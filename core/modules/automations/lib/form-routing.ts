import type { FormRouting } from "../interfaces";
import { clientActionsOf } from "./popup-rewards";

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Where the first form in the definition sends its submissions.
 *
 * Read from the stored definition, never from the request: the browser only says which popup
 * it submitted, so a visitor cannot redirect a lead to another destination. A definition
 * without a form, or whose form names no destinations, routes everywhere (`null`).
 */
export function routingOfDefinition(definition: Record<string, unknown>): FormRouting {
  for (const action of clientActionsOf(definition)) {
    if ((action.type !== "show_modal" && action.type !== "show_banner") || !isObject(action.form)) continue;
    const ids = action.form.destinations;
    return { destinations: Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : null };
  }
  return { destinations: null };
}
