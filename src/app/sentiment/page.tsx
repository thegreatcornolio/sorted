import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Sentiment Pulse · SORTED.AI",
  description:
    "Illustrative near-time sentiment and NPS across voice, email, and WhatsApp. Sample view, not live client data.",
};

const MIX = [
  { key: "positive", label: "Positive", value: 58 },
  { key: "neutral", label: "Neutral", value: 27 },
  { key: "negative", label: "Negative", value: 15 },
] as const;

const TOPICS = [
  { label: "Service delay", count: 18, width: 82, tone: "is-delay" },
  { label: "Product fit", count: 11, width: 50, tone: "is-fit" },
] as const;

const DRIVERS = [
  { label: "Resolution time", value: 46, tone: "is-resolution" },
  { label: "Communication", value: 31, tone: "is-communication" },
  { label: "Product questions", value: 18, tone: "is-questions" },
] as const;

const POSITIVE = [44, 46, 45, 47, 49, 51, 48, 50, 53, 55, 53, 56, 54, 57, 56, 57, 58];
const NEGATIVE = [24, 22, 23, 21, 22, 25, 23, 20, 21, 18, 20, 19, 18, 17, 19, 16, 15];
const DAYS = [
  { index: 0, label: "Mon" },
  { index: 4, label: "Tue" },
  { index: 8, label: "Wed" },
  { index: 12, label: "Thu" },
  { index: 16, label: "Fri" },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Listen across channels",
    body: "Voice, email, and WhatsApp in one view.",
  },
  {
    n: "02",
    title: "Spot the shifts",
    body: "Positive and negative sentiment move across the week.",
  },
  {
    n: "03",
    title: "Follow the evidence",
    body: "Each shift points back to the customer line.",
  },
] as const;

