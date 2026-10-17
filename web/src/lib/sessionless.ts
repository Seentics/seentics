/**
 * Pages read with a link's token instead of a session, by people who are not our customers: an
 * embed inside someone else's product. They probe no session, load no chat and are not self-tracked.
 */
export const isSessionlessPath = (path: string | null | undefined): boolean =>
  Boolean(path && /^\/embed\//.test(path));
