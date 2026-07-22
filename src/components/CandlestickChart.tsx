import { CandlestickSeries, ColorType, createChart, TickMarkType, type IChartApi, type ISeriesApi, type Time, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { KlineCandle } from "../types/binance";

type CandlestickChartProps = {
  candles: KlineCandle[];
  onHoverCandle: (candle: KlineCandle | null) => void;
};

export function CandlestickChart({ candles, onHoverCandle }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const hasFittedContentRef = useRef(false);
  const latestCandleTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    hasFittedContentRef.current = false;
    latestCandleTimeRef.current = null;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 380,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#7a8492",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "transparent" },
        horzLines: { color: "#f0f2f5" },
      },
      rightPriceScale: {
        borderColor: "#edf0f2",
      },
      timeScale: {
        borderColor: "#edf0f2",
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 8,
        minBarSpacing: 5,
        rightOffset: 4,
        tickMarkFormatter: formatBeijingTick,
      },
      localization: {
        locale: "zh-CN",
        timeFormatter: formatBeijingTime,
      },
      crosshair: {
        vertLine: { color: "#a9b1bb", labelBackgroundColor: "#5f6975" },
        horzLine: { color: "#a9b1bb", labelBackgroundColor: "#5f6975" },
      },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#0ecb81",
      downColor: "#f6465d",
      borderVisible: false,
      wickUpColor: "#0ecb81",
      wickDownColor: "#f6465d",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry) {
        chart.resize(entry.contentRect.width, entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;

    if (!series) {
      return;
    }

    series.setData(
      candles.map((candle) => ({
        time: Math.floor(candle.openTime / 1000) as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    );

    const latestCandleTime = candles[candles.length - 1]?.openTime;

    if (latestCandleTime === undefined) {
      return;
    }

    if (!hasFittedContentRef.current) {
      chartRef.current?.timeScale().fitContent();
      hasFittedContentRef.current = true;
    } else if (latestCandleTimeRef.current !== null && latestCandleTime > latestCandleTimeRef.current) {
      chartRef.current?.timeScale().fitContent();
    }

    latestCandleTimeRef.current = latestCandleTime;
  }, [candles]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;

    if (!chart || !series) {
      return;
    }

    const candlesByTime = new Map(candles.map((candle) => [Math.floor(candle.openTime / 1000), candle]));
    const handleCrosshairMove: Parameters<typeof chart.subscribeCrosshairMove>[0] = (parameter) => {
      const data = parameter.seriesData.get(series);
      const time = data?.time;
      onHoverCandle(typeof time === "number" ? candlesByTime.get(time) ?? null : null);
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
    };
  }, [candles, onHoverCandle]);

  return <div ref={containerRef} className="candlestick-chart" aria-label="Candlestick chart" />;
}

function formatBeijingTick(time: Time, tickMarkType: TickMarkType) {
  if (typeof time !== "number") {
    return null;
  }

  const date = new Date(time * 1000);

  if (tickMarkType === TickMarkType.Time || tickMarkType === TickMarkType.TimeWithSeconds) {
    return beijingClockFormatter.format(date);
  }

  return beijingDateFormatter.format(date);
}

function formatBeijingTime(time: Time) {
  if (typeof time !== "number") {
    return "";
  }

  return beijingDateTimeFormatter.format(new Date(time * 1000));
}

const beijingDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "2-digit",
  day: "2-digit",
});

const beijingClockFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const beijingDateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
