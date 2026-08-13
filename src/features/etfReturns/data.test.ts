import { describe, expect, it } from "vitest";
import { ETF_CONFIGS, ETF_KEYS, getEtfConfig } from "./data";

const boundaries = {
  qqq: {
    count: 320,
    first: { adjustedClose: 75.573822, month: "2000-01" },
    last: { adjustedClose: 723.700012, month: "2026-08" },
  },
  spy: {
    count: 320,
    first: { adjustedClose: 87.451408, month: "2000-01" },
    last: { adjustedClose: 772.48999, month: "2026-08" },
  },
  "02800": {
    count: 224,
    first: { adjustedClose: 15.166766, month: "2008-01" },
    last: { adjustedClose: 25.9, month: "2026-08" },
  },
  "03033": {
    count: 73,
    first: { adjustedClose: 7.575, month: "2020-08" },
    last: { adjustedClose: 4.702, month: "2026-08" },
  },
} as const;

describe("ETF source data", () => {
  it("keeps the four funds in the agreed Select order", () => {
    expect(ETF_KEYS).toEqual(["qqq", "spy", "02800", "03033"]);
  });

  it.each(ETF_KEYS)("preserves the exact %s monthly series boundaries", (key) => {
    const config = ETF_CONFIGS[key];
    const expected = boundaries[key];

    expect(config.prices).toHaveLength(expected.count);
    expect(config.prices[0]).toEqual(expected.first);
    expect(config.prices[config.prices.length - 1]).toEqual(expected.last);
  });

  it.each(ETF_KEYS)("contains valid ordered prices and resolvable %s events", (key) => {
    const config = ETF_CONFIGS[key];
    const months = config.prices.map((price) => price.month);

    expect(new Set(months).size).toBe(months.length);
    expect([...months].sort()).toEqual(months);
    expect(config.prices.every((price) => Number.isFinite(price.adjustedClose))).toBe(true);
    expect(config.prices.every((price) => price.adjustedClose > 0)).toBe(true);

    for (const event of config.events) {
      expect(months).toContain(event.start);
      expect(months).toContain(event.end);
    }
  });

  it("falls back to QQQ for unknown Select values", () => {
    expect(getEtfConfig("not-a-fund")).toBe(ETF_CONFIGS.qqq);
  });
});
