/**
 * The /bd page's words: for Bangladeshi businesses that sell through their own website and run
 * Facebook ads. Bangla only (the language switch links to the main site), with product and tech
 * terms kept in English the way sellers say them. `*words*` mark what the page sets on a solid
 * accent block (headings) or in the accent (body).
 */

export type Platform = 'woocommerce' | 'shopify' | 'custom';

export const bdCopy = {
  eyebrow: 'Website থেকে বিক্রি করা Bangladeshi Store-এর জন্য',
  title: 'Facebook Ads-এর *প্রতিটা Sale* Track করুন, Ad খরচ কমান',
  lead: 'Server-side Tracking আপনার Website-এর প্রতিটা অর্ডার সঠিকভাবে Facebook-এ পাঠায়, *Pixel মিস করলেও*। সাথে পুরো Analytics: কোন Ad থেকে আসল Sale আসছে, এক জায়গায় দেখুন।',
  start: 'ফ্রি শুরু করুন',
  openDashboard: 'Dashboard খুলুন',
  demo: 'Live Demo দেখুন',
  previewCaption: 'আসল Dashboard, Demo Data দিয়ে। পাশের Menu-তে Click করে ঘুরে দেখুন।',
  messenger: 'Messenger-এ কথা বলুন',
  platformsLine: 'WooCommerce, Shopify, WordPress আর যেকোনো Website-এ কাজ করে',

  problem: {
    title: 'Pixel অনেক অর্ডার ধরতে পারে না, *তাই Ad খরচ বাড়ে*',
    sub: 'Ad Blocker, iPhone-এর Privacy Setting, ধীর Internet বা Thank You Page লোড হওয়ার আগেই Page বন্ধ করা: এসব কারণে Browser-এর Pixel অনেক Purchase মিস করে। Facebook তখন কম Data থেকে শেখে, ভুল মানুষকে Ad দেখায়, আর আপনার প্রতিটা Sale-এর খরচ বেড়ে যায়।',
    columns: ['শুধু Pixel', 'Seentics দিয়ে'] as [string, string],
    rows: [
      { label: 'অর্ডার ধরা', now: 'Ad Blocker বা ধীর Internet-এ অনেক Purchase হারিয়ে যায়', with: 'প্রতিটা অর্ডার Server থেকে সরাসরি Facebook-এ যায়' },
      { label: 'Facebook-এর শেখা', now: 'কম Data পেয়ে Facebook ভুল মানুষকে Ad দেখায়', with: 'পুরো Data পেয়ে Facebook আসল ক্রেতা খোঁজে' },
      { label: 'কোন Ad কাজ করছে', now: 'Ads Manager-এর সংখ্যা আর আসল অর্ডার মেলে না', with: 'প্রতিটা Ad থেকে কত Visitor আর কত টাকার Sale' },
      { label: 'Customer কেন কেনে না', now: 'জানার কোনো উপায় নেই', with: 'Session Recording আর Heatmap-এ দেখুন কোথায় আটকায়' },
    ],
  },

  tracking: {
    tag: 'Server-side Conversion Tracking',
    head: 'প্রতিটা অর্ডার *সরাসরি Facebook-এ* পৌঁছায়',
    text: 'Customer অর্ডার করলে আপনার Website থেকে অর্ডারটা Seentics Server হয়ে Facebook Conversions API-তে যায়, আসল দামসহ। Browser-এর Pixel মিস করলেও Sale হারায় না, তাই Facebook সঠিক Data থেকে শেখে আর আপনার Ad কম খরচে আসল ক্রেতা খোঁজে।',
    points: [
      'Ad Blocker বা Browser-এর সমস্যায় আটকায় না',
      'একটা অর্ডার একবারই পাঠানো হয়, দুবার গোনা হয় না',
      'Customer-এর তথ্য Hash করে পাঠানো হয়, তাই Facebook সঠিক মানুষ চেনে',
      'চাইলে একই অর্ডার Google Analytics আর TikTok-এও যায়',
    ],
    flow: {
      order: { title: 'আপনার Website-এ অর্ডার', name: 'WooCommerce · অর্ডার #4521', detail: 'নাসরিন আক্তার · ৳2,450' },
      server: { title: 'Seentics Server', lines: ['Purchase Event, আসল দাম ৳2,450', 'Customer-এর তথ্য Hash করা', 'একবারই, Duplicate হবে না'] },
      out: { title: 'যেখানে পৌঁছাল', rows: ['Facebook · Purchase ৳2,450', 'Google Analytics · purchase', 'TikTok · CompletePayment'] },
    },
  },

  analytics: {
    tag: 'পুরো Analytics',
    title: 'কোন Ad, Page আর Product *আসল Sale আনছে* দেখুন',
    sub: 'শুধু Visitor গোনা না: কোন Ad থেকে কত Sale এল, কোন Page-এ Customer চলে যায়, আর কেন। Heatmap আর Session Recording সাথেই।',
    tabs: [
      { id: 'overview' as const, label: 'Web Analytics', text: 'কত Visitor, কোন Ad বা Post থেকে, আর কত টাকার Sale।' },
      { id: 'replays' as const, label: 'Session Recording', text: 'Customer Website-এ কী করল ভিডিওর মতো দেখুন, কোথায় আটকে গেল।' },
      { id: 'heatmaps' as const, label: 'Heatmap', text: 'Page-এর কোথায় Click হয়, কতদূর Scroll করে।' },
      { id: 'funnels' as const, label: 'Funnel', text: 'Product দেখা থেকে Checkout পর্যন্ত কোন ধাপে Customer হারায়।' },
    ],
  },

  how: {
    title: '*৩ ধাপে* চালু, Website নতুন করে বানাতে হবে না',
    sub: 'আপনার এখনকার Website-এই কাজ করে।',
    tabs: { woocommerce: 'WooCommerce / WordPress', shopify: 'Shopify', custom: 'নিজের Website' } as Record<Platform, string>,
    steps: {
      woocommerce: [
        { head: 'Seentics Plugin Install করুন', text: 'WordPress-এ Seentics Plugin বসান, Website-এর Key দিন।' },
        { head: 'Facebook যুক্ত করুন', text: 'Seentics-এ আপনার Pixel ID আর Access Token দিন।' },
        { head: 'প্রতিটা অর্ডার Track হচ্ছে', text: 'নতুন অর্ডার Server থেকে Facebook-এ যায়, Dashboard-এ দেখুন কোন Ad থেকে কত Sale।' },
      ],
      shopify: [
        { head: 'Seentics App Install করুন', text: 'Shopify-তে Seentics App বসান, Store যুক্ত করুন।' },
        { head: 'Facebook যুক্ত করুন', text: 'Seentics-এ আপনার Pixel ID আর Access Token দিন।' },
        { head: 'প্রতিটা অর্ডার Track হচ্ছে', text: 'নতুন অর্ডার Server থেকে Facebook-এ যায়, Dashboard-এ দেখুন কোন Ad থেকে কত Sale।' },
      ],
      custom: [
        { head: 'একটা Script আর Order Webhook বসান', text: 'Website-এ এক লাইনের Script, আর অর্ডার হলে আমাদের Webhook-এ খবর পাঠান।' },
        { head: 'Facebook যুক্ত করুন', text: 'Seentics-এ আপনার Pixel ID আর Access Token দিন।' },
        { head: 'প্রতিটা অর্ডার Track হচ্ছে', text: 'নতুন অর্ডার Server থেকে Facebook-এ যায়, Dashboard-এ দেখুন কোন Ad থেকে কত Sale।' },
      ],
    } as Record<Platform, Array<{ head: string; text: string }>>,
    help: 'Setup নিজে করতে না চাইলে Messenger-এ লিখুন, আমরা করে দেব।',
  },

  extras: {
    title: 'সাথে আরও যা পাচ্ছেন',
    items: [
      { head: 'Fake Order-এ টাকা হারানো বন্ধ করুন', text: 'প্রতিটা অর্ডারে Risk Label, কারণসহ। আর Facebook শিখবে শুধু Confirmed অর্ডার থেকে, Fake অর্ডার থেকে না।', soon: true },
      { head: 'Popup আর Form দিয়ে Visitor-কে Customer বানান', text: 'Offer Popup, চলে যাওয়ার আগে Exit Popup আর Lead Form দিয়ে Visitor-এর ফোন নম্বর বা Email নিন।', soon: false },
    ],
    soon: 'শীঘ্রই আসছে',
  },

  pricing: {
    title: 'টাকায় দাম, Invoice-এ পেমেন্ট',
    lead: 'মাসিক বা বছরের Plan। bKash, Nagad বা Rocket-এ Send Money করে পেমেন্ট, অথবা Card-এ। বছরের Plan নিলে ১০ মাসের দাম।',
    perMonth: '/মাস',
    popular: 'জনপ্রিয়',
    plans: [
      { tier: 'free' as const, name: 'Free', price: '৳0', cta: 'ফ্রি শুরু করুন', note: 'ছোট Store শুরু করার জন্য' },
      { tier: 'starter' as const, name: 'Starter', price: '৳499', cta: 'Starter নিন', note: 'নিয়মিত Ad চালানো Store-এর জন্য', featured: true },
      { tier: 'pro' as const, name: 'Pro', price: '৳1,499', cta: 'Pro নিন', note: 'বড় Store আর বেশি Traffic-এর জন্য' },
    ],
    /** Each card's limits, read from the live plans (gateway plan_limits, product core). */
    limits: [
      { key: 'monthly_events', label: 'মাসে Visitor Event', metered: true },
      { key: 'replays', label: 'মাসে Session Recording', metered: true },
      { key: 'heatmaps', label: 'Heatmap Page', metered: false },
      { key: 'funnels', label: 'Funnel', metered: false },
      { key: 'websites', label: 'Website', metered: false },
    ],
    unlimited: 'যত খুশি',
    limitsTitle: 'এই Plan-এ',
    includedTitle: 'সব Plan-এ যা থাকছে',
    included: [
      'Server-side Facebook Conversion Tracking',
      'Google Analytics আর TikTok-এ অর্ডার পাঠানো',
      'Web Analytics: কোন Ad থেকে কত Sale',
      'Session Recording',
      'Heatmap',
      'Funnel',
      'Popup আর Lead Form',
      'WooCommerce, Shopify আর যেকোনো Website',
    ],
    limitsNote: 'Pro Plan-এ সীমা পার হলে Extra Usage চালু করে চালিয়ে যেতে পারবেন।',
    compare: 'সব Plan-এর সীমা দেখুন',
  },

  faq: {
    title: 'প্রশ্ন',
    items: [
      { q: 'কোন কোন Platform-এ কাজ করে?', a: 'WooCommerce আর WordPress-এ Plugin দিয়ে, Shopify-তে App দিয়ে, আর অন্য যেকোনো Website-এ একটা Script আর Order Webhook দিয়ে।' },
      { q: 'Setup-এ কতক্ষণ লাগে?', a: 'Plugin বা App Install করে Pixel ID আর Access Token দিলেই চালু হয়ে যায়। নিজে করতে না চাইলে Messenger-এ লিখুন, আমরা করে দেব।' },
      { q: 'Website কি Slow হবে?', a: 'না। Script ছোট আর Page-এর বাকি অংশ লোড হওয়া আটকায় না। অর্ডার Facebook-এ যায় আমাদের Server থেকে, Customer-এর Browser থেকে না।' },
      { q: 'পেমেন্ট কীভাবে করব?', a: 'Plan বেছে নিলে একটা Invoice পাবেন। bKash, Nagad বা Rocket-এ Send Money করে Transaction ID দিন, যাচাই হলেই Plan চালু। Card-এও পেমেন্ট করা যায়।' },
      { q: 'আমার Data কি নিরাপদ?', a: 'আপনার Store-এর Data শুধু আপনার Account-এ থাকে। Customer-এর ফোন আর Email Facebook-এ Hash করে পাঠানো হয়, আসল তথ্য যায় না।' },
    ],
  },

  final: 'আজই ফ্রি শুরু করুন',
};
