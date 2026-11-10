import Link from "next/link";
import type { PulsePoint, PulseView } from "@/lib/pulse";

const TOPIC_TONE = ["is-delay", "is-fit"] as const;
const DRIVER_TONE = ["is-resolution", "is-communication", "is-questions"] as const;
const CHART = { width: 640, height: 220, min: 0, max: 100, padL: 32, padR: 36, padT: 14, padB: 28 };

export function SentimentPulseCard({ pulse, evidenceHref }: { pulse: PulseView; evidenceHref?: string }) {
  const note = pulse.total ? movementNote(pulse) : "";
  return (
    <section className="pulse-board" aria-label="Sentiment Pulse" data-testid="sentiment-pulse">
      <div className="pulse-board-head">
        <div className="pulse-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h2>Sentiment Pulse</h2>
        <span className="pulse-badge">{pulse.total === 0 ? "Waiting" : `${pulse.total} ${pulse.total === 1 ? "interaction" : "interactions"}`}</span>
      </div>

      <div className="pulse-metrics">
        <article className="pulse-metric" aria-label="Sentiment mix">
          <p className="pulse-label">Sentiment mix</p>
          <p className="mix-legend" data-testid="pulse-mix">
            <span className="is-positive">
              <i className="mix-dot" style={{ background: "#1f6b34" }} aria-hidden="true" />
              Positive <b>{pulse.total ? `${pulse.mix.positive}%` : "—"}</b>
            </span>
            <span className="is-neutral">
              <i className="mix-dot" style={{ background: "#c4922a" }} aria-hidden="true" />
              Neutral <b>{pulse.total ? `${pulse.mix.neutral}%` : "—"}</b>
            </span>
            <span className="is-negative">
              <i className="mix-dot" style={{ background: "#8e2f2a" }} aria-hidden="true" />
              Negative <b>{pulse.total ? `${pulse.mix.negative}%` : "—"}</b>
            </span>
          </p>
          <div className="mix-bar" aria-hidden="true">
            {pulse.mix.positive > 0 ? <span className="is-positive" style={{ width: `${pulse.mix.positive}%` }} /> : null}
            {pulse.mix.neutral > 0 ? <span className="is-neutral" style={{ width: `${pulse.mix.neutral}%` }} /> : null}
            {pulse.mix.negative > 0 ? <span className="is-negative" style={{ width: `${pulse.mix.negative}%` }} /> : null}
          </div>
        </article>

        <article className="pulse-metric" aria-label="NPS signals">
          <p className="pulse-label">NPS signals</p>
          <div className="nps-pair">
            <div>
              <SignalArc sweep={pulse.total ? pulse.promoters / pulse.total : 0} color="#1f6b34" />
              <span className="is-positive">Promoters</span>
              <strong className="is-positive" data-testid="pulse-promoters">
                {pulse.promoters}
              </strong>
            </div>
            <div>
              <SignalArc sweep={pulse.total ? pulse.detractors / pulse.total : 0} color="#8e2f2a" />
              <span className="is-negative">Detractors</span>
              <strong className="is-negative" data-testid="pulse-detractors">
                {pulse.detractors}
              </strong>
            </div>
          </div>
        </article>

        <article className="pulse-metric" aria-label="Emerging topics">
          <p className="pulse-label">Emerging topics</p>
          {pulse.topics.length === 0 ? (
            <p className="pulse-empty">Topics appear when a detractor arrives.</p>
          ) : (
            pulse.topics.map((topic, index) => (
              <div key={topic.label} className="topic" data-testid="pulse-topic" data-reason={topic.label}>
                <div className="topic-row">
                  <span>{topic.label}</span>
                  <strong>{topic.count}</strong>
                </div>
                <div className="bar-track" aria-hidden="true">
                  <span className={TOPIC_TONE[index] ?? "is-delay"} style={{ width: `${topic.width}%` }} />
                </div>
              </div>
            ))
          )}
        </article>

        <article className="pulse-metric" aria-label="Evidence">
          <p className="pulse-label">Evidence</p>
          <p className="pulse-evidence">From conversation to business signal.</p>
          {pulse.evidence ? (
            <>
              {evidenceHref ? (
                <Link href={evidenceHref} className="pulse-quote" data-testid="pulse-quote">
                  “{pulse.evidence.quote}”
                </Link>
              ) : (
                <p className="pulse-quote" data-testid="pulse-quote">
                  “{pulse.evidence.quote}”
                </p>
              )}
              {pulse.evidence.company ? <p className="meta pulse-quote-note">{pulse.evidence.company}</p> : null}
            </>
          ) : (
            <p className="pulse-empty">A detractor line appears here when one arrives.</p>
          )}
        </article>
      </div>

      <div className="pulse-split">
        <article className="pulse-chart" aria-labelledby="movement-heading">
          <div className="pulse-chart-head">
            <h3 id="movement-heading">Sentiment movement</h3>
            <p>As they arrive</p>
          </div>
          <div className="pulse-legend">
            <span>
              <i className="swatch promoter" aria-hidden="true" /> Positive sentiment
            </span>
            <span>
              <i className="swatch detractor" aria-hidden="true" /> Negative sentiment
            </span>
          </div>
          {pulse.series.length === 0 ? (
            <p className="pulse-empty">Movement appears with the first interaction.</p>
          ) : (
            <MovementChart series={pulse.series} note={note} />
          )}
          {note ? <p className="pulse-chart-note">{note}</p> : null}
        </article>

        <article className="pulse-drivers" aria-labelledby="drivers-heading">
          <div className="pulse-drivers-head">
            <h3 id="drivers-heading">What’s driving it</h3>
          </div>
          <p className="driver-note">Share of negative conversations.</p>
          {pulse.drivers.length === 0 ? (
            <p className="pulse-empty">Shares appear when a negative conversation arrives.</p>
          ) : (
            pulse.drivers.map((driver, index) => (
              <div key={driver.label} className="driver" data-testid="pulse-driver" data-reason={driver.label}>
                <div className="driver-top">
                  <span>{driver.label}</span>
                  <strong>{driver.share}%</strong>
                </div>
                <div className="bar-track" aria-hidden="true">
                  <span className={DRIVER_TONE[index] ?? "is-resolution"} style={{ width: `${driver.share}%` }} />
                </div>
              </div>
            ))
          )}
        </article>
      </div>
    </section>
  );
}

