import type { Annotation } from '@/components/use-cases/Shot';
import type { ExampleProps } from '@/components/use-cases/PopupExample';

/**
 * The visual and narrative layer of each /use-cases page, keyed by slug. The facts live in
 * use-cases.ts; this adds the pictures and the worked examples around them.
 *
 * Screenshots are real: the Seentics dashboard on its built-in demo data (public/use-cases).
 * Annotation positions are percentages of the 1440x900 image. The popups, the submissions list,
 * the alert and the funnel bars are drawn illustrations with sample values, and every one of
 * them says so on the page. Nothing here is a measured result.
 */

export interface ShotSpec { name: string; alt: string; url: string; annotations: Annotation[]; crop?: number }

export type Visual =
  | { kind: 'shot'; shot: ShotSpec }
  | { kind: 'example'; props: ExampleProps }
  | { kind: 'funnel'; steps: { label: string; value: number }[]; caption?: string }
  | { kind: 'alert'; title: string; lines: string[]; channel?: string }
  | { kind: 'submissions' };

export interface UseCaseDetail {
  hero: Visual;
  /** Logos from /integrations/<name>.svg shown under "Works with". */
  platforms?: string[];
  seen: { heading: string; text: string; visuals: Visual[] };
  scenario: { heading: string; paras: string[] };
  playbooks: { name: string; trigger: string; condition?: string; action: string; result: string }[];
  dashboard: { heading: string; text: string; shots: ShotSpec[] };
  loop: { title: string; body: string }[];
  checklist: string[];
  without: string[];
  withSeentics: string[];
}

const D = 'seentics.com';
const sh = (name: string, alt: string, path: string, annotations: Annotation[], crop?: number): ShotSpec => ({ name, alt, url: `${D}${path}`, annotations, crop });

const SHOTS = {
  funnelDetail: sh('funnel-detail', 'A funnel report with five steps, the visitors at each, and the biggest drop-off highlighted', '/websites/…/funnels', [
    { x: 40, y: 32, label: 'The biggest drop-off is called out for you, between which two steps and how many people.' },
    { x: 59, y: 49, label: 'Every step with its visitors and its share of everyone who entered the funnel.' },
    { x: 41, y: 53, label: 'Between steps: how many continued and how many dropped.' },
    { x: 47, y: 20, label: 'Conversion and drop-off rate for the whole path.' },
  ]),
  heatmapClicks: sh('heatmap-view', 'A click heatmap drawn over a pricing page, hottest on the Choose Growth button', '/websites/…/heatmaps', [
    { x: 82, y: 16, label: 'Clicks are drawn on your real page, not a wireframe.' },
    { x: 57, y: 55, label: 'The hottest spot is the main call to action.' },
    { x: 60, y: 3, label: 'Switch between click and scroll maps, and by device.' },
  ]),
  heatmapScroll: sh('heatmap-scroll', 'A scroll heatmap showing that 75 percent of visitors reached the compare plans section', '/websites/…/heatmaps', [
    { x: 81, y: 66, label: 'A line marks how far a share of visitors got: here, 75% reached the comparison table.' },
    { x: 57, y: 40, label: 'Colour fades from warm to cool as fewer visitors reach that part of the page.' },
    { x: 64, y: 3, label: 'Same page, switched to scroll depth.' },
  ]),
  replay: sh('replay-player', 'The session replay player with a summary panel and error and rage click flags', '/websites/…/replays', [
    { x: 44, y: 33, label: 'The visit replayed as it happened, with speed and skip controls.' },
    { x: 90, y: 3, label: 'Rage clicks and errors are flagged on the session.' },
    { x: 85, y: 33, label: 'Browser, device, country, entry and exit page for the visit.' },
    { x: 85, y: 8, label: 'Timeline, errors, console and network tabs beside the replay.' },
  ], 600),
  replays: sh('replays', 'The list of recorded sessions with filters for errors and rage clicks', '/websites/…/replays', [
    { x: 83, y: 25, label: 'Filter to sessions with errors, rage clicks, or a device.' },
    { x: 76, y: 43, label: 'Signals on each session tell you which ones to watch first.' },
    { x: 91, y: 36, label: 'One click to watch.' },
  ]),
  overview: sh('overview', 'The analytics overview with live visitors, a traffic chart, top pages and sources', '/websites/…', [
    { x: 57, y: 14, label: 'Live visitors, unique visitors, pageviews, session duration and bounce rate at a glance.' },
    { x: 57, y: 47, label: 'Visitors and pageviews over time, with compare and annotations.' },
    { x: 37, y: 87, label: 'Top, entry and exit pages.' },
    { x: 78, y: 87, label: 'Sources, including search and social.' },
  ]),
  paths: sh('paths', 'The user paths report with entry pages, exit pages and common page flows', '/websites/…/paths', [
    { x: 42, y: 37, label: 'Where visitors land first.' },
    { x: 73, y: 37, label: 'Where they leave from.' },
    { x: 58, y: 72, label: 'The most common moves from page to page.' },
  ]),
  revenue: sh('revenue', 'The revenue report with orders, average order value and attribution by source', '/websites/…/revenue', [
    { x: 58, y: 16, label: 'Revenue, orders, average order value and revenue per session, against the prior period.' },
    { x: 58, y: 44, label: 'Daily revenue and orders.' },
    { x: 58, y: 78, label: 'Attribution by source, medium, campaign, product and country.' },
    { x: 92, y: 80, label: 'Each channel\'s share of the total.' },
  ]),
  errors: sh('errors', 'The errors page listing JavaScript errors grouped by fault', '/websites/…/errors', [
    { x: 35, y: 36, label: 'Errors are grouped by fault, with the page and file where they happen.' },
    { x: 86, y: 37, label: 'How many times each has happened and when it was last seen.' },
    { x: 58, y: 15, label: 'Groups, occurrences, what is new and when the last error was.' },
  ], 640),
  automations: sh('automations', 'The automations list showing triggers, actions, runs and success rate', '/websites/…/automations', [
    { x: 56, y: 37, label: 'Each automation at a glance: its trigger and its action.' },
    { x: 76, y: 37, label: 'How many times it ran and how often it worked.' },
    { x: 88, y: 37, label: 'Switch one on or off without deleting it.' },
  ], 640),
  automationDetail: sh('automation-detail', 'An exit-intent automation with its run history and what it does', '/websites/…/automations', [
    { x: 85, y: 49, label: 'What it does, in order: the trigger, then the action.' },
    { x: 44, y: 49, label: 'Runs per day for the last two weeks.' },
    { x: 37, y: 22, label: 'Total runs, success rate, the last 30 days and failures.' },
  ], 620),
  agency: sh('agency', 'The agency dashboard listing clients, their websites, features and caps', '/websites/…/agency', [
    { x: 65, y: 47, label: 'One record per client, with their websites and status.' },
    { x: 64, y: 36, label: 'Which features each client has switched on.' },
    { x: 57, y: 15, label: 'Clients, active, websites and caps at a glance.' },
    { x: 24, y: 26, label: 'Embeds, API keys and the management API are one click away.' },
  ], 720),
  funnels: sh('funnels', 'The funnels list with each funnel\'s completion rate', '/websites/…/funnels', [
    { x: 62, y: 37, label: 'Every funnel with its completion rate and the visitors behind it.' },
    { x: 92, y: 37, label: 'Open one to see step-by-step drop-off.' },
  ], 520),
  heatmaps: sh('heatmaps', 'The heatmaps list with views, clicks and average scroll per page', '/websites/…/heatmaps', [
    { x: 63, y: 36, label: 'Views and clicks for every page you map.' },
    { x: 76, y: 36, label: 'Average scroll depth, so you can see which pages people actually read.' },
    { x: 92, y: 36, label: 'Open a page to see the map.' },
  ], 680),
};

