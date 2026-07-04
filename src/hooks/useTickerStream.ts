import { useEffect, useMemo, useRef, useState } from "react";
import { createTickerSocket, fetchTickerSnapshot } from "../api/binance";
import type { StreamStatus, Ticker } from "../types/binance";

export function useTickerStream(symbols: string[]) {
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const retryRef = useRef<number | null>(null);
  const signature = useMemo(() => symbols.join("|"), [symbols]);

  useEffect(() => {
    if (retryRef.current) {
      window.clearTimeout(retryRef.current);
      retryRef.current = null;
    }

    if (symbols.length === 0) {
      setStatus("idle");
      setTickers({});
      return;
    }

    let isCurrent = true;
    let socket: WebSocket | null = null;

    setStatus("connecting");
    setError(null);

    fetchTickerSnapshot(symbols)
      .then((snapshot) => {
        if (!isCurrent) {
          return;
        }

        setTickers((current) => mergeTickers(current, snapshot));
      })
      .catch((reason) => {
        if (isCurrent) {
          setError(reason instanceof Error ? reason.message : "Ticker snapshot failed");
        }
      });

    const connect = () => {
      socket = createTickerSocket(
        symbols,
        (ticker) => {
          if (!isCurrent) {
            return;
          }

          setTickers((current) => ({
            ...current,
            [ticker.symbol]: ticker,
          }));
        },
        (nextStatus) => {
          if (!isCurrent) {
            return;
          }

          setStatus(nextStatus);

          if (nextStatus === "error") {
            setError("WebSocket connection failed");
          }

          if (nextStatus === "closed") {
            retryRef.current = window.setTimeout(connect, 2000);
          }
        },
      );
    };

    connect();

    return () => {
      isCurrent = false;

      if (retryRef.current) {
        window.clearTimeout(retryRef.current);
        retryRef.current = null;
      }

      socket?.close();
    };
  }, [signature]);

  return {
    tickers,
    status,
    error,
  };
}

function mergeTickers(current: Record<string, Ticker>, snapshot: Ticker[]) {
  const next = { ...current };

  for (const ticker of snapshot) {
    next[ticker.symbol] = ticker;
  }

  return next;
}
