# Component and data architecture

## Goal

Dashboard pages are thin composition layers. They choose what to show and own
route-specific concerns; feature modules own data access; components only receive data
and callbacks. One dependable path then serves live data, demo mode, and the Remotion
recordings in `content-engine/`.

## Why, specifically, here

`content-engine/render/` currently holds roughly three thousand lines of hand-maintained
copies of this app's UI. Its own files say so:

```
render/screens/analytics/Logo.tsx  — "Copied from seentics/web/src/components/ui/logo.tsx"
render/screens/analytics/Sidebar.tsx — "Same order and icons as .../dashboard/Sidebar.tsx"
render/lib/format.ts — "Mirrors the formatters in .../lib/analytics-api.ts"
```

Every change to the real UI silently drifts the marketing videos, and nothing fails to
tell us. The fix is not to sync the copies harder — it is to make the real components
renderable from fixtures, so the video films the product instead of a lookalike.

The landing page already proves this works: `ProductShowcase` renders the real
`TrafficOverview` against `demoAnalyticsData()`. The four hand-built mocks beside it are
the thing this convention is meant to retire.

## Directory convention

```text
lib/api.ts                        # shared authenticated HTTP transport only
features/<feature>/
  types.ts                        # domain and request/response types
  api.ts                          # endpoint functions; no React, no hooks
  queries.ts                      # key factory, query options, read hooks
  mutations.ts                    # write hooks and their cache invalidation
  demo-data.ts                    # deterministic fixtures, never fetched data
  format.ts                       # pure presentation helpers (optional)
components/<feature>/
  <component>.tsx                 # presentational, data-driven
app/websites/[websiteId]/<feature>/
  page.tsx                        # route composition only
```

`features/errors/` is the reference implementation. Read it before starting a new one.

## Data access

Endpoint functions go in `features/<feature>/api.ts` and take plain arguments, so a
query, a prefetch, a test and a script share one definition. Raw URL strings appear
there and nowhere else — never in a page.

Keys come from a factory whose entries descend from one root, so a mutation can
invalidate the whole feature, just its lists, or one detail, without a caller writing a
raw array:

```ts
export const errorKeys = {
  all:     ['errors'] as const,
  lists:   () => [...errorKeys.all, 'list'] as const,
  detail:  (websiteId: string, fingerprint: string, days: number) =>
    [...errorKeys.details(), websiteId, fingerprint, days] as const,
};
```

Mutations invalidate the smallest scope that can be showing the changed value — and
every scope that can. Resolving an error from its detail panel has to move the row in
the list behind it.

Pick `staleTime` and any refetch interval from how fast the data actually moves, not by
habit. A thirty-day total does not need a thirty-second poll; a live-visitor count does.
That mistake was costing this product a month-wide aggregate twice a minute per open tab.

## Component contract

Components take typed domain data and explicit behaviour. They do not fetch, and they do
not branch on demo mode internally — a component that checks `isDemo()` for itself cannot
be handed fixtures by a recording.

Customisation, in order of preference:

1. Typed data props and callbacks — `group`, `onOpen`, `onWatchReplay`.
2. Semantic variants where the design has a finite set — `size`, `status`, `density`.
3. `className` for the caller's spacing and placement.
4. Render slots only at a real, repeated extension point.

Two rules that come specifically from recordings:

- **An optional callback means the read-only state is real.** `ErrorSampleCard` renders a
  static row when `onWatchReplay` is absent, so a scene can film the panel without a
  button that mutates something.
- **Take `now` as a prop wherever time is displayed.** `relativeTime(iso, now)` lets a
  recording pin the clock. A fixture that reads "2d ago" in one render and "3d ago" in the
  next makes a re-render differ from the take that was approved.

## Demo data

Fixtures live in `features/<feature>/demo-data.ts` and are deterministic: fixed ids,
dates, counts and labels. No `Math.random()`, no `Date.now()`, no time-relative strings,
and never a real customer's data.

Cover the states that matter, not just the happy one. `ERROR_SAMPLES_DEMO_DATA` includes
a sample with a `session_id` and one without, because "no replay recorded" is a real
state the component has to render.

```tsx
import { ErrorGroupList } from '@/components/errors/error-group-list';
import { ERROR_GROUPS_DEMO_DATA } from '@/features/errors/demo-data';

<ErrorGroupList groups={ERROR_GROUPS_DEMO_DATA} now={FIXED_NOW} />
```

A demo route may compose several production components from fixtures. It must not
duplicate their markup — duplicating it is the problem this document exists to remove.

For motion work, animate the scene around the component, not the component's logic. It
must stay usable with no animation at all, and the recording layer owns timing and
framing.

## Migrating a domain

The existing `lib/<domain>-api.ts` files mix endpoints, hooks, types and helpers in one
place — `analytics-api.ts` is over a thousand lines. Split one domain at a time:

1. Move endpoint calls into `features/<domain>/api.ts`; move types into `types.ts`.
2. Add the key factory, query options and hooks; add mutation hooks.
3. Point the page at the hooks and delete the old file when nothing imports it.
4. Extract repeated markup into typed components under `components/<domain>/`.
5. Add `demo-data.ts` when the domain appears in a demo or a recording.
6. Check light and dark, plus loading, empty, error and loaded states.
7. Where `content-engine` holds a copy of what you just extracted, delete the copy and
   import the real component.

Do not mix a new `useEffect` fetch with a feature query for the same resource.