function movementNote(pulse: PulseView): string {
  const noun = pulse.total === 1 ? "interaction" : "interactions";
  const base = `After ${pulse.total} ${noun}, positive is ${pulse.mix.positive}% and negative is ${pulse.mix.negative}%.`;
  if (pulse.mix.neutral === 0) return base;
  return `${base} Neutral makes up the other ${pulse.mix.neutral}%.`;
}

function SignalArc({ sweep, color }: { sweep: number; color: string }) {
  const radius = 16;
  const turn = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, sweep));
  return (
    <svg className="signal-arc" viewBox="0 0 44 44" aria-hidden="true">
      <circle cx="22" cy="22" r={radius} fill="none" stroke="#e4ebf1" strokeWidth="4" />
      {clamped > 0 ? (
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(clamped * turn).toFixed(2)} ${turn.toFixed(2)}`}
          transform="rotate(210 22 22)"
        />
      ) : null}
    </svg>
  );
}

function pointAt(series: PulsePoint[], index: number, key: "positive" | "negative"): [number, number] {
  const plotRight = CHART.width - CHART.padR;
  const innerW = plotRight - CHART.padL;
  const innerH = CHART.height - CHART.padT - CHART.padB;
  const x = series.length === 1 ? CHART.padL + innerW / 2 : CHART.padL + (index / (series.length - 1)) * innerW;
  const y = CHART.padT + ((CHART.max - series[index][key]) / (CHART.max - CHART.min)) * innerH;
  return [x, y];
}

function smoothPath(series: PulsePoint[], key: "positive" | "negative") {
  const points = series.map((_, index) => pointAt(series, index, key));
  const [start] = points;
  let path = `M ${start[0].toFixed(2)} ${start[1].toFixed(2)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    path += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return path;
}

function labelIndexes(length: number): number[] {
  if (length <= 1) return length === 1 ? [0] : [];
  if (length <= 5) return Array.from({ length }, (_, index) => index);
  return [...new Set([0, 0.25, 0.5, 0.75, 1].map((slot) => Math.round(slot * (length - 1))))];
}

function MovementChart({ series, note }: { series: PulsePoint[]; note: string }) {
  const ticks = [0, 25, 50, 75, 100];
  const yFor = (value: number) => {
    const innerH = CHART.height - CHART.padT - CHART.padB;
    return CHART.padT + ((CHART.max - value) / (CHART.max - CHART.min)) * innerH;
  };
  const plotRight = CHART.width - CHART.padR;
  const positiveEnd = pointAt(series, series.length - 1, "positive");
  const negativeEnd = pointAt(series, series.length - 1, "negative");
  const last = series[series.length - 1];
  let positiveLabelY = positiveEnd[1] + 4;
  let negativeLabelY = negativeEnd[1] + 4;
  if (Math.abs(positiveLabelY - negativeLabelY) < 12) {
    if (positiveLabelY <= negativeLabelY) {
      positiveLabelY -= 6;
      negativeLabelY += 6;
    } else {
      positiveLabelY += 6;
      negativeLabelY -= 6;
    }
  }
  return (
    <>
      <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} role="img" aria-label={note}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={CHART.padL} x2={plotRight} y1={yFor(tick)} y2={yFor(tick)} stroke="#e4ebf1" strokeWidth="1" />
            <text x="4" y={yFor(tick) + 4} fill="#5c6874" fontSize="11" fontFamily="ui-monospace, monospace">
              {tick}
            </text>
          </g>
        ))}
        {series.length > 1 ? (
          <>
            <path d={smoothPath(series, "positive")} fill="none" stroke="#1f6b34" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            <path d={smoothPath(series, "negative")} fill="none" stroke="#8e2f2a" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          </>
        ) : null}
        <circle cx={positiveEnd[0]} cy={positiveEnd[1]} r="3.5" fill="#1f6b34" />
        <circle cx={negativeEnd[0]} cy={negativeEnd[1]} r="3.5" fill="#8e2f2a" />
        <text x={positiveEnd[0] + 8} y={positiveLabelY} fill="#1f6b34" fontSize="12" fontFamily="ui-monospace, monospace">
          {last.positive}
        </text>
        <text x={negativeEnd[0] + 8} y={negativeLabelY} fill="#8e2f2a" fontSize="12" fontFamily="ui-monospace, monospace">
          {last.negative}
        </text>
        {labelIndexes(series.length).map((index) => {
          const [x] = pointAt(series, index, "positive");
          const anchor = series.length === 1 ? "middle" : index === 0 ? "start" : index === series.length - 1 ? "end" : "middle";
          return (
            <text key={series[index].time + index} x={x} y={CHART.height - 6} textAnchor={anchor} fill="#5c6874" fontSize="11" fontFamily="ui-monospace, monospace">
              {series[index].time}
            </text>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>{note}</caption>
        <thead>
          <tr>
            <th>Arrival</th>
            <th>Positive</th>
            <th>Negative</th>
          </tr>
        </thead>
        <tbody>
          {series.map((point, index) => (
            <tr key={`${point.time}-${index}`}>
              <td>{point.time}</td>
              <td>{point.positive}%</td>
              <td>{point.negative}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
