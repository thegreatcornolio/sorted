import { gaugeColor } from "@/lib/analyze";

const RADIUS = 78;
const ARC = Math.PI * RADIUS;

export function ScoreDial({
  label,
  value,
  min,
  max,
  caption,
  digits = 1,
  signed = false,
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  caption?: string;
  digits?: number;
  signed?: boolean;
}) {
  const amount = value === null ? 0 : (value - min) / (max - min);
  const color = value === null ? "#c5ced6" : gaugeColor(amount);
  const dash = `${Math.max(0, Math.min(1, amount)) * ARC} ${ARC}`;
  const shown =
    value === null ? "—" : `${signed && value > 0 ? "+" : ""}${value.toFixed(digits)}`;

  return (
    <article className="dial-card" aria-label={value === null ? `${label} dial waiting for interactions` : `${label} ${shown} out of ${max}`}>
      <p className="eyebrow">{label}</p>
      <svg viewBox="0 0 200 124" className="dial" role="img">
        <path d="M22 108 A78 78 0 0 1 178 108" fill="none" stroke="#e6edf2" strokeWidth="16" strokeLinecap="round" />
        <path
          d="M22 108 A78 78 0 0 1 178 108"
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={dash}
        />
        <text x="100" y="96" textAnchor="middle" fontSize="32" fontFamily="ui-monospace, monospace" fill="#13202e">
          {shown}
        </text>
        <text x="100" y="116" textAnchor="middle" fontSize="12" fill="#5c6874">
          {min}–{max}
        </text>
      </svg>
      {caption ? <p className="dial-caption">{caption}</p> : null}
    </article>
  );
}
