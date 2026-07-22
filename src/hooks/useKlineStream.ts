import { useEffect, useMemo, useRef, useState } from "react";
import { aggregateQuarterlyKlines, createKlineSocket, fetchKlines } from "../api/binance";
import type { KlineCandle, KlineInterval, StreamStatus } from "../types/binance";

export function useKlineStream(symbol: string | null, interval: KlineInterval) {
  const [sourceCandles, setSourceCandles] = useState<KlineCandle[]>([]);
  const [loadedSource, setLoadedSource] = useState<{ symbol: string; interval: KlineInterval } | null>(null);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retryRef = useRef<number | null>(null);

  useEffect(() => {
    if (retryRef.current) {
      window.clearTimeout(retryRef.current);
      retryRef.current = null;
    }

    if (!symbol) {
      setSourceCandles([]);
      setLoadedSource(null);
      setStatus("idle");
      setIsLoading(false);
      setError(null);
      return;
    }

    let isCurrent = true;
    let socket: WebSocket | null = null;

    setSourceCandles([]);
    setLoadedSource(null);
    setStatus("connecting");
    setIsLoading(true);
    setError(null);

    const connect = () => {
      socket = createKlineSocket(
        symbol,
        interval,
        (candle) => {
          if (isCurrent) {
            setSourceCandles((current) => mergeCandle(current, candle));
          }
        },
        (nextStatus) => {
          if (!isCurrent) {
            return;
          }

          setStatus(nextStatus);

          if (nextStatus === "open") {
            setError(null);
          }

          if (nextStatus === "error") {
            setError("Kline WebSocket connection failed");
          }

          if (nextStatus === "closed") {
            retryRef.current = window.setTimeout(connect, 2000);
          }
        },
      );
    };

    fetchKlines(symbol, interval)
      .then((snapshot) => {
        if (isCurrent) {
          setSourceCandles(snapshot);
          setLoadedSource({ symbol, interval });
        }
      })
      .catch((reason) => {
        if (isCurrent) {
          setError(reason instanceof Error ? reason.message : "Kline request failed");
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
          connect();
        }
      });

    return () => {
      isCurrent = false;

      if (retryRef.current) {
        window.clearTimeout(retryRef.current);
        retryRef.current = null;
      }

      socket?.close();
    };
  }, [symbol, interval]);

  const candles = useMemo(
    () => (interval === "3M" ? aggregateQuarterlyKlines(sourceCandles) : sourceCandles),
    [interval, sourceCandles],
  );

  return {
    candles: loadedSource?.symbol === symbol && loadedSource.interval === interval ? candles : [],
    status,
    isLoading,
    error,
  };
}

function mergeCandle(current: KlineCandle[], candle: KlineCandle) {
  const next = [...current];
  const lastIndex = next.length - 1;

  if (lastIndex >= 0 && next[lastIndex].openTime === candle.openTime) {
    next[lastIndex] = candle;
    return next;
  }

  if (lastIndex < 0 || next[lastIndex].openTime < candle.openTime) {
    next.push(candle);
    return next;
  }

  const existingIndex = next.findIndex((item) => item.openTime === candle.openTime);

  if (existingIndex >= 0) {
    next[existingIndex] = candle;
  }

  return next;
}
