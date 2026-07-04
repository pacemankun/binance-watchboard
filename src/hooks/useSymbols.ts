import { useEffect, useMemo, useState } from "react";
import { fetchTradableSymbols } from "../api/binance";
import type { SymbolInfo } from "../types/binance";

const quoteRank = new Map([
  ["USDT", 0],
  ["USDC", 1],
  ["FDUSD", 2],
  ["BTC", 3],
  ["ETH", 4],
  ["BNB", 5],
]);

export function useSymbols(query: string) {
  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetchTradableSymbols()
      .then((items) => {
        if (isMounted) {
          setSymbols(items);
          setError(null);
        }
      })
      .catch((reason) => {
        if (isMounted) {
          setError(reason instanceof Error ? reason.message : "Symbol request failed");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toUpperCase();

    if (normalizedQuery.length < 2) {
      return [];
    }

    return symbols
      .filter((item) => {
        return (
          item.symbol.includes(normalizedQuery) ||
          item.baseAsset.includes(normalizedQuery) ||
          item.quoteAsset.includes(normalizedQuery)
        );
      })
      .sort((a, b) => compareSymbols(a, b, normalizedQuery))
      .slice(0, 18);
  }, [query, symbols]);

  return {
    symbols,
    results,
    isLoading,
    error,
  };
}

function compareSymbols(a: SymbolInfo, b: SymbolInfo, query: string) {
  const aStarts = Number(!a.symbol.startsWith(query));
  const bStarts = Number(!b.symbol.startsWith(query));

  if (aStarts !== bStarts) {
    return aStarts - bStarts;
  }

  const aBase = Number(a.baseAsset !== query);
  const bBase = Number(b.baseAsset !== query);

  if (aBase !== bBase) {
    return aBase - bBase;
  }

  const aQuoteRank = quoteRank.get(a.quoteAsset) ?? 99;
  const bQuoteRank = quoteRank.get(b.quoteAsset) ?? 99;

  if (aQuoteRank !== bQuoteRank) {
    return aQuoteRank - bQuoteRank;
  }

  return a.symbol.localeCompare(b.symbol);
}
