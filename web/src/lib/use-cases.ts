import {
  BarChart3, Bug, CalendarCheck, DoorOpen, Flame, Filter, HeartHandshake, Layers, Magnet, Megaphone, ShoppingBag,
  TrendingUp, Video, Wallet, Zap,
} from 'lucide-react';
import type { ElementType } from 'react';

/**
 * The pages under /use-cases and the "Use cases" menu in the header.
 *
 * Each page is an outcome a visitor wants ("Capture more leads", "Recover leaving
 * visitors"), not an industry. A page says who can use it and how, with the industries
 * appearing as examples inside it: "Education: offer a prospectus for an email". That keeps
 * one strong page per intent instead of a thin page per vertical.
 *
 * Seentics is a behaviour-analytics product that also acts on what it sees: web analytics,
 * session recordings, heatmaps, funnels, revenue attribution and error tracking, plus
 * automations that show popups and capture leads. The pages lean on that combination: the
 * popup or form is the action, and the analytics say where it should go and whether it worked.
 *
 * Lead capture (docs/automations): a modal action with "Collect emails with a form" shows
 * an email field plus up to seven more (text or phone), a thank-you message or redirect and
 * an optional consent checkbox. Submissions are listed on the automation's page (search, CSV
 * export, delete, kept 90 days) and sent to the destinations the form picks (webhook, Mailchimp,
 * Klaviyo, HubSpot), a honeypot and a per-visitor rate limit filter bots, and a `lead_captured` event feeds goals and funnels.
 * Forms live in modal actions; banners, toasts and tooltips carry a message, not a form.
 *
 * Every claim has to be something the product does today (docs/analytics, session-replays,
 * heatmaps, funnels, automations, agency, privacy are the source of truth). Playbooks use
 * only the documented triggers (Page View, Click, Scroll Depth, Time on Page, Exit Intent,
 * Inactivity, Rage Click, Form Abandonment, JS Error, Tab Hidden, Tab Visible, Custom Event,
 * Identify) and actions (Show Modal, Toast, Banner, Tooltip, Highlight Element, Personalize
 * Content, Redirect, Tag Session, Webhook). No statistics, no customer quotes, no compliance
 * claims: none of it is measured or certified here.
 */

export type FeatureKey =
  | 'analytics' | 'replays' | 'heatmaps' | 'funnels' | 'revenue' | 'errors' | 'automations' | 'goals' | 'ai'
  | 'agency' | 'privacy' | 'leads';

export const FEATURES: Record<FeatureKey, { name: string; href: string }> = {
  analytics: { name: 'Web analytics', href: '/docs/analytics' },
  replays: { name: 'Session recordings', href: '/docs/session-replays' },
  heatmaps: { name: 'Heatmaps', href: '/docs/heatmaps' },
  funnels: { name: 'Funnels', href: '/docs/funnels' },
  revenue: { name: 'Revenue tracking', href: '/docs/analytics' },
  errors: { name: 'Error tracking', href: '/docs/session-replays' },
  automations: { name: 'Automations', href: '/docs/automations' },
  goals: { name: 'Goals and events', href: '/docs/analytics' },
  ai: { name: 'Seentics AI', href: '/docs/analytics' },
  agency: { name: 'Agency tools', href: '/docs/agency' },
  privacy: { name: 'Privacy controls', href: '/docs/privacy' },
  leads: { name: 'Popups & lead capture', href: '/docs/automations' },
};

export type UseCaseGroup = 'capture' | 'understand' | 'grow';

export const GROUPS: { key: UseCaseGroup; title: string; blurb: string }[] = [
  { key: 'capture', title: 'Capture & convert', blurb: 'Act on visitors while they are on the page' },
  { key: 'understand', title: 'Understand & improve', blurb: 'See what is happening, then fix it' },
  { key: 'grow', title: 'Grow & report', blurb: 'Prove what works and scale it' },
];

export interface UseCase {
  group: UseCaseGroup;
  slug: string;
  /** The outcome, as a short verb phrase: the menu entry and the page's breadcrumb. */
  name: string;
  icon: ElementType;
  /** The line under the name in the menu and on the index. */
  summary: string;
  /** The page's h1. */
  headline: string;
  metaDescription: string;
  intro: string;
  /** Who can use it, and how: one entry per audience. */
  who: { audience: string; how: string }[];
  /** How it works in Seentics, in order. */
  steps: { title: string; body: string }[];
  /** The capabilities behind it, each with the question it answers. */
  features: { key: FeatureKey; answers: string }[];
  funnel?: { name: string; steps: string[]; note: string };
  /** One concrete automation to copy. */
  automation?: { trigger: string; action: string; why: string };
  metrics: string[];
  faqs: { q: string; a: string }[];
}

