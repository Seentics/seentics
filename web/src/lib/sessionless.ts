import { onCustomHost } from './seentics-host';

/**
 * Pages read with a link's token instead of a session, by people who are not our customers: an
 * embed inside someone else's product. They probe no session, load no chat and are not self-tracked.
 */
export const isSessionlessPath = (path: string | null | undefined): boolean =>
  Boolean(path && /^\/embed\//.test(path));

/**
 * An agency's audience rather than ours: a client user signed in to their agency's dashboard
 * (client mode), the client sign-in pages, or anything on an agency's own domain. Like an embed,
 * they load no chat (they talk to the agency, not to us) and are not self-tracked (they are the
 * agency's clients, not our visitors).
 */
export const isClientAudience = (path: string | null | undefined, user?: { kind?: string } | null): boolean =>
  isSessionlessPath(path) || Boolean(path && /^\/signin(\/|$)/.test(path)) || user?.kind === 'client' || onCustomHost();
