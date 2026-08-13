import { describe, expect, it } from "vitest";
import {
  buildReturnSeries,
  calculateEventReturn,
  findUnderwaterSummary,
  formatDuration,
  formatMoney,
  formatMonth,
  formatPercent,
  interpolateReturn,
  parseMonth,
} from "./calculations";
import type { EtfReturnConfig, MarketEvent, MonthlyPrice } from "./types";

const prices: readonly MonthlyPrice[] = [
  { adjustedClose: 100, month: "2020-01" },
  { adjustedClose: 80, month: "2020-02" },
  { adjustedClose: 90, month: "2020-03" },
  { adjustedClose: 120, month: "2020-04" },
];

const fixture: EtfReturnConfig = {
  capital: 10000,
  chartAriaLabel: "Fixture chart",
  currencyName: "美元",
  currencyPrefix: "$",
  endLabel: "2020-04",
  events: [],
  heading: "Fixture",
  key: "qqq",
  note: "Fixture note",
  prices,
  selectLabel: "Fixture",
  startLabel: "Fixture start",
};

describe("ETF return calculations", () => {
  it("normalizes adjusted prices against the first month", () => {
    const series = buildReturnSeries(fixture);

    expect(series.map((point) => point.amount)).toEqual([10000, 8000, 9000, 12000]);
    [0, -20, -10, 20].forEach((expected, index) => {
      expect(series[index].pct).toBeCloseTo(expected, 8);
    });
  });

  it("finds the low and the longest recovered underwater episode", () => {
    const summary = findUnderwaterSummary(buildReturnSeries(fixture));

    expect(summary.low.month).toBe("2020-02");
    expect(summary.longest?.months).toBe(2);
    expect(summary.longest?.start.month).toBe("2020-02");
    expect(summary.longest?.recoveredMonth).toBe("2020-04");
  });

  it("keeps an unfinished underwater episode open", () => {
    const config = { ...fixture, prices: prices.slice(0, 3) };
    const summary = findUnderwaterSummary(buildReturnSeries(config));

    expect(summary.longest?.end).toBeNull();
    expect(summary.longest?.months).toBe(1);
    expect(summary.longest?.recoveredMonth).toBeNull();
  });

  it("calculates an event return from adjusted-close endpoints", () => {
    const event: MarketEvent = {
      compactName: "Fixture",
      end: "2020-04",
      kind: "gain",
      lane: 0,
      name: "Fixture event",
      start: "2020-02",
    };

    expect(calculateEventReturn(event, prices)).toBeCloseTo(50, 8);
  });

  it("interpolates return values between neighboring months", () => {
    const series = buildReturnSeries(fixture);
    const start = parseMonth("2020-03").getTime();
    const end = parseMonth("2020-04").getTime();
    const midpoint = new Date(start + (end - start) / 2);

    const interpolated = interpolateReturn(series, midpoint);
    expect(interpolated.amount).toBeCloseTo(10500, 8);
    expect(interpolated.pct).toBeCloseTo(5, 8);
  });

  it("formats chart values with the source-page conventions", () => {
    expect(formatMoney(95760.67, "$")).toBe("$95,761");
    expect(formatMoney(6207.26, "HK$")).toBe("HK$6,207");
    expect(formatPercent(857.6067)).toBe("+857.6");
    expect(formatPercent(-37.927)).toBe("−37.9");
    expect(formatMonth(parseMonth("2026-08"))).toBe("2026年08月");
    expect(formatDuration(8)).toBe("8个月");
    expect(formatDuration(26)).toBe("2年2个月");
    expect(formatDuration(36)).toBe("3年");
  });
});
