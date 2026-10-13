import type { IntegrationProvider, ProviderId } from "../interfaces";
import { hubspot } from "./hubspot";
import { klaviyo } from "./klaviyo";
import { mailchimp } from "./mailchimp";
import { zapier } from "./zapier";

/**
 * Every provider, in the order the dashboard lists them. Adding one is adding its file and a
 * line here; nothing else in the module names a provider.
 */
// The registry is heterogeneous: each entry is typed to its own credentials and config, and
// callers only ever reach them through the validated path in `ConnectionService`.
const ALL = [zapier, mailchimp, klaviyo, hubspot] as unknown as IntegrationProvider[];

export const providers: readonly IntegrationProvider[] = ALL;

export function getProvider(id: string): IntegrationProvider | undefined {
  return ALL.find((p) => p.id === (id as ProviderId));
}
