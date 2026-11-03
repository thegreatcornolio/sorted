type Point = { value: number; company: string };

const WIDTH = 640;
const HEIGHT = 200;
const PAD = { l: 32, r: 12, t: 14, b: 26 };

export function ScoreChart({
  points,
  average,
  min,
  max,
  label,
}: {
  points: Point[];
  average: number | null;
  min: number;
  max: number;
  label: string;
}) {
  const innerW = WIDTH - PAD.l - PAD.r;
  const yFor = (value: number) => {
    const inner = HEIGHT - PAD.t - PAD.b;
    const clamped = Math.min(max, Math.max(min, value));
    return PAD.t + ((max - clamped) / (max - min)) * inner;
  };
  const xFor = (index: number) => {
    if (points.length <= 1) return PAD.l + innerW / 2;
    return PAD.l + (index / (points.length - 1)) * innerW;
  };
  const line = points.map((point, index) => `${xFor(index)},${yFor(point.value)}`).join(" ");
  let running = 0;
  const averageLine = points
    .map((point, index) => {
      running += point.value;
      return `${xFor(index)},${yFor(running / (index + 1))}`;
    })
    .join(" ");
  const ticks = label === "CSAT" ? [1, 2, 3, 4, 5] : [0, 2, 4, 6, 8, 10];

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={
          points.length === 0
            ? `${label} chart is empty.`
            : `${label} by arriving call. Average ${average?.toFixed(1) ?? "unavailable"}.`
        }
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.l} x2={WIDTH - PAD.r} y1={yFor(tick)} y2={yFor(tick)} stroke="#e4ebf1" strokeWidth="1" />
            <text x={4} y={yFor(tick) + 4} fill="#5c6874" fontSize="11" fontFamily="ui-monospace, monospace">
              {tick}
            </text>
          </g>
        ))}
        {points.length > 1 ? (
          <>
            <polyline fill="none" stroke="#9aa8b5" strokeWidth="2" points={line} />
            <polyline fill="none" stroke="#0b121a" strokeWidth="2" strokeDasharray="5 4" points={averageLine} />
          </>
        ) : null}
        {points.map((point, index) => {
          const span = max - min;
          const amount = (point.value - min) / span;
          const color = amount >= 0.75 ? "#1f6b34" : amount >= 0.45 ? "#c4922a" : "#8e2f2a";
          const last = index === points.length - 1;
          return (
            <circle key={`${point.company}-${index}`} cx={xFor(index)} cy={yFor(point.value)} r={last ? 5.5 : 3.4} fill={color} stroke="white" strokeWidth="1.2">
              <title>{`${point.company}: ${label} ${point.value}`}</title>
            </circle>
          );
        })}
        <text x={PAD.l} y={HEIGHT - 6} fill="#5c6874" fontSize="11">
          Each call · dashed line is the running average
        </text>
      </svg>
    </div>
  );
}