export const USE_CASES: UseCase[] = [
  // ── Capture & convert ───────────────────────────────────────────────────────
  {
    group: 'capture', slug: 'capture-leads', name: 'Capture more leads', icon: Magnet,
    summary: 'Popups and forms that turn visitors into contacts',
    headline: 'Capture leads with popups and forms, and see where each one came from',
    metaDescription: 'Show a popup with an email and contact form at the right moment, send them to your email tool or CRM, and see which popup, variant, page and source produced each one. Lead capture from Seentics.',
    intro: 'Most visitors leave without a trace. A popup form shown at the right moment gets you their email; Seentics also tells you which popup, variant, page and campaign produced each lead, and what the visitor did first.',
    who: [
      { audience: 'Ecommerce stores', how: 'Offer a discount for an email before a shopper leaves the cart or a product page.' },
      { audience: 'Education', how: 'Offer a prospectus or an open-day reminder for a name and email on a programme page.' },
      { audience: 'Real estate', how: 'Offer viewing alerts or a valuation for a name, email and phone from a listing page.' },
      { audience: 'Automotive', how: 'Offer a trade-in valuation or a test drive with an email and phone on a vehicle page.' },
      { audience: 'Events and webinars', how: 'Capture a waitlist or a "remind me" email from visitors who are not ready to register.' },
      { audience: 'Fitness and wellness', how: 'Offer a free trial or a class pass for a name, email and phone on the pricing page.' },
      { audience: 'Publishers and creators', how: 'Invite readers to a newsletter with an email form after they have read most of an article.' },
      { audience: 'Recruiting teams', how: 'Invite visitors to a talent pool or job alerts from a job page.' },
    ],
    steps: [
      { title: 'Choose the moment', body: 'Pick a trigger: Exit Intent, Scroll Depth, Time on Page, Click, Inactivity or a custom event. A reader who got to 60% of a guide is a better prospect than someone who just arrived.' },
      { title: 'Add the form', body: 'In Automations, add a Show Modal action and turn on "Collect emails with a form". It adds an email field plus up to seven more (text or phone), a thank-you message or redirect, and an optional consent checkbox that can be required.' },
      { title: 'Limit how often it shows', body: 'Set a frequency cap and a cooldown, and scope it to the pages where it makes sense, so a visitor sees it once.' },
      { title: 'Send them where you work', body: 'Each submission is listed on the automation\'s page and sent to the destinations you pick in Settings > Integrations: Zapier or any webhook, Mailchimp, Klaviyo or HubSpot. Failed sends are retried automatically. You can also search them, export a CSV, or delete one.' },
      { title: 'Measure it', body: 'Each lead records the popup, the A/B variant and the page it came from, and a lead_captured event is recorded so you can build a goal or a funnel step on it.' },
    ],
    features: [
      { key: 'leads', answers: 'A form in a popup, a list of submissions per form, destinations that send each one to your tools with retries, a honeypot and rate limit against bots, and a consent checkbox.' },
      { key: 'automations', answers: 'Thirteen triggers, frequency caps, cooldowns, priority and A/B variants so you can test messages.' },
      { key: 'funnels', answers: 'Use lead_captured as a funnel step to see how many leads go on to sign up or buy.' },
      { key: 'analytics', answers: 'Submissions by page and source sit beside your traffic reports.' },
    ],
    funnel: { name: 'Lead capture funnel', steps: ['Landing or content page', 'Popup shown', 'Lead captured (lead_captured event)', 'Sign-up or purchase'], note: 'lead_captured is recorded automatically on a successful submit.' },
    automation: { trigger: 'Scroll Depth past 60% on a guide or article', action: 'Show Modal with an email form offering the next step', why: 'Readers who got that far are the likeliest to say yes, and it does not interrupt people who have just arrived.' },
    metrics: ['Submissions by popup, variant, page and source', 'Capture rate for each popup', 'Submissions by destination: delivered, retrying, failed', 'Lead to customer conversion'],
    faqs: [
      { q: 'Where do the leads go?', a: 'To the destinations you choose for the form: Zapier or any webhook, Mailchimp, Klaviyo or HubSpot, and each submission is also listed on the automation\'s page for 90 days. Seentics is not a contact database, so keep long-term contacts in the tool a destination feeds.' },
      { q: 'How are bots handled?', a: 'A hidden honeypot field and a per-visitor rate limit filter them, and nothing is stored for a submission that trips either.' },
      { q: 'What about consent?', a: 'Add the consent checkbox and make it required where your jurisdiction needs it. Submissions are personal data, so delete them on request. Seentics does not make you compliant on its own.' },
    ],
  },
  {
    group: 'capture', slug: 'recover-leaving-visitors', name: 'Recover leaving visitors', icon: DoorOpen,
    summary: 'Speak to visitors who are about to leave',
    headline: 'Recover visitors who are about to leave, and measure whether it worked',
    metaDescription: 'Show an offer, a message or a lead form when a visitor is about to leave a cart, pricing or application page. Cap it, A/B test it and measure the result. Exit-intent popups from Seentics.',
    intro: 'Exit intent is the last chance to ask a visitor to stay. Seentics fires it when the cursor moves as though leaving, lets you show an offer or a lead form, and then measures whether the step it targeted improved.',
    who: [
      { audience: 'Ecommerce stores', how: 'Meet a shopper leaving the cart with an offer and a button back to checkout, or an email form for a reminder offer.' },
      { audience: 'SaaS and software', how: 'Ask a visitor leaving the pricing page to start a trial or book a demo.' },
      { audience: 'Travel and booking', how: 'Offer flexible dates or a saved search to someone leaving the results page.' },
      { audience: 'Restaurants and food', how: 'Bring someone about to abandon the order page back to checkout.' },
      { audience: 'Finance and lending', how: 'Offer a call back or a help page to someone leaving the application.' },
      { audience: 'Education', how: 'Offer admissions support to someone leaving the application form.' },
    ],
    steps: [
      { title: 'Pick the page that matters', body: 'Use a funnel to find the step with the biggest drop. That is where an exit-intent message earns its place.' },
      { title: 'Set the trigger', body: 'Choose Exit Intent for desktop visitors. It is based on cursor movement, so use Scroll Depth, Time on Page or Inactivity for phone visitors.' },
      { title: 'Write one clear message', body: 'A Show Modal action with a short message and one button, or turn on the email form to capture a contact instead.' },
      { title: 'Cap it', body: 'Use a frequency cap and a cooldown so each visitor sees it once, and scope it to specific pages.' },
      { title: 'Check it', body: 'Watch the funnel step it targets before and after, and open recordings of visitors who dismissed it to improve the message.' },
    ],
    features: [
      { key: 'automations', answers: 'Exit Intent is one of thirteen triggers; combine it with caps, cooldowns, priority and A/B variants.' },
      { key: 'leads', answers: 'Turn the popup into an email form to capture a contact before the visitor goes.' },
      { key: 'funnels', answers: 'Measure the step the popup targets, such as cart to checkout.' },
      { key: 'replays', answers: 'See what visitors who closed the popup did next.' },
    ],
    automation: { trigger: 'Exit Intent on the cart or pricing page', action: 'Show Modal with a short offer and a button to continue, or an email form', why: 'It meets the visitor at the moment of leaving. Cap it at once per visitor.' },
    metrics: ['Popup views and clicks', 'Leads captured on exit', 'Variant comparison', 'Conversion of the targeted funnel step'],
    faqs: [
      { q: 'Does exit intent work on phones?', a: 'It is based on cursor movement, so it suits desktop. Use Scroll Depth, Time on Page or Inactivity triggers for phone visitors.' },
      { q: 'How do I stop it repeating?', a: 'Use a frequency cap and a cooldown on the automation, and scope it to specific pages.' },
      { q: 'Can I test two versions?', a: 'Yes. Automations support A/B variants, and each lead records which variant it came from.' },
    ],
  },
  {
    group: 'capture', slug: 'get-more-bookings', name: 'Get more bookings & enquiries', icon: CalendarCheck,
    summary: 'Test drives, viewings, appointments and quotes',
    headline: 'Get more bookings and enquiries by fixing where people stall',
    metaDescription: 'Find where visitors drop out of your booking or enquiry flow, alert your team to abandoned forms, and prompt the next step. For appointments, viewings, test drives and quotes.',
    intro: 'A booking is a short path with a form at the end, and the form is where most people stop. Seentics shows where they stall, alerts your team when someone leaves a form unfinished, and prompts the next step on the page.',
    who: [
      { audience: 'Car dealerships', how: 'See which vehicles lead to test-drive bookings, and alert sales when a booking form is left unfinished.' },
      { audience: 'Real estate agents', how: 'See which listings get enquiries and which get only views, and notify an agent about an abandoned enquiry.' },
      { audience: 'Clinics and healthcare', how: 'Find where patients leave the appointment form, with typed values masked. Keep health details out of events.' },
      { audience: 'Gyms and studios', how: 'See where visitors drop between the class schedule and the booking, on mobile especially.' },
      { audience: 'Restaurants and hotels', how: 'Find why the reservation form stalls on a phone.' },
      { audience: 'Security and home services', how: 'See which service pages produce quote requests and where the quote form loses people.' },
      { audience: 'Financial advisers', how: 'Track how many calculator users go on to book a call.' },
    ],
    steps: [
      { title: 'Define the path', body: 'Build a funnel: service or listing page, enquiry form, then a confirmation event such as seentics.track("booked"). Any step can be a page or an event.' },
      { title: 'Find the leak', body: 'The funnel shows the step with the biggest drop. Check the heatmap on that page and watch recordings of visitors who left it.' },
      { title: 'Get told about abandoned forms', body: 'Add an automation with a Form Abandonment trigger and a Webhook action to your Slack or CRM endpoint, plus Tag Session so you can replay it.' },
      { title: 'Prompt the next step', body: 'Use Time on Page or Scroll Depth to show a Banner or Modal linking to the booking page, or a short email and phone form.' },
      { title: 'Track the booking', body: 'Send the confirmation event and break bookings down by page and source.' },
    ],
    features: [
      { key: 'funnels', answers: 'Which step between a service page and a confirmed booking loses most visitors?' },
      { key: 'replays', answers: 'Where do people stall in the form? Typed values are always masked.' },
      { key: 'automations', answers: 'A Form Abandonment trigger and a Webhook tell your team the same day.' },
      { key: 'leads', answers: 'Capture a contact from visitors who are not ready to book.' },
    ],
    funnel: { name: 'Booking funnel', steps: ['Service, vehicle or listing page', 'Enquiry or booking form', 'Booking confirmed (custom event)'], note: 'Send the last step from your confirmation page. Do not put personal or health details in event properties.' },
    automation: { trigger: 'Form Abandonment on the booking form', action: 'Webhook to your team channel, and Tag Session', why: 'The alert carries no personal data, only that a form was left. A fast call back can win the booking, and the recording shows where it stopped.' },
    metrics: ['Bookings by page and source', 'Form completion rate', 'Enquiries per listing or vehicle', 'Mobile versus desktop bookings'],
    faqs: [
      { q: 'Does it replace my CRM or booking system?', a: 'No. It shows what happens on your website. A Webhook action posts alerts to the endpoint your tools provide, and you can send submissions to your CRM or export them as CSV.' },
      { q: 'Are form entries visible in recordings?', a: 'No. Typed values are masked, and you can exclude any page or element.' },
      { q: 'Is it fine for healthcare sites?', a: 'Seentics makes no compliance claim. Keep patient data out of events, exclude sensitive pages, and ask your compliance team what you may track.' },
    ],
  },
  {
    group: 'capture', slug: 'increase-online-sales', name: 'Increase online sales', icon: ShoppingBag,
    summary: 'Revenue by source, and the checkout leaks',
    headline: 'Increase online sales: track revenue, find checkout leaks, recover carts',
    metaDescription: 'Track orders and revenue by campaign, find where shoppers leave the funnel, watch failed checkouts and recover carts. For WooCommerce, Shopify and custom stores.',
    intro: 'Stores lose most visitors between a product page and the thank-you page. Seentics tracks orders and revenue, shows the step that leaks, lets you watch sessions where checkout went wrong, and acts on a leaving shopper.',
    who: [
      { audience: 'Online stores', how: 'See revenue by source and campaign, and find the step between product and purchase that loses shoppers.' },
      { audience: 'Restaurants taking direct orders', how: 'Compare menu visits to orders and bring back someone leaving the order page.' },
      { audience: 'Travel and tour sellers', how: 'See where travellers drop between search and payment, and which sources book.' },
      { audience: 'Event organisers', how: 'Count ticket sales as revenue and see which channels sell.' },
      { audience: 'Membership businesses', how: 'Send joins as purchases and attribute them to the campaign that brought the member.' },
    ],
    steps: [
      { title: 'Send purchases', body: 'The WooCommerce plugin and the Shopify pixel send purchases for you. Other stores call seentics.track("purchase", { value, currency, order_id }) on the confirmation page.' },
      { title: 'Build the funnel', body: 'Product page, cart, checkout, purchase. The report shows each step and the drop between them.' },
      { title: 'Look at the leak', body: 'Open heatmaps for the product page and recordings of sessions that ended in a rage click or error at checkout.' },
      { title: 'Recover the cart', body: 'Show a Modal on Exit Intent on the cart page, or an email form for a reminder offer, capped at once per visitor.' },
      { title: 'See what earned it', body: 'Revenue breaks down by source, medium and campaign, with refunds subtracted.' },
    ],
    features: [
      { key: 'revenue', answers: 'Orders and revenue by source, medium and campaign, with exact orders listed.' },
      { key: 'funnels', answers: 'Which step loses the most shoppers?' },
      { key: 'replays', answers: 'Watch the checkout sessions that failed.' },
      { key: 'errors', answers: 'Catch JavaScript errors during payment and tell your team.' },
    ],
    funnel: { name: 'Purchase funnel', steps: ['Product page', 'Cart', 'Checkout', 'Purchase (order confirmation)'], note: 'Orders with the same order id are counted once, so reloading the confirmation page is harmless.' },
    automation: { trigger: 'JS Error on checkout pages', action: 'Webhook to your team channel', why: 'A script error during payment loses sales silently; this makes it loud.' },
    metrics: ['Revenue and orders by campaign', 'Step-to-step conversion', 'Checkout sessions with errors', 'New versus returning customers'],
    faqs: [
      { q: 'Does it work with Shopify and WooCommerce?', a: 'Yes. There is a WordPress and WooCommerce plugin and a Shopify theme snippet and custom pixel. Check the Shopify setup with a test order.' },
      { q: 'How is revenue attributed?', a: 'To the most recent UTM-tagged page view in the same session within 24 hours before purchase, then to UTM tags on the purchase itself, then to the referring site.' },
      { q: 'Does it convert currencies?', a: 'No. Totals are shown in the currency most orders use; amounts in other currencies are not converted.' },
    ],
  },
  {
    group: 'capture', slug: 'promote-offers', name: 'Promote offers & announcements', icon: Megaphone,
    summary: 'Banners, toasts and messages on the right pages',
    headline: 'Promote offers and announcements on the right pages, to the right visitors',
    metaDescription: 'Show a banner, toast, tooltip or highlight when a visitor reaches a page, scrolls or lingers, with frequency caps and A/B variants. Promotions and announcements from Seentics.',
    intro: 'A sale, a launch or a new feature is only useful if the right visitors see it. Seentics shows banners, toasts and highlights on the pages you choose, at the moment you choose, and caps how often each visitor sees them.',
    who: [
      { audience: 'Retailers', how: 'Show a sale banner on category pages and a toast on product pages.' },
      { audience: 'SaaS teams', how: 'Announce a feature with a tooltip or highlight on the element it changes.' },
      { audience: 'Event organisers', how: 'Point visitors who read the agenda at the register button.' },
      { audience: 'Restaurants', how: 'Promote ordering direct to visitors reading the menu.' },
      { audience: 'Non-profits', how: 'Invite readers of a story to give or subscribe, after they finish it.' },
      { audience: 'Publishers', how: 'Invite long-form readers to subscribe or share.' },
    ],
    steps: [
      { title: 'Choose the page and the moment', body: 'A Page View trigger for a landing page, Scroll Depth for readers, Time on Page for people lingering, or a Click on an element.' },
      { title: 'Choose the format', body: 'Show Banner (top or bottom), Show Toast, Show Tooltip, Highlight Element, or Personalize Content to swap an element\'s text.' },
      { title: 'Add a button', body: 'Link it to the offer, with a button colour and text that match your site, and optional custom HTML and CSS.' },
      { title: 'Control exposure', body: 'Set frequency caps, cooldowns and priority, and scope it to specific pages, so promotions do not pile up.' },
      { title: 'Compare versions', body: 'Use A/B variants to test wording, then check the result in goals or funnels.' },
    ],
    features: [
      { key: 'automations', answers: 'Banners, toasts, tooltips, highlights and personalised content, triggered by behaviour, with caps and variants.' },
      { key: 'goals', answers: 'Count how many visitors go on to the target page or event.' },
      { key: 'analytics', answers: 'See which pages and sources bring the visitors who respond.' },
      { key: 'heatmaps', answers: 'Check that the banner is not covering something people click.' },
    ],
    automation: { trigger: 'Page View on a promotion landing page', action: 'Personalize Content on the headline to match the offer', why: 'It matches the page to the campaign that brought the visitor.' },
    metrics: ['Visitors reaching the offer page', 'Clicks on banner or toast buttons', 'Variant comparison', 'Conversion after seeing the message'],
    faqs: [
      { q: 'Will it annoy visitors?', a: 'Use frequency caps, cooldowns and priority so a visitor sees each message once and the right one wins when two could fire.' },
      { q: 'Can I use the visitor\'s name?', a: 'Messages support template values such as the first name and plan of a visitor you have identified, with a default.' },
      { q: 'Does it need a developer?', a: 'No. You build it in the automation builder; custom HTML and CSS are optional.' },
    ],
  },

  // ── Understand & improve ────────────────────────────────────────────────────
  {
    group: 'understand', slug: 'understand-your-traffic', name: 'Understand your traffic', icon: BarChart3,
    summary: 'Traffic, sources and pages, without the bloat',
    headline: 'Privacy-friendly website analytics: who visits, from where, and what they do',
    metaDescription: 'See visitors, pages, sources, devices and countries live, with no IP storage and no cookie banner for basic analytics. Website analytics from Seentics.',
    intro: 'Most teams need five answers: who came, from where, to which pages, on what device, and did they do the thing that matters. Seentics gives you those from one script tag, and stores no IP addresses.',
    who: [
      { audience: 'Small businesses and founders', how: 'A handful of views you can check weekly, without a heavy analytics suite.' },
      { audience: 'Marketers', how: 'Sources, mediums and UTM campaigns in the same report as the pages they led to.' },
      { audience: 'Publishers and bloggers', how: 'Top pages, entry pages and referrers, live.' },
      { audience: 'Privacy-conscious organisations', how: 'No IP storage, a per-site visitor id and consent controls.' },
      { audience: 'Developers', how: 'Custom events with seentics.track() and a REST API to read your data.' },
    ],
    steps: [
      { title: 'Add the script', body: 'One tag in your site\'s head, or a plugin or package for your platform. Analytics start with no configuration.' },
      { title: 'Read the overview', body: 'Pages (most viewed and entry), sources and UTM campaigns, device and browser, and countries on a map, plus who is on the site right now.' },
      { title: 'Count what matters', body: 'Name a page or an event as a goal, and send custom events from your code.' },
      { title: 'Ask in plain English', body: 'Press ⌘K and ask "top ten pages this week" or "which sources convert best"; export the answer as CSV.' },
    ],
    features: [
      { key: 'analytics', answers: 'Which pages get the most views, where visitors enter, which sources and campaigns send them, and what devices and countries they use.' },
      { key: 'goals', answers: 'Did visitors do what you wanted?' },
      { key: 'ai', answers: 'Answers to plain-English questions as an exportable table.' },
      { key: 'privacy', answers: 'No IP storage and consent controls for regions that require them.' },
    ],
    metrics: ['Visitors and pageviews over time', 'Top pages and entry pages', 'Sources, mediums and campaigns', 'Countries and device types'],
    faqs: [
      { q: 'Does it use cookies?', a: 'By default it runs in a cookieless mode. Where recording needs consent, such as the EU and UK, the tracker asks first, or you can pass your own consent banner\'s answer.' },
      { q: 'Does it slow my site?', a: 'The core script is about 11 KB gzipped. Recording and heatmap scripts only load when those features are on.' },
      { q: 'Can I export data?', a: 'Yes. Seentics AI answers export as CSV, and there is a REST API.' },
    ],
  },
  {
    group: 'understand', slug: 'find-why-visitors-dont-convert', name: 'Find why visitors don\'t convert', icon: Filter,
    summary: 'Find the drop-off, then watch why',
    headline: 'Find why visitors don\'t convert: funnels, then recordings and heatmaps',
    metaDescription: 'Define the path you expect, see where visitors drop off, then jump to recordings and heatmaps for that step. Funnel analysis from Seentics.',
    intro: 'A conversion rate says that people leave. A funnel says at which step. A recording says why. Seentics links the three, so you go from a number to a session in a few clicks.',
    who: [
      { audience: 'Marketers paying for traffic', how: 'Find the step where paid visitors drop before they buy or sign up.' },
      { audience: 'Product managers', how: 'See where sign-up and onboarding lose people, then watch real sessions.' },
      { audience: 'UX designers', how: 'Back a design argument with clicks, scrolls and recorded behaviour.' },
      { audience: 'Founders and small teams', how: 'Get the biggest leak in a few minutes without an analyst.' },
      { audience: 'Support teams', how: 'Watch what a customer did instead of guessing from a description.' },
    ],
    steps: [
      { title: 'Define the path', body: 'Build a funnel from pages and events, for example landing, pricing, sign-up form, account created.' },
      { title: 'Find the biggest drop', body: 'The report shows each step and the conversion between them, by source.' },
      { title: 'Look at the page', body: 'Open the click and scroll heatmap for the step where visitors leave.' },
      { title: 'Watch the sessions', body: 'Open recordings of visitors who left at that step, filtered by rage clicks or errors.' },
      { title: 'Fix it and compare', body: 'Change the page and watch the same funnel again.' },
    ],
    features: [
      { key: 'funnels', answers: 'How many visitors reach each step, and where is the biggest drop?' },
      { key: 'replays', answers: 'What did visitors who left do on the page? Typed values are masked.' },
      { key: 'heatmaps', answers: 'What do they click, and how far do they scroll?' },
      { key: 'goals', answers: 'Mix page steps with custom events such as seentics.track("signup").' },
    ],
    funnel: { name: 'A typical sign-up funnel', steps: ['Landing page', 'Pricing', 'Sign-up form', 'Account created (custom event)'], note: 'Any step can be a page path or an event name.' },
    metrics: ['Conversion between each pair of steps', 'The step with the largest drop', 'Funnel conversion by source', 'Change after a redesign'],
    faqs: [
      { q: 'Can a step be an event, not a page?', a: 'Yes. Send events with seentics.track(name, props) and use the name as a step.' },
      { q: 'How far back can I look?', a: 'Funnels have a reporting window; see the funnels documentation.' },
      { q: 'How much traffic do I need?', a: 'Enough that differences are not noise. On low-traffic sites, recordings teach more than statistics.' },
    ],
  },
  {
    group: 'understand', slug: 'improve-landing-pages', name: 'Improve landing pages', icon: Flame,
    summary: 'See clicks and scroll depth on the real page',
    headline: 'Improve landing pages with click and scroll heatmaps and A/B variants',
    metaDescription: 'See where visitors click and how far they scroll, drawn over your real page, then test a change. Heatmaps and conversion optimisation from Seentics.',
    intro: 'Paid traffic to a page that hides its main button wastes the spend. Seentics draws clicks and scroll depth over your real page, then lets you test a change and check the funnel.',
    who: [
      { audience: 'Performance marketers', how: 'Check that the call to action is seen and clicked before scaling spend.' },
      { audience: 'Designers', how: 'Settle layout debates with where visitors actually click and stop scrolling.' },
      { audience: 'Agencies', how: 'Show a client evidence for a page change, and the result after it.' },
      { audience: 'Publishers', how: 'See how far readers get on an article template, and where to place a call to action.' },
      { audience: 'Ecommerce teams', how: 'Check what shoppers click on product pages, on mobile and on desktop.' },
    ],
    steps: [
      { title: 'Turn heatmaps on', body: 'Enable heatmaps for the site and choose the pages with include and exclude rules.' },
      { title: 'Read the two maps', body: 'Clicks show where visitors click, including on things that are not links; scroll shows how far down the page they get.' },
      { title: 'Watch a few sessions', body: 'Open recordings for the same page to see why a spot is hot or ignored.' },
      { title: 'Change one thing', body: 'Test a message or element with an A/B variant, or edit the page.' },
      { title: 'Check the funnel', body: 'Compare the step conversion before and after.' },
    ],
    features: [
      { key: 'heatmaps', answers: 'Where do visitors click and how far do they scroll, by device?' },
      { key: 'replays', answers: 'Watch individual visits behind the map.' },
      { key: 'automations', answers: 'A/B variants for on-page messages and personalised elements.' },
      { key: 'funnels', answers: 'Did the change move the step it targeted?' },
    ],
    metrics: ['Click concentration on the call to action', 'Scroll depth reached by most visitors', 'Clicks on non-clickable elements', 'Desktop versus mobile differences'],
    faqs: [
      { q: 'Is the map drawn over my real page?', a: 'Yes. The page underneath is captured so the map sits on it. Pages behind a login or heavy bot protection may need care; see the heatmaps documentation.' },
      { q: 'Can I exclude parts of a page?', a: 'Yes, with attributes on elements and with page rules.' },
      { q: 'Does Seentics run A/B tests?', a: 'Automations support A/B variants for on-page messages and personalised elements. Full-page redirect testing is not a separate feature.' },
    ],
  },
  {
    group: 'understand', slug: 'debug-with-session-recordings', name: 'Watch real sessions', icon: Video,
    summary: 'See what visitors actually did',
    headline: 'Session recordings: watch what visitors really did',
    metaDescription: 'Watch real visitor sessions with console, network and error context, filtered by rage clicks and errors. Inputs are always masked. Session recordings from Seentics.',
    intro: 'A number tells you that visitors left. A recording tells you why. Seentics records the visit as it unfolded, with technical context beside it, so a vague complaint becomes a specific fix.',
    who: [
      { audience: 'Support teams', how: 'Watch what happened instead of asking a customer to describe it.' },
      { audience: 'Product teams', how: 'See how new users move through onboarding and where they stall.' },
      { audience: 'QA and engineers', how: 'Reproduce a bug with the console, network calls and errors beside the replay.' },
      { audience: 'UX researchers', how: 'Watch real behaviour for patterns without scheduling interviews.' },
      { audience: 'Regulated businesses', how: 'Record behaviour while masking inputs and excluding sensitive pages.' },
    ],
    steps: [
      { title: 'Turn recording on', body: 'Enable it per site, choose which pages to include or exclude, and sample if you wish; a visit is recorded fully or not at all.' },
      { title: 'Filter to the interesting sessions', body: 'The session list flags rage clicks (three or more rapid clicks in one spot) and client errors.' },
      { title: 'Watch with context', body: 'See the replay with console output, network requests and errors alongside.' },
      { title: 'Tag and find again', body: 'Use a Tag Session action to label visitors so you can filter on them later.' },
    ],
    features: [
      { key: 'replays', answers: 'What did this visitor click, scroll and see, with console, network and error context?' },
      { key: 'errors', answers: 'Which sessions had a rage click or an error?' },
      { key: 'privacy', answers: 'Typed values and rich-text editors are always masked; any element or page can be excluded; tokens and emails are scrubbed.' },
      { key: 'funnels', answers: 'From a drop-off in a funnel, jump to the sessions that left at that step.' },
    ],
    metrics: ['Sessions with rage clicks', 'Sessions with errors', 'Sessions that ended at a funnel step', 'Pages excluded or sampled'],
    faqs: [
      { q: 'Does it record what people type?', a: 'No. Typed values in form fields and rich-text editors are masked, and that cannot be turned off.' },
      { q: 'What else is stored with a recording?', a: 'Console output, network request metadata (method, URL, status, duration, never bodies) and JavaScript errors, scrubbed of tokens and email-like strings before leaving the browser.' },
      { q: 'Can I record only some pages?', a: 'Yes, with include and exclude page rules and sampling.' },
    ],
  },
  {
    group: 'understand', slug: 'catch-bugs-and-broken-forms', name: 'Catch bugs & broken forms', icon: Bug,
    summary: 'JavaScript errors and rage clicks, with the session',
    headline: 'Catch JavaScript errors, rage clicks and broken forms before customers complain',
    metaDescription: 'Catch JavaScript errors, rage clicks and failing network calls, alert your team, and watch the sessions where they happened. Error tracking from Seentics.',
    intro: 'Many problems never reach a bug report: a button that does not respond, a script that throws on one browser. Seentics surfaces the signals of a broken experience and shows you the session.',
    who: [
      { audience: 'Ecommerce teams', how: 'Find payment-step errors that lose orders silently.' },
      { audience: 'SaaS teams', how: 'Catch rage clicks and errors in onboarding.' },
      { audience: 'Agencies', how: 'Spot a broken form on a client site before the client does.' },
      { audience: 'Developers and QA', how: 'Get the message, stack, file and line, with the session.' },
      { audience: 'Support', how: 'See what the customer saw.' },
    ],
    steps: [
      { title: 'Turn on error tracking', body: 'It is a per-site feature switch; uncaught errors and unhandled rejections are captured with message, stack, file and line.' },
      { title: 'Review flagged sessions', body: 'Sessions with rage clicks or client errors are marked in the session list.' },
      { title: 'Get alerted', body: 'Add an automation with a JS Error or Rage Click trigger and a Webhook to your team channel.' },
      { title: 'Fix and confirm', body: 'Watch the session that broke, fix it, and check the error stops.' },
    ],
    features: [
      { key: 'errors', answers: 'Which errors are happening, how often, on which pages?' },
      { key: 'replays', answers: 'Watch the moment it broke.' },
      { key: 'automations', answers: 'A Webhook posts to Slack or your own endpoint when an error or rage click fires.' },
      { key: 'privacy', answers: 'Tokens and email-like strings are scrubbed from console output, errors and URLs.' },
    ],
    automation: { trigger: 'JS Error on checkout or sign-up pages', action: 'Webhook to your team channel', why: 'A script error on a conversion page loses visitors silently; this makes it loud.' },
    metrics: ['Errors per page', 'Sessions with rage clicks', 'Failing network requests', 'Errors by browser and device'],
    faqs: [
      { q: 'Does it replace an error tracker?', a: 'It covers errors in visitors\' browsers with the session for context. For server-side errors, see Seentics Observability.' },
      { q: 'Can it alert my team?', a: 'Yes, with a Webhook action to any endpoint such as Slack.' },
      { q: 'Could errors contain sensitive data?', a: 'It scrubs sensitive-looking values, but cannot know your own conventions. Exclude pages that handle sensitive data.' },
    ],
  },

  // ── Grow & report ───────────────────────────────────────────────────────────
  {
    group: 'grow', slug: 'measure-campaign-roi', name: 'Measure campaign ROI', icon: Wallet,
    summary: 'Which campaigns actually bring revenue',
    headline: 'Measure campaign ROI with revenue attribution by source and campaign',
    metaDescription: 'Track orders and revenue and see which source, medium and campaign earned them. Works with WooCommerce, Shopify and custom stores. Revenue attribution from Seentics.',
    intro: 'Traffic reports tell you who visited. Revenue reports tell you who paid. Seentics ties each order back to the source and campaign that brought the buyer.',
    who: [
      { audience: 'Marketers', how: 'Move budget toward the campaigns that bring orders, not just visits.' },
      { audience: 'Agencies', how: 'Report revenue by campaign to prove the work.' },
      { audience: 'Non-profits', how: 'See which emails and posts raised donations, sent as purchase events.' },
      { audience: 'Event organisers', how: 'See which channels sold tickets.' },
      { audience: 'Course and membership sellers', how: 'See which campaigns brought paying members.' },
    ],
    steps: [
      { title: 'Tag your links', body: 'Add UTM parameters to campaign links so source, medium and campaign are recorded.' },
      { title: 'Send purchases', body: 'Use the WooCommerce plugin or Shopify pixel, or call seentics.track("purchase", { value, currency, order_id }).' },
      { title: 'Record refunds', body: 'Send a refund event with the same order id; refunds are subtracted from revenue.' },
      { title: 'Read the report', body: 'Revenue and orders by source, medium, campaign and product, with each order listed.' },
    ],
    features: [
      { key: 'revenue', answers: 'Orders and revenue by source, medium, campaign and product.' },
      { key: 'analytics', answers: 'The same UTM tags that drive your traffic reports.' },
      { key: 'funnels', answers: 'Where purchasers differ from visitors who left.' },
      { key: 'ai', answers: 'Ask "which sources convert best" in plain English.' },
    ],
    metrics: ['Revenue and orders by campaign', 'Revenue by source and medium', 'New versus returning customers', 'Refunds subtracted from totals'],
    faqs: [
      { q: 'How is a purchase attributed?', a: 'To the visitor\'s most recent page view with UTM tags in the same session within 24 hours before purchase, then to UTM tags on the purchase itself, then to the referring site.' },
      { q: 'Are orders counted twice if the page reloads?', a: 'No. Orders with the same order id are counted once.' },
      { q: 'Does it convert currencies?', a: 'No. Totals are shown in the currency most orders use.' },
    ],
  },
  {
    group: 'grow', slug: 'report-to-clients', name: 'Report to clients', icon: Layers,
    summary: 'Many client sites, one account',
    headline: 'Run many client sites from one account and report to each client',
    metaDescription: 'Group websites under clients, control which features each client gets, share read-only dashboards and provision sites by API. Seentics for agencies and platforms.',
    intro: 'An agency needs the same analytics across many clients, with each client seeing only their own. Seentics groups websites under clients, controls their features, and shares dashboards you can embed.',
    who: [
      { audience: 'Digital agencies', how: 'Manage every client site in one account with one dashboard layout.' },
      { audience: 'Freelancers', how: 'Send each client a read-only link to their own results.' },
      { audience: 'SaaS platforms with tenants', how: 'Give every tenant its own tracking, provisioned by API at signup.' },
      { audience: 'Hosting and site-builder companies', how: 'Offer analytics to customers without building it.' },
    ],
    steps: [
      { title: 'Create clients', body: 'Group websites under a client in your account.' },
      { title: 'Set what each gets', body: 'Switch features on or off per client and cap their limits.' },
      { title: 'Share results', body: 'Give a client a read-only dashboard link, or embed it in an iframe in your own portal.' },
      { title: 'Automate setup', body: 'Provision tenants and sites through the management API with an account API key.' },
    ],
    features: [
      { key: 'agency', answers: 'Clients, feature switches, limits, embeds and a management API.' },
      { key: 'analytics', answers: 'One dashboard across every site.' },
      { key: 'revenue', answers: 'Revenue by campaign, to prove the work.' },
      { key: 'replays', answers: 'Show a client a real session when evidence helps.' },
    ],
    metrics: ['Traffic and conversions per client', 'Revenue by campaign per client', 'Funnel results before and after a project', 'Clients with dashboards in use'],
    faqs: [
      { q: 'Can clients see only their own data?', a: 'Yes. Read-only dashboard links cover one website or one client\'s websites.' },
      { q: 'Can I create sites automatically?', a: 'Yes, through the management API.' },
      { q: 'Can I control features per client?', a: 'Yes, with per-client feature switches and limits.' },
    ],
  },
  {
    group: 'grow', slug: 'convert-free-users', name: 'Convert free users to paid', icon: Zap,
    summary: 'Sign-up, activation and upgrade behaviour',
    headline: 'Convert free users to paid: track sign-up, activation and upgrade',
    metaDescription: 'Follow users from first visit to activation and upgrade, watch where they struggle, and prompt upgrades. Behaviour analytics for SaaS and software products.',
    intro: 'A software business lives on a funnel: visit, sign up, activate, upgrade. Seentics follows it with events and funnels, records where users struggle, and shows which campaigns bring paying customers.',
    who: [
      { audience: 'SaaS companies', how: 'Find the step between sign-up and first value where accounts go quiet.' },
      { audience: 'Mobile and web app teams', how: 'Send events from the app and build activation funnels.' },
      { audience: 'Marketplaces', how: 'Track listing creation and first transaction as steps.' },
      { audience: 'Developer tools', how: 'Watch where new users stall in docs and onboarding.' },
    ],
    steps: [
      { title: 'Install in the site and the app', body: 'The script tag, or a package for React, Next.js, Vue, Nuxt, Astro or Svelte.' },
      { title: 'Send the key events', body: 'seentics.track("signed_up"), seentics.track("activated"), and seentics.track("purchase", { value, currency }); identify known users with seentics.identify().' },
      { title: 'Build the funnel', body: 'Landing, sign-up, activated, pricing, upgraded.' },
      { title: 'Watch the stalls', body: 'Recordings of onboarding show where new users hesitate; rage clicks and errors are flagged.' },
      { title: 'Prompt the upgrade', body: 'Show a Banner on Time on Page on the pricing page, or a Modal on Exit Intent offering a trial or demo.' },
    ],
    features: [
      { key: 'funnels', answers: 'Where between sign-up and upgrade do users drop?' },
      { key: 'replays', answers: 'How do new users behave in onboarding?' },
      { key: 'revenue', answers: 'Which campaigns bring upgrades, not just sign-ups?' },
      { key: 'automations', answers: 'Prompt a demo or an upgrade on the pricing page, and alert support to a rage click.' },
    ],
    funnel: { name: 'Activation and upgrade', steps: ['Home page', 'Sign-up', 'Activated (custom event)', 'Pricing', 'Upgraded (purchase event)'], note: 'Send events from your app with seentics.track().' },
    automation: { trigger: 'Exit Intent on the pricing page', action: 'Show Modal with a button to start a trial or book a demo', why: 'It offers a low-risk next step to someone about to leave.' },
    metrics: ['Sign-up to activation conversion', 'Pricing page exits', 'Upgrades by source and campaign', 'Sessions with rage clicks or errors'],
    faqs: [
      { q: 'Can I track events inside my app?', a: 'Yes. The tracker has a browser API, and framework packages make it simple.' },
      { q: 'Can I identify users?', a: 'Yes, with seentics.identify(userId, traits), where consent allows. Do not send sensitive data as traits.' },
      { q: 'Does it replace product analytics?', a: 'It covers behaviour, funnels, recordings, heatmaps, errors and revenue. For deep cohort analysis, keep that tool beside it.' },
    ],
  },
  {
    group: 'grow', slug: 'grow-subscriptions-and-donations', name: 'Grow subscriptions & donations', icon: HeartHandshake,
    summary: 'Readers to subscribers, supporters to donors',
    headline: 'Grow subscriptions and donations by finding what turns attention into support',
    metaDescription: 'See how far readers get, which stories and articles lead to subscriptions or donations, and ask at the right moment. For publishers, non-profits and membership organisations.',
    intro: 'Publishers and non-profits both turn attention into support. Seentics shows how far readers get, which pieces lead to subscriptions or gifts, where donors hesitate on the form, and lets you ask at the point of highest engagement.',
    who: [
      { audience: 'Publishers and media', how: 'See scroll depth per article and which articles lead to subscriptions.' },
      { audience: 'Non-profits and charities', how: 'See which stories and campaigns bring donations, and where donors leave the giving form.' },
      { audience: 'Membership organisations', how: 'Track joins and renewals as revenue by campaign.' },
      { audience: 'Creators and newsletters', how: 'Invite engaged readers to subscribe with an email form.' },
      { audience: 'Schools and universities', how: 'See which programme pages and campaigns lead to applications.' },
    ],
    steps: [
      { title: 'See engagement', body: 'Use scroll heatmaps per page and the Scroll Depth trigger to learn how far readers get.' },
      { title: 'Ask at the right moment', body: 'Show a Banner or an email form Modal after a reader passes 60 to 75% of an article or story.' },
      { title: 'Track the gift or subscription', body: 'Send seentics.track("purchase", { value, currency, order_id }) so it appears in Revenue with its campaign.' },
      { title: 'Fix the form', body: 'Watch recordings of the donation or subscribe form to see where people stall.' },
    ],
    features: [
      { key: 'heatmaps', answers: 'How far do readers get, and what do they click?' },
      { key: 'revenue', answers: 'Gifts and subscriptions by campaign, source and medium.' },
      { key: 'leads', answers: 'Capture a supporter or subscriber email at a moment of high engagement.' },
      { key: 'replays', answers: 'Where donors or subscribers stall on the form.' },
    ],
    funnel: { name: 'Support funnel', steps: ['Story or article', 'Donate or subscribe page', 'Payment', 'Completed (purchase event)'], note: 'Send the final step from the confirmation page.' },
    automation: { trigger: 'Scroll Depth past 75% on a story or article', action: 'Show Banner linking to your donation or subscription page', why: 'Readers who finished are the most engaged, and it does not interrupt those who just arrived.' },
    metrics: ['Scroll depth per article or story', 'Donations or subscriptions by campaign', 'Donate page to completed gift', 'Sign-ups by source'],
    faqs: [
      { q: 'Can donations show as revenue?', a: 'Yes. Send them as purchase events with a value and currency, and they appear in Revenue attributed to the campaign that brought the donor.' },
      { q: 'Is there a free option?', a: 'See the pricing page for current plans, including a free one for small sites.' },
      { q: 'Does it use cookies?', a: 'By default it avoids persistent identifiers until consent where required. See the privacy documentation.' },
    ],
  },
];

export const USE_CASE_BY_SLUG: Record<string, UseCase> = Object.fromEntries(USE_CASES.map((u) => [u.slug, u]));
export const useCasesIn = (group: UseCaseGroup) => USE_CASES.filter((u) => u.group === group);
