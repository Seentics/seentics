/**
 * The f-commerce page's words (/f-commerce), Bangla first: it is written for Facebook sellers in
 * Bangladesh, and English is there for whoever switches. Kept beside the page rather than in the
 * site-wide dictionaries: no other page reads them. `en` must match `bn`'s shape.
 * `*words*` mark what the page sets on a solid accent block (headings) or in the accent (body).
 */

export type FcommerceCopy = {
  eyebrow: string;
  title: string;
  lead: string;
  start: string;
  openDashboard: string;
  seePlans: string;
  trust: string[];
  compare: {
    title: string;
    sub: string;
    columns: [string, string];
    rows: Array<{ label: string; now: string; with: string }>;
  };
  features: { blocks: Array<{ tag: string; head: string; text: string; points: string[] }> };
  visuals: {
    pageCaption: string;
    ordersTitle: string;
    ordersWhen: string;
    trackingTitle: string;
    trackingRows: Array<{ status: 'new' | 'confirmed' | 'delivered' | 'cancelled' | 'fake'; sent: boolean; note: string }>;
  };
  analytics: {
    tag: string;
    title: string;
    sub: string;
    tabs: Array<{ id: 'overview' | 'replays' | 'heatmaps' | 'funnels'; label: string; text: string }>;
  };
  pricing: {
    title: string;
    lead: string;
    perMonth: string;
    popular: string;
    plans: Array<{ name: string; price: string; cta: string; limits: string[]; featured?: boolean }>;
    includedTitle: string;
    included: string[];
    pay: string;
    compare: string;
  };
  faq: { title: string; items: Array<{ q: string; a: string }> };
  final: string;
};

