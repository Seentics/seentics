/** Ui: the shared controls (tables, collections, date ranges, calendar). */
export const uiEn = {
  dates: {
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },

  ranges: {
    last24Hours: 'Last 24 hours',
    lastDays: (n: number) => `Last ${n} days`,
    selectDates: 'Select dates',
    dateRange: 'Date range',
    presets: 'Date presets',
  },

  table: {
    selectAll: 'Select all',
    selectRow: 'Select row',
    noResults: 'No results',
    rowsRange: (from: number, to: number, total: number) => `${from}–${to} of ${total} rows`,
    firstPage: 'First page',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    lastPage: 'Last page',
  },

  collection: {
    layout: 'Layout',
    layouts: { list: 'List', table: 'Table', cards: 'Cards', board: 'Board' },
    sortedBy: 'Sorted by',
    sortBy: 'Sort by',
    addFilter: 'Add filter',
    nothingToFilter: 'Nothing to filter on yet',
    /** The word between a filter's field and value: "Status is Customer". */
    is: 'is',
    changeFilter: (field: string, value: string) => `Change ${field}: ${value}`,
    removeFilter: (filter: string) => `Remove filter: ${filter}`,
    selectAllShown: 'Select all shown',
    selectItem: (label: string) => `Select ${label}`,
    pages: 'Pages',
    range: (first: string, last: string, total: string) => `${first}–${last} of ${total}`,
    previous: 'Previous',
    next: 'Next',
  },
};

export type UiMessages = typeof uiEn;
