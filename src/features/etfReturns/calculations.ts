import { bisector, format, timeFormat, timeMonth } from "d3";
import type {
  EtfReturnConfig,
  MarketEvent,
  MonthlyPrice,
  ReturnPoint,
  UnderwaterEpisode,
  UnderwaterSummary,
} from "./types";

export type PointerDirection = -1 | 0 | 1;
export type HoverSnapKind = "high" | "low";

export type HoverResolution = {
  amount: number;
  date: Date;
  pct: number;
  snapKind: HoverSnapKind | null;
};

type HoverCandidate = {
  amount: number;
  date: Date;
  isNode: boolean;
  pct: number;
};

type SnapCandidate = HoverCandidate & {
  snapKind: HoverSnapKind;
};

const returnPointBisector = bisector<ReturnPoint, Date>((point) => point.date);

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

export function parseMonth(month: string): Date {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1);
}

export function buildReturnSeries(config: EtfReturnConfig): readonly ReturnPoint[] {
  const startValue = config.prices[0]?.adjustedClose;
  if (!startValue) {
    throw new Error(`${config.key} has no starting adjusted-close value`);
  }

  return config.prices.map((price) => {
    const amount = (config.capital * price.adjustedClose) / startValue;
    return {
      ...price,
      amount,
      date: parseMonth(price.month),
      pct: (amount / config.capital - 1) * 100,
    };
  });
}

export function findUnderwaterSummary(series: readonly ReturnPoint[]): UnderwaterSummary {
  const first = series[0];
  if (!first) {
    throw new Error("Cannot summarize an empty return series");
  }

  const episodes: UnderwaterEpisode[] = [];
  let underwaterStart: ReturnPoint | null = null;

  for (const point of series) {
    if (point.pct < 0 && underwaterStart === null) {
      underwaterStart = point;
    }

    if (point.pct >= 0 && underwaterStart !== null) {
      episodes.push({
        end: point,
        months: timeMonth.count(underwaterStart.date, point.date),
        recoveredMonth: point.month,
        start: underwaterStart,
      });
      underwaterStart = null;
    }
  }

  if (underwaterStart !== null) {
    const last = series[series.length - 1];
    episodes.push({
      end: null,
      months: timeMonth.count(underwaterStart.date, last.date),
      recoveredMonth: null,
      start: underwaterStart,
    });
  }

  return {
    longest: episodes.reduce<UnderwaterEpisode | null>(
      (longest, episode) => (longest === null || episode.months > longest.months ? episode : longest),
      null,
    ),
    low: series.reduce((lowest, point) => (point.pct < lowest.pct ? point : lowest), first),
  };
}

export function calculateEventReturn(
  event: MarketEvent,
  prices: readonly MonthlyPrice[],
): number {
  const byMonth = new Map(prices.map((price) => [price.month, price.adjustedClose]));
  const start = byMonth.get(event.start);
  const end = byMonth.get(event.end);
  if (start === undefined || end === undefined) {
    throw new Error(`Event ${event.name} references a missing monthly price`);
  }

  return (end / start - 1) * 100;
}

export function interpolateReturn(
  series: readonly ReturnPoint[],
  date: Date,
): Pick<ReturnPoint, "amount" | "pct"> {
  const first = series[0];
  const last = series[series.length - 1];
  if (!first || !last) {
    throw new Error("Cannot interpolate an empty return series");
  }
  if (date <= first.date) return { amount: first.amount, pct: first.pct };
  if (date >= last.date) return { amount: last.amount, pct: last.pct };

  const index = returnPointBisector.left(series, date);
  const before = series[index - 1];
  const after = series[index];
  const progress = (date.getTime() - before.date.getTime()) / (after.date.getTime() - before.date.getTime());
  const pct = before.pct + (after.pct - before.pct) * progress;

  return {
    amount: before.amount + (after.amount - before.amount) * progress,
    pct,
  };
}

