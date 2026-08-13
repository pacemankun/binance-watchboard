import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./hooks/useSymbols", () => ({
  useSymbols: () => ({ error: null, isLoading: false, results: [] }),
}));

vi.mock("./hooks/useWatchlist", () => ({
  useWatchlist: () => ({
    addSymbol: vi.fn(),
    removeSymbol: vi.fn(),
    symbolSet: new Set<string>(),
    symbols: [],
  }),
}));

vi.mock("./hooks/useTickerStream", () => ({
  useTickerStream: () => ({ error: null, status: "closed", tickers: {} }),
}));

vi.mock("./hooks/useKlineStream", () => ({
  useKlineStream: () => ({
    candles: [],
    error: null,
    isLoading: false,
    status: "idle",
  }),
}));

function renderAt(path: string) {
  window.history.pushState({}, "", path);
  return render(
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <App />
    </BrowserRouter>,
  );
}

describe("application routes", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("keeps the Binance Watchboard at the root and links to ETF returns", () => {
    renderAt("/");

    expect(screen.getByRole("heading", { name: "Watchboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ETF 总回报" })).toHaveAttribute(
      "href",
      "/etf-returns",
    );
  });

  it("renders the ETF returns page at its history route", () => {
    renderAt("/etf-returns");

    expect(screen.getByRole("heading", { name: "ETF 总回报" })).toBeInTheDocument();
  });

  it("redirects unknown paths to the Watchboard", async () => {
    renderAt("/missing");

    await waitFor(() => expect(window.location.pathname).toBe("/"));
    expect(screen.getByRole("heading", { name: "Watchboard" })).toBeInTheDocument();
  });
});
