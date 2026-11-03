type Point = { nps: number; company: string };

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { l: 32, r: 12, t: 16, b: 28 };

function yFor(nps: number) {
  const inner = HEIGHT - PAD.t - PAD.b;
  return PAD.t + ((10 - nps) / 10) * inner;
}

export function NpsChart({ points, average }: { points: Point[]; average: number | null }) {
  const innerW = WIDTH - PAD.l - PAD.r;
  const xFor = (index: number) => {
    if (points.length <= 1) return PAD.l + innerW / 2;
    return PAD.l + (index / (points.length - 1)) * innerW;
  };
  const line = points.map((point, index) => `${xFor(index)},${yFor(point.nps)}`).join(" ");
  let running = 0;
  const averageLine = points
    .map((point, index) => {
      running += point.nps;
      return `${xFor(index)},${yFor(running / (index + 1))}`;
    })
    .join(" ");

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={
          points.length === 0
            ? "NPS chart is empty. Scores plot as transcripts arrive."
            : `Primary live score, NPS from 0 to 10. ${points.length} transcripts plotted. Average NPS ${average?.toFixed(1) ?? "unavailable"}.`
        }
      >
        {[0, 2, 4, 6, 8, 10].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.l}
              x2={WIDTH - PAD.r}
              y1={yFor(tick)}
              y2={yFor(tick)}
              stroke="#e4ebf1"
              strokeWidth="1"
            />
            <text x={4} y={yFor(tick) + 4} fill="#5c6874" fontSize="11" fontFamily="ui-monospace, monospace">
              {tick}
            </text>
          </g>
        ))}
        {points.length > 1 ? (
          <>
            <polyline fill="none" stroke="#9aa8b5" strokeWidth="2" points={line} />
            <polyline
              fill="none"
              stroke="#0b121a"
              strokeWidth="2"
              strokeDasharray="5 4"
              points={averageLine}
            />
          </>
        ) : null}
        {points.map((point, index) => {
          const color = point.nps >= 9 ? "#1f6b34" : point.nps >= 7 ? "#c4922a" : "#8e2f2a";
          const last = index === points.length - 1;
          return (
            <circle
              key={`${point.company}-${index}`}
              cx={xFor(index)}
              cy={yFor(point.nps)}
              r={last ? 6 : 4.5}
              fill={color}
              stroke="white"
              strokeWidth="1.5"
            >
              <title>{`${point.company}: NPS ${point.nps}`}</title>
            </circle>
          );
        })}
        <text x={PAD.l} y={HEIGHT - 8} fill="#5c6874" fontSize="11">
          Arrival order · solid calls, dashed running average
        </text>
      </svg>
    </div>
  );
}
