import type { DailyOhlcPoint } from '../../lib/formatters';

type YAxisLike = {
  scale: (v: number) => number;
};

export type CandlestickShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: DailyOhlcPoint;
  yAxis?: YAxisLike;
};

/**
 * Recharts <Bar shape={...} /> — uses yAxis.scale for OHLC → pixels.
 * dataKey should return [low, high] so layout matches the wick span.
 */
export function CandlestickShape(props: unknown) {
  const raw = props as CandlestickShapeProps;
  const { x = 0, width = 0, payload, yAxis } = raw;
  if (!payload || !yAxis?.scale) return <g />;

  const { open, high, low, close } = payload;
  const cx = x + width / 2;
  const yHigh = yAxis.scale(high);
  const yLow = yAxis.scale(low);
  const yOpen = yAxis.scale(open);
  const yClose = yAxis.scale(close);

  const bodyTop = Math.min(yOpen, yClose);
  const bodyH = Math.max(Math.abs(yClose - yOpen), 1);
  const bodyW = Math.max(width * 0.62, 4);
  const bodyX = cx - bodyW / 2;

  const bull = close >= open;
  const fill = bull ? 'var(--rb-inflow, #4ade80)' : 'var(--rb-danger, #fb7185)';
  const stroke = bull ? 'var(--rb-inflow, #4ade80)' : 'var(--rb-danger, #fb7185)';

  return (
    <g className="recharts-candlestick">
      <line
        x1={cx}
        x2={cx}
        y1={yHigh}
        y2={yLow}
        stroke="var(--rb-text-muted, rgba(255,255,255,0.45))"
        strokeWidth={1}
      />
      <rect
        x={bodyX}
        y={bodyTop}
        width={bodyW}
        height={bodyH}
        fill={fill}
        stroke={stroke}
        strokeWidth={1}
        rx={1}
      />
    </g>
  );
}
