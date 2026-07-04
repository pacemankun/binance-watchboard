import { useEffect, useMemo, useState } from "react";

const storageKey = "binance-watchboard:watchlist:v1";
const defaultSymbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT"];

export function useWatchlist() {
  const [symbols, setSymbols] = useState<string[]>(() => readWatchlist());

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(symbols));
  }, [symbols]);

  const symbolSet = useMemo(() => new Set(symbols), [symbols]);

  function addSymbol(symbol: string) {
    setSymbols((current) => {
      const normalized = symbol.toUpperCase();

      if (current.includes(normalized)) {
        return current;
      }

      return [...current, normalized];
    });
  }

  function removeSymbol(symbol: string) {
    setSymbols((current) => current.filter((item) => item !== symbol));
  }

  return {
    symbols,
    symbolSet,
    addSymbol,
    removeSymbol,
  };
}

function readWatchlist() {
  const raw = localStorage.getItem(storageKey);

  if (!raw) {
    return defaultSymbols;
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").map((item) => item.toUpperCase())
      : defaultSymbols;
  } catch {
    localStorage.removeItem(storageKey);
    return defaultSymbols;
  }
}
