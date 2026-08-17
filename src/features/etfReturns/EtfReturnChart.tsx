import {
  area,
  axisBottom,
  axisLeft,
  axisRight,
  line,
  max,
  min,
  pointer,
  scaleLinear,
  scaleTime,
  select,
  timeFormat,
} from "d3";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildReturnSeries,
  calculateEventReturn,
  findUnderwaterSummary,
  formatDuration,
  formatHoverDate,
  formatMoney,
  formatMonth,
  formatPercent,
  parseMonth,
  resolveHoverPoint,
} from "./calculations";
import type { HoverSnapKind, PointerDirection } from "./calculations";
import type { EtfReturnConfig } from "./types";

const CHART_WIDTH = 1500;
const CHART_HEIGHT = 620;
const MARGIN = { bottom: 40, left: 72, right: 76, top: 96 } as const;

type TooltipState = {
  amount: number;
  dateLabel: string;
  left: number;
  pct: number;
  snapKind: HoverSnapKind | null;
  top: number;
  visible: boolean;
};

type PendingPointer = {
  clientX: number;
  clientY: number;
  mouseX: number;
};

const hiddenTooltip: TooltipState = {
  amount: 0,
  dateLabel: "",
  left: 0,
  pct: 0,
  snapKind: null,
  top: 0,
  visible: false,
};

