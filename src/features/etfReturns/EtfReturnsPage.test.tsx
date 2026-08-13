import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { EtfReturnsPage } from "./EtfReturnsPage";

function LocationProbe() {
  return <output data-testid="pathname">{useLocation().pathname}</output>;
}

function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={["/etf-returns"]}
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <EtfReturnsPage />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("EtfReturnsPage", () => {
  it("defaults to QQQ and provides a return link", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "ETF 总回报" })).toBeInTheDocument();
    expect(screen.getByLabelText("选择基金")).toHaveValue("qqq");
    expect(screen.getByRole("heading", { name: "QQQ（纳指100 ETF）：2000年投入一万美元" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回 Binance Watchboard" })).toHaveAttribute("href", "/");
  });

  it("switches all datasets without changing the history route", async () => {
    const user = userEvent.setup();
    renderPage();
    const select = screen.getByLabelText("选择基金");

    await user.selectOptions(select, "spy");
    expect(screen.getByRole("heading", { name: "SPY（标普500 ETF）：2000年投入一万美元" })).toBeInTheDocument();
    expect(screen.getByTestId("pathname")).toHaveTextContent("/etf-returns");

    await user.selectOptions(select, "02800");
    expect(screen.getByRole("heading", { name: "盈富基金（02800）：2008年投入一万港元" })).toBeInTheDocument();
    expect(screen.getByTestId("pathname")).toHaveTextContent("/etf-returns");

    await user.selectOptions(select, "03033");
    expect(screen.getByRole("heading", { name: "南方东英恒生科技（03033）：2020年投入一万港元" })).toBeInTheDocument();
    expect(screen.getByTestId("pathname")).toHaveTextContent("/etf-returns");
  });
});
