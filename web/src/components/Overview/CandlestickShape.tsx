import type { DailyOhlcPoint } from '../../lib/formatters';

export type CandlestickShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: DailyOhlcPoint;
};

/**
 * Recharts <Bar shape={...} /> — `yAxis` is stripped by filterProps before it
 * reaches custom shapes, so we map OHLC using the bar's pixel span (low→high).
 * Bar dataKey must return [low, high] for horizontal layout.
 */
export function CandlestickShape(props: unknown) {
  const raw = props as CandlestickShapeProps;
  const { x = 0, y = 0, width = 0, height = 0, payload } = raw;
  if (!payload) return <g />;

  const { open, high, low, close } = payload;
  const lo = Math.min(low, high);
  const hi = Math.max(low, high);
  const span = hi - lo;
  /** Pixel Y for balance value `v` along the bar (Recharts: y + height spans low→high). */
  const yFor = (v: number) => {
    if (!Number.isFinite(v)) return y + height / 2;
    if (Math.abs(span) < 1e-9) return y + height / 2;
    const clamped = Math.min(hi, Math.max(lo, v));
    return y + (height * (hi - clamped)) / span;
  };

  const cx = x + width / 2;
  const yHigh = yFor(high);
  const yLow = yFor(low);
  const yOpen = yFor(open);
  const yClose = yFor(close);

  const bodyTop = Math.min(yOpen, yClose);
  const bodyH = Math.max(Math.abs(yClose - yOpen), 1);
  /** Narrow candle body: ~22–28% of slot, hard-capped so bars stay slim. */
  const bodyW = Math.min(Math.max(width * 0.24, 1.5), 5.5);
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
        strokeWidth={0.85}
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
