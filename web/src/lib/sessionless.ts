/**
 * Pages read with a link's token instead of a session, by people who are not our customers: an
 * embed inside someone else's product, and an agency's client portal (possibly on the agency's own
 * domain). They probe no session, load no chat and are not self-tracked.
 */
export const isSessionlessPath = (path: string | null | undefined): boolean =>
  Boolean(path && /^\/(embed|client-portal)\//.test(path));
