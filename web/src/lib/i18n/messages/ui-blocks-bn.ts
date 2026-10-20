import type { UiBlocksMessages } from './ui-blocks-en';

/** UI Blocks in Bangla. */
export const uiBlocksBn: UiBlocksMessages = {
  page: {
    title: 'UI Blocks',
    description: 'আপনার প্রোডাক্টে বসানোর মতো অ্যানালিটিক্স উইজেট, ব্যাজ আর চার্ট — কপি করে পেস্ট করুন।',
    fullDocs: 'পুরো ডকস',
    searchPlaceholder: 'ব্লক খুঁজুন...',
    noMatch: 'সার্চের সাথে কোনো ব্লক মেলেনি।',
    comingSoon: 'শিগগিরই আসছে',
    showCode: 'কোড দেখুন',
    hideCode: 'কোড লুকান',
    copy: 'কপি',
    copied: 'ক্লিপবোর্ডে কপি হয়েছে',
    copyFailed: 'কপি করা গেল না',
    copyFailedBody: '“কোড দেখুন” চেপে সেখান থেকে কপি করুন।',
    notAvailable: 'এখনো পাওয়া যাচ্ছে না — এই উইজেটগুলোর জন্য দরকারি এমবেড script এখনো পাবলিশ হয়নি। আজই লাইভ দেখতে চাইলে Full Dashboard এমবেড ব্যবহার করুন।',
  },
  categories: {
    all: 'সব',
    badge: 'ব্যাজ',
    chart: 'চার্ট',
    widget: 'উইজেট',
    embed: 'এমবেড',
  },
  blocks: {
    'live-visitors-badge': { name: 'লাইভ ভিজিটর ব্যাজ', description: 'এই মুহূর্তে কতজন ভিজিটর আছে, জ্বলে-নেভা ইন্ডিকেটরসহ।' },
    'pageviews-badge': { name: 'পেজ ভিউ ব্যাজ', description: 'আজকের পেজ ভিউ সংখ্যা — ল্যান্ডিং পেজ বা মার্কেটিং সাইটের জন্য দারুণ।' },
    sparkline: { name: 'ট্রাফিক স্পার্কলাইন', description: '7 দিনের ট্রাফিকের ছোট্ট ট্রেন্ড লাইন — হালকা, লেখার ভেতরেই বসে, সব স্ক্রিনে মানায়।' },
    'stats-widget': { name: 'স্ট্যাটস উইজেট', description: '3 কলামের সারাংশ: ভিজিটর, pageview আর ইভেন্ট।' },
    'top-pages-widget': { name: 'টপ পেজ উইজেট', description: 'সবচেয়ে বেশি দেখা পেজগুলোর তালিকা, তুলনামূলক বার চার্টসহ।' },
    'country-widget': { name: 'দেশভিত্তিক ভাগ', description: 'ভিজিটরের ভাগ অনুযায়ী টপ দেশগুলো, পতাকা আর প্রোগ্রেস বারসহ।' },
    'full-embed': { name: 'Full Dashboard Embed', description: 'পুরো Seentics অ্যানালিটিক্স ড্যাশবোর্ড যেকোনো iframe-এ বসান।' },
    'react-component': { name: 'React কম্পোনেন্ট', description: '@seentics/ui দিয়ে নিজের React অ্যাপে আপনার ডেটা দেখান (npm-এ আসার আগ পর্যন্ত সোর্স থেকে ব্যবহার করুন)।' },
  },
  setup: {
    createEmbed: 'এমবেড লিংক বানান',
    readGuide: 'গাইড পড়ুন',
  },
  preview: {
    live: (n) => `${n} জন লাইভ`,
    viewsToday: (v) => `আজ ${v} ভিউ`,
    visitors: 'ভিজিটর',
    pageviews: 'Pageview',
    events: 'Event',
    topPages: 'টপ পেজ',
    topCountries: 'টপ দেশ',
    iframeEmbed: 'iframe embed',
    countries: {
      us: 'যুক্তরাষ্ট্র',
      gb: 'যুক্তরাজ্য',
      de: 'জার্মানি',
      fr: 'ফ্রান্স',
    },
  },
  codeBlock: {
    copied: 'ক্লিপবোর্ডে কপি হয়েছে',
    copy: 'কোড কপি করুন',
  },
};
