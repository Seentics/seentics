/** The JS error tracking page in English. `errors-bn.ts` mirrors it. */
export const errorsEn = {
  page: {
    title: 'Errors',
    description: 'The JavaScript and network errors your visitors hit, grouped, with the sessions where they happened.',
    statusLabel: 'Status',
    selected: (n: number) => `${n} selected`,
    allErrors: 'All errors',
    searchPlaceholder: 'Search errors…',
    searchLabel: 'Search errors',
    count: (n: number) => `${n} ${n === 1 ? 'error' : 'errors'}`,
    trend: 'Trend',
    kind: 'Kind',
    noMatches: 'No matches',
    noUnresolved: 'No unresolved errors',
    noErrors: 'No errors here',
    noMatchesBody: 'No error matches these filters or that search in this range.',
    notFound: 'This error is not on this site any more. It may have been purged.',
    loadFailed: 'This error could not be loaded. Try again in a moment.',
    capped: (shown: number, total: number) =>
      `Showing the ${shown} most recently seen of ${total} errors. Search or pick a shorter range to find the rest.`,
    /** `status` is '' for "every status". */
    emptyBody: (status: '' | 'unresolved' | 'resolved' | 'ignored', period: string) =>
      `Nothing ${status ? `${status} ` : ''}${period}. Uncaught JavaScript errors from real visitors appear here, grouped by fault.`,
  },
  tabs: { unresolved: 'Unresolved', resolved: 'Resolved', ignored: 'Ignored', all: 'All' },
  /** An error's status, as its tag shows it. */
  status: { unresolved: 'Unresolved', resolved: 'Resolved', ignored: 'Ignored' },
  ranges: { day: 'Last 24 hours', week: 'Last 7 days', month: 'Last 30 days' },
  sorts: { count: 'Most frequent', visitors: 'Most visitors', recent: 'Last seen', new: 'Newest' },
  /** How the period reads inside a sentence. */
  period: (days: number) => (days === 1 ? 'in the last 24 hours' : `in the last ${days} days`),
  columns: {
    error: 'Error',
    trend: 'Trend',
    occurrences: 'Occurrences',
    visitors: 'Visitors',
    page: 'Page',
    source: 'Source',
    firstSeen: 'First seen',
    lastSeen: 'Last seen',
    tableLabel: 'Errors',
  },
  buckets: {
    new: 'New',
    worse: 'Getting worse',
    key_pages: 'On checkout or signup',
    better: 'Calming down',
    noisy: 'Noisy but harmless',
    steady: 'Steady',
  },
  bucketHints: {
    new: 'First seen in this period',
    worse: 'At least twice as often as the period before',
    key_pages: 'Hitting the pages that make money',
    better: 'Less than half as often as before',
    noisy: 'Browser warnings that rarely affect visitors',
  },
  /** The one plain-words line under each error. */
  line: {
    times: (n: string, one: boolean) => `${n} time${one ? '' : 's'}`,
    harmless: 'Browser warning — usually harmless',
    on: (path: string) => `On ${path}`,
    onPages: (pages: string[]) => ` on ${pages.join(' and ')}`,
    affected: (n: string, one: boolean) => `, ${n} visitor${one ? '' : 's'} affected`,
    new: 'New',
    backAgain: 'Back again',
    upFrom: (n: string) => `Up from ${n}`,
    downFrom: (n: string) => `Down from ${n}`,
    steady: 'Steady',
    notSeen: (period: string) => `Not seen ${period}`,
    full: (trend: string, times: string, where: string, period: string, who: string) => `${trend} · ${times}${where} ${period}${who}`,
  },
  /** Compact relative time: "5s ago", "3m ago", "2h ago", "4d ago". Shared by other pages. */
  time: {
    seconds: (n: number) => `${n}s ago`,
    minutes: (n: number) => `${n}m ago`,
    hours: (n: number) => `${n}h ago`,
    days: (n: number) => `${n}d ago`,
  },
  detail: {
    occurrences: 'Occurrences',
    firstSeen: 'First seen',
    lastSeen: 'Last seen',
    resolve: 'Resolve',
    ignore: 'Ignore',
    reopen: 'Reopen',
    recent: 'Recent occurrences',
    noSamples: 'No samples kept in this range — occurrences are retained for a shorter period than the counts above.',
    watchReplay: 'Watch replay',
    noReplay: 'No replay recorded',
  },
};

export type ErrorsMessages = typeof errorsEn;