export const fcommerceBn: FcommerceCopy = {
  eyebrow: 'Facebook সেলারদের জন্য · Cash on Delivery',
  title: 'Facebook Ads থেকে *আরও বেশি অর্ডার* পান, সাথে পুরো Analytics।',
  lead: '*Website ছাড়াই* বাংলায় Order Page বানান। *কোন Ad থেকে অর্ডার আসছে* দেখুন Analytics, Heatmap আর Session Recording দিয়ে। Fake Order আগেই ধরুন, আর *Server-side Conversion Tracking* দিয়ে Facebook-কে শুধু আসল বিক্রির খবর দিন।',
  start: 'ফ্রি শুরু করুন',
  openDashboard: 'Dashboard খুলুন',
  seePlans: 'Plan দেখুন',
  trust: ['Card লাগবে না', 'bKash / Nagad-এ পেমেন্ট', '৫ মিনিটে Setup'],
  compare: {
    title: 'Facebook-এ বিক্রির রোজকার ঝামেলা, *এক জায়গায় সমাধান*',
    sub: 'Inbox-এ অর্ডার নেওয়া, আন্দাজে Ad চালানো, Fake Order আর Return খরচ। প্রতিদিনের এই সমস্যাগুলো Seentics কীভাবে সমাধান করে, পাশাপাশি দেখুন।',
    columns: ['এখন', 'Seentics দিয়ে'],
    rows: [
      { label: 'অর্ডার নেওয়া', now: 'Inbox-এ মেসেজ, খাতায় হিসাব', with: 'একটা Order Page, সব অর্ডার এক List-এ' },
      { label: 'কোন Ad কাজ করছে', now: 'আন্দাজে Budget বাড়ানো', with: 'প্রতিটা Ad থেকে কত Visitor আর কত অর্ডার' },
      { label: 'Fake Order', now: 'Courier ফেরত দিলে তবে বোঝা যায়', with: 'পাঠানোর আগেই Risk Label আর কারণ' },
      { label: 'Return খরচ', now: 'Delivery আর Return চার্জ, দুটোই আপনার', with: 'সন্দেহজনক অর্ডারে আগে ফোন করে নিন' },
      { label: 'Facebook Tracking', now: 'প্রতিটা Form জমাকে Purchase ধরে', with: 'Server-side Tracking: শুধু Confirmed অর্ডার, আসল দামসহ' },
    ],
  },
  features: {
    blocks: [
      {
        tag: 'Order Page',
        head: 'Website ছাড়াই *৫ মিনিটে* নিজের Order Page',
        text: 'Facebook Page-এর Inbox-এ অর্ডার নিতে গেলে অনেক Customer হারিয়ে যায়: Reply দিতে দেরি হয়, কেউ দাম জিজ্ঞেস করে আর ফেরে না। Seentics-এ একটা Product Page বানান, যেখানে Customer নিজেই দাম দেখে, Form পূরণ করে অর্ডার দেয়। কোনো Website, Domain বা Developer লাগবে না।',
        points: [
          'Product-এর ছবি, দাম আর বিবরণ দিন, একটা Template বেছে নিন, Page রেডি',
          'Page-এর ঠিকানা seentics.shop/আপনার-shop/product, এই Link সরাসরি Ad বা Post-এ দিন',
          'Cash on Delivery Order Form: নাম, ফোন, ঠিকানা আর পরিমাণ',
          'ঢাকার ভেতরে ও বাইরে আলাদা Delivery চার্জ, মোট দাম নিজে থেকেই হিসাব হয়',
          'Size বা Color বাছাই, পুরোনো দাম কেটে Offer দেখানো, আর প্রশ্ন-উত্তর (FAQ)',
          'হালকা Page, Mobile-এ দ্রুত খোলে',
        ],
      },
      {
        tag: 'Fake Order Check',
        head: 'কোন অর্ডার Fake হতে পারে, *পাঠানোর আগেই* জানুন',
        text: 'প্রতিটা অর্ডার আসার সাথে সাথে Seentics সেটা যাচাই করে একটা Label দেয়: নিরাপদ, আগে যাচাই করুন, বা ঝুঁকি বেশি। কেন এই Label, সেটাও বাংলায় লেখা থাকে। তাই কাকে আগে ফোন করবেন আর কোন Parcel পাঠাবেন না, এক নজরে বুঝবেন। Courier খরচ আর Return-এর ঝামেলা দুটোই কমে।',
        points: [
          'একই নম্বর বা ঠিকানা থেকে ২৪ ঘণ্টায় বারবার অর্ডার',
          'একই Device থেকে অল্প সময়ে অনেকগুলো অর্ডার',
          'ভুল ফোন নম্বর বা খুব ছোট ঠিকানা',
          'এই Customer-এর আগের Fake, Return বা সফল Delivery-র ইতিহাস',
          'আপনার নিজের Blacklist, এক Click-এ নম্বর যোগ করুন',
          'Steadfast Account যুক্ত করলে Courier-এ Customer-এর Delivery সফলতার হার',
          'চাইলে ঝুঁকি বেশি অর্ডার নিজে থেকেই আটকে দিন',
        ],
      },
      {
        tag: 'Server-side Conversion Tracking',
        head: 'Facebook জানবে *শুধু আসল বিক্রি*, তাই Ad আরও ভালো Customer খুঁজবে',
        text: 'সাধারণ Pixel প্রতিটা Form জমাকেই Purchase ধরে, Fake অর্ডারও। তখন Facebook এমন মানুষ খোঁজে যারা Form পূরণ করে কিন্তু কেনে না, আর আপনার Ad খরচ বাড়ে। Seentics-এ Purchase যায় শুধু তখন, যখন আপনি অর্ডার Confirm করেন (চাইলে Delivery হওয়ার পর)। এটা যায় আমাদের Server থেকে সরাসরি Facebook-এ, আসল দামসহ। একেই বলে Server-side Conversion Tracking।',
        points: [
          'Facebook Conversions API দিয়ে Server থেকে পাঠানো, Browser বা Ad Blocker-এ আটকায় না',
          'Fake, Cancel বা Return হওয়া অর্ডার কখনো Purchase হিসেবে যায় না',
          'একটা অর্ডারের Purchase একবারই যায়, দুবার গোনা হয় না',
          'Customer-এর ফোন নম্বর Hash করে পাঠানো হয়, তাই Facebook সঠিক মানুষকে চিনতে পারে',
          'আপনার এখনকার Pixel ID আর Access Token দিলেই চালু',
        ],
      },
    ],
  },
  visuals: {
    pageCaption: 'Editor-এর Preview, Demo Product দিয়ে।',
    ordersTitle: 'অর্ডার',
    ordersWhen: 'আজ',
    trackingTitle: 'Facebook-এ Purchase যাবে?',
    trackingRows: [
      { status: 'new', sent: false, note: 'অর্ডার এসেছে, এখনো না' },
      { status: 'confirmed', sent: true, note: 'আপনি Confirm করলেন, এখন যাবে' },
      { status: 'delivered', sent: false, note: 'আগেই গেছে, আবার যাবে না' },
      { status: 'fake', sent: false, note: 'কখনো না' },
      { status: 'cancelled', sent: false, note: 'কখনো না' },
    ],
  },
  analytics: {
    tag: 'সাথে পাচ্ছেন',
    title: 'প্রতিটা Order Page-এ *পুরো Analytics*',
    sub: 'আলাদা কিছু বসাতে হয় না, প্রতিটা Order Page-এ Seentics Analytics নিজে থেকেই চালু থাকে। কোন Ad কাজ করছে, আর কেউ কেন অর্ডার না করে চলে যায়, দুটোই দেখুন।',
    tabs: [
      { id: 'overview', label: 'Web Analytics', text: 'কত Visitor এল, কোন Ad বা Post থেকে, কোন Device-এ।' },
      { id: 'replays', label: 'Session Recording', text: 'Customer Page-এ কী করল ভিডিওর মতো দেখুন, কোথায় আটকে গেল।' },
      { id: 'heatmaps', label: 'Heatmap', text: 'Page-এর কোথায় Click হয়, কতদূর Scroll করে।' },
      { id: 'funnels', label: 'Funnel', text: 'Page দেখা থেকে অর্ডার পর্যন্ত কোন ধাপে Customer হারায়।' },
    ],
  },
  pricing: {
    title: 'টাকায় দাম, bKash বা Nagad-এ পেমেন্ট',
    lead: 'সব Plan-এ Order Page, Fake Order Check, Server-side Conversion Tracking আর Analytics আছে। শুধু Page আর অর্ডারের সংখ্যা আলাদা।',
    perMonth: '/মাস',
    popular: 'জনপ্রিয়',
    plans: [
      { name: 'Free', price: '৳0', cta: 'ফ্রি শুরু করুন', limits: ['১টা Published Page', 'মাসে ১০০টা অর্ডার'] },
      { name: 'Starter', price: '৳499', cta: 'Starter নিন', limits: ['১০টা Published Page', 'মাসে ১,০০০টা অর্ডার'], featured: true },
      { name: 'Pro', price: '৳1,499', cta: 'Pro নিন', limits: ['যত খুশি Published Page', 'মাসে ১০,০০০টা অর্ডার'] },
    ],
    includedTitle: 'যা যা পাচ্ছেন',
    included: [
      'Order Page আর COD Order Form',
      'ঢাকার ভেতরে ও বাইরে আলাদা Delivery চার্জ',
      'Fake Order Check আর Risk Label, কারণসহ',
      'নিজের Blacklist',
      'Steadfast Courier-এর Delivery রেকর্ড',
      'Server-side Facebook Conversion Tracking',
      'Web Analytics: কোন Ad থেকে কত Visitor',
      'Session Recording',
      'Heatmap',
      'Funnel',
    ],
    pay: 'bKash, Nagad বা Rocket-এ Send Money করে পেমেন্ট, অথবা Card-এ। বছরের Plan নিলে ১০ মাসের দাম।',
    compare: 'সব Plan তুলনা করুন',
  },
  faq: {
    title: 'প্রশ্ন',
    items: [
      { q: 'আমার কি Website লাগবে?', a: 'না। আপনার Shop আর Product Page থাকবে seentics.shop-এ, ঠিকানা হবে seentics.shop/আপনার-shop/product। Website থাকলে সেখানেও Seentics Analytics চালাতে পারবেন।' },
      { q: 'কোন Courier-এর সাথে কাজ করে?', a: 'Fake Order Check-এ এখন Steadfast-এর Delivery রেকর্ড দেখা যায়, আপনার নিজের Steadfast Account-এর API Key দিয়ে। Courier-এ সরাসরি Parcel Book করার সুবিধা এখনো নেই, শিগগিরই আসছে।' },
      { q: 'আমার আগের Facebook Pixel দিয়ে চলবে?', a: 'হ্যাঁ। Conversions-এ আপনার Pixel ID আর Access Token দিন। Seentics Server থেকে সেই Pixel-এই Purchase পাঠায়। seentics.shop Page-এ Browser Pixel বসানো হয় না, তাই একই অর্ডার দুবার গোনা হয় না।' },
      { q: 'Customer-এর তথ্য কি নিরাপদ?', a: 'নাম, ফোন আর ঠিকানা শুধু আপনার Account-এ থাকে। আপনার Blacklist আর Customer-এর ইতিহাস অন্য কোনো Seller দেখতে পায় না। Facebook-এ ফোন নম্বর Hash করে পাঠানো হয়, আসল নম্বর যায় না।' },
      { q: 'পেমেন্ট কীভাবে করব?', a: 'Plan বেছে নিলে একটা Invoice পাবেন। bKash, Nagad বা Rocket-এ Send Money করে Transaction ID দিন। যাচাই হলেই Plan চালু হবে। Card-এও পেমেন্ট করা যায়।' },
    ],
  },
  final: 'আজকের Ad-এর অর্ডার, আজই আলাদা করে দেখুন।',
};

