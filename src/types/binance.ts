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
