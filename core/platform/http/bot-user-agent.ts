/**
 * Whether a request comes from an automated client rather than a person.
 *
 * The tracker is JavaScript, so most bots never run it — but the ones that matter do: search
 * engines render pages (Googlebot, Bingbot), link previews and SEO crawlers load them, speed
 * tests and uptime monitors replay them. Each would otherwise count as a visitor, a session and
 * a pageview, and use up the site's monthly quota. Matched on the User-Agent, conservatively:
 * a name that announces itself as a bot, crawler, spider, preview, monitor or HTTP library.
 *
 * Headless Chrome is a bot in production (scrapers, our own screenshotter). Outside production it
 * is how the end-to-end suite drives real visitors, so it is counted there.
 */
const BOT = new RegExp(
  [
    "bot\\b", "bot[/;)_-]", "crawl", "spider", "slurp", "scrap", "archiver", "preview",
    "facebookexternalhit", "facebookcatalog", "embedly", "quora link", "whatsapp/", "skypeuripreview",
    "google-inspectiontool", "google-read-aloud", "mediapartners-google", "adsbot", "apis-google", "feedfetcher",
    "lighthouse", "pagespeed", "gtmetrix", "pingdom", "uptimerobot", "statuscake", "site24x7", "betteruptime", "checkly",
    "phantomjs", "puppeteer", "playwright", "selenium",
    "python-requests", "python-urllib", "aiohttp", "go-http-client", "okhttp", "^java/", "^curl/", "^wget/", "httpclient", "axios/", "node-fetch",
    "seenticsscreenshot", "seenticsstylesheetarchiver",
  ].join("|"),
  "i",
);

export function isBotUserAgent(ua: string | null | undefined, opts: { production: boolean }): boolean {
  // Every browser sends one.
  if (!ua || !ua.trim()) return opts.production;
  if (BOT.test(ua)) return true;
  return opts.production && /headlesschrome/i.test(ua);
}
