export type SymbolInfo = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  isSpotTradingAllowed: boolean;
};

export type ExchangeInfoResponse = {
  symbols: SymbolInfo[];
};

export type TickerSnapshot = {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  lastPrice: string;
  lastQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  count: number;
};

export type Ticker = {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
  eventTime: number;
};

export type StreamTickerMessage = {
  e: "24hrTicker";
  E: number;
  s: string;
  c: string;
  P: string;
  h: string;
  l: string;
  v: string;
  q: string;
};

export type CombinedStreamMessage = {
  stream: string;
  data: StreamTickerMessage;
};

export type StreamStatus = "idle" | "connecting" | "open" | "closed" | "error";

export type KlineInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w" | "1M" | "3M";
export type BinanceKlineInterval = Exclude<KlineInterval, "3M">;

export type KlineCandle = {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type KlineSnapshot = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

export type StreamKlineMessage = {
  e: "kline";
  E: number;
  s: string;
  k: {
    t: number;
    T: number;
    s: string;
    i: BinanceKlineInterval;
    o: string;
    c: string;
    h: string;
    l: string;
    v: string;
  };
};

export type CombinedKlineStreamMessage = {
  stream: string;
  data: StreamKlineMessage;
};