export const fcommerceEn: FcommerceCopy = {
  eyebrow: 'For Facebook sellers · Cash on delivery',
  title: 'Get *more orders* from your Facebook ads, with full analytics.',
  lead: 'A Bangla order page *without a website*, and analytics, heatmaps and session recordings that show *which ads bring orders*. Plus a fake-order check and *server-side Facebook conversion tracking*.',
  start: 'Start free',
  openDashboard: 'Open the dashboard',
  seePlans: 'See plans',
  trust: ['No card needed', 'bKash / Nagad', 'Set up in 5 minutes'],
  compare: {
    title: 'Everyday Facebook-selling problems, *solved in one place*',
    sub: 'Taking orders in the inbox, running ads on guesswork, fake orders and return costs: see side by side how Seentics fixes each one.',
    columns: ['Today', 'With Seentics'],
    rows: [
      { label: 'Taking orders', now: 'Inbox messages, written in a notebook', with: 'One form on one page, every order in one list' },
      { label: 'Which ads work', now: 'Raise budgets on a guess', with: 'Visitors and orders from each ad' },
      { label: 'Fake orders', now: 'You find out when the courier returns it', with: 'A label and the reasons before you ship' },
      { label: 'Return costs', now: 'You pay delivery and return charges', with: 'Call the doubtful ones first' },
      { label: 'Facebook ads', now: 'Every form counts as a Purchase', with: 'Server-side tracking: only confirmed orders, with the real amount' },
    ],
  },
  features: {
    blocks: [
      {
        tag: 'Order page',
        head: 'Your own order page in *five minutes*, no website needed',
        text: 'Taking orders in your Facebook inbox loses customers: replies come late, and people who ask the price never come back. With Seentics you make a product page where buyers see the price themselves and order through a form. No website, domain or developer needed.',
        points: [
          'Add photos, price and description, pick a template, and the page is ready',
          'The page lives at seentics.shop/your-shop/product; put that link straight into your ad or post',
          'Cash-on-delivery order form: name, phone, address and quantity',
          'Separate delivery charges inside and outside Dhaka, with the total worked out for the buyer',
          'Size or colour options, an old price struck through, and an FAQ',
          'A light page that opens fast on phones',
        ],
      },
      {
        tag: 'Fake-order check',
        head: 'Know which orders may be fake *before you ship*',
        text: 'As each order arrives, Seentics checks it and gives it a label: Safe, Check first, or High risk, with the reasons written out. You see at a glance whom to call first and which parcel not to send, so courier costs and returns both go down.',
        points: [
          'Repeat orders from the same number or address within 24 hours',
          'Many orders from one device in a short time',
          'An invalid phone number or a very short address',
          "This customer's past fake, returned or delivered orders",
          'Your own blacklist: add a number in one click',
          "With your Steadfast account connected, the customer's delivery success rate",
          'Optionally block high-risk orders automatically',
        ],
      },
      {
        tag: 'Server-side conversion tracking',
        head: 'Facebook hears *only about real sales*, so your ads find better buyers',
        text: 'A normal pixel counts every form submit as a Purchase, fake orders included. Facebook then looks for people who fill in forms but do not buy, and your ad costs go up. With Seentics a Purchase is sent only when you confirm the order (or, if you prefer, once it is delivered), from our server straight to Facebook, with the real amount. That is server-side conversion tracking.',
        points: [
          'Sent from the server through the Facebook Conversions API, so browsers and ad blockers cannot stop it',
          'Fake, cancelled or returned orders are never sent as a Purchase',
          'One Purchase per order, never counted twice',
          'The customer\'s phone is sent hashed, so Facebook can match the right person',
          'Works with the pixel ID and access token you already have',
        ],
      },
    ],
  },
  visuals: {
    pageCaption: 'The editor\'s preview, with a demo product.',
    ordersTitle: 'Orders',
    ordersWhen: 'Today',
    trackingTitle: 'Sent to Facebook as a Purchase?',
    trackingRows: [
      { status: 'new', sent: false, note: 'Order placed: not yet' },
      { status: 'confirmed', sent: true, note: 'You confirmed it: sent now' },
      { status: 'delivered', sent: false, note: 'Already sent: not again' },
      { status: 'fake', sent: false, note: 'Never' },
      { status: 'cancelled', sent: false, note: 'Never' },
    ],
  },
  analytics: {
    tag: 'Also included',
    title: 'Full *analytics* on every order page',
    sub: 'Every order page comes with Seentics analytics, nothing extra to install. See which ads work, and why people leave without ordering.',
    tabs: [
      { id: 'overview', label: 'Web analytics', text: 'How many visitors, from which ad or post, on which device.' },
      { id: 'replays', label: 'Session recordings', text: 'Watch what a buyer did on the page, and where they got stuck.' },
      { id: 'heatmaps', label: 'Heatmaps', text: 'Where people click on the page, and how far they scroll.' },
      { id: 'funnels', label: 'Funnels', text: 'Which step between viewing the page and ordering loses buyers.' },
    ],
  },
  pricing: {
    title: 'Priced in taka, paid with bKash or Nagad',
    lead: 'Every plan has order pages, the fake-order check, server-side conversion tracking and analytics. Only the number of pages and orders differs.',
    perMonth: '/month',
    popular: 'Popular',
    plans: [
      { name: 'Free', price: '৳0', cta: 'Start free', limits: ['1 published page', '100 orders a month'] },
      { name: 'Starter', price: '৳499', cta: 'Get Starter', limits: ['10 published pages', '1,000 orders a month'], featured: true },
      { name: 'Pro', price: '৳1,499', cta: 'Get Pro', limits: ['Unlimited published pages', '10,000 orders a month'] },
    ],
    includedTitle: 'Everything included',
    included: [
      'Order page and COD order form',
      'Separate delivery charges inside and outside Dhaka',
      'Fake-order check and risk labels, with reasons',
      'Your own blacklist',
      'Steadfast courier delivery records',
      'Server-side Facebook conversion tracking',
      'Web analytics: visitors from each ad',
      'Session recordings',
      'Heatmaps',
      'Funnels',
    ],
    pay: 'Pay by bKash, Nagad or Rocket Send Money, or by card. Yearly costs ten months.',
    compare: 'Compare every plan',
  },
  faq: {
    title: 'Questions',
    items: [
      { q: 'Do I need a website?', a: 'No. Your shop and product pages live on seentics.shop, at seentics.shop/your-shop/product. If you have a website, Seentics analytics can run there too.' },
      { q: 'Which couriers work?', a: 'The fake-order check can read Steadfast delivery records, using your own Steadfast account\'s API key. Booking parcels with a courier directly is not there yet; it is coming.' },
      { q: 'Does it work with my existing Facebook pixel?', a: 'Yes. Add your pixel id and access token under Conversions, and Seentics sends Purchases to that pixel from the server. seentics.shop pages carry no browser pixel, so an order is never counted twice.' },
      { q: 'Is my customers\' data safe?', a: 'Names, phones and addresses stay in your account. Your blacklist and customer history are never shown to other sellers. Phones go to Facebook hashed, never as the number.' },
      { q: 'How do I pay?', a: 'Pick a plan and you get an invoice. Send Money by bKash, Nagad or Rocket and enter the transaction ID; the plan starts once it is verified. Cards work too.' },
    ],
  },
  final: 'Tell today\'s real orders from the fake ones, today.',
};
