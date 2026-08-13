# ETF Returns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the Binance Watchboard at `/` and add a pixel-faithful, static-data ETF total-return experience at `/etf-returns` with one URL and four Select-controlled datasets.

**Architecture:** `BrowserRouter` owns the two application routes. The ETF feature is isolated under `src/features/etfReturns`: immutable source-derived configs feed pure calculation helpers, and one React/D3 component draws every dataset. The existing Watchboard becomes a page component and gains one React Router `Link` in its header.

**Tech Stack:** React 18, TypeScript 5.6, Vite 5, React Router DOM 6, D3 7, Vitest 2, Testing Library, jsdom, Cloudflare Pages static SPA hosting.

## Global Constraints

- Keep the existing Binance Watchboard at `/`.
- Add exactly one ETF route at `/etf-returns`; use Browser History and never a hash route.
- Keep all four ETF choices on `/etf-returns`; changing the Select must not call navigation or mutate the URL.
- Initialize the ETF choice to QQQ on every page mount or browser refresh.
- Copy the four source HTML files' embedded monthly adjusted-close values and event metadata exactly; never fetch ETF data at runtime.
- Preserve a pure frontend build; do not add API routes, Pages Functions, Workers, authentication, or secrets.
- Keep the chart's original `1500 × 620` SVG geometry and use horizontal overflow on narrower screens.
- Do not create a top-level `404.html`, because Cloudflare Pages uses its absence to apply the default SPA History fallback.

---

## File Map

- `src/App.tsx`: application routes and unknown-path redirect only.
- `src/main.tsx`: mounts `App` inside `BrowserRouter`.
- `src/pages/WatchboardPage.tsx`: existing Binance Watchboard behavior plus the ETF navigation link.
- `src/features/etfReturns/types.ts`: shared immutable ETF config and derived-series types.
- `src/features/etfReturns/data.ts`: four exact source-derived datasets and lookup helpers.
- `src/features/etfReturns/calculations.ts`: DOM-free normalization, underwater-episode, event-return, formatting, and interpolation helpers.
- `src/features/etfReturns/EtfReturnsPage.tsx`: QQQ-default local state, Select, return link, and page shell.
- `src/features/etfReturns/EtfReturnChart.tsx`: D3 SVG lifecycle, axes, paths, events, pointer interaction, and tooltip.
- `src/features/etfReturns/etfReturns.css`: ETF-prefixed page and chart styling.
- `src/test/setup.ts`: Testing Library cleanup and browser shims.
- `src/features/etfReturns/data.test.ts`: source-data integrity tests.
- `src/features/etfReturns/calculations.test.ts`: pure calculation regression tests.
- `src/features/etfReturns/EtfReturnsPage.test.tsx`: default selection and same-path switching tests.
- `src/App.test.tsx`: route and homepage navigation-entry tests.
- `vite.config.ts`: Vitest jsdom setup.
- `package.json`, `package-lock.json`: runtime and test dependencies/scripts.
- `src/styles.css`: existing global styles plus the small Watchboard header-link rules.

### Task 1: Test Harness and Router Skeleton

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/App.test.tsx`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Create: `src/pages/WatchboardPage.tsx`

**Interfaces:**
- Produces: `App(): JSX.Element`, with `/`, `/etf-returns`, and wildcard route contracts.
- Produces: global test environment with jsdom, Testing Library cleanup, `ResizeObserver`, and `matchMedia` shims.

- [ ] **Step 1: Install exact runtime and test dependencies**

Run:

```bash
npm install react-router-dom@6.30.1 d3@7.9.0
npm install --save-dev @types/d3@7.4.3 vitest@2.1.9 jsdom@25.0.1 @testing-library/react@16.1.0 @testing-library/jest-dom@6.6.3 @testing-library/user-event@14.5.2
```

Add scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Configure the jsdom test environment**

Add `test.environment = "jsdom"`, `test.setupFiles = ["./src/test/setup.ts"]`, and `test.css = false` to `vite.config.ts`. In `setup.ts`, import `@testing-library/jest-dom/vitest`, call `cleanup` after each test, and define deterministic `ResizeObserver` and `matchMedia` shims.

- [ ] **Step 3: Write failing application-route tests**

Create tests that render `App` under `MemoryRouter` and assert:

```tsx
expect(screen.getByRole("link", { name: "ETF 总回报" })).toHaveAttribute(
  "href",
  "/etf-returns",
);

