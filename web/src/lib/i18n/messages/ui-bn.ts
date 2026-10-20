import type { UiMessages } from './ui-en';

/** Ui in Bangla. Dates keep Latin digits: "27 সেপ্টে". */
export const uiBn: UiMessages = {
  dates: {
    weekdays: ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র', 'শনি'],
    weekdaysMin: ['র', 'সো', 'ম', 'বু', 'বৃ', 'শু', 'শ'],
    months: ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রি', 'মে', 'জুন', 'জুলাই', 'আগ', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'],
    monthsLong: ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'],
  },

  ranges: {
    last24Hours: 'গত 24 ঘণ্টা',
    lastDays: (n) => `গত ${n} দিন`,
    selectDates: 'তারিখ বেছে নিন',
    dateRange: 'তারিখের রেঞ্জ',
    presets: 'তারিখের অপশন',
  },

  table: {
    selectAll: 'সব সিলেক্ট করুন',
    selectRow: 'এই সারি সিলেক্ট করুন',
    noResults: 'কিছু পাওয়া যায়নি',
    rowsRange: (from, to, total) => `${total}টি সারির মধ্যে ${from}–${to}`,
    firstPage: 'প্রথম পেজ',
    previousPage: 'আগের পেজ',
    nextPage: 'পরের পেজ',
    lastPage: 'শেষ পেজ',
  },

  collection: {
    layout: 'লেআউট',
    layouts: { list: 'লিস্ট', table: 'টেবিল', cards: 'কার্ড', board: 'বোর্ড' },
    sortedBy: 'সাজানো:',
    sortBy: 'যেভাবে সাজাবেন',
    addFilter: 'ফিল্টার যোগ করুন',
    nothingToFilter: 'এখনো ফিল্টার করার মতো কিছু নেই',
    is: 'হলো',
    changeFilter: (field, value) => `${field} বদলান: ${value}`,
    removeFilter: (filter) => `ফিল্টার সরান: ${filter}`,
    selectAllShown: 'যা দেখাচ্ছে সব সিলেক্ট করুন',
    selectItem: (label) => `${label} সিলেক্ট করুন`,
    pages: 'পেজ',
    range: (first, last, total) => `${total}টির মধ্যে ${first}–${last}`,
    previous: 'আগের',
    next: 'পরের',
  },

  calendar: {
    previousMonth: 'আগের মাসে যান',
    nextMonth: 'পরের মাসে যান',
  },
};
