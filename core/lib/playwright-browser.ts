import { chromium, type Browser, type Page } from "playwright";

let browserInstance: Browser | null = null;

const BROWSER_POOL_SIZE = 5;
let activeBrowserPages = 0;

/**
 * Get or create a singleton browser instance.
 * Uses Chromium for consistent behavior across environments.
 */
export async function getBrowser(): Promise<Browser> {
  if (browserInstance) {
    return browserInstance;
  }

  try {
    browserInstance = await chromium.launch({
      headless: true,
      // Use memory for better performance in containerized environments
      args: [
        "--disable-dev-shm-usage", // Disable /dev/shm for better Docker compatibility
        "--single-process", // Single process mode for containers
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--disable-client-side-phishing-detection",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-hang-monitor",
        "--disable-popup-blocking",
        "--disable-prompt-on-repost",
        "--disable-sync",
        "--enable-automation",
        "--no-service-autorun",
      ],
    });

    return browserInstance;
  } catch (error) {
    browserInstance = null;
    throw new Error(`Failed to launch browser: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create a new page context with sensible defaults for screenshot capture.
 * Caller is responsible for closing the page when done.
 */
export async function createScreenshotPage(): Promise<Page> {
  const browser = await getBrowser();

  // Check pool size to prevent resource exhaustion
  if (activeBrowserPages >= BROWSER_POOL_SIZE) {
    throw new Error("Browser page pool exhausted - too many concurrent screenshots");
  }

  activeBrowserPages++;

  let context;
  let page: Page;
  try {
    context = await browser.createBrowserContext({
      viewport: { width: 1920, height: 1080 },
      javaScriptEnabled: true,
      ignoreHTTPSErrors: true,
      offline: false,
    });

    page = await context.newPage();
  } catch (error) {
    // Counter was incremented but page was never created — must decrement
    activeBrowserPages = Math.max(0, activeBrowserPages - 1);
    // Close leaked context if it was created
    if (context) {
      try { await context.close(); } catch { /* ignore */ }
    }
    // Browser may be in bad state — reset so next call gets a fresh one
    if (browserInstance) {
      try { await browserInstance.close(); } catch { /* ignore */ }
      browserInstance = null;
      activeBrowserPages = 0;
    }
    throw error;
  }

  // Set reasonable timeout for page navigation
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(30000);

  // Patch close to decrement counter AND close the browser context.
  // Without closing the context, each capture leaks a BrowserContext which
  // holds open network connections and memory until the browser process exits.
  const originalClose = page.close.bind(page);
  page.close = async function () {
    activeBrowserPages = Math.max(0, activeBrowserPages - 1);
    try {
      await originalClose();
    } finally {
      try { await context.close(); } catch { /* ignore */ }
    }
  };

  return page;
}

/**
 * Gracefully close the browser instance.
 * Safe to call multiple times.
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch (e) {
      console.error("Error closing browser:", e);
    } finally {
      browserInstance = null;
      activeBrowserPages = 0;
    }
  }
}

/**
 * Get current number of active page instances in the pool.
 * Useful for monitoring and debugging.
 */
export function getActivePagesCount(): number {
  return activeBrowserPages;
}