export default function SentimentPage() {
  return (
    <div className="pulse-page">
      <SiteHeader current="sentiment">
        <span className="pulse-sample-pill">Illustrative sample</span>
      </SiteHeader>
      <main className="pulse">
        <section className="pulse-hero">
          <div className="wrap pulse-hero-grid">
            <div>
              <img className="trilogy-logo" src="/trilogy-logo.png" alt="Trilogy" width={4160} height={920} />
              <p className="pulse-kicker">Introducing a new customer signal</p>
              <h1>
                <span>Sentiment</span>
                <span className="pulse-accent">Pulse.</span>
              </h1>
              <p className="pulse-short">
                Hear how customers feel.
                <br />
                See what changes.
              </p>
              <p className="pulse-lede">Near-time sentiment and NPS across voice, email, and WhatsApp.</p>
              <p className="pulse-disclaimer">Illustrative sample. Not live client data.</p>
            </div>
            <SignalMark />
          </div>
        </section>

        <div className="wrap">
          <section className="pulse-board" aria-label="Sentiment Pulse illustrative view">
            <div className="pulse-board-head">
              <div className="pulse-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <h2>Sentiment Pulse</h2>
              <span className="pulse-badge">Illustrative view</span>
            </div>

            <div className="pulse-metrics">
              <article className="pulse-metric" aria-label="Sentiment mix">
                <p className="pulse-label">Sentiment mix</p>
                <p className="mix-legend">
                  {MIX.map((item) => (
                    <span key={item.key} className={`is-${item.key}`}>
                      <i className="mix-dot" style={{ background: mixColor(item.key) }} aria-hidden="true" />
                      {item.label} <b>{item.value}%</b>
                    </span>
                  ))}
                </p>
                <div className="mix-bar" aria-hidden="true">
                  {MIX.map((item) => (
                    <span key={item.key} className={`is-${item.key}`} style={{ width: `${item.value}%` }} />
                  ))}
                </div>
              </article>

              <article className="pulse-metric" aria-label="NPS signals">
                <p className="pulse-label">NPS signals</p>
                <div className="nps-pair">
                  <div>
                    <SignalArc sweep={0.8} color="#1f6b34" />
                    <span className="is-positive">Promoters</span>
                    <strong className="is-positive">64</strong>
                  </div>
                  <div>
                    <SignalArc sweep={0.34} color="#8e2f2a" />
                    <span className="is-negative">Detractors</span>
                    <strong className="is-negative">21</strong>
                  </div>
                </div>
              </article>

              <article className="pulse-metric" aria-label="Emerging topics">
                <p className="pulse-label">Emerging topics</p>
                {TOPICS.map((topic) => (
                  <div key={topic.label} className="topic">
                    <div className="topic-row">
                      <span>{topic.label}</span>
                      <strong>{topic.count}</strong>
                    </div>
                    <div className="bar-track" aria-hidden="true">
                      <span className={topic.tone} style={{ width: `${topic.width}%` }} />
                    </div>
                  </div>
                ))}
              </article>

              <article className="pulse-metric" aria-label="Evidence">
                <p className="pulse-label">Evidence</p>
                <p className="pulse-evidence">From conversation to business signal.</p>
                <p className="pulse-quote">“I asked on Monday and I am still waiting for a straight answer.”</p>
                <p className="meta pulse-quote-note">Illustrative line</p>
              </article>
            </div>

            <div className="pulse-split">
              <article className="pulse-chart" aria-labelledby="movement-heading">
                <div className="pulse-chart-head">
                  <h3 id="movement-heading">Sentiment movement</h3>
                  <p>Recent period</p>
                </div>
                <div className="pulse-legend">
                  <span>
                    <i className="swatch promoter" aria-hidden="true" /> Positive sentiment
                  </span>
                  <span>
                    <i className="swatch detractor" aria-hidden="true" /> Negative sentiment
                  </span>
                </div>
                <MovementChart />
                <p className="pulse-chart-note">
                  Friday closes at 58% positive and 15% negative. Neutral makes up the other 27%.
                </p>
                <table className="sr-only">
                  <caption>Illustrative sentiment by day. Not live client data.</caption>
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Positive</th>
                      <th>Negative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((day) => (
                      <tr key={day.label}>
                        <td>{day.label}</td>
                        <td>{POSITIVE[day.index]}%</td>
                        <td>{NEGATIVE[day.index]}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>

              <article className="pulse-drivers" aria-labelledby="drivers-heading">
                <div className="pulse-drivers-head">
                  <h3 id="drivers-heading">What’s driving it</h3>
                </div>
                <p className="driver-note">Mentioned in negative conversations. A conversation can count more than once.</p>
                {DRIVERS.map((driver) => (
                  <div key={driver.label} className="driver">
                    <div className="driver-top">
                      <span>{driver.label}</span>
                      <strong>{driver.value}%</strong>
                    </div>
                    <div className="bar-track" aria-hidden="true">
                      <span className={driver.tone} style={{ width: `${driver.value}%` }} />
                    </div>
                  </div>
                ))}
              </article>
            </div>
          </section>

          <ol className="pulse-steps">
            {STEPS.map((step) => (
              <li key={step.n}>
                <span className="step-no">{step.n}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="pulse-foot">
            <span>SORTED.AI · Sentiment Pulse</span>
            <span>Illustrative sample · Not live client data</span>
          </p>
        </div>
      </main>
    </div>
  );
}

function mixColor(key: "positive" | "neutral" | "negative") {
  if (key === "positive") return "#1f6b34";
  if (key === "neutral") return "#c4922a";
  return "#8e2f2a";
}

function SignalArc({ sweep, color }: { sweep: number; color: string }) {
  const radius = 16;
  const turn = 2 * Math.PI * radius;
  return (
    <svg className="signal-arc" viewBox="0 0 44 44" aria-hidden="true">
      <circle
        cx="22"
        cy="22"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${(sweep * turn).toFixed(2)} ${turn.toFixed(2)}`}
        transform="rotate(210 22 22)"
      />
    </svg>
  );
}

function SignalMark() {
  return (
    <div className="pulse-mark">
      <svg viewBox="0 0 320 280" aria-hidden="true">
        <circle cx="168" cy="132" r="118" fill="none" stroke="#61d779" strokeOpacity="0.35" strokeWidth="1.4" />
        <circle cx="168" cy="132" r="92" fill="none" stroke="#61d779" strokeOpacity="0.7" strokeWidth="1.4" />
        <circle cx="168" cy="132" r="66" fill="none" stroke="#1f6b34" strokeOpacity="0.28" strokeWidth="1.4" />
        <circle cx="168" cy="132" r="78" fill="#61d779" fillOpacity="0.09" />
        <circle cx="168" cy="14" r="6" fill="#61d779" />
        <circle cx="274" cy="74" r="5.5" fill="#d5ec67" />
        <circle cx="70" cy="206" r="5" fill="#c4922a" />
        <circle cx="250" cy="220" r="4.5" fill="#13202e" />
        <g transform="translate(102 78)">
          <rect x="0" y="0" width="132" height="90" rx="26" fill="#ffffff" stroke="#1f6b34" strokeWidth="2.75" />
          <path d="M46 88 L64 88 L54 110 Z" fill="#ffffff" stroke="#1f6b34" strokeWidth="2.75" strokeLinejoin="round" />
          <path d="M44 86 H68 V94 H44 Z" fill="#ffffff" />
          <polyline
            points="24,46 42,46 54,30 70,64 84,46 110,46"
            fill="none"
            stroke="#1f6b34"
            strokeWidth="3.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}

const CHART = { width: 640, height: 220, min: 0, max: 80, padL: 36, padR: 54, padT: 12, padB: 28 };

function chartPoint(values: number[], index: number): [number, number] {
  const plotRight = CHART.width - CHART.padR;
  const innerW = plotRight - CHART.padL;
  const innerH = CHART.height - CHART.padT - CHART.padB;
  const x = CHART.padL + (index / (values.length - 1)) * innerW;
  const y = CHART.padT + ((CHART.max - values[index]) / (CHART.max - CHART.min)) * innerH;
  return [x, y];
}

function smoothPath(values: number[]) {
  const points = values.map((_, index) => chartPoint(values, index));
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

function MovementChart() {
  const ticks = [20, 40, 60, 80];
  const yFor = (value: number) => {
    const innerH = CHART.height - CHART.padT - CHART.padB;
    return CHART.padT + ((CHART.max - value) / (CHART.max - CHART.min)) * innerH;
  };
  const plotRight = CHART.width - CHART.padR;
  const positiveEnd = chartPoint(POSITIVE, POSITIVE.length - 1);
  const negativeEnd = chartPoint(NEGATIVE, NEGATIVE.length - 1);
  return (
    <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} role="img" aria-label="Illustrative week. Positive sentiment rises from 44 on Monday to 58 on Friday. Negative sentiment falls from 24 to 15.">
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={CHART.padL} x2={plotRight} y1={yFor(tick)} y2={yFor(tick)} stroke="#e4ebf1" strokeWidth="1" />
          <text x="4" y={yFor(tick) + 4} fill="#5c6874" fontSize="11" fontFamily="ui-monospace, monospace">
            {tick}
          </text>
        </g>
      ))}
      <path d={smoothPath(POSITIVE)} fill="none" stroke="#1f6b34" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d={smoothPath(NEGATIVE)} fill="none" stroke="#8e2f2a" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={positiveEnd[0]} cy={positiveEnd[1]} r="3.5" fill="#1f6b34" />
      <circle cx={negativeEnd[0]} cy={negativeEnd[1]} r="3.5" fill="#8e2f2a" />
      <text x={positiveEnd[0] + 8} y={positiveEnd[1] + 4} fill="#1f6b34" fontSize="12" fontFamily="ui-monospace, monospace">
        58
      </text>
      <text x={negativeEnd[0] + 8} y={negativeEnd[1] + 4} fill="#8e2f2a" fontSize="12" fontFamily="ui-monospace, monospace">
        15
      </text>
      {DAYS.map((day) => {
        const [x] = chartPoint(POSITIVE, day.index);
        return (
          <text key={day.label} x={x} y={CHART.height - 6} textAnchor="middle" fill="#5c6874" fontSize="11" fontFamily="ui-monospace, monospace">
            {day.label}
          </text>
        );
      })}
    </svg>
  );
}