expect(screen.getByRole("heading", { name: "ETF 总回报" })).toBeInTheDocument();

await waitFor(() => expect(window.location.pathname).toBe("/"));
```

Mock the four Binance hooks in the `/` test so no HTTP or WebSocket work starts. The ETF page assertion should initially fail because the page does not exist.

- [ ] **Step 4: Run the focused test and verify failure**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because the ETF route, page, and homepage link are missing.

- [ ] **Step 5: Split the existing Watchboard from routing**

Move the current `App.tsx` implementation unchanged into `WatchboardPage.tsx`, rename its component and default export to `WatchboardPage`, then make `App.tsx` render:

```tsx
<Routes>
  <Route path="/" element={<WatchboardPage />} />
  <Route path="/etf-returns" element={<EtfReturnsPage />} />
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

Wrap `<App />` with `<BrowserRouter>` in `main.tsx`. Create the initial `EtfReturnsPage` shell with an `ETF 总回报` heading so routing compiles; detailed behavior arrives in Task 4.

- [ ] **Step 6: Add the homepage ETF navigation entry**

In `WatchboardPage`, add a `Link` with `LineChart` and `ArrowRight` icons inside `.topbar`, with the accessible name `ETF 总回报` and `to="/etf-returns"`.

- [ ] **Step 7: Run the route test**

Run: `npm test -- src/App.test.tsx`

Expected: PASS for `/`, `/etf-returns`, and wildcard redirect behavior.

- [ ] **Step 8: Commit the router foundation**

```bash
git add package.json package-lock.json vite.config.ts src/test/setup.ts src/App.test.tsx src/main.tsx src/App.tsx src/pages/WatchboardPage.tsx src/features/etfReturns/EtfReturnsPage.tsx
git commit -m "feat: add ETF returns route"
```

### Task 2: Exact Static Data and Pure Calculations

**Files:**
- Create: `src/features/etfReturns/types.ts`
- Create: `src/features/etfReturns/data.ts`
- Create: `src/features/etfReturns/data.test.ts`
- Create: `src/features/etfReturns/calculations.ts`
- Create: `src/features/etfReturns/calculations.test.ts`

**Interfaces:**
- Produces: `ETF_CONFIGS: Readonly<Record<EtfKey, EtfReturnConfig>>`.
- Produces: `ETF_KEYS: readonly EtfKey[]` in Select order.
- Produces: `getEtfConfig(value: string): EtfReturnConfig`, falling back to QQQ.
- Produces: `buildReturnSeries(config)`, `findUnderwaterSummary(series)`, `calculateEventReturn(event, prices)`, and `interpolateReturn(series, date)`.

- [ ] **Step 1: Write failing source-data integrity tests**

Assert exact counts and boundaries:

```ts
expect(ETF_CONFIGS.qqq.prices).toHaveLength(320);
expect(ETF_CONFIGS.spy.prices).toHaveLength(320);
expect(ETF_CONFIGS["02800"].prices).toHaveLength(224);
expect(ETF_CONFIGS["03033"].prices).toHaveLength(73);

expect(ETF_CONFIGS.qqq.prices.at(0)).toEqual({ month: "2000-01", adjustedClose: 75.573822 });
expect(ETF_CONFIGS.qqq.prices.at(-1)).toEqual({ month: "2026-08", adjustedClose: 723.700012 });
expect(ETF_CONFIGS.spy.prices.at(0)).toEqual({ month: "2000-01", adjustedClose: 87.451408 });
expect(ETF_CONFIGS.spy.prices.at(-1)).toEqual({ month: "2026-08", adjustedClose: 772.48999 });
expect(ETF_CONFIGS["02800"].prices.at(0)).toEqual({ month: "2008-01", adjustedClose: 15.166766 });
expect(ETF_CONFIGS["02800"].prices.at(-1)).toEqual({ month: "2026-08", adjustedClose: 25.9 });
expect(ETF_CONFIGS["03033"].prices.at(0)).toEqual({ month: "2020-08", adjustedClose: 7.575 });
expect(ETF_CONFIGS["03033"].prices.at(-1)).toEqual({ month: "2026-08", adjustedClose: 4.702 });
```

Also verify every price is finite and positive, months are strictly ascending and unique, and every event endpoint exists in its dataset.

- [ ] **Step 2: Run the data test and verify failure**

