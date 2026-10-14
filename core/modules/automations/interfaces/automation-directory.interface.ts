/**
 * Which automations exist on a website, and what they are called.
 *
 * A port for modules that record something *about* an automation — leads attribute a
 * submission to the popup that collected it — and so need to check an id the browser
 * sent and show a name, without querying `automations` themselves.
 */
/** One slice of a spin wheel, as the server pays it out. */
export type WheelSegment = { label: string; weight: number; coupon_code: string };

/**
 * What a popup can give a visitor who submits its form.
 *
 * Read from the stored definition rather than the page, because the page is not trusted:
 * the prize is chosen from this, on the server, and the code travels back only with the
 * chosen prize. Exactly one of `wheel` and `coupon` is set.
 */
export type PopupRewards = {
  wheel: WheelSegment[] | null;
  coupon: { code: string; description: string } | null;
};

/**
 * Where a popup's form sends its submissions.
 *
 * `destinations` are integration connection ids the owner picked in the builder; `null`
 * means the owner picked none, so every enabled destination on the website receives it.
 * An empty array is a deliberate "nowhere".
 */
export type FormRouting = { destinations: string[] | null };

export interface AutomationDirectory {
  /**
   * Names of the given automations that belong to this website, keyed by id.
   *
   * An id missing from the result either does not exist or belongs to another website;
   * callers cannot tell which, which is the point.
   */
  names(websiteId: string, ids: readonly string[]): Promise<Map<string, string>>;

  /**
   * The rewards the automation's popup pays out, or `null` for an automation that does not
   * exist on this website or whose popup has none.
   */
  rewards(websiteId: string, automationId: string): Promise<PopupRewards | null>;

  /**
   * Where the automation's form sends submissions, or `null` for an automation that does not
   * exist on this website. An automation without a form routes to every destination.
   */
  routing(websiteId: string, automationId: string): Promise<FormRouting | null>;
}
