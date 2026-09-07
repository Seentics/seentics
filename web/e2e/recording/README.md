# Session recording end-to-end test

Prerequisites: Docker Desktop running, Node.js 20+, web dependencies installed
(`npm ci --legacy-peer-deps` in `web`), and the Playwright Chromium browser
(`npx playwright install chromium` in `web`).

From `web`:

```sh
npm run test:e2e:recording
```

The runner builds the current source and starts an isolated Docker Compose project
with PostgreSQL, MinIO, core, and the dashboard in OSS mode. It selects unused localhost
ports and creates fresh volumes. It does not use the normal development stack or
load application `.env` files into the images. The first build downloads dependencies
and can take several minutes; subsequent builds reuse Docker's cache.

The Chromium test creates the first admin through `/setup`, creates a website, copies the displayed
tracking snippet unchanged into a real local HTTP fixture, and visits it in a separate
browser context. It clicks, fills inputs, scrolls, navigates to checkout, and leaves
the site to exercise unload flushing. No auth, ingestion, replay, or storage API is
mocked, and no recording events are inserted by the test.

Assertions cover persisted MinIO chunks, two page snapshots in the same session,
click/input/scroll events, masked input and private content, session metadata, the
recordings list, and DOM reconstruction in the actual dashboard replay player. The
test rewinds and watches the cart and checkout transitions again. Canvas/video
capture, all browser engines, long-session rotation, and pixel-perfect rendering
across arbitrary websites are outside this test's coverage.

The runner removes only its uniquely named test project's containers, volumes, and
images it built itself, including on test failure or SIGINT/SIGTERM. Docker logs are retained under
`web/test-results/seentics-recording-e2e-*/docker.log`. Playwright traces,
screenshots, diagnostics and videos are saved on failures; open the report with:

```sh
npx playwright show-report playwright-report/recording
```

This suite is opt-in and separate from `npm run test:e2e` (the frontend/mock suite).
Everything required lives in the open-source repository. No enterprise gateway,
billing service, or parent checkout is needed.
