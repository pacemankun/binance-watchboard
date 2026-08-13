import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ETF_CONFIGS } from "./data";
import { EtfReturnChart } from "./EtfReturnChart";

describe("EtfReturnChart", () => {
  it("renders the complete QQQ chart structure and summary", () => {
    const { container } = render(<EtfReturnChart config={ETF_CONFIGS.qqq} />);

    expect(screen.getByRole("img", { name: ETF_CONFIGS.qqq.chartAriaLabel })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "$10,000 → $95,761（+857.6%）" })).toBeInTheDocument();
    expect(screen.getByText("$10,000 / 0% 水位线")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-event-band]")).toHaveLength(5);
    expect(container.querySelector("desc")).toHaveTextContent("现金分红再投资");
    expect(container.querySelector('[data-axis="y-right"]')).toHaveTextContent("实际金额（美元）");
  });

  it("cleans the old drawing when the selected fund changes", () => {
    const { container, rerender } = render(<EtfReturnChart config={ETF_CONFIGS.qqq} />);

    rerender(<EtfReturnChart config={ETF_CONFIGS["03033"]} />);

    expect(screen.getByRole("img", { name: ETF_CONFIGS["03033"].chartAriaLabel })).toBeInTheDocument();
    expect(container.querySelectorAll("[data-event-band]")).toHaveLength(5);
    expect(container.querySelector('[data-event-band="互联网泡沫"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-axis="y-right"]')).toHaveTextContent("实际金额（港元）");
  });

  it("shows an interpolated tooltip while the chart is pointed at", () => {
    const { container } = render(<EtfReturnChart config={ETF_CONFIGS.qqq} />);
    const root = container.querySelector(".etf-chart") as HTMLElement;
    const hitArea = container.querySelector("[data-chart-hit]") as SVGRectElement;
    root.getBoundingClientRect = () =>
      ({ bottom: 700, height: 700, left: 0, right: 1500, top: 0, width: 1500, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    fireEvent.pointerMove(hitArea, { clientX: 750, clientY: 320 });

    expect(screen.getByRole("tooltip")).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByRole("tooltip")).toHaveTextContent("实际金额");
    expect(container.querySelector("[data-chart-hover-guide]")).toBeVisible();
  });
});