const LOOP = (a: [string, string], b: [string, string], c: [string, string], d: [string, string]) =>
  [a, b, c, d].map(([title, body]) => ({ title, body }));

export const USE_CASE_DETAILS: Record<string, UseCaseDetail> = {
  'capture-leads': {
    hero: { kind: 'example', props: { kind: 'email-modal', layout: 'store', url: 'yourstore.com/products/trailhead-32l', title: 'Get 10% off your first order', body: 'Join our list and we will email your code, plus a heads-up on new arrivals.', fields: [{ label: 'First name', placeholder: 'Maya' }], consent: 'Yes, send me offers by email. You can unsubscribe at any time.', button: 'Send my code', note: 'A Show Modal action with "Collect emails with a form" turned on. Wording, colours, fields and the thank-you message are yours to set.' } },
    seen: {
      heading: 'From popup to your tools',
      text: 'The visitor sees a form on the page. When they submit, the submission is listed on the automation page with the popup, variant and page that produced it, and is sent on to your email platform, CRM or webhook.',
      visuals: [
        { kind: 'example', props: { kind: 'email-modal', layout: 'article', url: 'yourblog.com/guides/seo-checklist', title: 'Get the full checklist', body: 'Enter your email and we will send the PDF.', fields: [], button: 'Send it to me', note: 'The same action on a content page: only an email is required.' } },
        { kind: 'submissions' },
      ],
    },
    scenario: {
      heading: 'An example setup',
      paras: [
        'A furniture store sees that its buying guide pages are read to the end by many visitors who never join the mailing list. They add one automation: when a visitor scrolls past 60% of a guide, show a modal offering the printable checklist for an email address.',
        'They turn on the email form, add a first-name field, tick the consent box and make it required, and write a short thank-you message. They cap it at once per visitor and scope it to the guides section so it never appears on checkout.',
        'A week later they open the automation Submissions list and their email tool. Each submission shows which guide it came from, and the funnel built on lead_captured shows how many of those readers later reached a product page.',
      ],
    },
    playbooks: [
      { name: 'Guide readers to subscribers', trigger: 'Scroll Depth past 60%', condition: 'On a guide or article page', action: 'Show Modal with an email form', result: 'New submissions listed with the guide they came from, and sent to your email tool' },
      { name: 'First-order incentive', trigger: 'Exit Intent', condition: 'On a product or cart page', action: 'Show Modal with an offer and an email form', result: 'A lead_captured event and a submission for each taker' },
      { name: 'Waitlist for something not ready', trigger: 'Page View', condition: 'On a coming-soon page', action: 'Show Modal with an email and name form', result: 'A growing waitlist you can export as CSV' },
    ],
    dashboard: {
      heading: 'Watch the automation work',
      text: 'Every automation has its own page showing how often it ran and whether it worked.',
      shots: [SHOTS.automationDetail, SHOTS.automations],
    },
    loop: LOOP(['Find the moment', 'Funnels and scroll heatmaps show where interest peaks.'], ['Show the form', 'A popup at that moment, with the fields you need.'], ['Collect and follow up', 'Submissions are sent to your email tool or CRM, and listed on the automation.'], ['Measure', 'lead_captured feeds goals and funnels, per popup and variant.']),
    checklist: ['Pick one page and one trigger to start', 'Ask for as little as you can: email, plus at most a name', 'Add a consent checkbox, and make it required where the law needs it', 'Set a frequency cap and a cooldown', 'Write a thank-you message that says what happens next', 'Send a test submission and check it reaches your destination', 'Build a funnel with lead_captured as a step'],
    without: ['A static form at the bottom of the page that few people reach', 'Sign-ups with no idea what earned them', 'Analytics, popups and leads in three separate tools'],
    withSeentics: ['A form at the moment interest peaks', 'Every lead tagged with its popup, variant and page', 'Capture rate and what leads do next in the same dashboard'],
  },

  'recover-leaving-visitors': {
    hero: { kind: 'example', props: { kind: 'offer-modal', layout: 'store', url: 'yourstore.com/cart', title: 'Wait, your cart is waiting', body: 'Complete your order in the next few minutes and we will include free shipping.', button: 'Back to checkout', note: 'A Show Modal action on Exit Intent on the cart page. The button links back to checkout.' } },
    seen: {
      heading: 'Find the page worth saving',
      text: 'A funnel shows where visitors leave. That step, not every page, is where an exit message belongs.',
      visuals: [
        { kind: 'funnel', steps: [{ label: 'Product page', value: 10000 }, { label: 'Cart', value: 3200 }, { label: 'Checkout', value: 1400 }, { label: 'Purchase', value: 900 }] },
        { kind: 'example', props: { kind: 'email-modal', layout: 'pricing', url: 'yourapp.com/pricing', title: 'Not ready? We will remind you', body: 'Leave your email and we will send a summary of the plans.', fields: [], button: 'Send the summary', note: 'For a visitor you may not win today: turn the same popup into an email form.' } },
      ],
    },
    scenario: {
      heading: 'An example setup',
      paras: [
        'A software company notices from its funnel that many visitors reach the pricing page and leave without starting a trial. They add an Exit Intent automation on /pricing: a short modal with a button to start a free trial.',
        'Because exit intent follows the cursor, they add a second automation for phone visitors using Time on Page, so people on mobile see a similar nudge after a while. Both are capped at once per visitor.',
        'Two weeks on, they open the funnel again and compare the pricing-to-trial step with the weeks before, and watch a few recordings of visitors who dismissed the popup to improve the wording.',
      ],
    },
    playbooks: [
      { name: 'Cart rescue', trigger: 'Exit Intent', condition: 'On the cart page', action: 'Show Modal with a button back to checkout', result: 'Cart-to-checkout step in the funnel moves' },
      { name: 'Pricing page save', trigger: 'Exit Intent', condition: 'On the pricing page', action: 'Show Modal offering a trial or a demo', result: 'More visitors continue to sign-up' },
      { name: 'Mobile fallback', trigger: 'Time on Page', condition: 'On the same page', action: 'Show Banner with the same offer', result: 'Phone visitors, who have no cursor, are reached too' },
    ],
    dashboard: { heading: 'Check that it helped', text: 'Look at the step the popup targets before and after, and at how often the automation ran.', shots: [SHOTS.funnelDetail, SHOTS.automationDetail] },
    loop: LOOP(['Find the leak', 'A funnel shows the step with the biggest drop.'], ['Say one thing', 'A short message and one button at the moment of leaving.'], ['Limit it', 'Frequency caps and cooldowns so it appears once.'], ['Compare', 'The same funnel step before and after, plus variants.']),
    checklist: ['Choose the one page with the biggest drop', 'Use Exit Intent for desktop and a time or scroll trigger for phones', 'Keep the message to one sentence and one button', 'Only promise what you will deliver', 'Cap it at once per visitor', 'Watch a handful of recordings after a week', 'Test two wordings with A/B variants'],
    without: ['Visitors leave and you only see an exit rate', 'Popups shown everywhere, every visit', 'No way to tell whether the message changed anything'],
    withSeentics: ['A message at the moment of leaving, on the right page only', 'Caps and cooldowns so it is not repeated', 'The funnel step and recordings to judge the result'],
  },

  'get-more-bookings': {
    hero: { kind: 'example', props: { kind: 'booking-modal', layout: 'booking', url: 'yourdealership.com/used/suv-2021', title: 'Book a test drive', body: 'Pick a time that suits you and we will confirm by phone.', fields: [{ label: 'Phone', placeholder: '+1 555 0100' }, { label: 'Preferred day', placeholder: 'Saturday morning' }], button: 'Request a test drive', note: 'A short enquiry form in a Show Modal action, shown after a visitor has spent time on a vehicle page.' } },
    seen: {
      heading: 'Know the moment someone stalls',
      text: 'A visitor who starts a booking form and leaves is a warm lead. Seentics can tell your team the same day.',
      visuals: [
        { kind: 'alert', title: 'Booking form left unfinished', lines: ['Page: /used/suv-2021', 'Source: google / cpc'], channel: '#sales' },
        { kind: 'funnel', steps: [{ label: 'Vehicle page', value: 4000 }, { label: 'Booking form opened', value: 900 }, { label: 'Form submitted', value: 310 }, { label: 'Test drive confirmed', value: 240 }] },
      ],
    },
    scenario: {
      heading: 'An example setup',
      paras: [
        'A dealership builds a funnel from vehicle page to booking form to a confirmed test drive, and sees most people who open the form never submit it.',
        'They add an automation with a Form Abandonment trigger that posts a Webhook to the sales team\'s channel and tags the session. The alert says a form was left; it includes nothing the visitor typed.',
        'The team watches a few tagged recordings and finds that the date field is awkward on phones. They simplify it and compare the form step in the funnel afterwards.',
      ],
    },
    playbooks: [
      { name: 'Unfinished booking alert', trigger: 'Form Abandonment', condition: 'On the booking form', action: 'Webhook to your team channel, and Tag Session', result: 'A message in the channel and a tagged recording' },
      { name: 'Prompt a booking', trigger: 'Time on Page', condition: 'On a vehicle, listing or service page', action: 'Show Banner linking to the booking page', result: 'More visitors reach the form' },
      { name: 'Short form for the unsure', trigger: 'Exit Intent', condition: 'On the booking page', action: 'Show Modal with a name, email and phone form', result: 'A contact in Leads who can be called back' },
    ],
    dashboard: { heading: 'Find the step that loses people', text: 'The funnel names the biggest drop. Open recordings and the page heatmap for that step.', shots: [SHOTS.funnelDetail, SHOTS.replay] },
    loop: LOOP(['Define the path', 'Page, form, confirmation event.'], ['Find the stall', 'The funnel shows which step loses most.'], ['Get told', 'A Webhook alerts your team to an unfinished form.'], ['Fix and compare', 'Recordings show why; the funnel shows the effect.']),
    checklist: ['Send a confirmation event from the thank-you page', 'Build the funnel, with the form as its own step', 'Add a Form Abandonment automation with a Webhook', 'Keep personal and health details out of events and webhook messages', 'Check the form on a phone', 'Review five tagged recordings a week'],
    without: ['You learn about lost enquiries never', 'Forms are fixed by guesswork', 'No view of which pages or sources produce bookings'],
    withSeentics: ['A same-day alert when a form is abandoned', 'The step that loses people, and a recording to see why', 'Bookings by page and source'],
  },

  'increase-online-sales': {
    hero: { kind: 'shot', shot: sh('revenue', 'The revenue report showing orders, revenue and attribution by source', '/websites/…/revenue', []) },
    platforms: ['woocommerce', 'shopify', 'wordpress', 'nextdotjs', 'webflow', 'bigcommerce'],
    seen: {
      heading: 'Where shoppers leave, and what failed',
      text: 'The purchase funnel shows the step that leaks. Recordings show whether it was a hesitation or a bug.',
      visuals: [
        { kind: 'funnel', steps: [{ label: 'Product page', value: 12000 }, { label: 'Cart', value: 3600 }, { label: 'Checkout', value: 1500 }, { label: 'Purchase', value: 980 }] },
        { kind: 'alert', title: 'JavaScript error on /checkout', lines: ['TypeError: Cannot read properties of undefined', 'Browser: Safari on iOS'], channel: '#engineering' },
      ],
    },
    scenario: {
      heading: 'An example setup',
      paras: [
        'An outdoor-gear store installs the WooCommerce plugin, which reports purchases and a few shopping events. Within a day the Revenue page shows orders by source, and the funnel shows more shoppers leave between cart and checkout than anywhere else.',
        'They watch recordings of sessions that ended there and find a shipping estimate that fails to load on one browser. A JS Error automation now posts to their engineering channel if it ever recurs.',
        'For shoppers who simply leave, an Exit Intent modal on the cart page offers free shipping over a threshold, capped at once per visitor. Revenue by campaign tells them which ads brought the buyers.',
      ],
    },
    playbooks: [
      { name: 'Cart exit offer', trigger: 'Exit Intent', condition: 'On the cart page', action: 'Show Modal with an offer and a button to checkout', result: 'Cart-to-checkout conversion moves' },
      { name: 'Payment error alert', trigger: 'JS Error', condition: 'On checkout pages', action: 'Webhook to your engineering channel', result: 'You hear about a broken checkout the same hour' },
      { name: 'Find the dead button', trigger: 'Rage Click', condition: 'On product or checkout pages', action: 'Tag Session', result: 'A filter in recordings for the sessions to watch' },
    ],
    dashboard: { heading: 'Revenue, and the funnel behind it', text: 'Revenue tells you what sold and which campaign earned it. The funnel and recordings tell you what did not.', shots: [SHOTS.revenue, SHOTS.funnelDetail] },
    loop: LOOP(['Send purchases', 'The plugin, the pixel, or seentics.track("purchase").'], ['Find the leak', 'The funnel between product and purchase.'], ['Watch and fix', 'Recordings of the sessions that failed.'], ['Attribute', 'Revenue by source, medium and campaign.']),
    checklist: ['Install the WooCommerce plugin or the Shopify pixel, or send purchase events yourself', 'Place a test order and check it in Revenue', 'Tag campaign links with UTM parameters', 'Build the product-to-purchase funnel', 'Set up a JS Error alert for checkout', 'Add a capped cart exit offer', 'Record refunds so revenue stays accurate'],
    without: ['Revenue totals with no idea which campaign earned them', 'Checkout bugs found from support tickets', 'No view of why carts are abandoned'],
    withSeentics: ['Orders and revenue by source and campaign', 'The leaking step, and recordings to see why', 'Alerts when checkout breaks, and offers when shoppers leave'],
  },

  'promote-offers': {
    hero: { kind: 'example', props: { kind: 'banner', layout: 'store', url: 'yourstore.com/collections/summer', title: 'Summer sale: 20% off outdoor gear until Sunday', button: 'Shop the sale', note: 'A Show Banner action on a Page View trigger for a collection page.' } },
    seen: {
      heading: 'Four ways to put a message on the page',
      text: 'Pick the format that fits the moment. Each can carry a button, custom colours, and optional HTML and CSS.',
      visuals: [
        { kind: 'example', props: { kind: 'toast', layout: 'store', url: 'yourstore.com/products/trailhead-32l', title: 'Free shipping over $75', body: 'Add one more item to qualify.', button: 'See bestsellers', note: 'A Show Toast action, positioned and timed.' } },
        { kind: 'example', props: { kind: 'highlight', layout: 'booking', url: 'yourevent.com/agenda', title: 'Register now to save your seat', button: 'Register', note: 'A Highlight Element action drawing attention to the register button after a long look at the agenda.' } },
      ],
    },
    scenario: {
      heading: 'An example setup',
      paras: [
        'A retailer is running a weekend sale. They add a banner on collection pages that links to the sale page, and a toast on product pages that mentions free shipping over a threshold.',
        'Both have a frequency cap and a cooldown, and the banner has a lower priority than a cart-recovery message, so the right one wins when two could fire. They A/B test two banner headlines.',
        'After the weekend they check how many visitors went on to the sale page and how revenue by campaign compared with the weekend before.',
      ],
    },
    playbooks: [
      { name: 'Sale banner', trigger: 'Page View', condition: 'On collection pages', action: 'Show Banner linking to the sale', result: 'More visitors reach the sale page' },
      { name: 'Feature announcement', trigger: 'Page View', condition: 'On the page where the feature lives', action: 'Show Tooltip or Highlight Element', result: 'More users find the new feature' },
      { name: 'Campaign headline', trigger: 'Page View', condition: 'On a campaign landing page', action: 'Personalize Content on the headline', result: 'The page matches the ad that brought the visitor' },
    ],
    dashboard: { heading: 'See what ran, and how often', text: 'The automations list shows each message, how many times it fired and whether it worked.', shots: [SHOTS.automations, SHOTS.automationDetail] },
    loop: LOOP(['Pick the page', 'Page View, Scroll Depth, Time on Page or Click.'], ['Pick the format', 'Banner, toast, tooltip, highlight or personalised text.'], ['Control exposure', 'Caps, cooldowns and priority.'], ['Compare', 'A/B variants and goals.']),
    checklist: ['Decide the one action you want', 'Scope the message to the pages where it makes sense', 'Set frequency caps and priority', 'Check the banner does not cover buttons people click', 'Test two headlines with A/B variants', 'Check results in goals or a funnel'],
    without: ['A banner hard-coded into the theme, shown to everyone forever', 'No idea whether anyone clicked', 'A developer needed for every change'],
    withSeentics: ['Messages scoped to the pages and behaviour you choose', 'Caps, cooldowns and priority built in', 'Built in the automation builder, with results beside them'],
  },

  'understand-your-traffic': {
    hero: { kind: 'shot', shot: sh('overview', 'The analytics overview with live visitors and a traffic chart', '/websites/…', []) },
    seen: { heading: 'Five questions, answered on one screen', text: 'Who came, from where, to which pages, on what device, and are they doing the thing that matters?', visuals: [{ kind: 'shot', shot: SHOTS.overview }] },
    scenario: {
      heading: 'An example week',
      paras: [
        'A founder opens the overview on Monday. Live visitors confirm the site is up; the chart shows a bump on Thursday, and the sources panel shows it came from a newsletter that mentioned them.',
        'They press ⌘K and ask "which sources convert best". Seentics AI answers with a table they export as CSV for the weekly update.',
        'They add a goal for the sign-up page so the same overview shows how many visitors reached it, without installing anything new.',
      ],
    },
    playbooks: [
      { name: 'Weekly check', trigger: 'You open the overview', action: 'Read pages, sources, devices and countries', result: 'Five answers in a minute' },
      { name: 'Campaign check', trigger: 'A campaign launches', condition: 'With UTM-tagged links', action: 'Open Sources and filter by campaign', result: 'Which campaigns bring visitors' },
      { name: 'Ask a question', trigger: 'You press ⌘K', action: 'Type the question in plain English', result: 'A table you can export as CSV' },
    ],
    dashboard: { heading: 'How people move through your site', text: 'The paths report shows entry pages, exit pages and the most common moves between pages.', shots: [SHOTS.paths] },
    loop: LOOP(['Add the script', 'One tag, no configuration.'], ['Read the overview', 'Pages, sources, devices, countries.'], ['Set goals', 'Name a page or an event.'], ['Ask and export', 'Plain-English questions, CSV out.']),
    checklist: ['Add the script or the plugin for your platform', 'Confirm your own visit shows in Live Visitors', 'Tag campaign links with UTM parameters', 'Add a goal for the page that matters', 'Decide your consent approach for regions that need it', 'Bookmark the three reports you check weekly'],
    without: ['A heavy suite with hundreds of reports', 'Visitor IPs and cross-site identifiers you would rather not hold', 'Marketing and traffic reports that do not match'],
    withSeentics: ['The few views you use, live', 'No IP storage and a per-site visitor id', 'UTM campaigns in the same report as the pages'],
  },

  'find-why-visitors-dont-convert': {
    hero: { kind: 'shot', shot: sh('funnel-detail', 'A funnel report with the biggest drop-off highlighted', '/websites/…/funnels', []) },
    seen: { heading: 'From a number to a session', text: 'The funnel says where. The heatmap says what they do on that page. The recording says why.', visuals: [{ kind: 'shot', shot: SHOTS.funnelDetail }] },
    scenario: {
      heading: 'An example investigation',
      paras: [
        'A marketing manager is paying for traffic to a landing page that converts poorly. They build a funnel: landing page, pricing, sign-up form, account created. Most visitors drop between landing and pricing.',
        'The click heatmap for the landing page shows most clicks go to a logo link that does not lead to pricing, and the scroll map shows the pricing button sits where only a quarter of visitors reach.',
        'Recordings of visitors who left confirm it. They move the button up, and the same funnel the following week shows the step improving.',
      ],
    },
    playbooks: [
      { name: 'Find the biggest drop', trigger: 'You open a funnel', action: 'Read the highlighted drop-off', result: 'The one step worth fixing' },
      { name: 'See what they do there', trigger: 'On that page', action: 'Open the click and scroll heatmap', result: 'What is clicked and what is missed' },
      { name: 'Watch the visitors who left', trigger: 'Sessions that ended at the step', action: 'Open the recordings', result: 'The reason, in the visitor\'s own session' },
    ],
    dashboard: { heading: 'Three views of one problem', text: 'The heatmap and the recording both open from the page and the step you are looking at.', shots: [SHOTS.heatmapClicks, SHOTS.replay] },
    loop: LOOP(['Define the path', 'Pages and events as steps.'], ['Find the drop', 'The biggest loss is highlighted.'], ['Look and watch', 'Heatmap, then recordings.'], ['Change and compare', 'The same funnel afterwards.']),
    checklist: ['Pick one journey, not the whole site', 'Send an event for the final step', 'Build the funnel and note the biggest drop', 'Open the heatmap for that page, desktop and mobile', 'Watch five recordings of visitors who left there', 'Change one thing, then compare'],
    without: ['A conversion rate that does not say where to look', 'Heatmaps in one tool and recordings in another', 'Redesigns with no baseline'],
    withSeentics: ['The leak named for you', 'Heatmaps and recordings one click away', 'A baseline to compare against'],
  },

  'improve-landing-pages': {
    hero: { kind: 'shot', shot: sh('heatmap-view', 'A click heatmap drawn over a pricing page', '/websites/…/heatmaps', []) },
    seen: { heading: 'Clicks and scroll, on your real page', text: 'The page underneath is captured so the map sits on the real thing, and you can switch between clicks, scroll and devices.', visuals: [{ kind: 'shot', shot: SHOTS.heatmapClicks }, { kind: 'shot', shot: SHOTS.heatmapScroll }] },
    scenario: {
      heading: 'An example review',
      paras: [
        'A designer wants to move a call to action. The click map shows the main button is the hottest spot on the page, but the scroll map shows only 75% of visitors reach the comparison table below it.',
        'They open recordings of a few visitors who left from that page and see people scrolling past the second button without noticing it.',
        'They test a new headline with an A/B variant on the personalised element, then check the funnel for the step this page feeds.',
      ],
    },
    playbooks: [
      { name: 'Audit a page', trigger: 'Before a redesign', action: 'Open the click and scroll maps', result: 'A baseline of what is clicked and seen' },
      { name: 'Check a campaign page', trigger: 'Paid traffic is live', action: 'Open the map filtered to mobile', result: 'Whether the call to action is seen on phones' },
      { name: 'Test a headline', trigger: 'Page View', condition: 'On the landing page', action: 'Personalize Content with two A/B variants', result: 'Which wording the funnel prefers' },
    ],
    dashboard: { heading: 'Every mapped page at a glance', text: 'The list shows views, clicks and average scroll depth per page, so you know where to look first.', shots: [SHOTS.heatmaps] },
    loop: LOOP(['Map the page', 'Include the pages you care about.'], ['Read the maps', 'Clicks and scroll depth, by device.'], ['Change one thing', 'An edit or an A/B variant.'], ['Compare', 'The map and the funnel afterwards.']),
    checklist: ['Turn heatmaps on for the site and choose the pages', 'Look at desktop and mobile separately', 'Note the scroll depth reached by most visitors', 'Check for clicks on things that are not links', 'Exclude sensitive elements and pages', 'Change one thing at a time'],
    without: ['Design arguments settled by the loudest voice', 'A call to action nobody scrolls to', 'Desktop findings assumed to hold on mobile'],
    withSeentics: ['Evidence for layout decisions', 'Scroll depth that shows what is actually read', 'Device-by-device maps'],
  },

  'debug-with-session-recordings': {
    hero: { kind: 'shot', shot: sh('replay-player', 'The session replay player with error and rage click flags', '/websites/…/replays', [], 600) },
    seen: { heading: 'The visit, with the evidence beside it', text: 'Watch the session, and read the console, network and errors that happened at that moment.', visuals: [{ kind: 'shot', shot: SHOTS.replay }] },
    scenario: {
      heading: 'An example support case',
      paras: [
        'A customer writes that checkout "does not work". Instead of asking for browser versions and screenshots, support filters the session list to sessions with errors on /checkout.',
        'They find the visit, watch the customer click the pay button three times, and see in the network tab a request that failed with a 502 at that moment.',
        'The note they send to engineering contains the session link and the failing call, and the fix is shipped the same day.',
      ],
    },
    playbooks: [
      { name: 'Triage by signal', trigger: 'You open the session list', action: 'Filter to rage clicks or errors', result: 'Start with the sessions that went wrong' },
      { name: 'Label a behaviour', trigger: 'Click on a key button', action: 'Tag Session', result: 'A filter for those visitors in recordings' },
      { name: 'Keep it private', trigger: 'Recording setup', action: 'Exclude pages and sample sessions', result: 'Sensitive pages are never recorded' },
    ],
    dashboard: { heading: 'The session list, sorted by what matters', text: 'Signals on every row tell you which visits to watch first.', shots: [SHOTS.replays] },
    loop: LOOP(['Turn recording on', 'Per site, with page rules and sampling.'], ['Filter', 'Rage clicks and errors first.'], ['Watch with context', 'Console, network and errors beside the replay.'], ['Tag and share', 'Label sessions and send a link.']),
    checklist: ['Enable recording and choose included and excluded pages', 'Decide a sampling rate if traffic is high', 'Check that sensitive pages are excluded', 'Confirm typed values are masked in a test session', 'Teach support to filter by errors and rage clicks', 'Use Tag Session for behaviours you want to find again'],
    without: ['Bug reports without steps', 'Hours spent reproducing issues', 'Guessing why a funnel step loses people'],
    withSeentics: ['The session, the console and the network in one place', 'Flagged sessions first', 'Typed input always masked'],
  },

  'catch-bugs-and-broken-forms': {
    hero: { kind: 'shot', shot: sh('errors', 'The errors page listing JavaScript errors grouped by fault', '/websites/…/errors', [], 640) },
    seen: {
      heading: 'Errors grouped by fault, and a nudge to your team',
      text: 'Uncaught errors from real visitors are grouped so one bug is one row, and an automation can post to your channel the moment one fires.',
      visuals: [{ kind: 'shot', shot: SHOTS.errors }, { kind: 'alert', title: 'JavaScript error on /checkout', lines: ['TypeError: Cannot read properties of undefined (reading \'price\')', 'File: pricing-table.js:214'], channel: '#engineering' }],
    },
    scenario: {
      heading: 'An example catch',
      paras: [
        'A release changes a pricing component. An hour later the Errors page shows a new group with a growing count, reading a property of something undefined on /pricing.',
        'A JS Error automation had already posted to the engineering channel with the page and file. Engineering opens a flagged session, sees the pricing table fail to render, and reverts the release.',
        'The group stops growing, and they mark the fault resolved.',
      ],
    },
    playbooks: [
      { name: 'Alert on errors', trigger: 'JS Error', condition: 'On conversion pages', action: 'Webhook to your team channel', result: 'A message with the page and the error' },
      { name: 'Collect frustration', trigger: 'Rage Click', condition: 'On forms and buttons', action: 'Tag Session', result: 'Recordings of frustrated visitors, grouped' },
      { name: 'Review after a release', trigger: 'After you ship', action: 'Open Errors filtered to new groups', result: 'New faults caught early' },
    ],
    dashboard: { heading: 'Then watch what happened', text: 'Open a flagged session to see the replay with the error and the network call beside it.', shots: [SHOTS.replay] },
    loop: LOOP(['Capture', 'Uncaught errors and unhandled rejections.'], ['Group', 'One row per fault, with counts.'], ['Alert', 'A Webhook to the team.'], ['Watch and fix', 'The flagged session shows the moment.']),
    checklist: ['Turn on error tracking for the site', 'Add a JS Error automation on checkout and sign-up pages', 'Point the Webhook at your team channel', 'Exclude pages that handle sensitive data from recording', 'Review new error groups after each release', 'Use Rage Click to find broken buttons'],
    without: ['Bugs found from complaints', 'Reproduction by guesswork', 'No view of errors by page or browser'],
    withSeentics: ['Errors grouped and counted', 'Alerts to your channel', 'The session that shows the bug'],
  },

  'measure-campaign-roi': {
    hero: { kind: 'shot', shot: sh('revenue', 'Revenue attribution by source, medium and campaign', '/websites/…/revenue', []) },
    platforms: ['woocommerce', 'shopify', 'wordpress', 'nextdotjs'],
    seen: { heading: 'Revenue by where it came from', text: 'Each order is credited to the source, medium and campaign that brought the buyer, with refunds subtracted.', visuals: [{ kind: 'shot', shot: SHOTS.revenue }] },
    scenario: {
      heading: 'An example month',
      paras: [
        'A marketer tags email, social and paid links with UTM parameters, and sends purchases through the WooCommerce plugin. At month end they open Revenue and switch the attribution table from Source to Campaign.',
        'The newsletter shows a smaller share of visits than social but a larger share of revenue. They shift the next month\'s effort accordingly.',
        'A refund recorded with the same order id is subtracted from the totals, so the report matches what the business kept.',
      ],
    },
    playbooks: [
      { name: 'Tag every link', trigger: 'A campaign launches', action: 'Add utm_source, utm_medium, utm_campaign', result: 'Revenue grouped by campaign' },
      { name: 'Send purchases', trigger: 'An order completes', action: 'Plugin, pixel, or seentics.track("purchase")', result: 'Orders with value, currency and order id' },
      { name: 'Record refunds', trigger: 'A refund is issued', action: 'seentics.track("refund") with the same order id', result: 'Revenue net of refunds' },
    ],
    dashboard: { heading: 'Switch the lens', text: 'Attribution can be read by source, medium, campaign, product or country.', shots: [SHOTS.revenue] },
    loop: LOOP(['Tag', 'UTM parameters on every link.'], ['Track', 'Purchases with value and order id.'], ['Attribute', 'Revenue by source and campaign.'], ['Reallocate', 'Move budget to what pays.']),
    checklist: ['Agree a UTM naming convention', 'Place a test order and confirm it is attributed', 'Send refunds with the original order id', 'Check which currency most orders use', 'Review revenue by campaign monthly', 'Compare with your store\'s own report'],
    without: ['Budget decided on visits, not revenue', 'Orders you cannot trace to a campaign', 'Gross revenue overstating what you kept'],
    withSeentics: ['Orders and revenue by campaign', 'Refunds subtracted', 'The same UTMs as your traffic reports'],
  },

  'report-to-clients': {
    hero: { kind: 'shot', shot: sh('agency', 'The agency dashboard listing clients, websites and features', '/websites/…/agency', [], 720) },
    seen: { heading: 'One account, many clients', text: 'Each client has their websites, their features and their limits, and you decide what they see.', visuals: [{ kind: 'shot', shot: SHOTS.agency }] },
    scenario: {
      heading: 'An example agency',
      paras: [
        'A small agency manages a dozen client sites. They create a client for each, group the sites under it, and switch session recordings off for a client who does not want them.',
        'For monthly reports they send each client a read-only dashboard link, and one client embeds theirs in their own portal.',
        'When a new client signs, a script creates the client and its site through the management API, so onboarding takes minutes.',
      ],
    },
    playbooks: [
      { name: 'Onboard a client', trigger: 'A new client signs', action: 'Create the client and site in the dashboard or by API', result: 'Tracking code ready to install' },
      { name: 'Limit a plan', trigger: 'A client has a cap', action: 'Set event and recording limits', result: 'Usage that matches the plan' },
      { name: 'Share results', trigger: 'Monthly report', action: 'Send a read-only link or embed it', result: 'Clients see their own data only' },
    ],
    dashboard: { heading: 'All clients at a glance', text: 'Status, websites, features and caps in one table, with embeds and API keys beside it.', shots: [SHOTS.agency, SHOTS.overview] },
    loop: LOOP(['Create clients', 'Group sites under each.'], ['Set features', 'Switch on what each gets.'], ['Share', 'Read-only links and embeds.'], ['Automate', 'The management API.']),
    checklist: ['Create a client per account', 'Decide which features each client gets', 'Set caps where plans need them', 'Share a read-only dashboard link', 'Create an account API key for automation', 'Document the install for the client\'s developer'],
    without: ['A different login for every client', 'Screenshots pasted into reports', 'Manual setup for each new site'],
    withSeentics: ['One account, many clients', 'Live read-only dashboards', 'Provisioning by API'],
  },

  'convert-free-users': {
    hero: { kind: 'shot', shot: sh('funnel-detail', 'A five-step funnel from home page to sign-up complete', '/websites/…/funnels', []) },
    seen: { heading: 'From first visit to paid', text: 'Send the events that mark progress, and the funnel shows where free users stall.', visuals: [{ kind: 'funnel', steps: [{ label: 'Home page', value: 20000 }, { label: 'Sign-up', value: 3500 }, { label: 'Activated', value: 1400 }, { label: 'Pricing viewed', value: 600 }, { label: 'Upgraded', value: 210 }] }, { kind: 'example', props: { kind: 'offer-modal', layout: 'pricing', url: 'yourapp.com/pricing', title: 'Questions about which plan fits?', body: 'Book a short call and we will help you choose.', button: 'Book a demo', note: 'An Exit Intent modal on the pricing page.' } }] },
    scenario: {
      heading: 'An example product',
      paras: [
        'A SaaS team sends signed_up and activated from the app, and a purchase event on upgrade. Their funnel shows activation is the weak step.',
        'Recordings of new accounts that never activated show people stalling on an import screen. They simplify it and compare activation the next fortnight.',
        'Meanwhile an Exit Intent modal on the pricing page offers a demo, and Revenue shows which campaigns bring upgrades, not just sign-ups.',
      ],
    },
    playbooks: [
      { name: 'Find the activation gap', trigger: 'Your funnel', action: 'Read signed up to activated', result: 'How many new users reach first value' },
      { name: 'Help a stuck user', trigger: 'Rage Click', condition: 'In onboarding', action: 'Tag Session and Webhook to support', result: 'Support can watch and reach out' },
      { name: 'Offer a demo', trigger: 'Exit Intent', condition: 'On the pricing page', action: 'Show Modal with a button to book a demo', result: 'More demo requests' },
    ],
    dashboard: { heading: 'The funnel and the sessions behind it', text: 'Open recordings of new users who dropped between two steps.', shots: [SHOTS.funnelDetail, SHOTS.replay] },
    loop: LOOP(['Instrument', 'signed_up, activated, purchase.'], ['Find the stall', 'The funnel between steps.'], ['Watch', 'Recordings of onboarding.'], ['Prompt', 'A demo or trial at the right moment.']),
    checklist: ['Install the script or a framework package in the app', 'Send signed_up, activated and purchase events', 'Identify users with identify() where consent allows', 'Build the activation and upgrade funnel', 'Watch five sessions of users who did not activate', 'Add a capped pricing-page offer'],
    without: ['Sign-up counts with no sense of activation', 'Onboarding friction invisible in dashboards', 'Upgrades not tied to campaigns'],
    withSeentics: ['A funnel from visit to upgrade', 'Recordings of where users stall', 'Revenue by campaign'],
  },

  'grow-subscriptions-and-donations': {
    hero: { kind: 'shot', shot: sh('heatmap-scroll', 'A scroll heatmap showing how far visitors reach on a page', '/websites/…/heatmaps', []) },
    seen: { heading: 'See how far readers get, then ask', text: 'A scroll map shows where attention drops, and where a prompt will be seen by readers who are still engaged.', visuals: [{ kind: 'shot', shot: SHOTS.heatmapScroll }, { kind: 'example', props: { kind: 'banner', layout: 'article', url: 'yournewsroom.com/investigations/water', title: 'Support independent reporting. Become a member.', button: 'Join', note: 'A Show Banner action on Scroll Depth past 75%.' } }] },
    scenario: {
      heading: 'An example newsroom',
      paras: [
        'A newsroom looks at the scroll map for its long-form template and sees that most readers reach three-quarters of the way. They add a banner on Scroll Depth past 75% inviting readers to become members.',
        'Membership sign-ups are sent as purchase events, so Revenue shows which articles and campaigns led to them. A story page from a fundraising campaign shows up as the biggest source of donations.',
        'Recordings of the donation form show people stalling at the amount field, which they simplify.',
      ],
    },
    playbooks: [
      { name: 'Ask at engagement', trigger: 'Scroll Depth past 75%', condition: 'On long-form pages', action: 'Show Banner linking to membership or donations', result: 'More visitors reach the form' },
      { name: 'Newsletter invite', trigger: 'Time on Page', condition: 'On articles', action: 'Show Modal with an email form', result: 'Subscribers sent to your email tool' },
      { name: 'Credit the story', trigger: 'A gift is made', action: 'seentics.track("purchase") with value and order id', result: 'Donations by campaign in Revenue' },
    ],
    dashboard: { heading: 'Which pages hold attention', text: 'The list shows views, clicks and average scroll per page, so you know where a prompt will be seen.', shots: [SHOTS.heatmaps, SHOTS.revenue] },
    loop: LOOP(['Map attention', 'Scroll depth per page.'], ['Ask at the right point', 'A banner or form after engagement.'], ['Track the gift', 'Purchase events with a value.'], ['Credit the source', 'Revenue by campaign and story.']),
    checklist: ['Map scroll depth on your main templates', 'Choose a depth where most readers still are', 'Send gifts and subscriptions as purchase events', 'Tag campaign links with UTM parameters', 'Watch recordings of the donation form', 'Add a consent checkbox to any email form'],
    without: ['Prompts placed by guess', 'Gifts you cannot trace to a story or campaign', 'A donation form nobody has watched'],
    withSeentics: ['Scroll maps that show where attention is', 'Revenue by story and campaign', 'Recordings of the giving form'],
  },
};
