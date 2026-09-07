# Heatmap end-to-end test

From `web`, with Docker Desktop running, dependencies installed, and Playwright Chromium
available, run:

```sh
npm run test:e2e:heatmap
```

The suite builds a disposable OSS stack (PostgreSQL, MinIO, core, and dashboard), creates
an admin and website through the dashboard, and installs the displayed tracking snippet in
a real local browser fixture. It generates two known clicks and a known scroll, then checks:

- every generated click has the expected stored normalized coordinates and capture viewport;
- the maximum stored scroll depth matches the visitor page;
- the tracker-created DOM snapshot is stored and contains the fixture layout; and
- the actual dashboard iframe and heatmap canvas render the stored DOM, click dots, and
  scroll fold at the persisted positions.

No tracker payloads, APIs, DOM snapshots, or heatmap points are mocked or inserted by the
test. Docker logs remain in `web/test-results/seentics-heatmap-e2e-*/docker.log`; failure
artifacts and the HTML report are under `web/test-results/heatmap` and
`web/playwright-report/heatmap`.

The runner removes its own containers, network, volumes, and images it built itself;
it never prunes shared Docker caches or images supplied through environment variables.