export function resolveHoverPoint(
  series: readonly ReturnPoint[],
  rawDate: Date,
  direction: PointerDirection,
): HoverResolution {
  const first = series[0];
  const last = series[series.length - 1];
  if (!first || !last) {
    throw new Error("Cannot resolve hover for an empty return series");
  }

  const firstTime = first.date.getTime();
  const lastTime = last.date.getTime();
  const rawTime = Math.max(firstTime, Math.min(lastTime, rawDate.getTime()));
  const date = new Date(rawTime);
  const freePoint = interpolateReturn(series, date);
  const windowStart = new Date(
    Math.max(firstTime, offsetCalendarMonth(date, -3).getTime()),
  );
  const windowEnd = new Date(
    Math.min(lastTime, offsetCalendarMonth(date, 3).getTime()),
  );
  const candidates = buildWindowCandidates(series, windowStart, windowEnd);
  const highestAmount = candidates.reduce(
    (highest, point) => Math.max(highest, point.amount),
    Number.NEGATIVE_INFINITY,
  );
  const lowestAmount = candidates.reduce(
    (lowest, point) => Math.min(lowest, point.amount),
    Number.POSITIVE_INFINITY,
  );

  if (highestAmount === lowestAmount) {
    return { ...freePoint, date, snapKind: null };
  }

  const snapCandidates = candidates
    .flatMap((point) => {
      const extrema: Array<HoverSnapKind> = [];
      if (point.amount === highestAmount) extrema.push("high");
      if (point.amount === lowestAmount) extrema.push("low");
      return extrema.map((snapKind) =>
        toSnapCandidate(point, snapKind, windowStart, windowEnd),
      );
    })
    .filter((point): point is SnapCandidate => point !== null);

  if (snapCandidates.length === 0) {
    return { ...freePoint, date, snapKind: null };
  }

  snapCandidates.sort((a, b) => compareSnapCandidates(a, b, rawTime, direction));
  const snap = snapCandidates[0];

  return {
    amount: snap.amount,
    date: snap.date,
    pct: snap.pct,
    snapKind: snap.snapKind,
  };
}

function buildWindowCandidates(
  series: readonly ReturnPoint[],
  windowStart: Date,
  windowEnd: Date,
): HoverCandidate[] {
  const byTime = new Map<number, HoverCandidate>();
  const startValue = interpolateReturn(series, windowStart);
  const endValue = interpolateReturn(series, windowEnd);

  byTime.set(windowStart.getTime(), {
    ...startValue,
    date: windowStart,
    isNode: false,
  });
  byTime.set(windowEnd.getTime(), {
    ...endValue,
    date: windowEnd,
    isNode: false,
  });

  const firstNodeIndex = returnPointBisector.left(series, windowStart);
  const afterLastNodeIndex = returnPointBisector.right(series, windowEnd);

  for (let index = firstNodeIndex; index < afterLastNodeIndex; index += 1) {
    const point = series[index];
    byTime.set(point.date.getTime(), {
      amount: point.amount,
      date: point.date,
      isNode: true,
      pct: point.pct,
    });
  }

  return [...byTime.values()];
}

function toSnapCandidate(
  point: HoverCandidate,
  snapKind: HoverSnapKind,
  windowStart: Date,
  windowEnd: Date,
): SnapCandidate | null {
  const pointTime = point.date.getTime();
  if (
    !point.isNode ||
    pointTime <= windowStart.getTime() ||
    pointTime >= windowEnd.getTime()
  ) {
    return null;
  }

  return { ...point, snapKind };
}

function compareSnapCandidates(
  a: SnapCandidate,
  b: SnapCandidate,
  rawTime: number,
  direction: PointerDirection,
): number {
  const aTime = a.date.getTime();
  const bTime = b.date.getTime();
  const distanceDifference = Math.abs(aTime - rawTime) - Math.abs(bTime - rawTime);
  if (distanceDifference !== 0) {
    return distanceDifference;
  }

  if (direction !== 0) {
    const aIsAhead = direction > 0 ? aTime >= rawTime : aTime <= rawTime;
    const bIsAhead = direction > 0 ? bTime >= rawTime : bTime <= rawTime;
    if (aIsAhead !== bIsAhead) {
      return aIsAhead ? -1 : 1;
    }
  }

  return aTime - bTime;
}

export function formatMoney(value: number, prefix: "$" | "HK$"): string {
  return `${prefix}${format(",.0f")(value)}`;
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : "−"}${format(".1f")(Math.abs(value))}`;
}

export function formatMonth(date: Date): string {
  return timeFormat("%Y年%m月")(date);
}

export function formatHoverDate(date: Date): string {
  return timeFormat("%Y年%m月%d日")(date);
}

export function formatDuration(months: number): string {
  if (months < 12) return `${months}个月`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return `${years}年${remainingMonths ? `${remainingMonths}个月` : ""}`;
}
