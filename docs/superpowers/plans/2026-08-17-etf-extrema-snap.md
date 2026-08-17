# ETF Extrema Snap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a performant ±15-day local-extrema snap interaction to the existing ETF total-return chart without changing its embedded data or return calculations.

**Architecture:** A DOM-free resolver in `calculations.ts` locates the moving 30-day window with a D3 bisector, compares interpolated boundaries plus the real monthly nodes inside the window, and returns either the continuous hover point or a real high/low snap target. `EtfReturnChart.tsx` coalesces pointer events with `requestAnimationFrame`, tracks horizontal direction, and moves the crosshair, marker, and tooltip to the resolved point.

**Tech Stack:** React 18, TypeScript 5, D3 7, Vite 5

## Global Constraints

- Keep the current embedded QQQ, SPY, 02800, and 03033 monthly adjusted-close data unchanged.
- Keep the `capital × current adjusted close ÷ first adjusted close` total-return calculation unchanged.
- Do not request daily, real-time, or external ETF data.
- The snap window is always 15 calendar days before and after the raw pointer date.
- Interpolated window boundaries participate in extrema comparison but can never be snap targets.
- Do not modify routes, Watchboard behavior, or Binance data flows.
- Do not add `*.test.ts` or `*.test.tsx` files.

---

### Task 1: Resolve a continuous hover point and dynamic extrema snap target

**Files:**
- Modify: `src/features/etfReturns/calculations.ts`

**Interfaces:**
- Consumes: `readonly ReturnPoint[]`, raw pointer `Date`, and horizontal direction `-1 | 0 | 1`.
- Produces: `resolveHoverPoint(series, rawDate, direction): HoverResolution`.
- `HoverResolution` contains `date`, `amount`, `pct`, and `snapKind: "high" | "low" | null`.

- [ ] **Step 1: Add the hover result types and fixed window constant**

```ts
export type PointerDirection = -1 | 0 | 1;
export type HoverSnapKind = "high" | "low";

export type HoverResolution = {
  amount: number;
  date: Date;
  pct: number;
  snapKind: HoverSnapKind | null;
};

const snapWindowMs = 15 * 24 * 60 * 60 * 1000;
```

- [ ] **Step 2: Implement the bisector-based window resolver**

```ts
export function resolveHoverPoint(
  series: readonly ReturnPoint[],
  rawDate: Date,
  direction: PointerDirection,
): HoverResolution {
  const first = series[0];
  const last = series[series.length - 1];
  if (!first || !last) throw new Error("Cannot resolve hover for an empty return series");

  const rawTime = Math.max(first.date.getTime(), Math.min(last.date.getTime(), rawDate.getTime()));
  const date = new Date(rawTime);
  const freePoint = interpolateReturn(series, date);
  const start = new Date(Math.max(first.date.getTime(), rawTime - snapWindowMs));
  const end = new Date(Math.min(last.date.getTime(), rawTime + snapWindowMs));
  const candidates = buildWindowCandidates(series, start, end);
  const high = candidates.reduce((best, point) => point.amount > best.amount ? point : best);
  const low = candidates.reduce((best, point) => point.amount < best.amount ? point : best);

  if (high.amount === low.amount) {
    return { ...freePoint, date, snapKind: null };
  }

  const snaps = [
    toSnapCandidate(high, "high", start, end),
    toSnapCandidate(low, "low", start, end),
  ].filter((point): point is SnapCandidate => point !== null);

  if (snaps.length === 0) {
    return { ...freePoint, date, snapKind: null };
  }

  snaps.sort((a, b) => compareSnapCandidates(a, b, rawTime, direction));
  const snap = snaps[0];
  return { amount: snap.amount, date: snap.date, pct: snap.pct, snapKind: snap.snapKind };
}
```

`buildWindowCandidates` uses one shared `bisector<ReturnPoint, Date>((point) => point.date)` instance, interpolates both window boundaries, adds only bisected monthly nodes, and deduplicates by timestamp. `toSnapCandidate` rejects non-node candidates and timestamps equal to either window boundary. `compareSnapCandidates` sorts first by absolute time distance and then prefers the pointer movement direction. A flat window returns the continuous point.

- [ ] **Step 3: Add day-precision hover formatting without changing existing month formatting**

```ts
export function formatHoverDate(date: Date): string {
  return timeFormat("%Y年%m月%d日")(date);
}
```

- [ ] **Step 4: Run static verification**

Run: `npm run build`

Expected: TypeScript and Vite production build both succeed.

- [ ] **Step 5: Commit the calculation layer**

```bash
git add src/features/etfReturns/calculations.ts
git commit -m "feat: resolve ETF extrema snap targets"
```

### Task 2: Coalesce pointer events and render the magnetic interaction

**Files:**
- Modify: `src/features/etfReturns/EtfReturnChart.tsx`

**Interfaces:**
- Consumes: `resolveHoverPoint`, `formatHoverDate`, and the existing return series.
- Produces: continuous pointer tracking, real-node extrema snapping, and Tooltip extrema labels.

- [ ] **Step 1: Extend Tooltip state**

```ts
type TooltipState = {
  amount: number;
  dateLabel: string;
  left: number;
  pct: number;
  snapKind: "high" | "low" | null;
  top: number;
  visible: boolean;
};
```

Render `局部高点` or `局部低点` beside the date only while snapped.

- [ ] **Step 2: Add frame-coalesced pointer processing inside the D3 effect**

Maintain effect-local `pendingPointer`, `frameId`, and `previousRawTime`. `pointermove` stores only `mouseX`, `clientX`, and `clientY`; it schedules a frame only when no frame is pending. The animation frame computes direction, calls `resolveHoverPoint`, and uses `x(resolved.date)` for the crosshair and marker.

```ts
if (frameId === null) {
  frameId = requestAnimationFrame(renderPendingPointer);
}
```

- [ ] **Step 3: Clean up animation state**

On `pointerleave`, configuration change, and unmount: clear the pending pointer, reset direction, cancel any queued frame, hide chart guides, and hide the Tooltip.

- [ ] **Step 4: Run production verification**

Run: `npm run build`

Expected: TypeScript and Vite production build both succeed, with no data or route changes.

- [ ] **Step 5: Perform browser interaction verification**

At `http://localhost:5173/etf-returns` verify:

- free movement displays a day-precision interpolated date and changing amount;
- approaching a real peak or trough within 15 days snaps the guide and shows the correct extrema label;
- leaving the capture range restores continuous movement;
- rapid movement does not produce visible lag or console errors;
- all four ETF selections retain the same data summaries and curve shapes.

- [ ] **Step 6: Commit the chart interaction**

```bash
git add src/features/etfReturns/EtfReturnChart.tsx
git commit -m "feat: add ETF extrema magnetic hover"
```

### Task 3: Final consistency verification

**Files:**
- Verify only: `src/features/etfReturns/data.ts`
- Verify only: `src/features/etfReturns/calculations.ts`
- Verify only: `src/features/etfReturns/EtfReturnChart.tsx`

**Interfaces:**
- Consumes: completed calculation and chart interaction changes.
- Produces: evidence that only hover behavior changed.

- [ ] **Step 1: Confirm data files and return formula are unchanged relative to the branch base**

Run: `git diff 670665a -- src/features/etfReturns/data.ts`

Expected: no output.

Run: `git diff 670665a -- src/features/etfReturns/calculations.ts`

Expected: existing `buildReturnSeries` formula remains unchanged; only hover-resolution helpers are added.

- [ ] **Step 2: Run final verification**

Run: `npm run build`

Run: `git diff --check`

Expected: build succeeds and whitespace validation has no output.
