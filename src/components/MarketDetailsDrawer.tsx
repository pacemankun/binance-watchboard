import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { KlineCandle, KlineInterval, StreamStatus, Ticker } from "../types/binance";
import { CandlestickChart } from "./CandlestickChart";

const intervals: KlineInterval[] = ["1m", "5m", "15m", "1h", "4h", "1d", "1w", "1M", "3M"];

type MarketDetailsDrawerProps = {
  symbol: string | null;
  interval: KlineInterval;
  ticker?: Ticker;
  candles: KlineCandle[];
  isLoading: boolean;
  error: string | null;
  status: StreamStatus;
  onIntervalChange: (interval: KlineInterval) => void;
  onClose: () => void;
};

export function MarketDetailsDrawer({
  symbol,
  interval,
  ticker,
  candles,
  isLoading,
  error,
  status,
  onIntervalChange,
  onClose,
}: MarketDetailsDrawerProps) {
  const [hoveredCandle, setHoveredCandle] = useState<KlineCandle | null>(null);

  useEffect(() => {
    if (!symbol) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, symbol]);

  useEffect(() => {
    setHoveredCandle(null);
  }, [symbol, interval]);

  if (!symbol) {
    return null;
  }

  const latestCandle = candles[candles.length - 1];
  const candle = hoveredCandle ?? latestCandle;
  const currentPrice = ticker?.lastPrice ?? candle?.close;
  const change = ticker?.priceChangePercent;

  return (
    <div className="drawer-layer" role="presentation">
      <button type="button" className="drawer-backdrop" aria-label="Close market details" onClick={onClose} />
      <aside className="market-drawer" aria-label={`${symbol} market details`} aria-modal="true" role="dialog">
        <div className="drawer-header">
          <div>
            <p className="eyebrow">Spot market</p>
            <div className="drawer-title-row">
              <h2>{symbol}</h2>
              <span className={`stream-indicator ${status === "open" ? "online" : ""}`}>
                {status === "open" ? "Live" : status === "connecting" ? "Connecting" : "Delayed"}
              </span>
            </div>
          </div>
          <button type="button" className="icon-button drawer-close" onClick={onClose} aria-label="Close market details" title="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="price-summary">
          <div>
            <span className="summary-label">Last price</span>
            <strong className="summary-price">{currentPrice === undefined ? "-" : formatPrice(currentPrice)}</strong>
          </div>
          <div className={change === undefined ? "summary-change" : change >= 0 ? "summary-change positive" : "summary-change negative"}>
            <span className="summary-label">24h</span>
            <strong>{change === undefined ? "-" : `${change.toFixed(2)}%`}</strong>
          </div>
        </div>

        <div className="interval-tabs" aria-label="Kline interval">
          {intervals.map((item) => (
            <button
              key={item}
              type="button"
              className={item === interval ? "interval-tab active" : "interval-tab"}
              onClick={() => onIntervalChange(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="chart-panel">
          {isLoading ? <div className="chart-state">Loading Kline data...</div> : null}
          {error ? <div className="chart-state error-text">{error}</div> : null}
          {!isLoading && !error && candles.length === 0 ? <div className="chart-state">No Kline data available</div> : null}
          <CandlestickChart key={`${symbol}-${interval}`} candles={candles} onHoverCandle={setHoveredCandle} />
        </div>

        <div className="candle-inspector" aria-label="Selected candle values">
          <div className="candle-inspector-heading">
            <span>{hoveredCandle ? "所选 K 线" : "最新 K 线"}</span>
            <time>{candle ? formatCandleTime(candle.openTime) : "-"}</time>
          </div>
          <div className="ohlc-grid">
            <DetailItem label="开盘" value={candle ? formatPrice(candle.open) : "-"} />
            <DetailItem label="最高" value={candle ? formatPrice(candle.high) : "-"} />
            <DetailItem label="成交量" value={candle ? compactFormatter.format(candle.volume) : "-"} />
            <DetailItem label="收盘" value={candle ? formatPrice(candle.close) : "-"} />
            <DetailItem label="最低" value={candle ? formatPrice(candle.low) : "-"} />
            <DetailItem label="成交额" value={candle ? compactFormatter.format(candle.volume * candle.close) : "-"} />
          </div>
        </div>
      </aside>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="ohlc-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const priceFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 });
const compactFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

function formatPrice(value: number) {
  if (value >= 1000) {
    return priceFormatter.format(Number(value.toFixed(2)));
  }

  if (value >= 1) {
    return priceFormatter.format(Number(value.toFixed(4)));
  }

  return priceFormatter.format(value);
}

function formatCandleTime(value: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
