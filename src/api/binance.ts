import type {
  CombinedStreamMessage,
  ExchangeInfoResponse,
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
