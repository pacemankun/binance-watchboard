import { bisector, format, timeFormat, timeMonth } from "d3";
import type {
  EtfReturnConfig,
  MarketEvent,
  MonthlyPrice,
  ReturnPoint,
  UnderwaterEpisode,
  UnderwaterSummary,
} from "./types";

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

  const index = bisector<ReturnPoint, Date>((point) => point.date).left(series, date);
  const before = series[index - 1];
  const after = series[index];
  const progress = (date.getTime() - before.date.getTime()) / (after.date.getTime() - before.date.getTime());
  const pct = before.pct + (after.pct - before.pct) * progress;

  return {
    amount: before.amount + (after.amount - before.amount) * progress,
    pct,
  };
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

export function formatDuration(months: number): string {
  if (months < 12) return `${months}个月`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return `${years}年${remainingMonths ? `${remainingMonths}个月` : ""}`;
}
