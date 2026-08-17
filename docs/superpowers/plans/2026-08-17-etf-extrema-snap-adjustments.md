# ETF Extrema Snap Adjustments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove low-value pandemic annotations, use a ±1-calendar-month extrema window, and render snapped extrema markers in red without changing ETF data or return calculations.

**Architecture:** Keep the existing ETF feature boundaries intact. Event copy remains in `data.ts`, calendar-window resolution remains in the DOM-free calculation layer, and marker presentation remains in the D3 chart component with a CSS custom property for the red color.

**Tech Stack:** React 18, TypeScript, Vite 5, D3 7, CSS custom properties

## Global Constraints

- Do not change the embedded monthly adjusted-close strings, the initial capital of `10000`, or the total-return formula.
- Use a local calendar-month helper that clamps the original day to the target month's last day; do not use fixed 30-day arithmetic or bare `timeMonth.offset` for the moving window.
- Snapped local highs and lows both use red `#dc2626`; free hover keeps the existing line color.
- Keep the existing `requestAnimationFrame` pointer-event coalescing and all tie-breaking rules.
- Do not add `test.ts` or `test.tsx` files, per the project owner's explicit request.
- Work in the current normal Git checkout and current branch; do not create a Worktree.

---

### Task 1: Refine ETF Event Annotations

**Files:**
- Modify: `src/features/etfReturns/data.ts:24-66`

**Interfaces:**
- Consumes: Existing `EtfReturnConfig.events` arrays.
- Produces: Updated event annotations consumed unchanged by `EtfReturnChart`.

- [ ] **Step 1: Edit only the event annotations**

Remove this QQQ object:

```ts
{"start":"2020-02","end":"2020-03","name":"疫情冲击","compactName":"疫情","kind":"loss","lane":0}
```

Remove the same object from SPY. Replace the 02800 object:

```ts
{"start":"2018-01","end":"2020-03","name":"贸易摩擦与疫情","compactName":"贸易与疫情","kind":"loss","lane":0}
```

with:

```ts
{"start":"2018-01","end":"2020-03","name":"贸易摩擦","compactName":"贸易摩擦","kind":"loss","lane":0}
```

Do not change the 03033 events array.

- [ ] **Step 2: Verify annotations and data isolation**

Run:

```bash
rg -n "疫情冲击|贸易摩擦与疫情|贸易与疫情" src/features/etfReturns/data.ts
git diff --word-diff=porcelain -- src/features/etfReturns/data.ts
```

Expected: the search returns no matches; the diff contains event-array edits only and no monthly price-string edits.

- [ ] **Step 3: Commit the annotation change**

```bash
git add src/features/etfReturns/data.ts
git commit -m "chore: refine ETF event annotations"
```

### Task 2: Expand the Extrema Window to One Clamped Calendar Month

**Files:**
- Modify: `src/features/etfReturns/calculations.ts:1-33,155-160`

**Interfaces:**
- Consumes: `resolveHoverPoint(series, rawDate, direction)` and existing `ReturnPoint` values.
- Produces: The same `HoverResolution` shape with a clamped natural-month window; callers do not change.

- [ ] **Step 1: Remove the day-based dependency and constant**

Change the import from:

```ts
import { bisector, format, timeDay, timeFormat, timeMonth } from "d3";
```

to:

```ts
import { bisector, format, timeFormat, timeMonth } from "d3";
```

Remove:

```ts
const snapWindowDays = 15;
```

- [ ] **Step 2: Add a clamped local-calendar-month helper**

Add the following internal helper near the other calculation helpers:

```ts
function offsetCalendarMonth(date: Date, months: number): Date {
  const result = new Date(date);
  const dayOfMonth = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDayOfTargetMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(dayOfMonth, lastDayOfTargetMonth));
  return result;
}
```

Setting the day to `1` before shifting prevents JavaScript month overflow. Clamping then preserves ordinary day numbers while mapping March 31 to February 28 or 29.

- [ ] **Step 3: Use the clamped offsets in the hover window**

Replace the window calculation with:

```ts
const windowStart = new Date(
  Math.max(firstTime, offsetCalendarMonth(date, -1).getTime()),
);
const windowEnd = new Date(
  Math.min(lastTime, offsetCalendarMonth(date, 1).getTime()),
);
```

