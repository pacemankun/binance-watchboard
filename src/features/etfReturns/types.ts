export type EtfKey = "qqq" | "spy" | "02800" | "03033";

export type MonthlyPrice = {
  readonly adjustedClose: number;
  readonly month: string;
};

export type MarketEvent = {
  readonly compactName: string;
  readonly end: string;
  readonly kind: "gain" | "loss";
  readonly lane: 0 | 1;
  readonly name: string;
  readonly start: string;
};

export type EtfReturnConfig = {
  readonly capital: number;
  readonly chartAriaLabel: string;
  readonly currencyName: "美元" | "港元";
  readonly currencyPrefix: "$" | "HK$";
  readonly endLabel: string;
  readonly events: readonly MarketEvent[];
  readonly heading: string;
  readonly key: EtfKey;
  readonly note: string;
  readonly prices: readonly MonthlyPrice[];
  readonly selectLabel: string;
  readonly startLabel: string;
};

export type ReturnPoint = MonthlyPrice & {
  readonly amount: number;
  readonly date: Date;
  readonly pct: number;
};

export type UnderwaterEpisode = {
  readonly end: ReturnPoint | null;
  readonly months: number;
  readonly recoveredMonth: string | null;
  readonly start: ReturnPoint;
};

export type UnderwaterSummary = {
  readonly longest: UnderwaterEpisode | null;
  readonly low: ReturnPoint;
};