Run: `npm test -- src/features/etfReturns/data.test.ts`

Expected: FAIL because types and configs do not exist.

- [ ] **Step 3: Define immutable config types and migrate source data**

Define the exact types from the approved spec. Decode each source file's `srcdoc`, extract the first inline chart script's `raw` and `events`, convert `YYYY-MM:value` pairs to typed objects, and copy the output into `data.ts`. Keep all headings, labels, notes, currency units, and event names from the source HTML.

Use this read-only extraction shape to cross-check every dataset before pasting:

```bash
node -e 'const fs=require("fs"); /* decode srcdoc, read raw/events, print JSON */' \
  /Users/technology/qqq.html /Users/technology/spy.html \
  /Users/technology/hs.html /Users/technology/hskj.html
```

- [ ] **Step 4: Run data integrity tests**

Run: `npm test -- src/features/etfReturns/data.test.ts`

Expected: PASS with 320, 320, 224, and 73 exact monthly points.

- [ ] **Step 5: Write failing calculation tests**

Use a small deterministic fixture and assert:

```ts
expect(series.map((point) => point.amount)).toEqual([10000, 8000, 12000]);
expect(series.map((point) => point.pct)).toEqual([0, -20, 20]);
expect(summary.low.month).toBe("2020-02");
expect(summary.longest?.months).toBe(2);
expect(summary.longest?.recoveredMonth).toBe("2020-04");
expect(calculateEventReturn(event, prices)).toBeCloseTo(50, 8);
```

Include one unrecovered episode and one midpoint interpolation assertion.

- [ ] **Step 6: Implement minimal pure calculations**

Parse `YYYY-MM` as a local first-of-month `Date`, normalize every adjusted close against the first value, group consecutive `pct < 0` points, count month distance, resolve recovery metadata, calculate endpoint return, and linearly interpolate percentage/amount between neighboring months.

- [ ] **Step 7: Run calculation and data tests**

Run: `npm test -- src/features/etfReturns/data.test.ts src/features/etfReturns/calculations.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit data and calculation behavior**

```bash
git add src/features/etfReturns/types.ts src/features/etfReturns/data.ts src/features/etfReturns/data.test.ts src/features/etfReturns/calculations.ts src/features/etfReturns/calculations.test.ts
git commit -m "feat: add static ETF return datasets"
```

### Task 3: Shared D3 Total-Return Chart

**Files:**
- Create: `src/features/etfReturns/EtfReturnChart.tsx`
- Create: `src/features/etfReturns/EtfReturnChart.test.tsx`

**Interfaces:**
- Consumes: one `EtfReturnConfig` and the pure calculations from Task 2.
- Produces: `EtfReturnChart({ config }: { config: EtfReturnConfig }): JSX.Element`.

- [ ] **Step 1: Write a failing chart render test**

Render QQQ and assert one accessible SVG, the computed current-value heading, the waterline label, five `data-event-band` groups, and a `desc` explaining adjusted prices and the zero line. Rerender with 03033 and assert the right-axis currency title changes from 美元 to 港元 and stale QQQ event groups are gone.

- [ ] **Step 2: Run the chart test and verify failure**

Run: `npm test -- src/features/etfReturns/EtfReturnChart.test.tsx`

Expected: FAIL because the chart component is missing.

- [ ] **Step 3: Implement lifecycle-safe D3 drawing**

Use `useMemo` for derived series and `useEffect` for SVG drawing. At effect start call `select(svgRef.current).selectAll("*").remove()`. Recreate the original 1500×620 viewBox, 96/76/40/72 margins, scales, seven-tick grid/axes, event lanes, above/below clip paths, waterline, line, last point, hit rectangle, crosshair, marker, and pointer interpolation.

- [ ] **Step 4: Implement React-owned chart text and tooltip state**

Keep headings, legend, note, and tooltip DOM in React. Pointer handlers update `{ visible, left, top, month, amount, pct }`; pointer leave hides it. Clamp tooltip horizontally against the chart root bounds as the source HTML does.

- [ ] **Step 5: Run the chart test**

Run: `npm test -- src/features/etfReturns/EtfReturnChart.test.tsx`

Expected: PASS and no duplicate SVG nodes after rerender.

- [ ] **Step 6: Commit the shared chart**

```bash
git add src/features/etfReturns/EtfReturnChart.tsx src/features/etfReturns/EtfReturnChart.test.tsx
git commit -m "feat: render shared ETF return chart"
```

### Task 4: ETF Page Interaction and Visual System

**Files:**
- Modify: `src/features/etfReturns/EtfReturnsPage.tsx`
- Create: `src/features/etfReturns/EtfReturnsPage.test.tsx`
- Create: `src/features/etfReturns/etfReturns.css`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `ETF_KEYS`, `getEtfConfig`, and `EtfReturnChart`.
- Produces: one QQQ-default same-route Select experience and a polished homepage entry.

- [ ] **Step 1: Write failing interaction tests**

Render the page under `MemoryRouter` at `/etf-returns`, assert the Select label `选择基金`, value `qqq`, and QQQ heading. Use `userEvent.selectOptions` for `spy`, `02800`, and `03033`; after each selection assert the correct heading and that `useLocation().pathname` remains `/etf-returns`.

- [ ] **Step 2: Run the page test and verify failure**

Run: `npm test -- src/features/etfReturns/EtfReturnsPage.test.tsx`

Expected: FAIL because Select behavior and chart composition are incomplete.

- [ ] **Step 3: Implement the complete ETF page**

Add a Back-to-Watchboard `Link`, the page title, current summary, visible Select label, four options in fixed order, and `EtfReturnChart`. Keep state local with `useState<EtfKey>("qqq")`; route changes are forbidden in the change handler.

- [ ] **Step 4: Add isolated ETF styles**

Use `etf-` prefixes for every new class. Implement the wide white card, 1500px chart canvas, horizontal scroll, 20/14/12/11px source typography, source colors, event/axis classes, tooltip, visible focus rings, and reduced-motion override. Do not add bare `svg`, `section`, `select`, or heading selectors.

- [ ] **Step 5: Finish the homepage-entry styles**

Make `.topbar` flex/space-between, style `.etf-nav-link` as a compact white bordered link with green hover/focus, and add a mobile breakpoint that wraps the topbar without covering the Watchboard title.

- [ ] **Step 6: Run page and application tests**

Run: `npm test -- src/features/etfReturns/EtfReturnsPage.test.tsx src/App.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit page interaction and styling**