Leave boundary interpolation, real-node eligibility, flat-window behavior, nearest-time selection, and movement-direction tie-breaking unchanged.

- [ ] **Step 4: Verify TypeScript and calendar behavior**

Run:

```bash
npx tsc --noEmit
TZ=America/New_York node --input-type=module -e 'function offsetCalendarMonth(date,months){const result=new Date(date);const day=result.getDate();result.setDate(1);result.setMonth(result.getMonth()+months);const last=new Date(result.getFullYear(),result.getMonth()+1,0).getDate();result.setDate(Math.min(day,last));return result} console.log(offsetCalendarMonth(new Date(2024,2,31,12),-1).toString()); console.log(offsetCalendarMonth(new Date(2023,2,31,12),-1).toString())'
```

Expected: TypeScript exits successfully; the command prints February 29, 2024 and February 28, 2023 while preserving local noon across DST offset changes.

- [ ] **Step 5: Commit the calculation change**

```bash
git add src/features/etfReturns/calculations.ts
git commit -m "feat: use monthly ETF extrema window"
```

### Task 3: Highlight Snapped Extrema Markers in Red

**Files:**
- Modify: `src/features/etfReturns/etfReturns.css:1-10`
- Modify: `src/features/etfReturns/EtfReturnChart.tsx:296-341`

**Interfaces:**
- Consumes: Existing `HoverResolution.snapKind` value (`"high" | "low" | null`).
- Produces: A red, radius-5 marker for either snap kind and the original marker style for free hover.

- [ ] **Step 1: Add the scoped snap color token**

Add to `.etf-page`:

```css
--etf-snap: #dc2626;
```

- [ ] **Step 2: Switch marker fill together with radius**

Add this chained D3 attribute immediately after the radius attribute:

```ts
.attr("fill", resolved.snapKind ? "var(--etf-snap)" : "var(--etf-line)")
```

The initial hidden marker remains `var(--etf-line)`. Each pointer frame explicitly sets the current fill, so leaving a snap state restores the normal color.

- [ ] **Step 3: Verify production compilation**

Run:

```bash
npm run build
git diff --check
```

Expected: TypeScript and Vite build successfully, and the diff has no whitespace errors.

- [ ] **Step 4: Commit the visual change**

```bash
git add src/features/etfReturns/etfReturns.css src/features/etfReturns/EtfReturnChart.tsx
git commit -m "style: highlight ETF extrema markers"
```

### Task 4: Browser and Data-Contract Verification

**Files:**
- Verify: `src/features/etfReturns/data.ts`
- Verify: `src/features/etfReturns/calculations.ts`
- Verify: `src/features/etfReturns/EtfReturnChart.tsx`
- Verify: `src/features/etfReturns/etfReturns.css`

**Interfaces:**
- Consumes: The completed event, calculation, and marker changes.
- Produces: Verification evidence; no production interface changes.

- [ ] **Step 1: Confirm the embedded price data and formula are unchanged**

Run:

```bash
git diff 83a4928 -- src/features/etfReturns/data.ts
git diff --unified=0 83a4928 -- src/features/etfReturns/calculations.ts
```

Expected: `data.ts` differs only in event objects; `buildReturnSeries` still computes `(config.capital * price.adjustedClose) / startValue`.

- [ ] **Step 2: Check all four funds in the browser**

Open `http://127.0.0.1:5173/etf-returns`, then select QQQ, SPY, 02800, and 03033.

Expected:

- QQQ and SPY do not show “疫情冲击”.
- 02800 shows “贸易摩擦”.
- 03033 annotations remain unchanged.
- Free hover uses the blue radius-3.5 marker.
- A local high and a local low within the ±1-natural-month window both use a red radius-5 marker and retain the correct Tooltip label.
- Leaving the snap state restores the blue radius-3.5 marker.
- No browser console warnings or errors appear.

- [ ] **Step 3: Run final repository checks**

Run:

```bash
npm run build
git diff --check main...HEAD
git status --short --branch
rg --files -g "*.test.ts" -g "*.test.tsx"
```

Expected: build succeeds, the diff check succeeds, the working tree is clean, and no test files are listed.
