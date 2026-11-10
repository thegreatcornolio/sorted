import { movementLabel, type PulseCall } from "@/lib/live-pulse";

function csatBand(csat: number): "negative" | "neutral" | "positive" {
  if (csat <= 2) return "negative";
  if (csat === 3) return "neutral";
  return "positive";
}

export function LiveCallDetail({ call, onClose }: { call: PulseCall; onClose: () => void }) {
  const band = call.csat == null ? null : csatBand(call.csat);
  return (
    <div className="sheet" role="presentation" onClick={onClose}>
      <div
        className="sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="call-title"
        data-testid="live-call-detail"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-top">
          <div>
            <p className="eyebrow">Scored transcript · {movementLabel(call.scoredAt)}</p>
            <h2 id="call-title">{call.file}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} data-testid="close-live-call">
            Close
          </button>
        </div>
        <div className="score-grid">
          <article>
            <span>NPS band</span>
            <strong data-testid="live-call-band">{call.npsBand}</strong>
          </article>
          <article>
            <span>CSAT</span>
            <strong data-testid="live-call-csat">
              {call.csat ?? "—"}
              {call.csat != null ? <small> / 5</small> : null}
            </strong>
            {band ? <em className="meta">{band}</em> : null}
          </article>
        </div>
        <section className="why">
          <h3>Why this score</h3>
          <p>{call.reason ?? "No reason was recorded."}</p>
          {call.quote ? (
            <blockquote>
              <p>{call.quote}</p>
            </blockquote>
          ) : (
            <p className="meta">No quote was recorded.</p>
          )}
        </section>
      </div>
    </div>
  );
}
