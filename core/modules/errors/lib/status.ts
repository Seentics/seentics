/**
 * The statuses a group may hold.
 *
 * Its own file rather than living beside the query service, because the routes need only
 * this and importing it from there dragged the repository — and therefore the database
 * connection — into the request-validation path. A string check should not open a socket.
 */
export const ERROR_STATUSES = ["unresolved", "resolved", "ignored"] as const;

export type ErrorStatus = (typeof ERROR_STATUSES)[number];

export function isErrorStatus(value: string): value is ErrorStatus {
  return (ERROR_STATUSES as readonly string[]).includes(value);
}
