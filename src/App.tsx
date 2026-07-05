import { Plus, RefreshCw, Search, Trash2, Wifi, WifiOff } from "lucide-react";
import { useMemo, useState } from "react";
import { useSymbols } from "./hooks/useSymbols";
import { useTickerStream } from "./hooks/useTickerStream";
import { useWatchlist } from "./hooks/useWatchlist";
import type { SymbolInfo, Ticker } from "./types/binance";

const usdFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 8,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

function App() {
  const [query, setQuery] = useState("");
  const { results, isLoading, error: symbolError } = useSymbols(query);
  const { symbols: watchlist, symbolSet, addSymbol, removeSymbol } = useWatchlist();
  const { tickers, status, error: tickerError } = useTickerStream(watchlist);

  const rows = useMemo(() => {
    return watchlist.map((symbol) => ({
      symbol,
      ticker: tickers[symbol],
    }));
  }, [tickers, watchlist]);

  function handleAddSymbol(item: SymbolInfo) {
    addSymbol(item.symbol);
    setQuery("");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Binance Spot</p>
          <div className="title-row">
            <h1>Watchboard</h1>
            <ConnectionState status={status} />
          </div>
        </div>
      </header>

      <section className="toolbar" aria-label="Symbol search">
        <div className="search-box">
          <Search size={18} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search BTC, ETH, SOL..."
            aria-label="Search trading pair"
          />
        </div>
      </section>

      <SearchResults
        query={query}
        results={results}
        selected={symbolSet}
        isLoading={isLoading}
        error={symbolError}
        onAdd={handleAddSymbol}
      />

      <section className="watchlist" aria-label="Watchlist">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Live Prices</p>
            <h2>关注列表</h2>
          </div>
          <span className="error-text">{tickerError}</span>
        </div>

        <div className="table-wrap">
          <table className="market-table">
            <thead>
              <tr>
                <th className="sticky-col">Pair</th>
                <th>Last Price</th>
                <th>24h</th>
                <th>High</th>
                <th>Low</th>
                <th>Volume</th>
                <th>Updated</th>
                <th className="sticky-action" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <WatchRow
                    key={row.symbol}
                    symbol={row.symbol}
                    ticker={row.ticker}
                    onRemove={removeSymbol}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="empty-cell">
                    Search and add a trading pair
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

type SearchResultsProps = {
  query: string;
  results: SymbolInfo[];
  selected: Set<string>;
  isLoading: boolean;
  error: string | null;
  onAdd: (item: SymbolInfo) => void;
};

function SearchResults({ query, results, selected, isLoading, error, onAdd }: SearchResultsProps) {
  const hasQuery = query.trim().length >= 2;

  if (error) {
    return <div className="notice error-text">{error}</div>;
  }

  if (!hasQuery) {
    return null;
  }

  if (isLoading) {
    return <div className="notice">Loading tradable pairs...</div>;
  }

  if (results.length === 0) {
    return <div className="notice">No matching pair</div>;
  }

  return (
    <section className="search-results" aria-label="Search results">
      {results.map((item) => {
        const isSelected = selected.has(item.symbol);

        return (
          <button
            type="button"
            key={item.symbol}
            className="result-row"
            onClick={() => onAdd(item)}
            disabled={isSelected}
            title={isSelected ? "Already added" : "Add to watchlist"}
          >
            <span>
              <strong>{item.symbol}</strong>
              <small>
                {item.baseAsset} / {item.quoteAsset}
              </small>
            </span>
            <Plus size={16} aria-hidden="true" />
          </button>
        );
      })}
    </section>
  );
}

type WatchRowProps = {
  symbol: string;
  ticker?: Ticker;
  onRemove: (symbol: string) => void;
};

function WatchRow({ symbol, ticker, onRemove }: WatchRowProps) {
  const change = ticker?.priceChangePercent ?? 0;
  const direction = change >= 0 ? "positive" : "negative";

  return (
    <tr>
      <td className="sticky-col">
        <strong>{symbol}</strong>
      </td>
      <td className="mono">{ticker ? formatPrice(ticker.lastPrice) : <LoadingCell />}</td>
      <td className={direction}>{ticker ? `${change.toFixed(2)}%` : "-"}</td>
      <td className="mono">{ticker ? formatPrice(ticker.highPrice) : "-"}</td>
      <td className="mono">{ticker ? formatPrice(ticker.lowPrice) : "-"}</td>
      <td className="mono">{ticker ? compactFormatter.format(ticker.quoteVolume) : "-"}</td>
      <td>{ticker ? formatTime(ticker.eventTime) : "-"}</td>
      <td className="sticky-action">
        <button
          type="button"
          className="icon-button"
          onClick={() => onRemove(symbol)}
          title="Remove"
          aria-label={`Remove ${symbol}`}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </td>
    </tr>
  );
}

function ConnectionState({ status }: { status: string }) {
  const isOpen = status === "open";
  const isConnecting = status === "connecting";
  const label = isConnecting ? "Connecting" : isOpen ? "Live" : status === "error" ? "Failed" : "Offline";

  return (
    <div className={`connection-state ${isOpen ? "online" : isConnecting ? "pending" : "offline"}`}>
      {isOpen ? <Wifi size={16} aria-hidden="true" /> : <WifiOff size={16} aria-hidden="true" />}
      <span>{label}</span>
    </div>
  );
}

function LoadingCell() {
  return (
    <span className="loading-cell">
      <RefreshCw size={14} aria-hidden="true" />
    </span>
  );
}

function formatPrice(value: number) {
  if (value >= 1000) {
    return usdFormatter.format(Number(value.toFixed(2)));
  }

  if (value >= 1) {
    return usdFormatter.format(Number(value.toFixed(4)));
  }

  return usdFormatter.format(value);
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

export default App;
