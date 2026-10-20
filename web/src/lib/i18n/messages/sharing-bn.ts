import type { SharingMessages } from './sharing-en';

/** Sharing in Bangla. */
export const sharingBn: SharingMessages = {
  embed: {
    tabs: { analytics: 'Analytics', recordings: 'রেকর্ডিং', heatmaps: 'Heatmap' },
    invalidTitle: 'এই এম্বেড লিংক আর কাজ করছে না',
    invalidBody: 'হয়তো এটা বাতিল করা হয়েছে। যিনি এই পেজ চালান, তার কাছে নতুন লিংক চান।',
    loadFailed: 'ড্যাশবোর্ড লোড হয়নি',
    tryAgain: 'একটু পরে আবার চেষ্টা করুন।',
    noWebsites: 'এই ক্লায়েন্টের এখনো কোনো ওয়েবসাইট নেই।',
    chooseWebsite: 'ওয়েবসাইট বেছে নিন',
  },

  share: {
    unavailableTitle: 'ড্যাশবোর্ড পাওয়া যাচ্ছে না',
    unavailableBody: 'ড্যাশবোর্ডটা হয়তো প্রাইভেট, লিংকের মেয়াদ শেষ, অথবা ওয়েবসাইটটা মুছে ফেলা হয়েছে।',
    home: 'Seentics হোমে যান',
    fallbackTitle: 'অ্যানালিটিক্স ড্যাশবোর্ড',
    publicDashboard: 'পাবলিক ড্যাশবোর্ড',
    poweredBy: 'Powered by',
    tagline: 'সহজ, প্রাইভেসি-বান্ধব Google Analytics-এর বিকল্প।',
  },

  public: {
    loading: 'পাবলিক ড্যাশবোর্ড লোড হচ্ছে...',
    notFoundTitle: 'ড্যাশবোর্ড পাওয়া যায়নি',
    notFoundBody: 'ড্যাশবোর্ডটা হয়তো প্রাইভেট করা হয়েছে, অথবা লিংকটা ভুল।',
    back: 'Seentics-এ ফিরে যান',
    publicAnalytics: 'পাবলিক অ্যানালিটিক্স',
    selectRange: 'সময় বেছে নিন',
    ranges: { '1': 'গত 24 ঘণ্টা', '7': 'গত 7 দিন', '30': 'গত 30 দিন', '90': 'গত 90 দিন' },
    subtitle: 'রিয়েল-টাইম এনগেজমেন্ট আর ট্রাফিকের তথ্য।',
    liveVisitors: (n) => `${n} জন এখন লাইভ`,
    poweredBy: 'অ্যানালিটিক্স চালাচ্ছে\nSeentics Platform',
    generatedBy: 'Seentics Open Source অ্যানালিটিক্স দিয়ে তৈরি',
    tagline: 'রিয়েল-টাইম, প্রাইভেসি-বান্ধব ওয়েবসাইট পারফরম্যান্স ট্র্যাকিং।',
  },

  settingsCard: {
    title: 'পাবলিক ড্যাশবোর্ড লিংক',
    hint: 'লিংক যার কাছে থাকবে, সে-ই এই ওয়েবসাইটের ট্রাফিক দেখতে পারবে: ভিজিটর, টপ পেজ, সোর্স, দেশ আর ডিভাইস। সাইন-ইন লাগবে না।',
    enable: 'পাবলিক লিংক শেয়ার করুন',
    copy: 'লিংক কপি করুন',
    copied: 'লিংক কপি হয়েছে',
    open: 'খুলুন',
    enabled: 'পাবলিক লিংক চালু হয়েছে',
    disabled: 'পাবলিক লিংক বন্ধ হয়েছে। পুরনো লিংক আর কাজ করবে না।',
    failed: 'পাবলিক লিংক বদলানো যায়নি',
  },

  preview: {
    logs: 'ওয়ার্কফ্লো লগ',
    restart: 'আবার শুরু',
    clear: 'মুছুন',
    waiting: 'ইভেন্টের অপেক্ষায়...',
    loading: 'ওয়ার্কফ্লো প্রিভিউ লোড হচ্ছে...',
    title: 'নমুনা ক্লায়েন্ট ওয়েবসাইট',
    subtitle: 'এই পেজে আপনার ওয়ার্কফ্লো পরীক্ষা করে দেখুন। সেট করা সব ট্রিগার এখন চালু।',
    intro: 'আপনার ওয়ার্কফ্লো এখন চলছে। ট্রিগার পরীক্ষা করতে এই পেজে কিছু করে দেখুন:',
    triggers: [
      { name: 'Page View / Time on Page:', text: 'এই ট্রিগারগুলো ইতিমধ্যে চালু হয়ে গেছে।' },
      { name: 'Scroll Depth:', text: 'এই ট্রিগার পরীক্ষা করতে পেজটা নিচে স্ক্রল করুন।' },
      { name: 'Exit Intent:', text: 'পেজ ছেড়ে যাওয়ার মতো করে মাউস ব্রাউজারের উপরের দিকে নিয়ে যান।' },
      { name: 'Element Click:', text: 'নিচের বাটনে ক্লিক করুন।' },
    ],
    clickMe: 'এখানে ক্লিক করুন (Element Click ট্রিগারের জন্য)',
    anotherSection: 'আরেকটা সেকশন',
    errorNoWebsite: 'এরর: websiteId query parameter লাগবে।',
    errorNotFound: 'এরর: ওয়ার্কফ্লো পাওয়া যায়নি।',
    errorFetching: (message) => `ওয়ার্কফ্লো আনতে এরর: ${message}`,
    unknownError: 'অজানা একটা এরর হয়েছে',
    selectorMatches: (selector, n) => `Selector '${selector}' মিলেছে: ${n}`,
    invalidSelector: (selector) => `ভুল selector: ${selector}`,
  },
};