export function EtfReturnChart({ config }: { config: EtfReturnConfig }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>(hiddenTooltip);
  const series = useMemo(() => buildReturnSeries(config), [config]);
  const summary = useMemo(() => findUnderwaterSummary(series), [series]);
  const last = series[series.length - 1];
  const valueTitle = `${formatMoney(config.capital, config.currencyPrefix)} → ${formatMoney(last.amount, config.currencyPrefix)}（${formatPercent(last.pct)}%）`;
  const summaryParts = [
    `最低 ${formatMoney(summary.low.amount, config.currencyPrefix)}（${formatPercent(summary.low.pct)}%）`,
  ];
  if (summary.longest) {
    summaryParts.push(`最长水下 ${formatDuration(summary.longest.months)}`);
    if (summary.longest.end) summaryParts.push(`回本 ${formatMonth(summary.longest.end.date)}`);
  }

  useEffect(() => {
    const svgNode = svgRef.current;
    const rootNode = rootRef.current;
    if (!svgNode || !rootNode) return;

    setTooltip(hiddenTooltip);
    const svg = select(svgNode);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`);
    svg
      .append("desc")
      .text(
        "复权价格按现金分红再投资计算。零线代表初始本金，线上盈利，线下亏损。重大事件在上方以起点至终点区间显示。",
      );

    const innerWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
    const innerHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
    const x = scaleTime()
      .domain([series[0].date, series[series.length - 1].date])
      .range([0, innerWidth]);
    const lowestPct = Math.min(0, min(series, (point) => point.pct) ?? 0);
    const highestPct = Math.max(0, max(series, (point) => point.pct) ?? 0);
    const span = Math.max(10, highestPct - lowestPct);
    const y = scaleLinear()
      .domain([Math.max(-100, lowestPct - span * 0.04), highestPct + span * 0.06])
      .range([innerHeight, 0]);
    const group = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    group
      .append("g")
      .attr("class", "etf-chart-grid")
      .call(axisLeft(y).ticks(7).tickSize(-innerWidth).tickFormat(() => ""));
    group
      .append("rect")
      .attr("class", "etf-chart-frame")
      .attr("data-chart-frame", "")
      .attr("width", innerWidth)
      .attr("height", innerHeight);
    group
      .append("g")
      .attr("class", "etf-chart-axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(axisBottom(x).ticks(7).tickFormat((value) => timeFormat("%Y")(value as Date)));
    group
      .append("g")
      .attr("class", "etf-chart-axis")
      .call(axisLeft(y).ticks(7).tickFormat((value) => `${value}%`));
    group
      .append("g")
      .attr("class", "etf-chart-axis")
      .attr("transform", `translate(${innerWidth},0)`)
      .call(
        axisRight(y)
          .ticks(7)
          .tickFormat((value) => formatMoney(config.capital * (1 + Number(value) / 100), config.currencyPrefix)),
      );

    group
      .append("text")
      .attr("class", "etf-chart-axis-title")
      .attr("data-axis", "x")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 31)
      .attr("text-anchor", "middle")
      .text("年份");
    group
      .append("text")
      .attr("class", "etf-chart-axis-title")
      .attr("data-axis", "y")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -58)
      .attr("text-anchor", "middle")
      .text("相对初始本金（%）");
    group
      .append("text")
      .attr("class", "etf-chart-axis-title")
      .attr("data-axis", "y-right")
      .attr("transform", `translate(${innerWidth + 62},${innerHeight / 2}) rotate(90)`)
      .attr("text-anchor", "middle")
      .text(`实际金额（${config.currencyName}）`);
    group
      .append("text")
      .attr("class", "etf-chart-event-title")
      .attr("x", 0)
      .attr("y", -77)
      .text("重大事件区间（起点—终点）");

    const priceByMonth = new Map(config.prices.map((price) => [price.month, price]));
    for (const event of config.events) {
      const start = priceByMonth.get(event.start);
      const end = priceByMonth.get(event.end);
      if (!start || !end) continue;
      const x1 = x(parseMonth(start.month));
      const x2 = x(parseMonth(end.month));
      const yPosition = event.lane === 0 ? -49 : -19;
      const color = event.kind === "gain" ? "var(--etf-above)" : "var(--etf-below)";
      const change = calculateEventReturn(event, config.prices);
      const midpoint = (x1 + x2) / 2;
      let labelX = midpoint;
      let labelAnchor: "start" | "middle" | "end" = "middle";
      if (midpoint > innerWidth * 0.82) {
        labelX = innerWidth - 4;
        labelAnchor = "end";
      } else if (midpoint < innerWidth * 0.12) {
        labelX = 4;
        labelAnchor = "start";
      }
      const eventGroup = group
        .append("g")
        .attr("class", "etf-chart-event")
        .attr("data-event-band", event.name);
      eventGroup
        .append("line")
        .attr("x1", x1)
        .attr("x2", x2)
        .attr("y1", yPosition)
        .attr("y2", yPosition)
        .attr("stroke", color)
        .attr("stroke-width", 8)
        .attr("stroke-linecap", "round")
        .attr("stroke-opacity", 0.42);
      eventGroup
        .selectAll("circle")
        .data([x1, x2])
        .join("circle")
        .attr("cx", (value) => value)
        .attr("cy", yPosition)
        .attr("r", 3.2)
        .attr("fill", color);
      eventGroup
        .append("text")
        .attr("x", labelX)
        .attr("y", yPosition - 8)
        .attr("text-anchor", labelAnchor)
        .text(
          `${event.start.replace("-", ".")}–${event.end.replace("-", ".")} ${event.name} ${formatPercent(change)}%`,
        );
    }

    const waterline = y(0);
    const clipId = `etf-${config.key}`;
    const definitions = group.append("defs");
    definitions
      .append("clipPath")
      .attr("id", `${clipId}-above`)
      .append("rect")
      .attr("width", innerWidth)
      .attr("height", Math.max(0, waterline));
    definitions
      .append("clipPath")
      .attr("id", `${clipId}-below`)
      .append("rect")
      .attr("y", waterline)
      .attr("width", innerWidth)
      .attr("height", Math.max(0, innerHeight - waterline));
    const areaPath = area<(typeof series)[number]>()
      .x((point) => x(point.date))
      .y0(waterline)
      .y1((point) => y(point.pct));
    group
      .append("path")
      .datum(series)
      .attr("d", areaPath)
      .attr("fill", "var(--etf-above)")
      .attr("fill-opacity", 0.18)
      .attr("clip-path", `url(#${clipId}-above)`);
    group
      .append("path")
      .datum(series)
      .attr("d", areaPath)
      .attr("fill", "var(--etf-below)")
      .attr("fill-opacity", 0.22)
      .attr("clip-path", `url(#${clipId}-below)`);
    group
      .append("line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", waterline)
      .attr("y2", waterline)
      .attr("stroke", "var(--etf-waterline)")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "5 4");
    group
      .append("text")
      .attr("x", innerWidth - 4)
      .attr("y", waterline - 6)
      .attr("text-anchor", "end")
      .attr("fill", "var(--etf-foreground)")
      .attr("font-size", 11)
      .text(`${config.currencyPrefix}10,000 / 0% 水位线`);
    group
      .append("path")
      .datum(series)
      .attr("fill", "none")
      .attr("stroke", "var(--etf-line)")
      .attr("stroke-width", 2.2)
      .attr(
        "d",
        line<(typeof series)[number]>()
          .x((point) => x(point.date))
          .y((point) => y(point.pct)),
      );
    group
      .append("circle")
      .attr("cx", x(last.date))
      .attr("cy", y(last.pct))
      .attr("r", 3.5)
      .attr("fill", "var(--etf-background)")
      .attr("stroke", "var(--etf-line)")
      .attr("stroke-width", 2);

    const crosshair = group
      .append("line")
      .attr("class", "etf-chart-crosshair")
      .attr("data-chart-hover-guide", "")
      .attr("y1", 0)
      .attr("y2", innerHeight)
      .style("display", "none");
    const marker = group
      .append("circle")
      .attr("data-chart-hover-marker", "")
      .attr("r", 3.5)
      .attr("fill", "var(--etf-line)")
      .style("display", "none");
    let frameId: number | null = null;
    let pendingPointer: PendingPointer | null = null;
    let previousRawTime: number | null = null;

    const hidePointer = () => {
      pendingPointer = null;
      previousRawTime = null;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      crosshair.style("display", "none");
      marker.style("display", "none");
    };

    const renderPendingPointer = () => {
      frameId = null;
      const current = pendingPointer;
      pendingPointer = null;
      if (!current) return;

      const rawDate = x.invert(current.mouseX);
      const rawTime = rawDate.getTime();
      const direction: PointerDirection =
        previousRawTime === null || rawTime === previousRawTime
          ? 0
          : rawTime > previousRawTime
            ? 1
            : -1;
      previousRawTime = rawTime;

      const resolved = resolveHoverPoint(series, rawDate, direction);
      const resolvedX = x(resolved.date);
      crosshair.attr("x1", resolvedX).attr("x2", resolvedX).style("display", null);
      marker
        .attr("cx", resolvedX)
        .attr("cy", y(resolved.pct))
        .attr("r", resolved.snapKind ? 5 : 3.5)
        .attr("fill", resolved.snapKind ? "var(--etf-snap)" : "var(--etf-line)")
        .attr("data-snap-kind", resolved.snapKind ?? "")
        .style("display", null);

      const bounds = rootNode.getBoundingClientRect();
      const rawLeft = current.clientX - bounds.left + 12;
      const left = rawLeft + 230 > bounds.width - 8 ? Math.max(8, rawLeft - 254) : Math.max(8, rawLeft);
      setTooltip({
        amount: resolved.amount,
        dateLabel: formatHoverDate(resolved.date),
        left,
        pct: resolved.pct,
        snapKind: resolved.snapKind,
        top: Math.max(8, current.clientY - bounds.top + 12),
        visible: true,
      });
    };

    const hitArea = group
      .append("rect")
      .attr("data-chart-hit", "")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .attr("fill", "transparent")
      .on("pointermove", function (event: PointerEvent) {
        pendingPointer = {
          clientX: event.clientX,
          clientY: event.clientY,
          mouseX: Math.max(0, Math.min(innerWidth, pointer(event, this)[0])),
        };
        if (frameId === null) {
          frameId = requestAnimationFrame(renderPendingPointer);
        }
      })
      .on("pointerleave", () => {
        hidePointer();
        setTooltip((current) => ({ ...current, visible: false }));
      });

    return () => {
      hidePointer();
      hitArea.on("pointermove", null).on("pointerleave", null);
      svg.selectAll("*").remove();
    };
  }, [config, last, series]);

  return (
    <div className="etf-chart" ref={rootRef}>
      <div className="etf-chart-head">
        <h2>{config.heading}</h2>
        <p>{config.startLabel}</p>
      </div>
      <section className="etf-chart-panel">
        <div className="etf-chart-panel-head">
          <h3>{valueTitle}</h3>
          <p>{summaryParts.join(" · ")}</p>
        </div>
        <div className="etf-chart-legend" aria-label="图例">
          <span><i className="etf-legend-line" />实际金额</span>
          <span><i className="etf-legend-above" />高于本金</span>
          <span><i className="etf-legend-below" />低于本金</span>
          <span><i className="etf-legend-waterline" />{config.currencyPrefix}10,000水位线</span>
        </div>
        <div className="etf-chart-scroll">
          <svg ref={svgRef} role="img" aria-label={config.chartAriaLabel} />
        </div>
      </section>
      <p className="etf-chart-note">{config.note}</p>
      <div
        className="etf-chart-tooltip"
        role="tooltip"
        aria-hidden={tooltip.visible ? "false" : "true"}
        style={{ display: tooltip.visible ? "block" : "none", left: tooltip.left, top: tooltip.top }}
      >
        <b>
          {tooltip.dateLabel}
          {tooltip.snapKind ? ` · ${tooltip.snapKind === "high" ? "局部高点" : "局部低点"}` : ""}
        </b>
        <br />实际金额：{formatMoney(tooltip.amount, config.currencyPrefix)}
        <br />相对本金：{formatPercent(tooltip.pct)}%
        <br />状态：{tooltip.pct >= 0 ? "水上（盈利）" : "水下（亏损）"}
      </div>
    </div>
  );
}
