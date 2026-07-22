import type {
  CombinedKlineStreamMessage,
  CombinedStreamMessage,
  BinanceKlineInterval,
  ExchangeInfoResponse,
  KlineCandle,
  KlineInterval,
  KlineSnapshot,
  SymbolInfo,
  Ticker,
  TickerSnapshot,
} from "../types/binance";

const REST_BASE_URL =
  import.meta.env.VITE_BINANCE_REST_BASE_URL ?? "https://data-api.binance.vision";
const STREAM_BASE_URL =
  import.meta.env.VITE_BINANCE_STREAM_BASE_URL ?? "wss://data-stream.binance.vision/stream";

const symbolCacheKey = "binance-watchboard:symbols:v1";
const symbolCacheTtl = 12 * 60 * 60 * 1000;

type CachedSymbols = {
  savedAt: number;
  symbols: SymbolInfo[];
};

export async function fetchTradableSymbols(): Promise<SymbolInfo[]> {
  const cached = readSymbolCache();

  if (cached) {
    return cached;
  }

  const response = await fetch(`${REST_BASE_URL}/api/v3/exchangeInfo`);

  if (!response.ok) {
    throw new Error(`Binance symbol request failed: ${response.status}`);
  }

  const payload = (await response.json()) as ExchangeInfoResponse;
  const symbols = payload.symbols
    .filter((item) => item.status === "TRADING" && item.isSpotTradingAllowed)
    .map((item) => ({
      symbol: item.symbol,
      baseAsset: item.baseAsset,
      quoteAsset: item.quoteAsset,
      status: item.status,
      isSpotTradingAllowed: item.isSpotTradingAllowed,
    }));

  writeSymbolCache(symbols);

  return symbols;
}

export async function fetchTickerSnapshot(symbols: string[]): Promise<Ticker[]> {
  if (symbols.length === 0) {
    return [];
  }

  const params = new URLSearchParams({
    symbols: JSON.stringify(symbols),
  });
  const response = await fetch(`${REST_BASE_URL}/api/v3/ticker/24hr?${params}`);

  if (!response.ok) {
    throw new Error(`Binance ticker request failed: ${response.status}`);
  }

  const payload = (await response.json()) as TickerSnapshot[];
  return payload.map(mapSnapshotToTicker);
}

export async function fetchKlines(
  symbol: string,
  interval: KlineInterval,
  limit = 120,
): Promise<KlineCandle[]> {
  const sourceInterval = getKlineSourceInterval(interval);
  const params = new URLSearchParams({
    symbol,
    interval: sourceInterval,
    limit: String(limit),
  });
  const response = await fetch(`${REST_BASE_URL}/api/v3/klines?${params}`);

  if (!response.ok) {
    throw new Error(`Kline request failed: ${response.status}`);
  }

  const payload = (await response.json()) as KlineSnapshot[];
  return payload.map(mapSnapshotToKline);
}

export function createTickerSocket(
  symbols: string[],
  onTicker: (ticker: Ticker) => void,
  onStatus: (status: "open" | "closed" | "error") => void,
): WebSocket | null {
  if (symbols.length === 0) {
    return null;
  }

  const streams = symbols.map((symbol) => `${symbol.toLowerCase()}@ticker`).join("/");
  const socket = new WebSocket(`${STREAM_BASE_URL}?streams=${streams}`);

  socket.addEventListener("open", () => onStatus("open"));
  socket.addEventListener("close", () => onStatus("closed"));
  socket.addEventListener("error", () => onStatus("error"));
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data as string) as CombinedStreamMessage;

    if (message.data?.e === "24hrTicker") {
      onTicker(mapStreamToTicker(message.data));
    }
  });

  return socket;
}

export function createKlineSocket(
  symbol: string,
  interval: KlineInterval,
  onCandle: (candle: KlineCandle) => void,
  onStatus: (status: "open" | "closed" | "error") => void,
): WebSocket {
  const stream = `${symbol.toLowerCase()}@kline_${getKlineSourceInterval(interval)}`;
  const socket = new WebSocket(`${STREAM_BASE_URL}?streams=${stream}`);

  socket.addEventListener("open", () => onStatus("open"));
  socket.addEventListener("close", () => onStatus("closed"));
  socket.addEventListener("error", () => onStatus("error"));
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data as string) as CombinedKlineStreamMessage;

    if (message.data?.e === "kline") {
      onCandle(mapStreamToKline(message.data));
    }
  });

  return socket;
}

export function getKlineSourceInterval(interval: KlineInterval): BinanceKlineInterval {
  return interval === "3M" ? "1M" : interval;
}

export function aggregateQuarterlyKlines(monthlyCandles: KlineCandle[]): KlineCandle[] {
  const quarters = new Map<string, KlineCandle>();

  for (const candle of monthlyCandles) {
    const date = new Date(candle.openTime);
    const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
    const key = `${date.getUTCFullYear()}-${quarter}`;
    const current = quarters.get(key);

    if (!current) {
      quarters.set(key, { ...candle });
      continue;
    }

    quarters.set(key, {
      openTime: current.openTime,
      closeTime: candle.closeTime,
      open: current.open,
      high: Math.max(current.high, candle.high),
      low: Math.min(current.low, candle.low),
      close: candle.close,
      volume: current.volume + candle.volume,
    });
  }

  return [...quarters.values()];
}

function readSymbolCache(): SymbolInfo[] | null {
  const raw = sessionStorage.getItem(symbolCacheKey);

  if (!raw) {
    return null;
  }

  try {
    const cache = JSON.parse(raw) as CachedSymbols;
    const isFresh = Date.now() - cache.savedAt < symbolCacheTtl;
    return isFresh ? cache.symbols : null;
  } catch {
    sessionStorage.removeItem(symbolCacheKey);
    return null;
  }
}

function writeSymbolCache(symbols: SymbolInfo[]) {
  const payload: CachedSymbols = {
    savedAt: Date.now(),
    symbols,
  };

  sessionStorage.setItem(symbolCacheKey, JSON.stringify(payload));
}

function mapSnapshotToTicker(snapshot: TickerSnapshot): Ticker {
  return {
    symbol: snapshot.symbol,
    lastPrice: Number(snapshot.lastPrice),
    priceChangePercent: Number(snapshot.priceChangePercent),
    highPrice: Number(snapshot.highPrice),
    lowPrice: Number(snapshot.lowPrice),
    volume: Number(snapshot.volume),
    quoteVolume: Number(snapshot.quoteVolume),
    eventTime: snapshot.closeTime,
  };
}

function mapStreamToTicker(data: CombinedStreamMessage["data"]): Ticker {
  return {
    symbol: data.s,
    lastPrice: Number(data.c),
    priceChangePercent: Number(data.P),
    highPrice: Number(data.h),
    lowPrice: Number(data.l),
    volume: Number(data.v),
    quoteVolume: Number(data.q),
    eventTime: data.E,
  };
}

function mapSnapshotToKline(snapshot: KlineSnapshot): KlineCandle {
  return {
    openTime: snapshot[0],
    open: Number(snapshot[1]),
    high: Number(snapshot[2]),
    low: Number(snapshot[3]),
    close: Number(snapshot[4]),
    volume: Number(snapshot[5]),
    closeTime: snapshot[6],
  };
}

function mapStreamToKline(data: CombinedKlineStreamMessage["data"]): KlineCandle {
  return {
    openTime: data.k.t,
    closeTime: data.k.T,
    open: Number(data.k.o),
    high: Number(data.k.h),
    low: Number(data.k.l),
    close: Number(data.k.c),
    volume: Number(data.k.v),
  };
}
