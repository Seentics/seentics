/**
 * Which automations exist on a website, and what they are called.
 *
 * A port for modules that record something *about* an automation — leads attribute a
 * submission to the popup that collected it — and so need to check an id the browser
 * sent and show a name, without querying `automations` themselves.
 */
export interface AutomationDirectory {
  /**
   * Names of the given automations that belong to this website, keyed by id.
   *
   * An id missing from the result either does not exist or belongs to another website;
   * callers cannot tell which, which is the point.
   */
  names(websiteId: string, ids: readonly string[]): Promise<Map<string, string>>;
}