```bash
git add src/features/etfReturns/EtfReturnsPage.tsx src/features/etfReturns/EtfReturnsPage.test.tsx src/features/etfReturns/etfReturns.css src/styles.css
git commit -m "feat: complete ETF returns experience"
```

### Task 5: Full Verification and Browser QA

**Files:**
- Modify only files implicated by verification failures.

**Interfaces:**
- Consumes: the complete feature.
- Produces: passing tests/build and browser evidence at `http://localhost:5173/`.

- [ ] **Step 1: Run all automated tests**

Run: `npm test`

Expected: all route, data, calculation, chart, and interaction tests PASS.

- [ ] **Step 2: Run type checking and production build**

Run: `npm run build`

Expected: `tsc --noEmit` and `vite build` both exit 0; output is in `dist`, with no `404.html`.

- [ ] **Step 3: Start the local Vite server**

Run: `npm run dev -- --host localhost`

Expected: `http://localhost:5173/` responds successfully.

- [ ] **Step 4: Verify desktop routing and interactions in the browser**

At `/`, inspect the Watchboard header link, hover it, focus it by keyboard, click it, and confirm `/etf-returns`. Directly load `/etf-returns`, refresh, and confirm QQQ. Select SPY, 02800, and 03033; verify URL stability, correct currencies/copy/events, no console errors, and working pointer crosshair/tooltip.

- [ ] **Step 5: Verify narrow viewport behavior**

At a 390×844 viewport, confirm the Watchboard topbar wraps cleanly, ETF controls remain usable, and the 1500px chart scrolls horizontally without compressed axis labels.

- [ ] **Step 6: Verify production preview History fallback**

Run `npm run preview -- --host localhost`, directly open `/etf-returns`, and confirm Vite preview returns the SPA shell and React renders QQQ.

- [ ] **Step 7: Inspect final diff and repository status**

Run:

```bash
git diff --check
git status --short --branch
git log -5 --oneline
```

Expected: no whitespace errors; only intentional implementation changes remain, or all implementation commits are clean.

- [ ] **Step 8: Commit any verification-only fixes**

If Step 1–7 required a fix, stage only those files and commit:

```bash
git commit -m "fix: finalize ETF returns verification"
```

If no fix was needed, do not create an empty commit.
